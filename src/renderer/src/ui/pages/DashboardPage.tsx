import React from 'react'
import { Card } from '../components/Card'
import { useEngine } from '../state/EngineContext'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

export function DashboardPage() {
  const { latest, history, running } = useEngine()
  const [netInfo, setNetInfo] = React.useState<any>(null)
  const [sysInfo, setSysInfo] = React.useState<any>(null)

  const data = history.map((s) => ({
    t: new Date(s.ts).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
    ping: s.pingMs,
    jitter: s.jitterMs,
    loss: s.packetLossPct,
  }))

  React.useEffect(() => {
    const load = async () => {
      try {
        const [n, si] = await Promise.all([window.netflux.getNetworkInfo(), window.netflux.getSystemInfo()])
        setNetInfo(n)
        setSysInfo(si)
      } catch {
        // ignore
      }
    }
    load()
    const t = setInterval(load, 6000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="grid gap-6">
      {/* Hero Stats Row */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card 
          title="System" 
          className="relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonBlue/10 to-transparent blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-neonBlue shadow-[0_0_8px_rgba(76,201,240,0.6)]" />
              <div className="text-xs font-medium text-neonBlue/90 uppercase tracking-wider">Hardware</div>
            </div>
            <div className="mt-3 text-sm font-medium text-white/90">
              {sysInfo?.cpuModel ? sysInfo.cpuModel : '—'}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
              <span>{sysInfo?.cpuCores ? `${sysInfo.cpuCores} cores` : '—'}</span>
              <span>•</span>
              <span>{sysInfo?.totalMemoryGb ? `${sysInfo.totalMemoryGb} GB RAM` : '—'}</span>
            </div>
            <div className="mt-2 text-xs text-white/50">
              {sysInfo?.gpuName ? sysInfo.gpuName : '—'}
            </div>
          </div>
        </Card>

        <Card 
          title="Network" 
          className="relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPurple/10 to-transparent blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${netInfo?.connected ? 'bg-neonPurple shadow-[0_0_8px_rgba(181,23,255,0.6)]' : 'bg-white/30'}`} />
              <div className={`text-xs font-medium uppercase tracking-wider ${netInfo?.connected ? 'text-neonPurple/90' : 'text-white/40'}`}>
                {netInfo?.connected ? 'Connected' : 'Offline'}
              </div>
            </div>
            <div className="mt-3 text-sm font-medium text-white/90">
              {netInfo?.connected
                ? netInfo?.type === 'wifi'
                  ? `Wi‑Fi${netInfo?.ssid ? ` (${netInfo.ssid})` : ''}`
                  : netInfo?.type === 'ethernet'
                    ? 'Ethernet'
                    : 'Connected'
                : 'Not connected'}
            </div>
            <div className="mt-2 text-xs text-white/50">
              {netInfo?.interfaceName ? `Adapter: ${netInfo.interfaceName}` : '—'}
            </div>
          </div>
        </Card>

        <Card 
          title="Live Metrics" 
          className="relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPink/10 to-transparent blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${running ? 'bg-neonPink shadow-[0_0_8px_rgba(255,77,222,0.6)]' : 'bg-white/30 animate-pulse'}`} />
              <div className={`text-xs font-medium uppercase tracking-wider ${running ? 'text-neonPink/90' : 'text-white/40'}`}>
                {running ? 'Active' : 'Idle'}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-white/40">Ping</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {latest ? latest.pingMs : '—'}
                  <span className="ml-0.5 text-xs font-normal text-white/40">ms</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-white/40">Jitter</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {latest ? latest.jitterMs : '—'}
                  <span className="ml-0.5 text-xs font-normal text-white/40">ms</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-white/40">Loss</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {latest ? latest.packetLossPct : '—'}
                  <span className="ml-0.5 text-xs font-normal text-white/40">%</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Quality Score Card - Full Width */}
      <Card 
        title="Connection Quality" 
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-40 w-64 bg-gradient-to-br from-neonBlue/5 via-neonPurple/5 to-neonPink/5 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="text-5xl font-semibold tracking-tight text-white">
              {latest ? latest.qualityScore : '—'}
              <span className="ml-2 text-xl font-normal text-white/40">/ 100</span>
            </div>
            <div className="mt-2 text-sm text-white/50">
              {running ? 'Live optimization is actively improving your connection.' : 'Optimization engine is idle. Start optimization to improve quality.'}
            </div>
          </div>
          <div className="hidden lg:block">
            <div className={`h-20 w-20 rounded-full border-4 ${latest && latest.qualityScore >= 80 ? 'border-neonBlue/30 bg-neonBlue/5' : latest && latest.qualityScore >= 50 ? 'border-neonPurple/30 bg-neonPurple/5' : 'border-neonPink/30 bg-neonPink/5'} flex items-center justify-center`}>
              <div className={`text-sm font-semibold ${latest && latest.qualityScore >= 80 ? 'text-neonBlue' : latest && latest.qualityScore >= 50 ? 'text-neonPurple' : 'text-neonPink'}`}>
                {latest ? (latest.qualityScore >= 80 ? 'Excellent' : latest.qualityScore >= 50 ? 'Good' : 'Poor') : '—'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Detailed Metrics Row */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Ping Details">
          <div className="flex items-baseline gap-3">
            <div className="text-4xl font-semibold text-neonBlue">
              {latest ? latest.pingMs : '—'}
              <span className="ml-2 text-lg font-normal text-white/40">ms</span>
            </div>
          </div>
          <div className="mt-3 text-xs text-white/50">
            Lower is better. Stabilized via intelligent routing and packet prioritization.
          </div>
          <div className="mt-4 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-neonBlue to-neonPurple transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.max(0, 200 - (latest?.pingMs || 200)))}%` }}
            />
          </div>
        </Card>

        <Card title="Packet Loss">
          <div className="flex items-baseline gap-3">
            <div className="text-4xl font-semibold text-neonPurple">
              {latest ? latest.packetLossPct : '—'}
              <span className="ml-2 text-lg font-normal text-white/40">%</span>
            </div>
          </div>
          <div className="mt-3 text-xs text-white/50">
            Detects loss spikes and applies smoothing algorithms for stable gameplay.
          </div>
          <div className="mt-4 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-neonPurple to-neonPink transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.max(0, 100 - (latest?.packetLossPct || 100) * 10))}%` }}
            />
          </div>
        </Card>
      </div>

      {/* Real-time Graph */}
      <Card 
        title="Real-time Network Graph" 
        className="relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-neonBlue/[0.02] via-transparent to-neonPurple/[0.02]" />
        <div className="relative h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 6, right: 18, top: 12, bottom: 6 }}>
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
                  padding: '12px 16px',
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 }}
                itemStyle={{ fontSize: 12, padding: '2px 0' }}
              />
              <Line 
                type="monotone" 
                dataKey="ping" 
                stroke="#4CC9F0" 
                strokeWidth={2.5} 
                dot={false}
                activeDot={{ r: 4, fill: '#4CC9F0', stroke: 'rgba(76,201,240,0.3)', strokeWidth: 8 }}
              />
              <Line 
                type="monotone" 
                dataKey="jitter" 
                stroke="#B517FF" 
                strokeWidth={2.5} 
                dot={false}
                activeDot={{ r: 4, fill: '#B517FF', stroke: 'rgba(181,23,255,0.3)', strokeWidth: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="relative mt-4 flex items-center justify-between text-xs text-white/40">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-neonBlue" />
              <span>Ping</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-neonPurple" />
              <span>Jitter</span>
            </div>
          </div>
          <span>Showing last 60 seconds</span>
        </div>
      </Card>
    </div>
  )
}
