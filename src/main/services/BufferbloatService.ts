import { EventEmitter } from 'events'
import * as https from 'https'

export type BufferbloatSample = {
  t: number
  phase: 'idle' | 'load'
  pingMs: number
}

export type BufferbloatResult = {
  ts: number
  baselinePingMs: number
  loadedPingMs: number
  bufferbloatMs: number
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  samples: BufferbloatSample[]
}

export type BufferbloatStatus = {
  running: boolean
  lastError: string | null
  lastResult: BufferbloatResult | null
}

function httpsGetBytes(url: string, maxBytes: number, signal?: AbortSignal): Promise<{ ok: boolean; statusCode: number; bytes: number }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)

    let settled = false
    const safeResolve = (v: { ok: boolean; statusCode: number; bytes: number }) => {
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
        method: 'GET',
        headers: {
          'User-Agent': 'NovaOptimizer/1.0',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        rejectUnauthorized: false,
      },
      (res) => {
        let bytes = 0
        const statusCode = res.statusCode || 0

        res.on('data', (chunk: Buffer) => {
          bytes += chunk.length
          if (bytes >= maxBytes) {
            try {
              res.destroy()
            } catch {
              // ignore
            }
          }
        })
        res.on('end', () => {
          safeResolve({ ok: statusCode >= 200 && statusCode < 400, statusCode, bytes })
        })

        // If we destroy the response early (maxBytes), Node may emit 'close' without 'end'.
        res.on('close', () => {
          safeResolve({ ok: statusCode >= 200 && statusCode < 400, statusCode, bytes })
        })
      }
    )

    const onAbort = () => {
      try {
        req.destroy(new Error('Aborted'))
      } catch {
        // ignore
      }
    }

    if (signal) {
      if (signal.aborted) return onAbort()
      signal.addEventListener('abort', onAbort, { once: true })
    }

    req.on('error', (e) => safeReject(e))
    req.setTimeout(20000, () => {
      try {
        req.destroy(new Error('Request timeout'))
      } catch {
        // ignore
      }
    })
    req.end()
  })
}

async function pingOnce(url: string): Promise<number> {
  const t0 = performance.now()
  const r = await httpsGetBytes(url, 1024)
  if (!r.ok) throw new Error(`Ping failed (HTTP ${r.statusCode})`)
  return performance.now() - t0
}

async function firstWorkingEndpoint(urls: string[]) {
  let lastErr: any = null
  for (const url of urls) {
    try {
      const r = await httpsGetBytes(url, 2048)
      if (r.ok) return url
      lastErr = new Error(`HTTP ${r.statusCode}`)
    } catch (e) {
      lastErr = e
    }
  }
  throw new Error(String(lastErr?.message || lastErr || 'No reachable endpoint'))
}

function avg(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0) / Math.max(nums.length, 1)
}

function gradeForBufferbloat(ms: number): BufferbloatResult['grade'] {
  if (ms <= 5) return 'A+'
  if (ms <= 15) return 'A'
  if (ms <= 30) return 'B'
  if (ms <= 60) return 'C'
  if (ms <= 100) return 'D'
  return 'F'
}

export class BufferbloatService extends EventEmitter {
  private status: BufferbloatStatus = {
    running: false,
    lastError: null,
    lastResult: null,
  }

  private abort: AbortController | null = null

  getStatus() {
    return this.status
  }

  stop() {
    if (this.abort) {
      this.abort.abort()
      this.abort = null
    }
    this.status = { ...this.status, running: false }
    return this.status
  }

  async run(): Promise<BufferbloatResult> {
    if (this.status.running) throw new Error('Bufferbloat test already running')

    this.status = { ...this.status, running: true, lastError: null }
    this.abort = new AbortController()

    const pingUrl = await firstWorkingEndpoint([
      'https://www.google.com/generate_204',
      'https://clients3.google.com/generate_204',
      'https://www.cloudflare.com/cdn-cgi/trace',
      'https://1.1.1.1/',
    ])

    const loadUrl = await firstWorkingEndpoint([
      'https://speed.cloudflare.com/__down?bytes=10000000',
      'https://speed.hetzner.de/100MB.bin',
    ])

    const samples: BufferbloatSample[] = []
    const started = performance.now()

    const pushSample = (phase: BufferbloatSample['phase'], pingMs: number) => {
      const s: BufferbloatSample = { t: Math.round(performance.now() - started), phase, pingMs: Math.round(pingMs * 10) / 10 }
      samples.push(s)
      this.emit('sample', s)
    }

    try {
      // Baseline phase
      const idlePings: number[] = []
      for (let i = 0; i < 10; i++) {
        const p = await pingOnce(pingUrl)
        idlePings.push(p)
        pushSample('idle', p)
        await new Promise((r) => setTimeout(r, 180))
      }

      const baselinePingMs = Math.round(avg(idlePings) * 10) / 10

      // Load phase: start a download while sampling ping.
      const loadPromise = httpsGetBytes(loadUrl, 10 * 1024 * 1024, this.abort.signal).catch(() => null)

      const loadedPings: number[] = []
      const loadStart = performance.now()
      while (performance.now() - loadStart < 6000) {
        if (this.abort.signal.aborted) throw new Error('Aborted')
        const p = await pingOnce(pingUrl)
        loadedPings.push(p)
        pushSample('load', p)
        await new Promise((r) => setTimeout(r, 180))
      }

      await loadPromise

      const loadedPingMs = Math.round(avg(loadedPings) * 10) / 10
      const bufferbloatMs = Math.max(0, Math.round((loadedPingMs - baselinePingMs) * 10) / 10)
      const grade = gradeForBufferbloat(bufferbloatMs)

      const result: BufferbloatResult = {
        ts: Date.now(),
        baselinePingMs,
        loadedPingMs,
        bufferbloatMs,
        grade,
        samples,
      }

      this.status = { running: false, lastError: null, lastResult: result }
      this.abort = null
      return result
    } catch (e: any) {
      const msg = String(e?.message || e)
      this.status = { ...this.status, running: false, lastError: msg }
      this.abort = null
      throw new Error(msg)
    }
  }
}
