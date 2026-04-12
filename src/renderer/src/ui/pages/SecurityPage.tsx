import React from 'react'
import { Card } from '../components/Card'

export function SecurityPage() {
  const [status, setStatus] = React.useState<any>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [threats, setThreats] = React.useState<any[]>([])
  const [removingThreatId, setRemovingThreatId] = React.useState<string | null>(null)

  async function refresh() {
    try {
      const s = await window.netflux.refreshSecurity()
      setStatus(s)
      setError(s?.lastError ? String(s.lastError) : null)
    } catch (e: any) {
      setError(String(e?.message || e))
    }
  }

  React.useEffect(() => {
    window.netflux.getSecurityStatus().then(setStatus)
    refresh()
    fetchThreats()
    const t = setInterval(() => refresh(), 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchThreats() {
    try {
      const t = await window.netflux.getThreats()
      setThreats(t)
    } catch (e: any) {
      console.error('Failed to fetch threats:', e)
    }
  }

  async function removeThreat(threatId: string) {
    setRemovingThreatId(threatId)
    try {
      const res = await window.netflux.removeThreat(threatId)
      if (res.ok) {
        await fetchThreats()
      } else {
        setError(res.error || 'Failed to remove threat')
      }
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setRemovingThreatId(null)
    }
  }

  async function startScan(scanType: 'QuickScan' | 'FullScan') {
    setBusy(true)
    setError(null)
    try {
      const s = await window.netflux.startDefenderScan(scanType)
      setStatus(s)
      setError(s?.lastError ? String(s.lastError) : null)
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const defender = status?.defender

  return (
    <div className="grid gap-6">
      <Card 
        title="Security"
        right={
          <button className="btn-ghost text-xs" onClick={refresh} disabled={busy}>
            Refresh
          </button>
        }
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonBlue/10 to-transparent blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" onClick={() => startScan('QuickScan')} disabled={busy}>
              Quick Scan
            </button>
            <button className="btn-secondary" onClick={() => startScan('FullScan')} disabled={busy}>
              Full Scan
            </button>
            <div className="flex items-center gap-2 text-xs text-white/50">
              <div className={`h-1.5 w-1.5 rounded-full ${status?.runningScan ? 'bg-neonPurple' : 'bg-white/30'}`} />
              <span>
                {status?.runningScan ? 'Scan started (may continue in background)…' : 'Uses Windows Defender PowerShell cmdlets.'}
              </span>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-neonPink/10 border border-neonPink/20 px-4 py-3 text-xs text-neonPink">
              {error}
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card 
          title="Protection Status"
          className="relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPurple/10 to-transparent blur-3xl" />
          <div className="relative">
            {!defender ? (
              <div className="text-sm text-white/70">
                Defender status not available. If you're on Windows, run Nova as Administrator and try again.
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="flex items-center justify-between rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                  <div className="text-sm text-white/70">Antivirus Enabled</div>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${defender.antivirusEnabled ? 'bg-neonBlue shadow-[0_0_8px_rgba(76,201,240,0.6)]' : 'bg-white/30'}`} />
                    <div className="font-semibold text-white">{String(defender.antivirusEnabled ?? 'Unknown')}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                  <div className="text-sm text-white/70">Real-time Protection</div>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${defender.realTimeProtectionEnabled ? 'bg-neonBlue shadow-[0_0_8px_rgba(76,201,240,0.6)]' : 'bg-white/30'}`} />
                    <div className="font-semibold text-white">{String(defender.realTimeProtectionEnabled ?? 'Unknown')}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                  <div className="text-sm text-white/70">Signature Version</div>
                  <div className="font-semibold text-white">{defender.signatureVersion ?? 'Unknown'}</div>
                </div>
              </div>
            )}
          </div>
        </Card>
        <Card 
          title="Threats"
          className="relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPink/10 to-transparent blur-3xl" />
          <div className="relative">
            {threats.length === 0 ? (
              <div className="text-sm text-white/70">
                No threats detected. Use Quick Scan / Full Scan to check for malware.
              </div>
            ) : (
              <div className="space-y-3">
                {threats.map((threat) => (
                  <div key={threat.threatId} className="rounded-xl bg-black/25 p-4 ring-1 ring-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-white">{threat.threatName}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/50">
                          <span>Severity: <span className={`font-medium ${
                            threat.severity === 'Severe' ? 'text-neonPink' :
                            threat.severity === 'High' ? 'text-neonPurple' :
                            threat.severity === 'Medium' ? 'text-neonBlue' :
                            'text-white/70'
                          }`}>{threat.severity}</span></span>
                          <span>Status: {threat.threatStatus}</span>
                          {threat.resourceLocation && <span>Location: {threat.resourceLocation}</span>}
                        </div>
                        <div className="mt-1 text-xs text-white/40">
                          Detected: {new Date(threat.detectionTime).toLocaleString()}
                        </div>
                      </div>
                      <button
                        className="btn-secondary text-xs"
                        onClick={() => removeThreat(threat.threatId)}
                        disabled={removingThreatId === threat.threatId}
                      >
                        {removingThreatId === threat.threatId ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="mt-4 btn-ghost text-xs" onClick={fetchThreats}>
              Refresh Threats
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
