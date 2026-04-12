import React from 'react'
import { Card } from '../components/Card'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function SpeedtestPage() {
  const [running, setRunning] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<any>(null)
  const [live, setLive] = React.useState<any>(null)
  const [samples, setSamples] = React.useState<any[]>([])
  const [netInfo, setNetInfo] = React.useState<any>(null)

  const [bbRunning, setBbRunning] = React.useState(false)
  const [bbError, setBbError] = React.useState<string | null>(null)
  const [bbResult, setBbResult] = React.useState<any>(null)
  const [bbSamples, setBbSamples] = React.useState<any[]>([])
  const [bbCurrentPhase, setBbCurrentPhase] = React.useState<'idle' | 'load' | null>(null)
  const [bbCurrentPing, setBbCurrentPing] = React.useState<number | null>(null)

  async function refresh() {
    const s = await window.netflux.getSpeedtestStatus()
    setRunning(!!s?.running)
    setError(s?.lastError ? String(s.lastError) : null)
    setResult(s?.lastResult ?? result)
  }

  async function startBufferbloat() {
    setBbError(null)
    setBbResult(null)
    setBbSamples([])
    setBbRunning(true)
    try {
      const res = await window.netflux.startBufferbloat()
      setBbResult(res?.result ?? null)
      setBbSamples(res?.result?.samples ?? bbSamples)
    } catch (e: any) {
      setBbError(String(e?.message || e))
    } finally {
      setBbRunning(false)
    }
  }

  async function stopBufferbloat() {
    try {
      await window.netflux.stopBufferbloat()
    } finally {
      setBbRunning(false)
    }
  }

  React.useEffect(() => {
    refresh()
    const t = setInterval(refresh, 1500)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    const load = async () => {
      try {
        const info = await window.netflux.getNetworkInfo()
        setNetInfo(info)
      } catch {
        setNetInfo(null)
      }
    }
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])

  React.useEffect(() => {
    const off = window.netflux.onSpeedtestSample((sample: any) => {
      setLive((prev: any) => ({ ...prev, ...sample }))
      setSamples((prev) => {
        const next = [...prev, sample]
        return next.length > 250 ? next.slice(next.length - 250) : next
      })
    })
    return () => off()
  }, [])

  React.useEffect(() => {
    window.netflux.getBufferbloatStatus().then((s: any) => {
      setBbRunning(!!s?.running)
      setBbError(s?.lastError ? String(s.lastError) : null)
      setBbResult(s?.lastResult ?? null)
      setBbSamples(s?.lastResult?.samples ?? [])
    })

    const off = window.netflux.onBufferbloatSample((sample: any) => {
      setBbCurrentPhase(sample.phase || null)
      setBbCurrentPing(sample.pingMs || null)
      setBbSamples((prev) => {
        const next = [...prev, sample]
        return next.length > 200 ? next.slice(next.length - 200) : next
      })
    })
    return () => off()
  }, [])

  async function run() {
    setError(null)
    setRunning(true)
    setLive(null)
    setSamples([])
    try {
      const res = await window.netflux.runSpeedtest()
      setResult(res?.result ?? null)
      await refresh()
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Card 
        title="Network Speedtest" 
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonBlue/10 to-transparent blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-white/70">Real speed test (ping / jitter / download / upload).</div>
            <button className="btn-primary" onClick={run} disabled={running}>
              {running ? 'Running…' : 'Run Speedtest'}
            </button>
          </div>

          {netInfo?.connected && (
            <div className="mt-3 flex items-center gap-2 text-xs text-white/50">
              <div className="h-1.5 w-1.5 rounded-full bg-neonBlue/60" />
              <span>
                Network:{' '}
                {netInfo?.type === 'wifi'
                  ? `Wi‑Fi${netInfo?.ssid ? ` (${netInfo.ssid})` : ''}`
                  : netInfo?.type === 'ethernet'
                    ? 'Ethernet'
                    : 'Connected'}
                {netInfo?.interfaceName ? ` • Adapter: ${netInfo.interfaceName}` : ''}
              </span>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl bg-neonPink/10 border border-neonPink/20 px-4 py-3 text-xs text-neonPink">
              {error}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-[10px] uppercase tracking-wide text-white/40">Ping</div>
              <div className="mt-2 text-lg font-semibold text-neonBlue">
                {live?.pingMs ?? result?.pingMs ?? '--'}
                <span className="ml-1 text-xs font-normal text-white/40">ms</span>
              </div>
            </div>
            <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-[10px] uppercase tracking-wide text-white/40">Jitter</div>
              <div className="mt-2 text-lg font-semibold text-neonPurple">
                {live?.jitterMs ?? result?.jitterMs ?? '--'}
                <span className="ml-1 text-xs font-normal text-white/40">ms</span>
              </div>
            </div>
            <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-[10px] uppercase tracking-wide text-white/40">Download</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {live?.downloadMbps ?? result?.downloadMbps ?? '--'}
                <span className="ml-1 text-xs font-normal text-white/40">Mbps</span>
              </div>
            </div>
            <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-[10px] uppercase tracking-wide text-white/40">Upload</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {live?.uploadMbps ?? result?.uploadMbps ?? '--'}
                <span className="ml-1 text-xs font-normal text-white/40">Mbps</span>
              </div>
            </div>
          </div>

          {(result?.serverName || result?.isp) && (
            <div className="mt-4 text-xs text-white/50">
              {result?.serverName ? `Server: ${result.serverName}` : ''}
              {result?.serverName && result?.isp ? ' • ' : ''}
              {result?.isp ? `ISP: ${result.isp}` : ''}
            </div>
          )}

          <div className="mt-4 h-64 rounded-2xl bg-black/25 p-3 ring-1 ring-white/10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={samples.map((s) => ({ ...s, tSec: (s.t ?? 0) / 1000 }))}>
                <XAxis 
                  dataKey="tSec" 
                  tickFormatter={(v) => `${v}s`} 
                  stroke="rgba(255,255,255,0.25)" 
                  fontSize={11}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.25)" 
                  fontSize={11} 
                  width={40}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ 
                    background: 'rgba(7, 10, 19, 0.95)', 
                    border: '1px solid rgba(255,255,255,0.12)', 
                    borderRadius: 12,
                    padding: '12px 16px'
                  }}
                  labelFormatter={(v) => `t=${v}s`}
                />
                <Line type="monotone" dataKey="pingMs" stroke="#4CC9F0" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="jitterMs" stroke="#B517FF" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="downloadMbps" stroke="#4DFFB5" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="uploadMbps" stroke="#4DA3FF" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>
      <Card 
        title="Bufferbloat Test" 
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPurple/10 to-transparent blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-white/70">
              Measures latency under load to calculate bufferbloat impact + grade.
            </div>
            <div className="flex items-center gap-2">
              {bbRunning ? (
                <button className="btn-secondary border-neonPink/30 hover:border-neonPink/50" onClick={stopBufferbloat}>
                  Stop
                </button>
              ) : (
                <button className="btn-primary" onClick={startBufferbloat}>
                  Run Bufferbloat
                </button>
              )}
            </div>
          </div>

          {bbError && (
            <div className="mt-4 rounded-xl bg-neonPink/10 border border-neonPink/20 px-4 py-3 text-xs text-neonPink">
              {bbError}
            </div>
          )}

          {bbRunning && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 border border-white/5">
              <div className={`h-2 w-2 rounded-full ${bbCurrentPhase === 'idle' ? 'bg-neonBlue' : bbCurrentPhase === 'load' ? 'bg-neonPurple' : 'bg-white/30'}`} />
              <span className="text-xs text-white/70">
                Phase: <span className="font-semibold text-white">{bbCurrentPhase?.toUpperCase() || 'WAITING'}</span>
              </span>
              <span className="text-xs text-white/50">•</span>
              <span className="text-xs text-white/70">
                Current Ping: <span className="font-semibold text-white">{bbCurrentPing !== null ? `${bbCurrentPing.toFixed(1)} ms` : '--'}</span>
              </span>
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-[10px] uppercase tracking-wide text-white/40">Baseline</div>
              <div className="mt-2 text-lg font-semibold text-neonBlue">
                {bbResult?.baselinePingMs ?? '--'}
                <span className="ml-1 text-xs font-normal text-white/40">ms</span>
              </div>
            </div>
            <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-[10px] uppercase tracking-wide text-white/40">Loaded</div>
              <div className="mt-2 text-lg font-semibold text-neonPurple">
                {bbResult?.loadedPingMs ?? '--'}
                <span className="ml-1 text-xs font-normal text-white/40">ms</span>
              </div>
            </div>
            <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-[10px] uppercase tracking-wide text-white/40">Bufferbloat</div>
              <div className="mt-2 text-lg font-semibold text-neonPink">
                {bbResult?.bufferbloatMs ?? '--'}
                <span className="ml-1 text-xs font-normal text-white/40">ms</span>
              </div>
            </div>
            <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-[10px] uppercase tracking-wide text-white/40">Grade</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {bbResult?.grade ?? '--'}
              </div>
            </div>
          </div>

          <div className="mt-4 h-64 rounded-2xl bg-black/25 p-3 ring-1 ring-white/10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bbSamples.map((s) => ({ ...s, tSec: (s.t ?? 0) / 1000 }))}>
                <XAxis 
                  dataKey="tSec" 
                  tickFormatter={(v) => `${v}s`} 
                  stroke="rgba(255,255,255,0.25)" 
                  fontSize={11}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.25)" 
                  fontSize={11} 
                  width={40}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ 
                    background: 'rgba(7, 10, 19, 0.95)', 
                    border: '1px solid rgba(255,255,255,0.12)', 
                    borderRadius: 12,
                    padding: '12px 16px'
                  }}
                  labelFormatter={(v) => `t=${v}s`}
                />
                <Line type="monotone" dataKey="pingMs" stroke="#B517FF" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 rounded-xl bg-white/5 px-4 py-3 text-xs text-white/50 border border-white/5">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-neonPurple/60" />
              <span>Tip: Run this while your connection is idle for a clean baseline.</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
