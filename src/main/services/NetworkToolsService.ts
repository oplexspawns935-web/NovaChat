import { execFile } from 'child_process'

export type NetworkActionResult = {
  ok: boolean
  action: string
  stdout: string
  stderr: string
}

function run(cmd: string, args: string[]): Promise<NetworkActionResult> {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const out = String(stdout || '')
      const errText = String(stderr || '')
      resolve({
        ok: !err,
        action: `${cmd} ${args.join(' ')}`,
        stdout: out,
        stderr: err ? (errText || String(err.message || err)) : errText,
      })
    })
  })
}

export class NetworkToolsService {
  flushDns() {
    return run('ipconfig', ['/flushdns'])
  }

  renewIp() {
    return run('ipconfig', ['/renew'])
  }

  releaseIp() {
    return run('ipconfig', ['/release'])
  }

  resetWinsock() {
    return run('netsh', ['winsock', 'reset'])
  }

  resetTcpIp() {
    return run('netsh', ['int', 'ip', 'reset'])
  }
}
