import React from 'react'
import { Card } from '../components/Card'
import { useSettings } from '../state/SettingsContext'

export function GamesBoostPage() {
  const { settings, setSettings } = useSettings()
  const [scan, setScan] = React.useState<{ status: any; games: any[] } | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [q, setQ] = React.useState('')
  const [filter, setFilter] = React.useState<'all' | 'steam' | 'epic' | 'windows'>('all')
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [scanError, setScanError] = React.useState<string | null>(null)

  const boosted = new Set(settings?.boostedGameIds ?? [])
  const legacyBoostedSteam = new Set(settings?.boostedSteamAppIds ?? [])

  const games = (scan?.games ?? [])
    .filter((g) => {
      const src = String(g?.source || '').toLowerCase()
      if (filter === 'all') return true
      return src === filter
    })
    .filter((g) => {
      const name = String(g?.name || '')
      if (!q.trim()) return true
      return name.toLowerCase().includes(q.trim().toLowerCase())
    })

  async function doScan() {
    setBusy(true)
    setScanError(null)
    try {
      const res = await window.netflux.scanGames()
      setScan(res)
    } catch (e: any) {
      setScanError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function openFolder(path: string) {
    setActionError(null)
    try {
      const res = await window.netflux.openGameFolder(path)
      if (res?.ok === false) throw new Error(String(res?.error || 'Failed to open folder'))
    } catch (e: any) {
      setActionError(String(e?.message || e))
    }
  }

  async function launch(source: string, appId: string) {
    setActionError(null)
    try {
      const res = await window.netflux.launchGame(source, appId)
      if (res?.ok === false) throw new Error(String(res?.error || 'Failed to launch'))
    } catch (e: any) {
      setActionError(String(e?.message || e))
    }
  }


  React.useEffect(() => {
    doScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggleBoost(gameId: string, source?: string, appId?: string) {
    if (!settings) return
    const next = new Set(settings.boostedGameIds ?? [])
    if (next.has(gameId)) next.delete(gameId)
    else next.add(gameId)

    // Keep backward compatibility: if it's a Steam title, also toggle boostedSteamAppIds.
    if (source === 'steam' && appId) {
      const legacy = new Set(settings.boostedSteamAppIds ?? [])
      if (legacy.has(appId)) legacy.delete(appId)
      else legacy.add(appId)
      await setSettings({ boostedGameIds: Array.from(next), boostedSteamAppIds: Array.from(legacy) })
      return
    }

    await setSettings({ boostedGameIds: Array.from(next) })
  }

  return (
    <div className="grid gap-6">
      <Card 
        title="Games Boost" 
        right={
          <button className="btn-ghost text-xs" onClick={doScan} disabled={busy}>
            {busy ? 'Scanning…' : 'Rescan'}
          </button>
        }
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonBlue/10 to-transparent blur-3xl" />
        <div className="relative">
          <div className="text-sm text-white/70">
            Pick installed games (Steam / Epic / Windows) and enable per-game boost profiles.
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search installed games…"
              className="w-full rounded-2xl bg-black/25 px-4 py-3 text-sm outline-none ring-1 ring-white/12 transition-all focus:ring-neonBlue/50 focus:bg-black/35"
            />

            <div className="flex items-center gap-2">
              <button 
                className={filter === 'all' ? 'btn-primary' : 'btn-ghost'} 
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button 
                className={filter === 'steam' ? 'btn-primary' : 'btn-ghost'} 
                onClick={() => setFilter('steam')}
              >
                Steam
              </button>
              <button 
                className={filter === 'epic' ? 'btn-primary' : 'btn-ghost'} 
                onClick={() => setFilter('epic')}
              >
                Epic
              </button>
              <button 
                className={filter === 'windows' ? 'btn-primary' : 'btn-ghost'} 
                onClick={() => setFilter('windows')}
              >
                Windows
              </button>
            </div>

            <div className="flex items-center justify-end text-xs text-white/50">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-neonBlue/60" />
                <span>{games.length} shown</span>
              </div>
            </div>
          </div>

        {!scan ? (
          <div className="mt-4 text-xs text-white/50">Scanning…</div>
        ) : (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <div className={`h-1.5 w-1.5 rounded-full ${scan.status?.steamInstalled ? 'bg-neonBlue' : 'bg-white/30'}`} />
              <span>Steam: {scan.status?.steamInstalled ? 'Detected' : 'Not detected'}</span>
              {scan.status?.steamPath && <span className="text-white/40">• {scan.status.steamPath}</span>}
            </div>

            <div className="flex items-center gap-2 text-xs text-white/50">
              <div className={`h-1.5 w-1.5 rounded-full ${scan.status?.epicInstalled ? 'bg-neonPurple' : 'bg-white/30'}`} />
              <span>Epic: {scan.status?.epicInstalled ? 'Detected' : 'Not detected'}</span>
              {scan.status?.epicManifestPath && <span className="text-white/40">• {scan.status.epicManifestPath}</span>}
            </div>

            {scan.status?.lastError && (
              <div className="rounded-xl bg-neonPink/10 border border-neonPink/20 px-4 py-3 text-xs text-neonPink">
                {String(scan.status.lastError)}
              </div>
            )}

            {scanError && (
              <div className="rounded-xl bg-neonPink/10 border border-neonPink/20 px-4 py-3 text-xs text-neonPink">
                {scanError}
              </div>
            )}

            {actionError && (
              <div className="rounded-xl bg-neonPink/10 border border-neonPink/20 px-4 py-3 text-xs text-neonPink">
                {actionError}
              </div>
            )}

            {games.length === 0 ? (
              <div className="rounded-xl bg-white/5 px-4 py-6 text-center text-xs text-white/50 border border-white/5">
                No games found. If your launcher is installed, open it once and try Rescan.
              </div>
            ) : (
              <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {games.map((g) => {
                  const gameId = String(g.id || `${g.source || 'steam'}:${g.appId}`)
                  const isBoosted = boosted.has(gameId) || (g.source === 'steam' && legacyBoostedSteam.has(String(g.appId)))
                  const src = String(g.source || 'steam').toLowerCase()
                  const badge = src === 'steam' ? 'STEAM' : src === 'epic' ? 'EPIC' : src === 'windows' ? 'WINDOWS' : src.toUpperCase()

                  const rawIcon = String(g.displayIconPath || '')
                  const iconPath = rawIcon ? rawIcon.split(',')[0].replace(/^"|"$/g, '').trim() : ''
                  const canPlay = src === 'steam' || src === 'epic' || src === 'windows'
                  const badgeColor = src === 'steam' ? 'bg-neonBlue/20 text-neonBlue border-neonBlue/30' : src === 'epic' ? 'bg-neonPurple/20 text-neonPurple border-neonPurple/30' : 'bg-neonPink/20 text-neonPink border-neonPink/30'
                  return (
                    <div key={gameId} className="relative overflow-hidden rounded-2xl bg-black/25 p-4 ring-1 ring-white/10 transition-all hover:ring-white/20">
                      <div className={`absolute right-3 top-3 rounded-full border px-2 py-1 text-[10px] font-semibold tracking-wide ${badgeColor}`}>
                        {badge}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
                          {iconPath ? (
                            <img src={`file:///${iconPath.replace(/\\/g, '/')}`} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white/60">
                              {String(g.name || '?').slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white/90">{g.name}</div>
                          <div className="truncate text-[11px] text-white/40">{src.toUpperCase()} • {g.appId}</div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            className={isBoosted ? 'btn-primary' : 'btn-secondary'}
                            onClick={() => toggleBoost(gameId, String(g.source || ''), String(g.appId || ''))}
                            disabled={!settings}
                          >
                            {isBoosted ? 'Boosting' : 'Boost'}
                          </button>

                          <button
                            className="btn-ghost"
                            onClick={() => openFolder(String(g.installDir || ''))}
                            disabled={!String(g.installDir || '').trim()}
                          >
                            Open
                          </button>

                          <button
                            className="btn-ghost"
                            onClick={async () => {
                              if (src === 'windows') {
                                const exePath = iconPath
                                const installDir = String(g.installDir || '')
                                await window.netflux.launchGame('windows', String(g.appId || ''), { exePath, installDir })
                                return
                              }
                              await launch(String(src), String(g.appId || ''))
                            }}
                            disabled={!canPlay}
                            title={!canPlay ? 'Launch is not available for this source' : 'Launch'}
                          >
                            Play
                          </button>
                        </div>

                        <div className="text-[11px] text-white/40">{String(g.installDir || '').slice(0, 42)}{String(g.installDir || '').length > 42 ? '…' : ''}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card 
          title="Game Profiles" 
          className="relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPurple/10 to-transparent blur-3xl" />
          <div className="relative">
            <div className="text-sm text-white/70">
              Enabled boosts are saved locally and will be used for future per-game routing rules.
            </div>
            <div className="mt-4 rounded-xl bg-white/5 px-4 py-3 border border-white/5">
              <div className="flex items-center gap-2 text-xs text-white/50">
                <div className="h-1.5 w-1.5 rounded-full bg-neonPurple/60" />
                <span>{boosted.size} games currently boosted</span>
              </div>
            </div>
          </div>
        </Card>
        <Card 
          title="Route Preview" 
          className="relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPink/10 to-transparent blur-3xl" />
          <div className="relative">
            <div className="text-sm text-white/70">
              Shows your region, selected exit node, and target game server region.
            </div>
            <div className="mt-4 rounded-xl bg-white/5 px-4 py-3 border border-white/5">
              <div className="flex items-center gap-2 text-xs text-white/50">
                <div className="h-1.5 w-1.5 rounded-full bg-neonPink/60" />
                <span>Route preview coming soon</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
