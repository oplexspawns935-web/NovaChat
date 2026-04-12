import React from 'react'

export type TrialStatus = {
  startedAt: number
  expiresAt: number
  remainingDays: number
  expired: boolean
}

type TrialCtx = {
  trial: TrialStatus | null
  refresh: () => Promise<void>
}

const Ctx = React.createContext<TrialCtx | null>(null)

export function TrialProvider({ children }: { children: React.ReactNode }) {
  const [trial, setTrial] = React.useState<TrialStatus | null>(null)

  const refresh = React.useCallback(async () => {
    const t = await window.netflux.getTrial()
    setTrial(t)
  }, [])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  return <Ctx.Provider value={{ trial, refresh }}>{children}</Ctx.Provider>
}

export function useTrial() {
  const v = React.useContext(Ctx)
  if (!v) throw new Error('useTrial must be used within TrialProvider')
  return v
}
