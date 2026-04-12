import React from 'react'

export type AppSettings = {
  startOnBoot: boolean
  minimizeToTray: boolean
  routingMode: 'smart_auto' | 'gaming' | 'streaming' | 'custom'
  trafficPriority: 'balanced' | 'latency' | 'throughput'
  dnsOptimization: boolean
  boostedSteamAppIds: string[]
  boostedGameIds: string[]
  googleOAuthClientId: string
}

type SettingsCtx = {
  settings: AppSettings | null
  setSettings: (patch: Partial<AppSettings>) => Promise<void>
  refresh: () => Promise<void>
}

const Ctx = React.createContext<SettingsCtx | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setLocal] = React.useState<AppSettings | null>(null)

  const refresh = React.useCallback(async () => {
    const s = await window.netflux.getSettings()
    setLocal(s)
  }, [])

  const setSettings = React.useCallback(async (patch: Partial<AppSettings>) => {
    const next = await window.netflux.setSettings(patch)
    setLocal(next)
  }, [])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  return <Ctx.Provider value={{ settings, setSettings, refresh }}>{children}</Ctx.Provider>
}

export function useSettings() {
  const v = React.useContext(Ctx)
  if (!v) throw new Error('useSettings must be used within SettingsProvider')
  return v
}
