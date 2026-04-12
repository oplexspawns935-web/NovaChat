import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { EventEmitter } from 'events'

export type CaptureStatus = {
  installed: boolean
  running: boolean
  tsharkPath: string | null
  outputPath: string | null
  lastError: string | null
}

function tryFindTShark(): string | null {
  const candidates = [
    'C:\\Program Files\\Wireshark\\tshark.exe',
    'C:\\Program Files (x86)\\Wireshark\\tshark.exe',
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

export class PacketCaptureService extends EventEmitter {
  private tsharkPath: string | null = null
  private proc: ChildProcessWithoutNullStreams | null = null

  private status: CaptureStatus = {
    installed: false,
    running: false,
    tsharkPath: null,
    outputPath: null,
    lastError: null,
  }

  constructor() {
    super()
    this.refreshInstallState()
  }

  refreshInstallState() {
    this.tsharkPath = tryFindTShark()
    this.status = {
      ...this.status,
      installed: !!this.tsharkPath,
      tsharkPath: this.tsharkPath,
    }
    this.emit('status', this.status)
    return this.status
  }

  getStatus() {
    return this.status
  }

  private getCaptureDir() {
    return join(app.getPath('userData'), 'captures')
  }

  async startCapture(args?: { interfaceName?: string }) {
    this.refreshInstallState()
    if (!this.tsharkPath) {
      this.status = { ...this.status, lastError: 'TShark (Wireshark CLI) not found.' }
      return this.status
    }

    if (this.proc) {
      return this.status
    }

    const dir = this.getCaptureDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const out = join(dir, `nova-capture-${ts}.pcapng`)

    const wgArgs: string[] = []
    if (args?.interfaceName) {
      wgArgs.push('-i', args.interfaceName)
    }

    // -w writes capture file. This requires appropriate permissions.
    const proc = spawn(this.tsharkPath, [...wgArgs, '-w', out], {
      windowsHide: true,
    })

    this.proc = proc
    this.status = {
      ...this.status,
      running: true,
      outputPath: out,
      lastError: null,
    }
    this.emit('status', this.status)

    proc.on('error', (e) => {
      this.status = { ...this.status, lastError: String(e), running: false }
      this.proc = null
      this.emit('status', this.status)
    })

    proc.on('exit', (code) => {
      this.status = { ...this.status, running: false, lastError: code ? `Capture exited: ${code}` : null }
      this.proc = null
      this.emit('status', this.status)
    })

    return this.status
  }

  async stopCapture() {
    if (!this.proc) return this.status

    // Graceful stop: send CTRL+C equivalent
    try {
      this.proc.kill('SIGINT')
    } catch {
      try {
        this.proc.kill('SIGTERM')
      } catch {
        // ignore
      }
    }

    this.proc = null
    this.status = { ...this.status, running: false }
    this.emit('status', this.status)
    return this.status
  }
}
