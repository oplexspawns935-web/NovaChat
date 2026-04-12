import React from 'react'
import { Card } from '../components/Card'
import { Toggle } from '../components/Toggle'
import { useSettings } from '../state/SettingsContext'
import { useTrial } from '../state/TrialContext'

export function OptimizationSettingsPage() {
  const { settings, setSettings } = useSettings()
  const { trial } = useTrial()

  const expired = !!trial?.expired

  return (
    <div className="grid gap-6">
      <Card 
        title="Core Optimization"
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonBlue/10 to-transparent blur-3xl" />
        <div className="relative grid gap-4 md:grid-cols-2">
          <Row
            label="DNS optimization"
            desc="Routes DNS to lower-latency resolvers (simulated)."
            right={
              <Toggle
                checked={!!settings?.dnsOptimization}
                onChange={(v) => setSettings({ dnsOptimization: v })}
              />
            }
          />

          <Row
            label="Traffic prioritization"
            desc="Prioritize latency, throughput, or keep balanced."
            right={
              <select
                value={settings?.trafficPriority ?? 'balanced'}
                onChange={(e) => setSettings({ trafficPriority: e.target.value as any })}
                className="rounded-2xl bg-black/25 px-3 py-2 text-sm outline-none ring-1 ring-white/12 transition-all focus:ring-neonBlue/50 focus:bg-black/35"
              >
                <option value="balanced">Balanced</option>
                <option value="latency">Latency</option>
                <option value="throughput">Throughput</option>
              </select>
            }
          />
        </div>
      </Card>

      <Card 
        title="Advanced Tweaks"
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPurple/10 to-transparent blur-3xl" />
        <div className="relative">
          <div className="text-sm text-white/70">
            Advanced controls are {expired ? 'locked (trial expired)' : 'available during trial'}.
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Row
              label="Background process limiter"
              desc="Limits background traffic (placeholder)."
              right={<Toggle checked={false} onChange={() => {}} disabled={expired} />}
            />
            <Row
              label="Jitter smoothing"
              desc="Aggressively smooth jitter spikes (placeholder slider)."
              right={
                <input
                  type="range"
                  min={0}
                  max={100}
                  defaultValue={55}
                  disabled={expired}
                  className="w-44"
                />
              }
            />
          </div>

          <div className="mt-4 rounded-xl bg-white/5 px-4 py-3 border border-white/5">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <div className="h-1.5 w-1.5 rounded-full bg-neonPurple/60" />
              <span>Future: these controls will map to real routing, queueing, and DNS logic.</span>
            </div>
          </div>
        </div>
      </Card>

      <Card 
        title="App Behavior"
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPink/10 to-transparent blur-3xl" />
        <div className="relative grid gap-4 md:grid-cols-2">
          <Row
            label="Minimize to tray"
            desc="Closing the window keeps NetFlux running in the tray."
            right={
              <Toggle
                checked={!!settings?.minimizeToTray}
                onChange={(v) => setSettings({ minimizeToTray: v })}
              />
            }
          />

          <Row
            label="Start on boot"
            desc="Launch NetFlux automatically when you log in."
            right={
              <Toggle
                checked={!!settings?.startOnBoot}
                onChange={(v) => setSettings({ startOnBoot: v })}
              />
            }
          />
        </div>
      </Card>
    </div>
  )
}

function Row({
  label,
  desc,
  right,
}: {
  label: string
  desc: string
  right: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-black/25 px-4 py-4 ring-1 ring-white/10">
      <div>
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className="mt-1 text-xs text-white/50">{desc}</div>
      </div>
      <div>{right}</div>
    </div>
  )
}
