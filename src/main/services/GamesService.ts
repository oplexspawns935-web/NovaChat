import { app } from 'electron'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { execFile } from 'child_process'

export type SteamGame = {
  appId: string
  name: string
  installDir: string
  libraryPath: string
  source: 'steam'
}

function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script]
    execFile('powershell.exe', args, { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(String(stderr || err.message || err)))
      resolve(String(stdout || ''))
    })
  })
}

export type EpicGame = {
  appId: string
  name: string
  installDir: string
  source: 'epic'
}

export type WindowsGame = {
  appId: string
  name: string
  installDir: string
  source: 'windows'
  displayIconPath?: string | null
}

export type InstalledGame = (SteamGame | EpicGame | WindowsGame) & {
  id: string
}

export type GamesStatus = {
  steamInstalled: boolean
  steamPath: string | null
  epicInstalled: boolean
  epicManifestPath: string | null
  lastScanAt: number | null
  lastError: string | null
}

function tryFindSteamPath(): string | null {
  const candidates: Array<string | undefined> = [
    process.env['ProgramFiles(x86)'] ? join(process.env['ProgramFiles(x86)']!, 'Steam') : undefined,
    process.env['ProgramFiles'] ? join(process.env['ProgramFiles']!, 'Steam') : undefined,
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
  ]

  for (const p of candidates) {
    if (!p) continue
    try {
      if (existsSync(join(p, 'steam.exe'))) return p
    } catch {
      // ignore
    }
  }
  return null
}

function readTextSafe(path: string) {
  return readFileSync(path, 'utf-8')
}

function parseKeyValueFile(content: string): Record<string, any> {
  // Very small KeyValues-ish parser for Steam .vdf/.acf.
  // Handles: "key"  "value" and nested blocks with { }
  const tokens: string[] = []
  const re = /"([^"\\]*(?:\\.[^"\\]*)*)"|\{|\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content))) {
    if (m[0] === '{' || m[0] === '}') tokens.push(m[0])
    else tokens.push(m[1] ?? '')
  }

  let i = 0
  function parseObject(): any {
    const obj: Record<string, any> = {}
    while (i < tokens.length) {
      const t = tokens[i++]
      if (t === '}') break
      if (t === '{') continue

      const key = t
      const next = tokens[i++]
      if (next === '{') {
        obj[key] = parseObject()
      } else if (next === '}') {
        obj[key] = {}
        break
      } else {
        obj[key] = next
      }
    }
    return obj
  }

  // skip leading root key if present
  const rootKey = tokens[0]
  const rootNext = tokens[1]
  if (rootNext === '{') {
    i = 2
    const rootObj = parseObject()
    return { [rootKey]: rootObj }
  }

  i = 0
  return parseObject()
}

function getSteamLibraries(steamPath: string): string[] {
  const libraries: string[] = [steamPath]
  const vdfPath = join(steamPath, 'steamapps', 'libraryfolders.vdf')
  if (!existsSync(vdfPath)) return libraries

  const parsed = parseKeyValueFile(readTextSafe(vdfPath))
  const root = parsed['libraryfolders'] ?? parsed['LibraryFolders'] ?? parsed

  const maybeFolders = typeof root === 'object' && root ? root : {}

  for (const k of Object.keys(maybeFolders)) {
    const entry = maybeFolders[k]
    if (typeof entry === 'string') {
      libraries.push(entry)
      continue
    }
    if (entry && typeof entry === 'object') {
      const p = entry['path']
      if (typeof p === 'string') libraries.push(p)
    }
  }

  return Array.from(new Set(libraries))
}

function safeDirExists(p: string) {
  try {
    return existsSync(p) && statSync(p).isDirectory()
  } catch {
    return false
  }
}

function getSteamGamesFromLibrary(libraryPath: string): SteamGame[] {
  const steamAppsPath = join(libraryPath, 'steamapps')
  const commonPath = join(steamAppsPath, 'common')
  if (!safeDirExists(steamAppsPath)) return []

  const files = readdirSync(steamAppsPath)
  const manifests = files.filter((f) => f.startsWith('appmanifest_') && f.endsWith('.acf'))

  const games: SteamGame[] = []
  for (const file of manifests) {
    const manifestPath = join(steamAppsPath, file)
    try {
      const parsed = parseKeyValueFile(readTextSafe(manifestPath))
      const appState = parsed['AppState'] ?? parsed
      const appId = String(appState['appid'] ?? '').trim()
      const name = String(appState['name'] ?? '').trim()
      const installdir = String(appState['installdir'] ?? '').trim()
      if (!appId || !name || !installdir) continue

      const installDir = join(commonPath, installdir)
      games.push({
        appId,
        name,
        installDir,
        libraryPath,
        source: 'steam',
      })
    } catch {
      // ignore malformed manifests
    }
  }

  return games
}

export class GamesService {
  private status: GamesStatus = {
    steamInstalled: false,
    steamPath: null,
    epicInstalled: false,
    epicManifestPath: null,
    lastScanAt: null,
    lastError: null,
  }

  getStatus() {
    return this.status
  }

  private scanEpicGames(): { epicInstalled: boolean; epicManifestPath: string | null; games: EpicGame[] } {
    const candidates: Array<string | undefined> = [
      process.env['ProgramData'] ? join(process.env['ProgramData']!, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests', 'installed.json') : undefined,
      'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests\\installed.json',
    ]

    for (const p of candidates) {
      if (!p) continue
      try {
        if (!existsSync(p)) continue
        const raw = readFileSync(p, 'utf-8')
        const json = JSON.parse(raw)
        const list: any[] = Array.isArray(json) ? json : Array.isArray(json?.InstallationList) ? json.InstallationList : []
        const games: EpicGame[] = []
        for (const it of list) {
          const appId = String(it?.AppName || it?.AppId || it?.CatalogItemId || it?.ItemId || '').trim()
          const name = String(it?.DisplayName || it?.AppName || '').trim()
          const installDir = String(it?.InstallLocation || it?.InstallDir || '').trim()
          if (!appId || !name || !installDir) continue
          games.push({ appId, name, installDir, source: 'epic' })
        }
        games.sort((a, b) => a.name.localeCompare(b.name))
        return { epicInstalled: true, epicManifestPath: p, games }
      } catch {
        // ignore
      }
    }

    return { epicInstalled: false, epicManifestPath: null, games: [] }
  }

  private async scanWindowsInstalledGames(): Promise<WindowsGame[]> {
    try {
      const script =
        "$paths = @('HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*');" +
        "$apps = foreach($p in $paths){ Get-ItemProperty -Path $p -ErrorAction SilentlyContinue } |" +
        " Where-Object { $_.DisplayName -and ($_.InstallLocation -or $_.DisplayIcon) } |" +
        " Select-Object DisplayName,InstallLocation,DisplayIcon,Publisher | ConvertTo-Json -Depth 3"

      const out = await runPowerShell(script)
      const parsed = JSON.parse(out || 'null')
      const arr: any[] = Array.isArray(parsed) ? parsed : parsed ? [parsed] : []

      const games: WindowsGame[] = []
      for (const it of arr) {
        const name = String(it?.DisplayName || '').trim()
        if (!name) continue

        // Light heuristic to reduce noise: prefer entries that look like games/launchers.
        const publisher = String(it?.Publisher || '').toLowerCase()
        const looksGamey =
          /(game|launcher|steam|epic|riot|battle\.net|ubisoft|rockstar|xbox|valve)/i.test(name) ||
          /(epic|riot|blizzard|ubisoft|rockstar|ea|valve)/i.test(publisher)

        if (!looksGamey) continue

        const installDir = String(it?.InstallLocation || '').trim()
        const displayIcon = String(it?.DisplayIcon || '').trim()

        const appId = name
        games.push({
          appId,
          name,
          installDir: installDir || '',
          source: 'windows',
          displayIconPath: displayIcon || null,
        })
      }

      games.sort((a, b) => a.name.localeCompare(b.name))
      return games
    } catch {
      return []
    }
  }

  async scanSteamGames(): Promise<{ status: GamesStatus; games: InstalledGame[] }> {
    try {
      const epic = this.scanEpicGames()
      const windowsGames = await this.scanWindowsInstalledGames()
      const steamPath = tryFindSteamPath()
      if (!steamPath) {
        this.status = {
          steamInstalled: false,
          steamPath: null,
          epicInstalled: epic.epicInstalled,
          epicManifestPath: epic.epicManifestPath,
          lastScanAt: Date.now(),
          lastError: null,
        }
        const epicGames: InstalledGame[] = epic.games.map((g) => ({ ...g, id: `epic:${g.appId}` }))
        const win: InstalledGame[] = windowsGames.map((g) => ({ ...g, id: `win:${g.appId}` }))
        const merged = [...epicGames, ...win]
        merged.sort((a, b) => a.name.localeCompare(b.name))
        return { status: this.status, games: merged }
      }

      const libraries = getSteamLibraries(steamPath)
      const steamGames = libraries.flatMap((lib) => getSteamGamesFromLibrary(lib))
      steamGames.sort((a, b) => a.name.localeCompare(b.name))

      const unified: InstalledGame[] = [
        ...steamGames.map((g) => ({ ...g, id: `steam:${g.appId}` })),
        ...epic.games.map((g) => ({ ...g, id: `epic:${g.appId}` })),
        ...windowsGames.map((g) => ({ ...g, id: `win:${g.appId}` })),
      ]
      unified.sort((a, b) => a.name.localeCompare(b.name))

      this.status = {
        steamInstalled: true,
        steamPath,
        epicInstalled: epic.epicInstalled,
        epicManifestPath: epic.epicManifestPath,
        lastScanAt: Date.now(),
        lastError: null,
      }

      return { status: this.status, games: unified }
    } catch (e: any) {
      this.status = {
        ...this.status,
        lastScanAt: Date.now(),
        lastError: String(e?.message || e),
      }
      return { status: this.status, games: [] }
    }
  }

  // placeholder to keep room for future persistence; currently renderer can store boost toggles via settings
  getDataDir() {
    return join(app.getPath('userData'), 'games')
  }
}
