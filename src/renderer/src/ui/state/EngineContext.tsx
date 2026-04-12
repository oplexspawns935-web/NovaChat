import React from 'react'

export type OptimizationSample = {
  ts: number
  pingMs: number
  jitterMs: number
  packetLossPct: number
  bandwidthMbps: number
  qualityScore: number
}

type EngineCtx = {
  running: boolean
  latest: OptimizationSample | null
  history: OptimizationSample[]
  start: () => Promise<void>
  stop: () => Promise<void>
}

const Ctx = React.createContext<EngineCtx | null>(null)

export function EngineProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = React.useState(false)
  const [latest, setLatest] = React.useState<OptimizationSample | null>(null)
  const [history, setHistory] = React.useState<OptimizationSample[]>([])

  const refreshStatus = React.useCallback(async () => {
    const status = await window.netflux.getEngineStatus()
    setRunning(!!status.running)
  }, [])

  const start = React.useCallback(async () => {
    const res = await window.netflux.startEngine()
    setRunning(res.running)
  }, [])

  const stop = React.useCallback(async () => {
    const res = await window.netflux.stopEngine()
    setRunning(res.running)
  }, [])

  React.useEffect(() => {
    refreshStatus()
    window.netflux.getEngineSample().then((s) => {
      setLatest(s)
      setHistory([s])
    })

    const unsub = window.netflux.onEngineSample((s) => {
      setLatest(s)
      setHistory((prev) => {
        const next = [...prev, s]
        return next.slice(-60)
      })
    })

    return () => {
      unsub()
    }
  }, [refreshStatus])

  return <Ctx.Provider value={{ running, latest, history, start, stop }}>{children}</Ctx.Provider>
}

export function useEngine() {
  const v = React.useContext(Ctx)
  if (!v) throw new Error('useEngine must be used within EngineProvider')
  return v
}
