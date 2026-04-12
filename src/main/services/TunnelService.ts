import { app } from 'electron'
import { execFile } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { EventEmitter } from 'events'

export type TunnelProvider = 'wireguard'

export type TunnelRegion = {
  id: string
  name: string
  country: string
  city: string
  latencyHintMs: number
}

export type TunnelStatus = {
  provider: TunnelProvider
  installed: boolean
  connected: boolean
  activeRegionId: string | null
  lastError: string | null
}

const REGIONS: TunnelRegion[] = [
  { id: 'eu-lon', name: 'London', country: 'UK', city: 'London', latencyHintMs: 18 },
  { id: 'eu-fra', name: 'Frankfurt', country: 'DE', city: 'Frankfurt', latencyHintMs: 22 },
  { id: 'eu-par', name: 'Paris', country: 'FR', city: 'Paris', latencyHintMs: 24 },
  { id: 'us-nyc', name: 'New York', country: 'US', city: 'New York', latencyHintMs: 78 },
  { id: 'us-chi', name: 'Chicago', country: 'US', city: 'Chicago', latencyHintMs: 92 },
]

function tryFindWireGuardExe(): string | null {
  const candidates = [
    'C:\\Program Files\\WireGuard\\wireguard.exe',
    'C:\\Program Files (x86)\\WireGuard\\wireguard.exe',
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

export class TunnelService extends EventEmitter {
  private provider: TunnelProvider = 'wireguard'
  private wgExePath: string | null = null
  private status: TunnelStatus = {
    provider: 'wireguard',
    installed: false,
    connected: false,
    activeRegionId: null,
    lastError: null,
  }

  constructor() {
    super()
    this.refreshInstallState()
  }

  refreshInstallState() {
    this.wgExePath = tryFindWireGuardExe()
    this.status = {
      ...this.status,
      installed: !!this.wgExePath,
    }
    this.emit('status', this.status)
    return this.status
  }

  getRegions() {
    return REGIONS
  }

  getStatus() {
    return this.status
  }

  private getTunnelDir() {
    return join(app.getPath('userData'), 'tunnels')
  }

  private getTunnelConfigPath(regionId: string) {
    return join(this.getTunnelDir(), `${regionId}.conf`)
  }

  async connect(regionId: string) {
    this.refreshInstallState()
    if (!this.wgExePath) {
      this.status = { ...this.status, lastError: 'WireGuard is not installed.' }
      return this.status
    }

    const dir = this.getTunnelDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const confPath = this.getTunnelConfigPath(regionId)
    if (!existsSync(confPath)) {
      const template = this.buildTemplateConfig(regionId)
      writeFileSync(confPath, template, { encoding: 'utf-8' })
    }

    await this.runWireGuard(['/installtunnelservice', confPath])

    this.status = {
      ...this.status,
      connected: true,
      activeRegionId: regionId,
      lastError: null,
    }
    this.emit('status', this.status)
    return this.status
  }

  async disconnect() {
    this.refreshInstallState()
    if (!this.wgExePath) {
      this.status = { ...this.status, lastError: 'WireGuard is not installed.' }
      return this.status
    }

    const regionId = this.status.activeRegionId
    if (!regionId) {
      this.status = { ...this.status, connected: false, lastError: null }
      return this.status
    }

    const confPath = this.getTunnelConfigPath(regionId)
    await this.runWireGuard(['/uninstalltunnelservice', confPath]).catch(() => {
      // swallow uninstall failures; we still want UI to recover
    })

    this.status = {
      ...this.status,
      connected: false,
      activeRegionId: null,
      lastError: null,
    }
    this.emit('status', this.status)
    return this.status
  }

  private buildTemplateConfig(regionId: string) {
    const region = REGIONS.find((r) => r.id === regionId)
    const name = region ? `${region.city}-${region.country}` : regionId

    return [
      `[Interface]`,
      `PrivateKey = REPLACE_ME`,
      `Address = 10.13.37.2/32`,
      `DNS = 1.1.1.1`,
      ``,
      `[Peer]`,
      `PublicKey = REPLACE_ME`,
      `AllowedIPs = 0.0.0.0/0, ::/0`,
      `Endpoint = ${name}.example.com:51820`,
      `PersistentKeepalive = 25`,
      ``,
    ].join('\n')
  }

  private runWireGuard(args: string[]) {
    return new Promise<void>((resolve, reject) => {
      if (!this.wgExePath) return reject(new Error('WireGuard not installed'))

      execFile(this.wgExePath, args, { windowsHide: true }, (err, _stdout, stderr) => {
        if (err) {
          const msg = (stderr || err.message || 'WireGuard command failed').toString()
          this.status = { ...this.status, lastError: msg }
          this.emit('status', this.status)
          return reject(new Error(msg))
        }
        resolve()
      })
    })
  }
}
