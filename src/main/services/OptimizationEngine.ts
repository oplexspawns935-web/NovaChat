import { EventEmitter } from 'events'
import { execFile } from 'child_process'

export type RoutingMode = 'smart_auto' | 'gaming' | 'streaming' | 'custom'

export type OptimizationSample = {
  ts: number
  pingMs: number
  jitterMs: number
  packetLossPct: number
  bandwidthMbps: number
  qualityScore: number
}

export type EngineStatus = {
  running: boolean
  mode: RoutingMode
  dnsOptimization: boolean
  trafficPriority: 'balanced' | 'latency' | 'throughput'
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export class OptimizationEngine extends EventEmitter {
  private running = false
  private timer: NodeJS.Timeout | null = null

  private pingHistory: number[] = []
  private status: EngineStatus = {
    running: false,
    mode: 'smart_auto',
    dnsOptimization: true,
    trafficPriority: 'balanced',
  }

  private latest: OptimizationSample = {
    ts: Date.now(),
    pingMs: 0,
    jitterMs: 0,
    packetLossPct: 0,
    bandwidthMbps: 0,
    qualityScore: 0,
  }

  isRunning() {
    return this.running
  }

  getStatus() {
    return this.status
  }

  getLatestSample() {
    return this.latest
  }

  start() {
    if (this.running) return
    this.running = true
    this.status = { ...this.status, running: true }
    this.pingHistory = []
    this.emit('log', JSON.stringify({ ts: Date.now(), level: 'info', msg: 'Engine started' }))

    this.timer = setInterval(async () => {
      const now = Date.now()
      
      // Ping Google DNS for real latency measurement
      const pingMs = await this.measurePing()
      
      // Calculate jitter from ping history
      this.pingHistory.push(pingMs)
      if (this.pingHistory.length > 10) this.pingHistory.shift()
      
      const jitterMs = this.calculateJitter()
      
      // Packet loss is estimated from ping failures
      const packetLossPct = pingMs === 0 ? 100 : 0
      
      // Quality score based on ping and jitter
      const qualityScore = Math.max(0, 100 - (pingMs * 0.5) - (jitterMs * 1.5))
      
      this.latest = {
        ts: now,
        pingMs: Math.round(pingMs * 10) / 10,
        jitterMs: Math.round(jitterMs * 10) / 10,
        packetLossPct,
        bandwidthMbps: 0,
        qualityScore: Math.round(qualityScore),
      }

      this.emit('sample', this.latest)
    }, 1000)
  }

  stop() {
    if (!this.running) return
    this.running = false
    this.status = { ...this.status, running: false }
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.emit('log', JSON.stringify({ ts: Date.now(), level: 'info', msg: 'Engine stopped' }))
  }

  setMode(mode: RoutingMode) {
    this.status = { ...this.status, mode }
    this.emit('log', JSON.stringify({ ts: Date.now(), level: 'info', msg: `Mode set: ${mode}` }))
  }

  setDnsOptimization(enabled: boolean) {
    this.status = { ...this.status, dnsOptimization: enabled }
    this.emit('log', JSON.stringify({ ts: Date.now(), level: 'info', msg: `DNS optimization: ${enabled}` }))
    
    if (enabled) {
      this.setDnsServers(['8.8.8.8', '8.8.4.4'])
    } else {
      this.resetDns()
    }
  }

  setTrafficPriority(priority: EngineStatus['trafficPriority']) {
    this.status = { ...this.status, trafficPriority: priority }
    this.emit('log', JSON.stringify({ ts: Date.now(), level: 'info', msg: `Traffic priority: ${priority}` }))
    
    // Apply QoS policies based on priority
    this.applyTrafficPriority(priority)
  }

  private async measurePing(): Promise<number> {
    return new Promise((resolve) => {
      execFile('ping', ['-n', '1', '-w', '2000', '8.8.8.8'], { windowsHide: true }, (err, stdout) => {
        if (err) {
          resolve(0)
          return
        }
        const match = stdout.match(/time[=<](\d+)ms/)
        const ping = match ? parseInt(match[1], 10) : 0
        resolve(ping)
      })
    })
  }

  private calculateJitter(): number {
    if (this.pingHistory.length < 2) return 0
    const diffs = []
    for (let i = 1; i < this.pingHistory.length; i++) {
      diffs.push(Math.abs(this.pingHistory[i] - this.pingHistory[i - 1]))
    }
    return diffs.reduce((a, b) => a + b, 0) / diffs.length
  }

  private async setDnsServers(dnsServers: string[]): Promise<void> {
    try {
      // Get all network interfaces
      const interfaces = await this.getNetworkInterfaces()
      
      for (const iface of interfaces) {
        // Set DNS using netsh
        const dnsArgs = dnsServers.map(d => d).join(' ')
        execFile('netsh', [
          'interface', 'ip', 'set', 'dns',
          iface.name,
          'static',
          ...dnsServers
        ], { windowsHide: true }, (err) => {
          if (err) {
            this.emit('log', JSON.stringify({ ts: Date.now(), level: 'error', msg: `Failed to set DNS for ${iface.name}: ${err.message}` }))
          } else {
            this.emit('log', JSON.stringify({ ts: Date.now(), level: 'info', msg: `DNS set for ${iface.name}` }))
          }
        })
      }
    } catch (e: any) {
      this.emit('log', JSON.stringify({ ts: Date.now(), level: 'error', msg: `DNS optimization failed: ${e.message}` }))
    }
  }

  private async resetDns(): Promise<void> {
    try {
      const interfaces = await this.getNetworkInterfaces()
      
      for (const iface of interfaces) {
        execFile('netsh', [
          'interface', 'ip', 'set', 'dns',
          iface.name,
          'dhcp'
        ], { windowsHide: true }, (err) => {
          if (err) {
            this.emit('log', JSON.stringify({ ts: Date.now(), level: 'error', msg: `Failed to reset DNS for ${iface.name}: ${err.message}` }))
          } else {
            this.emit('log', JSON.stringify({ ts: Date.now(), level: 'info', msg: `DNS reset for ${iface.name}` }))
          }
        })
      }
    } catch (e: any) {
      this.emit('log', JSON.stringify({ ts: Date.now(), level: 'error', msg: `DNS reset failed: ${e.message}` }))
    }
  }

  private async getNetworkInterfaces(): Promise<{ name: string }[]> {
    return new Promise((resolve) => {
      execFile('netsh', ['interface', 'show', 'interface'], { windowsHide: true }, (err, stdout) => {
        if (err) {
          resolve([])
          return
        }
        const lines = stdout.split('\n')
        const interfaces: { name: string }[] = []
        
        for (const line of lines) {
          const match = line.match(/^\s*\d+\s+(\S+)\s+/)
          if (match && match[1] !== 'Loopback') {
            interfaces.push({ name: match[1] })
          }
        }
        
        resolve(interfaces)
      })
    })
  }

  private async applyTrafficPriority(priority: EngineStatus['trafficPriority']): Promise<void> {
    try {
      // Windows QoS can be configured using netsh or Group Policy
      // For now, we'll log the priority setting since full QoS requires admin privileges
      this.emit('log', JSON.stringify({ 
        ts: Date.now(), 
        level: 'info', 
        msg: `Traffic priority set to ${priority} (requires admin for QoS policy application)` 
      }))
      
      // Note: Real QoS requires:
      // 1. Admin privileges
      // 2. netsh qos commands or Group Policy Objects
      // 3. Windows 10/11 Pro or Enterprise
    } catch (e: any) {
      this.emit('log', JSON.stringify({ ts: Date.now(), level: 'error', msg: `Traffic priority failed: ${e.message}` }))
    }
  }

  async addRoute(destination: string, gateway: string): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile('route', ['add', destination, gateway], { windowsHide: true }, (err, stdout) => {
        if (err) {
          reject(new Error(err.message || 'Failed to add route'))
        } else {
          this.emit('log', JSON.stringify({ ts: Date.now(), level: 'info', msg: `Route added: ${destination} via ${gateway}` }))
          resolve()
        }
      })
    })
  }

  async deleteRoute(destination: string): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile('route', ['delete', destination], { windowsHide: true }, (err, stdout) => {
        if (err) {
          reject(new Error(err.message || 'Failed to delete route'))
        } else {
          this.emit('log', JSON.stringify({ ts: Date.now(), level: 'info', msg: `Route deleted: ${destination}` }))
          resolve()
        }
      })
    })
  }

  async getRoutes(): Promise<string[]> {
    return new Promise((resolve) => {
      execFile('route', ['print'], { windowsHide: true }, (err, stdout) => {
        if (err) {
          resolve([])
          return
        }
        const lines = stdout.split('\n')
        const routes: string[] = []
        
        for (const line of lines) {
          if (line.match(/^\d+\.\d+\.\d+\.\d+/)) {
            routes.push(line.trim())
          }
        }
        
        resolve(routes)
      })
    })
  }
}
