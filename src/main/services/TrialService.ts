import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export type TrialStatus = {
  startedAt: number
  expiresAt: number
  remainingDays: number
  expired: boolean
}

const TRIAL_DAYS = 30

export class TrialService {
  private getPath() {
    return join(app.getPath('userData'), 'trial.json')
  }

  ensureInitialized() {
    const p = this.getPath()
    if (existsSync(p)) return

    const startedAt = Date.now()
    const expiresAt = startedAt + TRIAL_DAYS * 24 * 60 * 60 * 1000

    writeFileSync(
      p,
      JSON.stringify({ startedAt, expiresAt }, null, 2),
      { encoding: 'utf-8' }
    )
  }

  getStatus(): TrialStatus {
    const p = this.getPath()
    const raw = readFileSync(p, 'utf-8')
    const data = JSON.parse(raw) as { startedAt: number; expiresAt: number }

    const now = Date.now()
    const remainingMs = Math.max(0, data.expiresAt - now)
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000))

    return {
      startedAt: data.startedAt,
      expiresAt: data.expiresAt,
      remainingDays,
      expired: now >= data.expiresAt,
    }
  }
}
