import React from 'react'
import { Card } from '../components/Card'
import { useEngine } from '../state/EngineContext'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

export function NetworkAnalyzerPage() {
  const { history, latest } = useEngine()

  const [cap, setCap] = React.useState<any>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    window.netflux.getCaptureStatus().then(setCap)

    const off = window.netflux.onCaptureStatus((status) => {
      setCap(status)
    })
    return () => off()
  }, [])

  async function refreshCap() {
    const s = await window.netflux.getCaptureStatus()
    setCap(s)
  }

  async function start() {
    setBusy(true)
    try {
      const s = await window.netflux.startCapture()
      setCap(s)
    } finally {
      setBusy(false)
    }
  }

  async function stop() {
    setBusy(true)
    try {
      const s = await window.netflux.stopCapture()
      setCap(s)
    } finally {
      setBusy(false)
    }
  }

  const bandwidth = history.map((s) => ({
    t: new Date(s.ts).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
    bw: s.bandwidthMbps,
  }))

  return (
    <div className="grid gap-6">
      <Card 
        title="Packet Capture (Wireshark)"
        right={
          <button onClick={refreshCap} className="btn-ghost text-xs" disabled={busy}>
            Refresh
          </button>
        }
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonBlue/10 to-transparent blur-3xl" />
        <div className="relative">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-[10px] uppercase tracking-wide text-white/40">TShark</div>
              <div className="mt-2 flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${cap?.installed ? 'bg-neonBlue shadow-[0_0_8px_rgba(76,201,240,0.6)]' : 'bg-white/30'}`} />
                <div className="text-sm font-semibold text-white">
                  {cap?.installed ? 'Detected' : 'Not found'}
                </div>
              </div>
              <div className="mt-2 text-xs text-white/50">{cap?.tsharkPath || 'Install Wireshark to enable capture.'}</div>
            </div>
            <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-[10px] uppercase tracking-wide text-white/40">Capture</div>
              <div className="mt-2 flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${cap?.running ? 'bg-neonPurple shadow-[0_0_8px_rgba(181,23,255,0.6)]' : 'bg-white/30'}`} />
                <div className="text-sm font-semibold text-white">
                  {cap?.running ? 'Running' : 'Stopped'}
                </div>
              </div>
              {cap?.lastError && (
                <div className="mt-2 text-xs text-neonPink">{String(cap.lastError)}</div>
              )}
            </div>
            <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-[10px] uppercase tracking-wide text-white/40">Output</div>
              <div className="mt-2 break-all text-xs text-white/60">{cap?.outputPath || '—'}</div>
              <div className="mt-3 flex gap-2">
                {cap?.running ? (
                  <button className="btn-secondary flex-1 border-neonPink/30 hover:border-neonPink/50" onClick={stop} disabled={busy}>
                    Stop
                  </button>
                ) : (
                  <button className="btn-primary flex-1" onClick={start} disabled={busy || !cap?.installed}>
                    Start
                  </button>
                )}
              </div>
              <div className="mt-2 text-[11px] text-white/50">
                Captures are saved to Nova userData and can be opened in Wireshark.
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card 
          title="Live Diagnostics"
          className="relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPurple/10 to-transparent blur-3xl" />
          <div className="relative space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
              <div className="text-sm text-white/70">Latency</div>
              <div className="font-semibold text-neonBlue">{latest ? `${latest.pingMs} ms` : '—'}</div>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
              <div className="text-sm text-white/70">Jitter</div>
              <div className="font-semibold text-neonPurple">{latest ? `${latest.jitterMs} ms` : '—'}</div>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
              <div className="text-sm text-white/70">Packet Loss</div>
              <div className="font-semibold text-neonPink">{latest ? `${latest.packetLossPct}%` : '—'}</div>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-white/5 px-4 py-3 border border-white/5">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <div className="h-1.5 w-1.5 rounded-full bg-neonPurple/60" />
              <span>Future: multi-region ping test, MTR-style path trace, per-hop loss.</span>
            </div>
          </div>
        </Card>

        <Card 
          title="Bandwidth Usage Monitor"
          className="relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPink/10 to-transparent blur-3xl" />
          <div className="relative h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bandwidth} margin={{ left: 6, right: 18, top: 12, bottom: 6 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                <XAxis 
                  dataKey="t" 
                  stroke="rgba(255,255,255,0.25)" 
                  tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.25)" 
                  tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
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
                  labelStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 }}
                />
                <Area type="monotone" dataKey="bw" stroke="#4CC9F0" strokeWidth={2.5} fill="rgba(76,201,240,0.15)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-xs text-white/50">Simulated Mbps usage based on engine state.</div>
        </Card>
      </div>

      <Card 
        title="Packet Trace Visualization"
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonBlue/10 to-transparent blur-3xl" />
        <div className="relative">
          <div className="grid gap-3 md:grid-cols-4">
            {['Hop 1', 'Hop 2', 'Hop 3', 'Hop 4'].map((h, i) => (
              <div key={h} className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
                <div className="text-[10px] uppercase tracking-wide text-white/40">{h}</div>
                <div className="mt-2 text-sm font-semibold text-white">Node {i + 1}</div>
                <div className="mt-1 text-xs text-white/50">Latency: {Math.round(8 + Math.random() * 22)} ms</div>
                <div className="mt-1 text-xs text-white/50">Loss: {Math.round(Math.random() * 3)}%</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-white/5 px-4 py-3 border border-white/5">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <div className="h-1.5 w-1.5 rounded-full bg-neonBlue/60" />
              <span>Simulated trace visualization. Real MTR integration coming soon.</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
