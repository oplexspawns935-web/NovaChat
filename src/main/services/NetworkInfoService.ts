import { execFile } from 'child_process'

export type NetworkInfo = {
  interfaceName: string | null
  type: 'wifi' | 'ethernet' | 'unknown'
  ssid: string | null
  connected: boolean
  lastError: string | null
}

function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script]
    execFile('powershell.exe', args, { windowsHide: true, maxBuffer: 5 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(String(stderr || err.message || err)))
      resolve(String(stdout || ''))
    })
  })
}

export class NetworkInfoService {
  async getInfo(): Promise<NetworkInfo> {
    try {
      // Pick the primary connected adapter.
      const json = await runPowerShell(
        "$a = Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Sort-Object -Property InterfaceMetric | Select-Object -First 1 Name,InterfaceDescription,ifIndex; if($a){$a | ConvertTo-Json -Depth 3}else{ $null | ConvertTo-Json }"
      )
      const adapter = JSON.parse(json)

      if (!adapter) {
        return { interfaceName: null, type: 'unknown', ssid: null, connected: false, lastError: null }
      }

      const iface = String(adapter.Name || '') || null
      const desc = String(adapter.InterfaceDescription || '')

      let type: NetworkInfo['type'] = 'unknown'
      if (/wi-?fi|wireless|wlan/i.test(desc)) type = 'wifi'
      else if (/ethernet|gbe|pci[- ]e/i.test(desc)) type = 'ethernet'

      let ssid: string | null = null
      if (type === 'wifi') {
        try {
          const out = await runPowerShell("(netsh wlan show interfaces) | Out-String")
          const m = out.match(/\s*SSID\s*:\s*(.+)\r?\n/i)
          if (m && m[1]) ssid = m[1].trim()
          if (ssid && /BSSID/i.test(ssid)) ssid = null
        } catch {
          ssid = null
        }
      }

      return { interfaceName: iface, type, ssid, connected: true, lastError: null }
    } catch (e: any) {
      return {
        interfaceName: null,
        type: 'unknown',
        ssid: null,
        connected: false,
        lastError: String(e?.message || e),
      }
    }
  }
}
