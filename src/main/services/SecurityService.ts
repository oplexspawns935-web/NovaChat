import { execFile } from 'child_process'

export type Threat = {
  threatId: string
  threatName: string
  severity: 'Low' | 'Medium' | 'High' | 'Severe' | 'Unknown'
  threatStatus: string
  detectionTime: number
  resourceLocation: string | null
}

export type DefenderStatus = {
  antivirusEnabled: boolean | null
  realTimeProtectionEnabled: boolean | null
  tamperProtection: string | null
  signatureVersion: string | null
  lastQuickScan: number | null
  lastFullScan: number | null
  lastError: string | null
  raw?: any
}

export type SecurityStatus = {
  runningScan: boolean
  lastError: string | null
  defender: DefenderStatus | null
  threats: Threat[]
}

function runPowerShellJson(script: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const args = [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script,
    ]

    execFile('powershell.exe', args, { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(String(stderr || err.message || err)))
      }
      const text = String(stdout || '').trim()
      if (!text) return resolve(null)
      try {
        resolve(JSON.parse(text))
      } catch (e) {
        reject(new Error('Failed to parse PowerShell JSON output'))
      }
    })
  })
}

export class SecurityService {
  private status: SecurityStatus = {
    runningScan: false,
    lastError: null,
    defender: null,
    threats: [],
  }

  getStatus() {
    return this.status
  }

  async refreshDefenderStatus() {
    try {
      // Get status, but don’t crash if Defender module isn’t available.
      const s = await runPowerShellJson(
        "try { Get-MpComputerStatus | Select-Object AMServiceEnabled,AntivirusEnabled,RealTimeProtectionEnabled,IsTamperProtected,AntivirusSignatureVersion,QuickScanEndTime,FullScanEndTime | ConvertTo-Json -Depth 3 } catch { $null | ConvertTo-Json }"
      )

      const defender: DefenderStatus | null =
        s && typeof s === 'object'
          ? {
              antivirusEnabled: typeof s.AntivirusEnabled === 'boolean' ? s.AntivirusEnabled : null,
              realTimeProtectionEnabled:
                typeof s.RealTimeProtectionEnabled === 'boolean' ? s.RealTimeProtectionEnabled : null,
              tamperProtection: s.IsTamperProtected != null ? String(s.IsTamperProtected) : null,
              signatureVersion: s.AntivirusSignatureVersion != null ? String(s.AntivirusSignatureVersion) : null,
              lastQuickScan: s.QuickScanEndTime ? Date.parse(String(s.QuickScanEndTime)) || null : null,
              lastFullScan: s.FullScanEndTime ? Date.parse(String(s.FullScanEndTime)) || null : null,
              lastError: null,
              raw: s,
            }
          : null

      this.status = { ...this.status, lastError: null, defender }
      return this.status
    } catch (e: any) {
      const msg = String(e?.message || e)
      this.status = { ...this.status, lastError: msg }
      return this.status
    }
  }

  async startDefenderScan(scanType: 'QuickScan' | 'FullScan') {
    if (this.status.runningScan) throw new Error('Scan already running')
    this.status = { ...this.status, runningScan: true, lastError: null }

    try {
      // Start-MpScan returns immediately but may need admin.
      await runPowerShellJson(
        `try { Start-MpScan -ScanType ${scanType} | Out-Null; @{ ok = $true } | ConvertTo-Json } catch { @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json }`
      )
      await this.refreshDefenderStatus()
      this.status = { ...this.status, runningScan: false, lastError: null }
      return this.status
    } catch (e: any) {
      const msg = String(e?.message || e)
      this.status = { ...this.status, runningScan: false, lastError: msg }
      return this.status
    }
  }

  async getThreats(): Promise<Threat[]> {
    try {
      const threatsRaw = await runPowerShellJson(
        "try { Get-MpThreatDetection | Select-Object ThreatId,ThreatName,Severity,ThreatStatus,InitialDetectionTime,ResourceLocation | ConvertTo-Json -Depth 3 } catch { @() | ConvertTo-Json }"
      )

      const threats: Threat[] = []
      
      if (Array.isArray(threatsRaw)) {
        for (const t of threatsRaw) {
          threats.push({
            threatId: String(t.ThreatId || ''),
            threatName: String(t.ThreatName || 'Unknown'),
            severity: ['Low', 'Medium', 'High', 'Severe'].includes(t.Severity) ? t.Severity : 'Unknown',
            threatStatus: String(t.ThreatStatus || 'Unknown'),
            detectionTime: t.InitialDetectionTime ? Date.parse(String(t.InitialDetectionTime)) || Date.now() : Date.now(),
            resourceLocation: t.ResourceLocation ? String(t.ResourceLocation) : null,
          })
        }
      }

      this.status = { ...this.status, threats }
      return threats
    } catch (e: any) {
      const msg = String(e?.message || e)
      this.status = { ...this.status, lastError: msg }
      return []
    }
  }

  async removeThreat(threatId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await runPowerShellJson(
        `try { Remove-MpThreat -ThreatId '${threatId}' | Out-Null; @{ ok = $true } | ConvertTo-Json } catch { @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json }`
      )
      await this.getThreats()
      return { ok: true }
    } catch (e: any) {
      const msg = String(e?.message || e)
      return { ok: false, error: msg }
    }
  }
}
