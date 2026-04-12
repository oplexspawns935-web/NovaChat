import React from 'react'
import { Card } from '../components/Card'
import { useSettings } from '../state/SettingsContext'
import { useTrial } from '../state/TrialContext'

const modes = [
  { id: 'smart_auto', name: 'Smart Auto Routing', desc: 'Adaptive routing based on live conditions.' },
  { id: 'gaming', name: 'Gaming Mode', desc: 'Aggressive low-latency path selection and jitter smoothing.' },
  { id: 'streaming', name: 'Streaming Mode', desc: 'Throughput-focused routing for stable streams.' },
  { id: 'custom', name: 'Custom Route', desc: 'Manually override routes and rule sets.' },
] as const

export function RoutingControlPage() {
  const { settings, setSettings } = useSettings()
  const { trial } = useTrial()

  const [regions, setRegions] = React.useState<any[]>([])
  const [tunnel, setTunnel] = React.useState<any>(null)
  const [selectedRegion, setSelectedRegion] = React.useState<string>('eu-lon')
  const [busy, setBusy] = React.useState(false)
  const [netBusy, setNetBusy] = React.useState(false)
  const [netOut, setNetOut] = React.useState<string | null>(null)

  const expired = !!trial?.expired

  React.useEffect(() => {
    window.netflux.getTunnelRegions().then(setRegions).catch(() => setRegions([]))
    window.netflux.getTunnelStatus().then(setTunnel).catch(() => setTunnel({ installed: false, connected: false }))

    const off = window.netflux.onTunnelStatus((status) => {
      setTunnel(status)
    })

    return () => off()
  }, [])

  async function refreshTunnel() {
    const s = await window.netflux.getTunnelStatus()
    setTunnel(s)
  }

  async function connect() {
    setBusy(true)
    try {
      const s = await window.netflux.connectTunnel(selectedRegion)
      setTunnel(s)
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      const s = await window.netflux.disconnectTunnel()
      setTunnel(s)
    } finally {
      setBusy(false)
    }
  }

  async function runNetAction(fn: () => Promise<any>) {
    setNetBusy(true)
    setNetOut(null)
    try {
      const res = await fn()
      const text = [res?.action ? `> ${res.action}` : null, res?.stdout ? String(res.stdout).trim() : null, res?.stderr ? String(res.stderr).trim() : null]
        .filter(Boolean)
        .join('\n')
      setNetOut(text || 'Done.')
    } catch (e: any) {
      setNetOut(String(e?.message || e))
    } finally {
      setNetBusy(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Card 
        title="Nova Tunnel (WireGuard)"
        right={
          <button onClick={refreshTunnel} className="btn-ghost text-xs" disabled={busy}>
            Refresh
          </button>
        }
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonBlue/10 to-transparent blur-3xl" />
        <div className="relative">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-[10px] uppercase tracking-wide text-white/40">Provider</div>
              <div className="mt-2 text-sm font-semibold text-white">WireGuard</div>
              <div className="mt-2 text-xs text-white/50">
                If not installed, install WireGuard for Windows.
              </div>
            </div>
            <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-[10px] uppercase tracking-wide text-white/40">Status</div>
              <div className="mt-2 flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${tunnel?.connected ? 'bg-neonBlue shadow-[0_0_8px_rgba(76,201,240,0.6)]' : 'bg-white/30'}`} />
                <div className="text-sm font-semibold text-white">
                  {tunnel?.connected ? 'Connected' : 'Disconnected'}
                </div>
              </div>
              <div className="mt-2 text-xs text-white/50">
                Installed: {tunnel?.installed ? 'Yes' : 'No'}
              </div>
              {tunnel?.lastError && (
                <div className="mt-2 text-xs text-neonPink">{String(tunnel.lastError)}</div>
              )}
            </div>
            <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-[10px] uppercase tracking-wide text-white/40">Exit Region</div>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="mt-2 w-full rounded-2xl bg-black/25 px-3 py-2 text-sm outline-none ring-1 ring-white/12 transition-all focus:ring-neonBlue/50 focus:bg-black/35"
                disabled={busy}
              >
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.country})
                  </option>
                ))}
              </select>

              <div className="mt-3 flex gap-2">
                {tunnel?.connected ? (
                  <button className="btn-secondary flex-1 border-neonPink/30 hover:border-neonPink/50" onClick={disconnect} disabled={busy}>
                    Disconnect
                  </button>
                ) : (
                  <button className="btn-primary flex-1" onClick={connect} disabled={busy || !tunnel?.installed}>
                    Connect
                  </button>
                )}
              </div>
              <div className="mt-2 text-[11px] text-white/50">
                Tunnel config uses placeholder values. Replace PrivateKey, PublicKey, and Endpoint in the config file to use a real WireGuard server.
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card 
        title="Network Utilities"
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPurple/10 to-transparent blur-3xl" />
        <div className="relative">
          <div className="text-sm text-white/70">
            These actions run Windows networking commands. Some may require Administrator.
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <button className="btn-secondary" disabled={netBusy} onClick={() => runNetAction(() => window.netflux.flushDns())}>
              Flush DNS
            </button>
            <button className="btn-secondary" disabled={netBusy} onClick={() => runNetAction(() => window.netflux.releaseIp())}>
              Release IP
            </button>
            <button className="btn-secondary" disabled={netBusy} onClick={() => runNetAction(() => window.netflux.renewIp())}>
              Renew IP
            </button>
            <button className="btn-secondary" disabled={netBusy} onClick={() => runNetAction(() => window.netflux.resetWinsock())}>
              Reset Winsock
            </button>
            <button className="btn-secondary" disabled={netBusy} onClick={() => runNetAction(() => window.netflux.resetTcpIp())}>
              Reset TCP/IP
            </button>
          </div>

          {netOut && (
            <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-black/25 p-4 text-[11px] text-white/70 ring-1 ring-white/10 border border-white/5">
              {netOut}
            </div>
          )}
        </div>
      </Card>

      <Card 
        title="Routing Mode"
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPink/10 to-transparent blur-3xl" />
        <div className="relative">
          <div className="grid gap-3 md:grid-cols-2">
            {modes.map((m) => {
              const active = settings?.routingMode === m.id
              const premiumLocked = expired && (m.id === 'custom' || m.id === 'gaming')

              return (
                <button
                  key={m.id}
                  disabled={!settings || premiumLocked}
                  onClick={() => setSettings({ routingMode: m.id as any })}
                  className={
                    'rounded-2xl border p-4 text-left transition-all ' +
                    (active
                      ? 'border-neonBlue/35 bg-white/10 shadow-glow'
                      : 'border-white/12 bg-black/25 hover:bg-black/30 hover:ring-white/20') +
                    (premiumLocked ? ' opacity-50 cursor-not-allowed' : '')
                  }
                >
                  <div className="text-sm font-semibold text-white">{m.name}</div>
                  <div className="mt-1 text-xs text-white/55">{m.desc}</div>
                  {premiumLocked && <div className="mt-2 text-xs text-neonPink">Locked (trial expired)</div>}
                </button>
              )
            })}
          </div>
        </div>
      </Card>

      <Card 
        title="Active Routes (visual)"
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonBlue/10 to-transparent blur-3xl" />
        <div className="relative">
          <div className="grid gap-3 md:grid-cols-3">
            {['Device', 'NetFlux Node', 'Destination'].map((n, idx) => (
              <div key={n} className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
                <div className="text-[10px] uppercase tracking-wide text-white/40">Hop {idx + 1}</div>
                <div className="mt-2 text-sm font-semibold text-white">{n}</div>
                <div className="mt-1 text-xs text-white/50">Simulated path map</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-white/5 px-4 py-3 border border-white/5">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <div className="h-1.5 w-1.5 rounded-full bg-neonBlue/60" />
              <span>Future: render actual route table + map and allow per-route overrides.</span>
            </div>
          </div>
        </div>
      </Card>

      <Card 
        title="Manual Overrides"
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPurple/10 to-transparent blur-3xl" />
        <div className="relative">
          <div className="text-sm text-white/70">
            Override UI placeholder: add static routes, exclude hops, or force a preferred region.
          </div>
          <div className="mt-4 flex gap-3">
            <button className="btn-primary">
              Add Route Rule
            </button>
            <button className="btn-ghost">
              Import Rules
            </button>
          </div>
          <div className="mt-4 rounded-xl bg-white/5 px-4 py-3 border border-white/5">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <div className="h-1.5 w-1.5 rounded-full bg-neonPurple/60" />
              <span>Manual route overrides coming soon.</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
