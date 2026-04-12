import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

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

const DEFAULTS: AppSettings = {
  startOnBoot: false,
  minimizeToTray: true,
  routingMode: 'smart_auto',
  trafficPriority: 'balanced',
  dnsOptimization: true,
  boostedSteamAppIds: [],
  boostedGameIds: [],
  googleOAuthClientId: '',
}

export class SettingsService {
  private getPath() {
    return join(app.getPath('userData'), 'settings.json')
  }

  ensureInitialized() {
    const p = this.getPath()
    if (existsSync(p)) return
    writeFileSync(p, JSON.stringify(DEFAULTS, null, 2), { encoding: 'utf-8' })
  }

  get(): AppSettings {
    const p = this.getPath()
    const raw = readFileSync(p, 'utf-8')
    const data = JSON.parse(raw) as Partial<AppSettings>
    return { ...DEFAULTS, ...data }
  }

  set(patch: Partial<AppSettings>): AppSettings {
    const p = this.getPath()
    const next = { ...this.get(), ...patch }
    writeFileSync(p, JSON.stringify(next, null, 2), { encoding: 'utf-8' })
    return next
  }
}
