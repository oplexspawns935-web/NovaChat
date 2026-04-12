import { randomBytes } from 'crypto'
import * as https from 'https'
import { EventEmitter } from 'events'

export type SpeedtestResult = {
  ts: number
  pingMs: number | null
  jitterMs: number | null
  downloadMbps: number | null
  uploadMbps: number | null
  serverName: string | null
  isp: string | null
  raw?: any
}

export type SpeedtestSample = {
  t: number
  phase: 'ping' | 'download' | 'upload' | 'done'
  pingMs?: number
  jitterMs?: number
  downloadMbps?: number
  uploadMbps?: number
}

export type SpeedtestStatus = {
  running: boolean
  lastError: string | null
  lastResult: SpeedtestResult | null
}

function httpsRequestBytes(
  url: string,
  opts: { method: 'GET' | 'POST'; body?: Buffer; maxBytes?: number }
): Promise<{ ok: boolean; statusCode: number; bytes: number; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const started = performance.now()

    let settled = false
    const safeResolve = (v: { ok: boolean; statusCode: number; bytes: number; durationMs: number }) => {
      if (settled) return
      settled = true
      resolve(v)
    }
    const safeReject = (e: any) => {
      if (settled) return
      settled = true
      reject(e)
    }

    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port ? Number(u.port) : undefined,
        path: u.pathname + u.search,
        method: opts.method,
        headers: {
          'User-Agent': 'NovaOptimizer/1.0',
          ...(opts.body ? { 'Content-Length': String(opts.body.byteLength) } : {}),
        },
        rejectUnauthorized: false,
      },
      (res) => {
        let bytes = 0
        res.on('data', (chunk: Buffer) => {
          bytes += chunk.length
          if (opts.maxBytes && bytes >= opts.maxBytes) {
            try {
              res.destroy()
            } catch {
              // ignore
            }
          }
        })
        res.on('end', () => {
          const durationMs = Math.max(performance.now() - started, 0)
          safeResolve({ ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 400, statusCode: res.statusCode || 0, bytes, durationMs })
        })

        res.on('close', () => {
          const durationMs = Math.max(performance.now() - started, 0)
          safeResolve({ ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 400, statusCode: res.statusCode || 0, bytes, durationMs })
        })
      }
    )

    req.on('error', (e) => safeReject(e))
    req.setTimeout(25000, () => {
      try {
        req.destroy(new Error('Request timeout'))
      } catch {
        // ignore
      }
    })

    if (opts.body) req.write(opts.body)
    req.end()
  })
}

async function firstWorkingEndpoint(urls: string[], method: 'GET' | 'POST') {
  let lastErr: any = null
  for (const url of urls) {
    try {
      const r = await httpsRequestBytes(url, { method, maxBytes: 1024 })
      if (r.ok) return url
      lastErr = new Error(`HTTP ${r.statusCode}`)
    } catch (e) {
      lastErr = e
    }
  }
  throw new Error(String(lastErr?.message || lastErr || 'No reachable speedtest endpoint'))
}

export class SpeedtestService extends EventEmitter {
  private status: SpeedtestStatus = {
    running: false,
    lastError: null,
    lastResult: null,
  }

  private startedAtPerf: number | null = null

  getStatus() {
    return this.status
  }

  private emitSample(sample: SpeedtestSample) {
    this.emit('sample', sample)
  }

  private tNow() {
    if (this.startedAtPerf == null) return 0
    return Math.round(performance.now() - this.startedAtPerf)
  }

  async run(): Promise<SpeedtestResult> {
    if (this.status.running) throw new Error('Speedtest already running')

    this.status = { ...this.status, running: true, lastError: null }
    try {
      this.startedAtPerf = performance.now()
      const now = Date.now()
      const downloadCandidates = [
        'https://speed.cloudflare.com/__down?bytes=25000000',
        'https://speed.hetzner.de/100MB.bin',
      ]

      const uploadCandidates = [
        'https://speed.cloudflare.com/__up',
        'https://httpbin.org/post',
      ]

      const pingCandidates = [
        'https://www.google.com/generate_204',
        'https://clients3.google.com/generate_204',
        'https://www.cloudflare.com/cdn-cgi/trace',
        'https://1.1.1.1/',
      ]

      const pingUrl = await firstWorkingEndpoint(pingCandidates, 'GET')
      const downloadUrl = await firstWorkingEndpoint(downloadCandidates, 'GET')

      this.emitSample({ t: this.tNow(), phase: 'ping' })

      const pingSamples: number[] = []
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now()
        const r = await httpsRequestBytes(pingUrl, { method: 'GET', maxBytes: 2048 })
        if (!r.ok) throw new Error('Ping failed')
        const t1 = performance.now()
        pingSamples.push(t1 - t0)

        const avgPing = pingSamples.reduce((a, b) => a + b, 0) / pingSamples.length
        const jitter =
          pingSamples.length > 1
            ? pingSamples
                .slice(1)
                .map((v, idx) => Math.abs(v - pingSamples[idx - 1]))
                .reduce((a, b) => a + b, 0) /
              (pingSamples.length - 1)
            : 0

        this.emitSample({
          t: this.tNow(),
          phase: 'ping',
          pingMs: Math.round(avgPing * 10) / 10,
          jitterMs: Math.round(jitter * 10) / 10,
        })
      }

      const pingMs = pingSamples.length ? Math.round((pingSamples.reduce((a, b) => a + b, 0) / pingSamples.length) * 10) / 10 : null
      const jitterMs =
        pingSamples.length > 1
          ? Math.round(
              (pingSamples
                .slice(1)
                .map((v, idx) => Math.abs(v - pingSamples[idx - 1]))
                .reduce((a, b) => a + b, 0) /
                (pingSamples.length - 1)) *
                10
            ) / 10
          : null

      // Download test: stream for a short duration and emit live Mbps.
      this.emitSample({ t: this.tNow(), phase: 'download' })
      const downloadMbps = await this.runStreamingDownload(downloadUrl)

      // Upload test: POST random bytes to a public echo endpoint.
      // Note: some networks block this; we treat failure as "upload unavailable".
      let uploadMbps: number | null = null
      try {
        this.emitSample({ t: this.tNow(), phase: 'upload' })
        const uploadUrl = await firstWorkingEndpoint(uploadCandidates, 'POST')
        uploadMbps = await this.runStreamingUpload(uploadUrl)
      } catch {
        uploadMbps = null
      }

      const res: SpeedtestResult = {
        ts: now,
        pingMs,
        jitterMs,
        downloadMbps,
        uploadMbps,
        serverName: 'Cloudflare / Hetzner',
        isp: null,
        raw: { pingUrl, downloadUrl },
      }

      this.emitSample({
        t: this.tNow(),
        phase: 'done',
        pingMs: res.pingMs ?? undefined,
        jitterMs: res.jitterMs ?? undefined,
        downloadMbps: res.downloadMbps ?? undefined,
        uploadMbps: res.uploadMbps ?? undefined,
      })

      this.status = { running: false, lastError: null, lastResult: res }
      this.startedAtPerf = null
      return res
    } catch (e: any) {
      const msg = String(e?.message || e)
      this.status = { ...this.status, running: false, lastError: msg }
      this.startedAtPerf = null
      throw new Error(msg)
    }
  }

  private runStreamingDownload(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const u = new URL(url)
      const started = performance.now()
      let bytes = 0
      let lastBytes = 0
      let lastAt = started

      const tick = () => {
        const now = performance.now()
        const dt = Math.max((now - lastAt) / 1000, 0.001)
        const dBytes = bytes - lastBytes
        const mbps = Math.round(((dBytes * 8) / 1_000_000 / dt) * 10) / 10
        this.emitSample({ t: this.tNow(), phase: 'download', downloadMbps: mbps })
        lastBytes = bytes
        lastAt = now
      }

      const interval = setInterval(tick, 250)

      let settled = false
      const safeResolve = (v: number) => {
        if (settled) return
        settled = true
        clearInterval(interval)
        resolve(v)
      }
      const safeReject = (e: any) => {
        if (settled) return
        settled = true
        clearInterval(interval)
        reject(e)
      }

      const req = https.request(
        {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port ? Number(u.port) : undefined,
          path: u.pathname + u.search,
          method: 'GET',
          headers: {
            'User-Agent': 'NovaOptimizer/1.0',
            'Cache-Control': 'no-store',
            Pragma: 'no-cache',
          },
          rejectUnauthorized: false,
        },
        (res) => {
          const statusCode = res.statusCode || 0
          if (statusCode < 200 || statusCode >= 400) {
            res.resume()
            return safeReject(new Error(`Download failed (HTTP ${statusCode})`))
          }

          res.on('data', (chunk: Buffer) => {
            bytes += chunk.length

            // Stop after ~6 seconds to keep it responsive.
            if (performance.now() - started > 6000) {
              try {
                res.destroy()
              } catch {
                // ignore
              }
            }
          })

          const finish = () => {
            const seconds = Math.max((performance.now() - started) / 1000, 0.001)
            const avgMbps = Math.round(((bytes * 8) / 1_000_000 / seconds) * 10) / 10
            safeResolve(avgMbps)
          }

          res.on('end', finish)
          res.on('close', finish)
        }
      )

      req.on('error', (e) => {
        safeReject(e)
      })
      req.setTimeout(25000, () => {
        try {
          req.destroy(new Error('Download timeout'))
        } catch {
          // ignore
        }
      })
      req.end()
    })
  }

  private runStreamingUpload(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const u = new URL(url)
      const body = randomBytes(5 * 1024 * 1024)
      const started = performance.now()
      let sent = 0
      let lastSent = 0
      let lastAt = started

      const tick = () => {
        const now = performance.now()
        const dt = Math.max((now - lastAt) / 1000, 0.001)
        const dBytes = sent - lastSent
        const mbps = Math.round(((dBytes * 8) / 1_000_000 / dt) * 10) / 10
        this.emitSample({ t: this.tNow(), phase: 'upload', uploadMbps: mbps })
        lastSent = sent
        lastAt = now
      }

      const interval = setInterval(tick, 250)

      let settled = false
      const safeResolve = (v: number) => {
        if (settled) return
        settled = true
        clearInterval(interval)
        resolve(v)
      }
      const safeReject = (e: any) => {
        if (settled) return
        settled = true
        clearInterval(interval)
        reject(e)
      }

      const req = https.request(
        {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port ? Number(u.port) : undefined,
          path: u.pathname + u.search,
          method: 'POST',
          headers: {
            'User-Agent': 'NovaOptimizer/1.0',
            'Content-Length': String(body.byteLength),
            'Cache-Control': 'no-store',
            Pragma: 'no-cache',
          },
          rejectUnauthorized: false,
        },
        (res) => {
          const statusCode = res.statusCode || 0
          res.on('data', () => {
            // drain
          })
          res.on('end', () => {
            if (statusCode < 200 || statusCode >= 400) return safeReject(new Error(`Upload failed (HTTP ${statusCode})`))
            const seconds = Math.max((performance.now() - started) / 1000, 0.001)
            const avgMbps = Math.round(((sent * 8) / 1_000_000 / seconds) * 10) / 10
            safeResolve(avgMbps)
          })
        }
      )

      req.on('error', (e) => {
        safeReject(e)
      })
      req.setTimeout(25000, () => {
        try {
          req.destroy(new Error('Upload timeout'))
        } catch {
          // ignore
        }
      })

      // Write in chunks so we can emit progress.
      const chunkSize = 64 * 1024
      let offset = 0
      const writeNext = () => {
        if (offset >= body.length) {
          req.end()
          return
        }
        const end = Math.min(offset + chunkSize, body.length)
        const chunk = body.subarray(offset, end)
        offset = end
        sent = offset
        const ok = req.write(chunk)
        if (!ok) req.once('drain', writeNext)
        else setImmediate(writeNext)
      }

      writeNext()
    })
  }
}
