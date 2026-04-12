"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const events = require("events");
const child_process = require("child_process");
const crypto = require("crypto");
const https = require("https");
const http = require("http");
const os = require("os");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const https__namespace = /* @__PURE__ */ _interopNamespaceDefault(https);
class OptimizationEngine extends events.EventEmitter {
  running = false;
  timer = null;
  pingHistory = [];
  status = {
    running: false,
    mode: "smart_auto",
    dnsOptimization: true,
    trafficPriority: "balanced"
  };
  latest = {
    ts: Date.now(),
    pingMs: 0,
    jitterMs: 0,
    packetLossPct: 0,
    bandwidthMbps: 0,
    qualityScore: 0
  };
  isRunning() {
    return this.running;
  }
  getStatus() {
    return this.status;
  }
  getLatestSample() {
    return this.latest;
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.status = { ...this.status, running: true };
    this.pingHistory = [];
    this.emit("log", JSON.stringify({ ts: Date.now(), level: "info", msg: "Engine started" }));
    this.timer = setInterval(async () => {
      const now = Date.now();
      const pingMs = await this.measurePing();
      this.pingHistory.push(pingMs);
      if (this.pingHistory.length > 10) this.pingHistory.shift();
      const jitterMs = this.calculateJitter();
      const packetLossPct = pingMs === 0 ? 100 : 0;
      const qualityScore = Math.max(0, 100 - pingMs * 0.5 - jitterMs * 1.5);
      this.latest = {
        ts: now,
        pingMs: Math.round(pingMs * 10) / 10,
        jitterMs: Math.round(jitterMs * 10) / 10,
        packetLossPct,
        bandwidthMbps: 0,
        qualityScore: Math.round(qualityScore)
      };
      this.emit("sample", this.latest);
    }, 1e3);
  }
  stop() {
    if (!this.running) return;
    this.running = false;
    this.status = { ...this.status, running: false };
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.emit("log", JSON.stringify({ ts: Date.now(), level: "info", msg: "Engine stopped" }));
  }
  setMode(mode) {
    this.status = { ...this.status, mode };
    this.emit("log", JSON.stringify({ ts: Date.now(), level: "info", msg: `Mode set: ${mode}` }));
  }
  setDnsOptimization(enabled) {
    this.status = { ...this.status, dnsOptimization: enabled };
    this.emit("log", JSON.stringify({ ts: Date.now(), level: "info", msg: `DNS optimization: ${enabled}` }));
    if (enabled) {
      this.setDnsServers(["8.8.8.8", "8.8.4.4"]);
    } else {
      this.resetDns();
    }
  }
  setTrafficPriority(priority) {
    this.status = { ...this.status, trafficPriority: priority };
    this.emit("log", JSON.stringify({ ts: Date.now(), level: "info", msg: `Traffic priority: ${priority}` }));
    this.applyTrafficPriority(priority);
  }
  async measurePing() {
    return new Promise((resolve) => {
      child_process.execFile("ping", ["-n", "1", "-w", "2000", "8.8.8.8"], { windowsHide: true }, (err, stdout) => {
        if (err) {
          resolve(0);
          return;
        }
        const match = stdout.match(/time[=<](\d+)ms/);
        const ping = match ? parseInt(match[1], 10) : 0;
        resolve(ping);
      });
    });
  }
  calculateJitter() {
    if (this.pingHistory.length < 2) return 0;
    const diffs = [];
    for (let i = 1; i < this.pingHistory.length; i++) {
      diffs.push(Math.abs(this.pingHistory[i] - this.pingHistory[i - 1]));
    }
    return diffs.reduce((a, b) => a + b, 0) / diffs.length;
  }
  async setDnsServers(dnsServers) {
    try {
      const interfaces = await this.getNetworkInterfaces();
      for (const iface of interfaces) {
        const dnsArgs = dnsServers.map((d) => d).join(" ");
        child_process.execFile("netsh", [
          "interface",
          "ip",
          "set",
          "dns",
          iface.name,
          "static",
          ...dnsServers
        ], { windowsHide: true }, (err) => {
          if (err) {
            this.emit("log", JSON.stringify({ ts: Date.now(), level: "error", msg: `Failed to set DNS for ${iface.name}: ${err.message}` }));
          } else {
            this.emit("log", JSON.stringify({ ts: Date.now(), level: "info", msg: `DNS set for ${iface.name}` }));
          }
        });
      }
    } catch (e) {
      this.emit("log", JSON.stringify({ ts: Date.now(), level: "error", msg: `DNS optimization failed: ${e.message}` }));
    }
  }
  async resetDns() {
    try {
      const interfaces = await this.getNetworkInterfaces();
      for (const iface of interfaces) {
        child_process.execFile("netsh", [
          "interface",
          "ip",
          "set",
          "dns",
          iface.name,
          "dhcp"
        ], { windowsHide: true }, (err) => {
          if (err) {
            this.emit("log", JSON.stringify({ ts: Date.now(), level: "error", msg: `Failed to reset DNS for ${iface.name}: ${err.message}` }));
          } else {
            this.emit("log", JSON.stringify({ ts: Date.now(), level: "info", msg: `DNS reset for ${iface.name}` }));
          }
        });
      }
    } catch (e) {
      this.emit("log", JSON.stringify({ ts: Date.now(), level: "error", msg: `DNS reset failed: ${e.message}` }));
    }
  }
  async getNetworkInterfaces() {
    return new Promise((resolve) => {
      child_process.execFile("netsh", ["interface", "show", "interface"], { windowsHide: true }, (err, stdout) => {
        if (err) {
          resolve([]);
          return;
        }
        const lines = stdout.split("\n");
        const interfaces = [];
        for (const line of lines) {
          const match = line.match(/^\s*\d+\s+(\S+)\s+/);
          if (match && match[1] !== "Loopback") {
            interfaces.push({ name: match[1] });
          }
        }
        resolve(interfaces);
      });
    });
  }
  async applyTrafficPriority(priority) {
    try {
      this.emit("log", JSON.stringify({
        ts: Date.now(),
        level: "info",
        msg: `Traffic priority set to ${priority} (requires admin for QoS policy application)`
      }));
    } catch (e) {
      this.emit("log", JSON.stringify({ ts: Date.now(), level: "error", msg: `Traffic priority failed: ${e.message}` }));
    }
  }
  async addRoute(destination, gateway) {
    return new Promise((resolve, reject) => {
      child_process.execFile("route", ["add", destination, gateway], { windowsHide: true }, (err, stdout) => {
        if (err) {
          reject(new Error(err.message || "Failed to add route"));
        } else {
          this.emit("log", JSON.stringify({ ts: Date.now(), level: "info", msg: `Route added: ${destination} via ${gateway}` }));
          resolve();
        }
      });
    });
  }
  async deleteRoute(destination) {
    return new Promise((resolve, reject) => {
      child_process.execFile("route", ["delete", destination], { windowsHide: true }, (err, stdout) => {
        if (err) {
          reject(new Error(err.message || "Failed to delete route"));
        } else {
          this.emit("log", JSON.stringify({ ts: Date.now(), level: "info", msg: `Route deleted: ${destination}` }));
          resolve();
        }
      });
    });
  }
  async getRoutes() {
    return new Promise((resolve) => {
      child_process.execFile("route", ["print"], { windowsHide: true }, (err, stdout) => {
        if (err) {
          resolve([]);
          return;
        }
        const lines = stdout.split("\n");
        const routes = [];
        for (const line of lines) {
          if (line.match(/^\d+\.\d+\.\d+\.\d+/)) {
            routes.push(line.trim());
          }
        }
        resolve(routes);
      });
    });
  }
}
const TRIAL_DAYS = 30;
class TrialService {
  getPath() {
    return path.join(electron.app.getPath("userData"), "trial.json");
  }
  ensureInitialized() {
    const p = this.getPath();
    if (fs.existsSync(p)) return;
    const startedAt = Date.now();
    const expiresAt = startedAt + TRIAL_DAYS * 24 * 60 * 60 * 1e3;
    fs.writeFileSync(
      p,
      JSON.stringify({ startedAt, expiresAt }, null, 2),
      { encoding: "utf-8" }
    );
  }
  getStatus() {
    const p = this.getPath();
    const raw = fs.readFileSync(p, "utf-8");
    const data = JSON.parse(raw);
    const now = Date.now();
    const remainingMs = Math.max(0, data.expiresAt - now);
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1e3));
    return {
      startedAt: data.startedAt,
      expiresAt: data.expiresAt,
      remainingDays,
      expired: now >= data.expiresAt
    };
  }
}
const DEFAULTS = {
  startOnBoot: false,
  minimizeToTray: true,
  routingMode: "smart_auto",
  trafficPriority: "balanced",
  dnsOptimization: true,
  boostedSteamAppIds: [],
  boostedGameIds: [],
  googleOAuthClientId: ""
};
class SettingsService {
  getPath() {
    return path.join(electron.app.getPath("userData"), "settings.json");
  }
  ensureInitialized() {
    const p = this.getPath();
    if (fs.existsSync(p)) return;
    fs.writeFileSync(p, JSON.stringify(DEFAULTS, null, 2), { encoding: "utf-8" });
  }
  get() {
    const p = this.getPath();
    const raw = fs.readFileSync(p, "utf-8");
    const data = JSON.parse(raw);
    return { ...DEFAULTS, ...data };
  }
  set(patch) {
    const p = this.getPath();
    const next = { ...this.get(), ...patch };
    fs.writeFileSync(p, JSON.stringify(next, null, 2), { encoding: "utf-8" });
    return next;
  }
}
const REGIONS = [
  { id: "eu-lon", name: "London", country: "UK", city: "London", latencyHintMs: 18 },
  { id: "eu-fra", name: "Frankfurt", country: "DE", city: "Frankfurt", latencyHintMs: 22 },
  { id: "eu-par", name: "Paris", country: "FR", city: "Paris", latencyHintMs: 24 },
  { id: "us-nyc", name: "New York", country: "US", city: "New York", latencyHintMs: 78 },
  { id: "us-chi", name: "Chicago", country: "US", city: "Chicago", latencyHintMs: 92 }
];
function tryFindWireGuardExe() {
  const candidates = [
    "C:\\Program Files\\WireGuard\\wireguard.exe",
    "C:\\Program Files (x86)\\WireGuard\\wireguard.exe"
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
class TunnelService extends events.EventEmitter {
  provider = "wireguard";
  wgExePath = null;
  status = {
    provider: "wireguard",
    installed: false,
    connected: false,
    activeRegionId: null,
    lastError: null
  };
  constructor() {
    super();
    this.refreshInstallState();
  }
  refreshInstallState() {
    this.wgExePath = tryFindWireGuardExe();
    this.status = {
      ...this.status,
      installed: !!this.wgExePath
    };
    this.emit("status", this.status);
    return this.status;
  }
  getRegions() {
    return REGIONS;
  }
  getStatus() {
    return this.status;
  }
  getTunnelDir() {
    return path.join(electron.app.getPath("userData"), "tunnels");
  }
  getTunnelConfigPath(regionId) {
    return path.join(this.getTunnelDir(), `${regionId}.conf`);
  }
  async connect(regionId) {
    this.refreshInstallState();
    if (!this.wgExePath) {
      this.status = { ...this.status, lastError: "WireGuard is not installed." };
      return this.status;
    }
    const dir = this.getTunnelDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const confPath = this.getTunnelConfigPath(regionId);
    if (!fs.existsSync(confPath)) {
      const template = this.buildTemplateConfig(regionId);
      fs.writeFileSync(confPath, template, { encoding: "utf-8" });
    }
    await this.runWireGuard(["/installtunnelservice", confPath]);
    this.status = {
      ...this.status,
      connected: true,
      activeRegionId: regionId,
      lastError: null
    };
    this.emit("status", this.status);
    return this.status;
  }
  async disconnect() {
    this.refreshInstallState();
    if (!this.wgExePath) {
      this.status = { ...this.status, lastError: "WireGuard is not installed." };
      return this.status;
    }
    const regionId = this.status.activeRegionId;
    if (!regionId) {
      this.status = { ...this.status, connected: false, lastError: null };
      return this.status;
    }
    const confPath = this.getTunnelConfigPath(regionId);
    await this.runWireGuard(["/uninstalltunnelservice", confPath]).catch(() => {
    });
    this.status = {
      ...this.status,
      connected: false,
      activeRegionId: null,
      lastError: null
    };
    this.emit("status", this.status);
    return this.status;
  }
  buildTemplateConfig(regionId) {
    const region = REGIONS.find((r) => r.id === regionId);
    const name = region ? `${region.city}-${region.country}` : regionId;
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
      ``
    ].join("\n");
  }
  runWireGuard(args) {
    return new Promise((resolve, reject) => {
      if (!this.wgExePath) return reject(new Error("WireGuard not installed"));
      child_process.execFile(this.wgExePath, args, { windowsHide: true }, (err, _stdout, stderr) => {
        if (err) {
          const msg = (stderr || err.message || "WireGuard command failed").toString();
          this.status = { ...this.status, lastError: msg };
          this.emit("status", this.status);
          return reject(new Error(msg));
        }
        resolve();
      });
    });
  }
}
function tryFindTShark() {
  const candidates = [
    "C:\\Program Files\\Wireshark\\tshark.exe",
    "C:\\Program Files (x86)\\Wireshark\\tshark.exe"
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
class PacketCaptureService extends events.EventEmitter {
  tsharkPath = null;
  proc = null;
  status = {
    installed: false,
    running: false,
    tsharkPath: null,
    outputPath: null,
    lastError: null
  };
  constructor() {
    super();
    this.refreshInstallState();
  }
  refreshInstallState() {
    this.tsharkPath = tryFindTShark();
    this.status = {
      ...this.status,
      installed: !!this.tsharkPath,
      tsharkPath: this.tsharkPath
    };
    this.emit("status", this.status);
    return this.status;
  }
  getStatus() {
    return this.status;
  }
  getCaptureDir() {
    return path.join(electron.app.getPath("userData"), "captures");
  }
  async startCapture(args) {
    this.refreshInstallState();
    if (!this.tsharkPath) {
      this.status = { ...this.status, lastError: "TShark (Wireshark CLI) not found." };
      return this.status;
    }
    if (this.proc) {
      return this.status;
    }
    const dir = this.getCaptureDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const out = path.join(dir, `nova-capture-${ts}.pcapng`);
    const wgArgs = [];
    if (args?.interfaceName) {
      wgArgs.push("-i", args.interfaceName);
    }
    const proc = child_process.spawn(this.tsharkPath, [...wgArgs, "-w", out], {
      windowsHide: true
    });
    this.proc = proc;
    this.status = {
      ...this.status,
      running: true,
      outputPath: out,
      lastError: null
    };
    this.emit("status", this.status);
    proc.on("error", (e) => {
      this.status = { ...this.status, lastError: String(e), running: false };
      this.proc = null;
      this.emit("status", this.status);
    });
    proc.on("exit", (code) => {
      this.status = { ...this.status, running: false, lastError: code ? `Capture exited: ${code}` : null };
      this.proc = null;
      this.emit("status", this.status);
    });
    return this.status;
  }
  async stopCapture() {
    if (!this.proc) return this.status;
    try {
      this.proc.kill("SIGINT");
    } catch {
      try {
        this.proc.kill("SIGTERM");
      } catch {
      }
    }
    this.proc = null;
    this.status = { ...this.status, running: false };
    this.emit("status", this.status);
    return this.status;
  }
}
function runPowerShell$2(script) {
  return new Promise((resolve, reject) => {
    const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script];
    child_process.execFile("powershell.exe", args, { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(String(stderr || err.message || err)));
      resolve(String(stdout || ""));
    });
  });
}
function tryFindSteamPath() {
  const candidates = [
    process.env["ProgramFiles(x86)"] ? path.join(process.env["ProgramFiles(x86)"], "Steam") : void 0,
    process.env["ProgramFiles"] ? path.join(process.env["ProgramFiles"], "Steam") : void 0,
    "C:\\Program Files (x86)\\Steam",
    "C:\\Program Files\\Steam"
  ];
  for (const p of candidates) {
    if (!p) continue;
    try {
      if (fs.existsSync(path.join(p, "steam.exe"))) return p;
    } catch {
    }
  }
  return null;
}
function readTextSafe(path2) {
  return fs.readFileSync(path2, "utf-8");
}
function parseKeyValueFile(content) {
  const tokens = [];
  const re = /"([^"\\]*(?:\\.[^"\\]*)*)"|\{|\}/g;
  let m;
  while (m = re.exec(content)) {
    if (m[0] === "{" || m[0] === "}") tokens.push(m[0]);
    else tokens.push(m[1] ?? "");
  }
  let i = 0;
  function parseObject() {
    const obj = {};
    while (i < tokens.length) {
      const t = tokens[i++];
      if (t === "}") break;
      if (t === "{") continue;
      const key = t;
      const next = tokens[i++];
      if (next === "{") {
        obj[key] = parseObject();
      } else if (next === "}") {
        obj[key] = {};
        break;
      } else {
        obj[key] = next;
      }
    }
    return obj;
  }
  const rootKey = tokens[0];
  const rootNext = tokens[1];
  if (rootNext === "{") {
    i = 2;
    const rootObj = parseObject();
    return { [rootKey]: rootObj };
  }
  i = 0;
  return parseObject();
}
function getSteamLibraries(steamPath) {
  const libraries = [steamPath];
  const vdfPath = path.join(steamPath, "steamapps", "libraryfolders.vdf");
  if (!fs.existsSync(vdfPath)) return libraries;
  const parsed = parseKeyValueFile(readTextSafe(vdfPath));
  const root = parsed["libraryfolders"] ?? parsed["LibraryFolders"] ?? parsed;
  const maybeFolders = typeof root === "object" && root ? root : {};
  for (const k of Object.keys(maybeFolders)) {
    const entry = maybeFolders[k];
    if (typeof entry === "string") {
      libraries.push(entry);
      continue;
    }
    if (entry && typeof entry === "object") {
      const p = entry["path"];
      if (typeof p === "string") libraries.push(p);
    }
  }
  return Array.from(new Set(libraries));
}
function safeDirExists(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function getSteamGamesFromLibrary(libraryPath) {
  const steamAppsPath = path.join(libraryPath, "steamapps");
  const commonPath = path.join(steamAppsPath, "common");
  if (!safeDirExists(steamAppsPath)) return [];
  const files = fs.readdirSync(steamAppsPath);
  const manifests = files.filter((f) => f.startsWith("appmanifest_") && f.endsWith(".acf"));
  const games2 = [];
  for (const file of manifests) {
    const manifestPath = path.join(steamAppsPath, file);
    try {
      const parsed = parseKeyValueFile(readTextSafe(manifestPath));
      const appState = parsed["AppState"] ?? parsed;
      const appId = String(appState["appid"] ?? "").trim();
      const name = String(appState["name"] ?? "").trim();
      const installdir = String(appState["installdir"] ?? "").trim();
      if (!appId || !name || !installdir) continue;
      const installDir = path.join(commonPath, installdir);
      games2.push({
        appId,
        name,
        installDir,
        libraryPath,
        source: "steam"
      });
    } catch {
    }
  }
  return games2;
}
class GamesService {
  status = {
    steamInstalled: false,
    steamPath: null,
    epicInstalled: false,
    epicManifestPath: null,
    lastScanAt: null,
    lastError: null
  };
  getStatus() {
    return this.status;
  }
  scanEpicGames() {
    const candidates = [
      process.env["ProgramData"] ? path.join(process.env["ProgramData"], "Epic", "EpicGamesLauncher", "Data", "Manifests", "installed.json") : void 0,
      "C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests\\installed.json"
    ];
    for (const p of candidates) {
      if (!p) continue;
      try {
        if (!fs.existsSync(p)) continue;
        const raw = fs.readFileSync(p, "utf-8");
        const json = JSON.parse(raw);
        const list = Array.isArray(json) ? json : Array.isArray(json?.InstallationList) ? json.InstallationList : [];
        const games2 = [];
        for (const it of list) {
          const appId = String(it?.AppName || it?.AppId || it?.CatalogItemId || it?.ItemId || "").trim();
          const name = String(it?.DisplayName || it?.AppName || "").trim();
          const installDir = String(it?.InstallLocation || it?.InstallDir || "").trim();
          if (!appId || !name || !installDir) continue;
          games2.push({ appId, name, installDir, source: "epic" });
        }
        games2.sort((a, b) => a.name.localeCompare(b.name));
        return { epicInstalled: true, epicManifestPath: p, games: games2 };
      } catch {
      }
    }
    return { epicInstalled: false, epicManifestPath: null, games: [] };
  }
  async scanWindowsInstalledGames() {
    try {
      const script = "$paths = @('HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*');$apps = foreach($p in $paths){ Get-ItemProperty -Path $p -ErrorAction SilentlyContinue } | Where-Object { $_.DisplayName -and ($_.InstallLocation -or $_.DisplayIcon) } | Select-Object DisplayName,InstallLocation,DisplayIcon,Publisher | ConvertTo-Json -Depth 3";
      const out = await runPowerShell$2(script);
      const parsed = JSON.parse(out || "null");
      const arr = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
      const games2 = [];
      for (const it of arr) {
        const name = String(it?.DisplayName || "").trim();
        if (!name) continue;
        const publisher = String(it?.Publisher || "").toLowerCase();
        const looksGamey = /(game|launcher|steam|epic|riot|battle\.net|ubisoft|rockstar|xbox|valve)/i.test(name) || /(epic|riot|blizzard|ubisoft|rockstar|ea|valve)/i.test(publisher);
        if (!looksGamey) continue;
        const installDir = String(it?.InstallLocation || "").trim();
        const displayIcon = String(it?.DisplayIcon || "").trim();
        const appId = name;
        games2.push({
          appId,
          name,
          installDir: installDir || "",
          source: "windows",
          displayIconPath: displayIcon || null
        });
      }
      games2.sort((a, b) => a.name.localeCompare(b.name));
      return games2;
    } catch {
      return [];
    }
  }
  async scanSteamGames() {
    try {
      const epic = this.scanEpicGames();
      const windowsGames = await this.scanWindowsInstalledGames();
      const steamPath = tryFindSteamPath();
      if (!steamPath) {
        this.status = {
          steamInstalled: false,
          steamPath: null,
          epicInstalled: epic.epicInstalled,
          epicManifestPath: epic.epicManifestPath,
          lastScanAt: Date.now(),
          lastError: null
        };
        const epicGames = epic.games.map((g) => ({ ...g, id: `epic:${g.appId}` }));
        const win = windowsGames.map((g) => ({ ...g, id: `win:${g.appId}` }));
        const merged = [...epicGames, ...win];
        merged.sort((a, b) => a.name.localeCompare(b.name));
        return { status: this.status, games: merged };
      }
      const libraries = getSteamLibraries(steamPath);
      const steamGames = libraries.flatMap((lib) => getSteamGamesFromLibrary(lib));
      steamGames.sort((a, b) => a.name.localeCompare(b.name));
      const unified = [
        ...steamGames.map((g) => ({ ...g, id: `steam:${g.appId}` })),
        ...epic.games.map((g) => ({ ...g, id: `epic:${g.appId}` })),
        ...windowsGames.map((g) => ({ ...g, id: `win:${g.appId}` }))
      ];
      unified.sort((a, b) => a.name.localeCompare(b.name));
      this.status = {
        steamInstalled: true,
        steamPath,
        epicInstalled: epic.epicInstalled,
        epicManifestPath: epic.epicManifestPath,
        lastScanAt: Date.now(),
        lastError: null
      };
      return { status: this.status, games: unified };
    } catch (e) {
      this.status = {
        ...this.status,
        lastScanAt: Date.now(),
        lastError: String(e?.message || e)
      };
      return { status: this.status, games: [] };
    }
  }
  // placeholder to keep room for future persistence; currently renderer can store boost toggles via settings
  getDataDir() {
    return path.join(electron.app.getPath("userData"), "games");
  }
}
function httpsRequestBytes(url, opts) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const started = performance.now();
    let settled = false;
    const safeResolve = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const safeReject = (e) => {
      if (settled) return;
      settled = true;
      reject(e);
    };
    const req = https__namespace.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port ? Number(u.port) : void 0,
        path: u.pathname + u.search,
        method: opts.method,
        headers: {
          "User-Agent": "NovaOptimizer/1.0",
          ...opts.body ? { "Content-Length": String(opts.body.byteLength) } : {}
        },
        rejectUnauthorized: false
      },
      (res) => {
        let bytes = 0;
        res.on("data", (chunk) => {
          bytes += chunk.length;
          if (opts.maxBytes && bytes >= opts.maxBytes) {
            try {
              res.destroy();
            } catch {
            }
          }
        });
        res.on("end", () => {
          const durationMs = Math.max(performance.now() - started, 0);
          safeResolve({ ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 400, statusCode: res.statusCode || 0, bytes, durationMs });
        });
        res.on("close", () => {
          const durationMs = Math.max(performance.now() - started, 0);
          safeResolve({ ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 400, statusCode: res.statusCode || 0, bytes, durationMs });
        });
      }
    );
    req.on("error", (e) => safeReject(e));
    req.setTimeout(25e3, () => {
      try {
        req.destroy(new Error("Request timeout"));
      } catch {
      }
    });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}
async function firstWorkingEndpoint$1(urls, method) {
  let lastErr = null;
  for (const url of urls) {
    try {
      const r = await httpsRequestBytes(url, { method, maxBytes: 1024 });
      if (r.ok) return url;
      lastErr = new Error(`HTTP ${r.statusCode}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(String(lastErr?.message || lastErr || "No reachable speedtest endpoint"));
}
class SpeedtestService extends events.EventEmitter {
  status = {
    running: false,
    lastError: null,
    lastResult: null
  };
  startedAtPerf = null;
  getStatus() {
    return this.status;
  }
  emitSample(sample) {
    this.emit("sample", sample);
  }
  tNow() {
    if (this.startedAtPerf == null) return 0;
    return Math.round(performance.now() - this.startedAtPerf);
  }
  async run() {
    if (this.status.running) throw new Error("Speedtest already running");
    this.status = { ...this.status, running: true, lastError: null };
    try {
      this.startedAtPerf = performance.now();
      const now = Date.now();
      const downloadCandidates = [
        "https://speed.cloudflare.com/__down?bytes=25000000",
        "https://speed.hetzner.de/100MB.bin"
      ];
      const uploadCandidates = [
        "https://speed.cloudflare.com/__up",
        "https://httpbin.org/post"
      ];
      const pingCandidates = [
        "https://www.google.com/generate_204",
        "https://clients3.google.com/generate_204",
        "https://www.cloudflare.com/cdn-cgi/trace",
        "https://1.1.1.1/"
      ];
      const pingUrl = await firstWorkingEndpoint$1(pingCandidates, "GET");
      const downloadUrl = await firstWorkingEndpoint$1(downloadCandidates, "GET");
      this.emitSample({ t: this.tNow(), phase: "ping" });
      const pingSamples = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        const r = await httpsRequestBytes(pingUrl, { method: "GET", maxBytes: 2048 });
        if (!r.ok) throw new Error("Ping failed");
        const t1 = performance.now();
        pingSamples.push(t1 - t0);
        const avgPing = pingSamples.reduce((a, b) => a + b, 0) / pingSamples.length;
        const jitter = pingSamples.length > 1 ? pingSamples.slice(1).map((v, idx) => Math.abs(v - pingSamples[idx - 1])).reduce((a, b) => a + b, 0) / (pingSamples.length - 1) : 0;
        this.emitSample({
          t: this.tNow(),
          phase: "ping",
          pingMs: Math.round(avgPing * 10) / 10,
          jitterMs: Math.round(jitter * 10) / 10
        });
      }
      const pingMs = pingSamples.length ? Math.round(pingSamples.reduce((a, b) => a + b, 0) / pingSamples.length * 10) / 10 : null;
      const jitterMs = pingSamples.length > 1 ? Math.round(
        pingSamples.slice(1).map((v, idx) => Math.abs(v - pingSamples[idx - 1])).reduce((a, b) => a + b, 0) / (pingSamples.length - 1) * 10
      ) / 10 : null;
      this.emitSample({ t: this.tNow(), phase: "download" });
      const downloadMbps = await this.runStreamingDownload(downloadUrl);
      let uploadMbps = null;
      try {
        this.emitSample({ t: this.tNow(), phase: "upload" });
        const uploadUrl = await firstWorkingEndpoint$1(uploadCandidates, "POST");
        uploadMbps = await this.runStreamingUpload(uploadUrl);
      } catch {
        uploadMbps = null;
      }
      const res = {
        ts: now,
        pingMs,
        jitterMs,
        downloadMbps,
        uploadMbps,
        serverName: "Cloudflare / Hetzner",
        isp: null,
        raw: { pingUrl, downloadUrl }
      };
      this.emitSample({
        t: this.tNow(),
        phase: "done",
        pingMs: res.pingMs ?? void 0,
        jitterMs: res.jitterMs ?? void 0,
        downloadMbps: res.downloadMbps ?? void 0,
        uploadMbps: res.uploadMbps ?? void 0
      });
      this.status = { running: false, lastError: null, lastResult: res };
      this.startedAtPerf = null;
      return res;
    } catch (e) {
      const msg = String(e?.message || e);
      this.status = { ...this.status, running: false, lastError: msg };
      this.startedAtPerf = null;
      throw new Error(msg);
    }
  }
  runStreamingDownload(url) {
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const started = performance.now();
      let bytes = 0;
      let lastBytes = 0;
      let lastAt = started;
      const tick = () => {
        const now = performance.now();
        const dt = Math.max((now - lastAt) / 1e3, 1e-3);
        const dBytes = bytes - lastBytes;
        const mbps = Math.round(dBytes * 8 / 1e6 / dt * 10) / 10;
        this.emitSample({ t: this.tNow(), phase: "download", downloadMbps: mbps });
        lastBytes = bytes;
        lastAt = now;
      };
      const interval = setInterval(tick, 250);
      let settled = false;
      const safeResolve = (v) => {
        if (settled) return;
        settled = true;
        clearInterval(interval);
        resolve(v);
      };
      const safeReject = (e) => {
        if (settled) return;
        settled = true;
        clearInterval(interval);
        reject(e);
      };
      const req = https__namespace.request(
        {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port ? Number(u.port) : void 0,
          path: u.pathname + u.search,
          method: "GET",
          headers: {
            "User-Agent": "NovaOptimizer/1.0",
            "Cache-Control": "no-store",
            Pragma: "no-cache"
          },
          rejectUnauthorized: false
        },
        (res) => {
          const statusCode = res.statusCode || 0;
          if (statusCode < 200 || statusCode >= 400) {
            res.resume();
            return safeReject(new Error(`Download failed (HTTP ${statusCode})`));
          }
          res.on("data", (chunk) => {
            bytes += chunk.length;
            if (performance.now() - started > 6e3) {
              try {
                res.destroy();
              } catch {
              }
            }
          });
          const finish = () => {
            const seconds = Math.max((performance.now() - started) / 1e3, 1e-3);
            const avgMbps = Math.round(bytes * 8 / 1e6 / seconds * 10) / 10;
            safeResolve(avgMbps);
          };
          res.on("end", finish);
          res.on("close", finish);
        }
      );
      req.on("error", (e) => {
        safeReject(e);
      });
      req.setTimeout(25e3, () => {
        try {
          req.destroy(new Error("Download timeout"));
        } catch {
        }
      });
      req.end();
    });
  }
  runStreamingUpload(url) {
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const body = crypto.randomBytes(5 * 1024 * 1024);
      const started = performance.now();
      let sent = 0;
      let lastSent = 0;
      let lastAt = started;
      const tick = () => {
        const now = performance.now();
        const dt = Math.max((now - lastAt) / 1e3, 1e-3);
        const dBytes = sent - lastSent;
        const mbps = Math.round(dBytes * 8 / 1e6 / dt * 10) / 10;
        this.emitSample({ t: this.tNow(), phase: "upload", uploadMbps: mbps });
        lastSent = sent;
        lastAt = now;
      };
      const interval = setInterval(tick, 250);
      let settled = false;
      const safeResolve = (v) => {
        if (settled) return;
        settled = true;
        clearInterval(interval);
        resolve(v);
      };
      const safeReject = (e) => {
        if (settled) return;
        settled = true;
        clearInterval(interval);
        reject(e);
      };
      const req = https__namespace.request(
        {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port ? Number(u.port) : void 0,
          path: u.pathname + u.search,
          method: "POST",
          headers: {
            "User-Agent": "NovaOptimizer/1.0",
            "Content-Length": String(body.byteLength),
            "Cache-Control": "no-store",
            Pragma: "no-cache"
          },
          rejectUnauthorized: false
        },
        (res) => {
          const statusCode = res.statusCode || 0;
          res.on("data", () => {
          });
          res.on("end", () => {
            if (statusCode < 200 || statusCode >= 400) return safeReject(new Error(`Upload failed (HTTP ${statusCode})`));
            const seconds = Math.max((performance.now() - started) / 1e3, 1e-3);
            const avgMbps = Math.round(sent * 8 / 1e6 / seconds * 10) / 10;
            safeResolve(avgMbps);
          });
        }
      );
      req.on("error", (e) => {
        safeReject(e);
      });
      req.setTimeout(25e3, () => {
        try {
          req.destroy(new Error("Upload timeout"));
        } catch {
        }
      });
      const chunkSize = 64 * 1024;
      let offset = 0;
      const writeNext = () => {
        if (offset >= body.length) {
          req.end();
          return;
        }
        const end = Math.min(offset + chunkSize, body.length);
        const chunk = body.subarray(offset, end);
        offset = end;
        sent = offset;
        const ok = req.write(chunk);
        if (!ok) req.once("drain", writeNext);
        else setImmediate(writeNext);
      };
      writeNext();
    });
  }
}
function runPowerShellJson(script) {
  return new Promise((resolve, reject) => {
    const args = [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script
    ];
    child_process.execFile("powershell.exe", args, { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(String(stderr || err.message || err)));
      }
      const text = String(stdout || "").trim();
      if (!text) return resolve(null);
      try {
        resolve(JSON.parse(text));
      } catch (e) {
        reject(new Error("Failed to parse PowerShell JSON output"));
      }
    });
  });
}
class SecurityService {
  status = {
    runningScan: false,
    lastError: null,
    defender: null,
    threats: []
  };
  getStatus() {
    return this.status;
  }
  async refreshDefenderStatus() {
    try {
      const s = await runPowerShellJson(
        "try { Get-MpComputerStatus | Select-Object AMServiceEnabled,AntivirusEnabled,RealTimeProtectionEnabled,IsTamperProtected,AntivirusSignatureVersion,QuickScanEndTime,FullScanEndTime | ConvertTo-Json -Depth 3 } catch { $null | ConvertTo-Json }"
      );
      const defender = s && typeof s === "object" ? {
        antivirusEnabled: typeof s.AntivirusEnabled === "boolean" ? s.AntivirusEnabled : null,
        realTimeProtectionEnabled: typeof s.RealTimeProtectionEnabled === "boolean" ? s.RealTimeProtectionEnabled : null,
        tamperProtection: s.IsTamperProtected != null ? String(s.IsTamperProtected) : null,
        signatureVersion: s.AntivirusSignatureVersion != null ? String(s.AntivirusSignatureVersion) : null,
        lastQuickScan: s.QuickScanEndTime ? Date.parse(String(s.QuickScanEndTime)) || null : null,
        lastFullScan: s.FullScanEndTime ? Date.parse(String(s.FullScanEndTime)) || null : null,
        lastError: null,
        raw: s
      } : null;
      this.status = { ...this.status, lastError: null, defender };
      return this.status;
    } catch (e) {
      const msg = String(e?.message || e);
      this.status = { ...this.status, lastError: msg };
      return this.status;
    }
  }
  async startDefenderScan(scanType) {
    if (this.status.runningScan) throw new Error("Scan already running");
    this.status = { ...this.status, runningScan: true, lastError: null };
    try {
      await runPowerShellJson(
        `try { Start-MpScan -ScanType ${scanType} | Out-Null; @{ ok = $true } | ConvertTo-Json } catch { @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json }`
      );
      await this.refreshDefenderStatus();
      this.status = { ...this.status, runningScan: false, lastError: null };
      return this.status;
    } catch (e) {
      const msg = String(e?.message || e);
      this.status = { ...this.status, runningScan: false, lastError: msg };
      return this.status;
    }
  }
  async getThreats() {
    try {
      const threatsRaw = await runPowerShellJson(
        "try { Get-MpThreatDetection | Select-Object ThreatId,ThreatName,Severity,ThreatStatus,InitialDetectionTime,ResourceLocation | ConvertTo-Json -Depth 3 } catch { @() | ConvertTo-Json }"
      );
      const threats = [];
      if (Array.isArray(threatsRaw)) {
        for (const t of threatsRaw) {
          threats.push({
            threatId: String(t.ThreatId || ""),
            threatName: String(t.ThreatName || "Unknown"),
            severity: ["Low", "Medium", "High", "Severe"].includes(t.Severity) ? t.Severity : "Unknown",
            threatStatus: String(t.ThreatStatus || "Unknown"),
            detectionTime: t.InitialDetectionTime ? Date.parse(String(t.InitialDetectionTime)) || Date.now() : Date.now(),
            resourceLocation: t.ResourceLocation ? String(t.ResourceLocation) : null
          });
        }
      }
      this.status = { ...this.status, threats };
      return threats;
    } catch (e) {
      const msg = String(e?.message || e);
      this.status = { ...this.status, lastError: msg };
      return [];
    }
  }
  async removeThreat(threatId) {
    try {
      await runPowerShellJson(
        `try { Remove-MpThreat -ThreatId '${threatId}' | Out-Null; @{ ok = $true } | ConvertTo-Json } catch { @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json }`
      );
      await this.getThreats();
      return { ok: true };
    } catch (e) {
      const msg = String(e?.message || e);
      return { ok: false, error: msg };
    }
  }
}
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}
function randomToken() {
  return crypto.randomBytes(24).toString("hex");
}
function base64Url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function sha256Base64Url(input) {
  const hash = crypto.createHash("sha256").update(input).digest();
  return base64Url(hash);
}
class AuthService {
  status = { signedIn: false, user: null, lastError: null };
  pending = null;
  getSessionPath() {
    return path.join(electron.app.getPath("userData"), "auth-session.json");
  }
  loadSession() {
    const p = this.getSessionPath();
    if (!fs.existsSync(p)) return null;
    try {
      const raw = fs.readFileSync(p, "utf-8");
      const data = JSON.parse(raw);
      if (!data?.user?.email || !data?.token) return null;
      return data;
    } catch {
      return null;
    }
  }
  saveSession(session) {
    const p = this.getSessionPath();
    if (!session) {
      try {
        fs.writeFileSync(p, JSON.stringify({}), { encoding: "utf-8" });
      } catch {
      }
      return;
    }
    fs.writeFileSync(p, JSON.stringify(session, null, 2), { encoding: "utf-8" });
  }
  ensureInitialized() {
    const s = this.loadSession();
    if (s) {
      this.status = { signedIn: true, user: s.user, lastError: null };
    }
  }
  getStatus() {
    return this.status;
  }
  signOut() {
    this.status = { signedIn: false, user: null, lastError: null };
    this.pending = null;
    this.saveSession(null);
    return this.status;
  }
  requestOtp(email) {
    const e = normalizeEmail(email);
    if (!e || !e.includes("@")) throw new Error("Enter a valid email");
    const code = String(Math.floor(1e5 + Math.random() * 9e5));
    const expiresAt = Date.now() + 10 * 60 * 1e3;
    this.pending = { email: e, code, expiresAt };
    return { ok: true, devCode: code, expiresAt };
  }
  verifyOtp(email, code) {
    const e = normalizeEmail(email);
    const c = String(code || "").trim();
    if (!this.pending || this.pending.email !== e) throw new Error("No pending code for this email");
    if (Date.now() > this.pending.expiresAt) throw new Error("Code expired");
    if (c !== this.pending.code) throw new Error("Invalid code");
    const session = {
      user: { email: e, provider: "otp" },
      token: randomToken(),
      createdAt: Date.now()
    };
    this.pending = null;
    this.saveSession(session);
    this.status = { signedIn: true, user: session.user, lastError: null };
    return { ok: true, session };
  }
  async connectGoogle(args) {
    const clientId = String(args?.clientId || "").trim();
    if (!clientId) throw new Error("Google Client ID is required");
    const scopes = (args?.scopes?.length ? args.scopes : ["openid", "email", "profile"]).join(" ");
    const verifier = base64Url(crypto.randomBytes(32));
    const challenge = sha256Base64Url(verifier);
    const state = base64Url(crypto.randomBytes(16));
    const server = http.createServer();
    const codePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Google sign-in timed out"));
        try {
          server.close();
        } catch {
        }
      }, 12e4);
      server.on("request", (req, res) => {
        try {
          const url = new URL(req.url || "/", "http://127.0.0.1");
          if (url.pathname !== "/callback") {
            res.writeHead(404);
            res.end("Not found");
            return;
          }
          const returnedState = url.searchParams.get("state");
          const code2 = url.searchParams.get("code");
          const err = url.searchParams.get("error");
          if (err) {
            clearTimeout(timeout);
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("Sign-in cancelled. You can close this tab.");
            reject(new Error(err));
            return;
          }
          if (!code2 || returnedState !== state) {
            clearTimeout(timeout);
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("Invalid sign-in response. You can close this tab.");
            reject(new Error("Invalid OAuth response"));
            return;
          }
          clearTimeout(timeout);
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("Signed in successfully. You can close this tab and return to Nova Optimizer.");
          resolve(code2);
        } catch (e) {
          reject(new Error(String(e?.message || e)));
        } finally {
          setTimeout(() => {
            try {
              server.close();
            } catch {
            }
          }, 50);
        }
      });
    });
    const preferredPort = 42813;
    await new Promise((resolve, reject) => {
      server.once("error", (e) => reject(e));
      server.listen(preferredPort, "127.0.0.1", () => resolve());
    });
    const redirectUri = `http://127.0.0.1:${preferredPort}/callback`;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256&access_type=offline&prompt=consent`;
    await electron.shell.openExternal(authUrl);
    const code = await codePromise;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri
      })
    });
    const tokenJson = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok) {
      throw new Error(tokenJson?.error_description || tokenJson?.error || "Google token exchange failed");
    }
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` }
    });
    const info = await infoRes.json().catch(() => ({}));
    const email = normalizeEmail(info?.email);
    if (!email) throw new Error("Google did not return an email address");
    const session = {
      user: { email, provider: "google", name: info?.name ?? null },
      token: randomToken(),
      createdAt: Date.now()
    };
    this.saveSession(session);
    this.status = { signedIn: true, user: session.user, lastError: null };
    return { ok: true, session, tokens: tokenJson };
  }
}
function run(cmd, args) {
  return new Promise((resolve) => {
    child_process.execFile(cmd, args, { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const out = String(stdout || "");
      const errText = String(stderr || "");
      resolve({
        ok: !err,
        action: `${cmd} ${args.join(" ")}`,
        stdout: out,
        stderr: err ? errText || String(err.message || err) : errText
      });
    });
  });
}
class NetworkToolsService {
  flushDns() {
    return run("ipconfig", ["/flushdns"]);
  }
  renewIp() {
    return run("ipconfig", ["/renew"]);
  }
  releaseIp() {
    return run("ipconfig", ["/release"]);
  }
  resetWinsock() {
    return run("netsh", ["winsock", "reset"]);
  }
  resetTcpIp() {
    return run("netsh", ["int", "ip", "reset"]);
  }
}
function httpsGetBytes(url, maxBytes, signal) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    let settled = false;
    const safeResolve = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const safeReject = (e) => {
      if (settled) return;
      settled = true;
      reject(e);
    };
    const req = https__namespace.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port ? Number(u.port) : void 0,
        path: u.pathname + u.search,
        method: "GET",
        headers: {
          "User-Agent": "NovaOptimizer/1.0",
          "Cache-Control": "no-store",
          Pragma: "no-cache"
        },
        rejectUnauthorized: false
      },
      (res) => {
        let bytes = 0;
        const statusCode = res.statusCode || 0;
        res.on("data", (chunk) => {
          bytes += chunk.length;
          if (bytes >= maxBytes) {
            try {
              res.destroy();
            } catch {
            }
          }
        });
        res.on("end", () => {
          safeResolve({ ok: statusCode >= 200 && statusCode < 400, statusCode, bytes });
        });
        res.on("close", () => {
          safeResolve({ ok: statusCode >= 200 && statusCode < 400, statusCode, bytes });
        });
      }
    );
    const onAbort = () => {
      try {
        req.destroy(new Error("Aborted"));
      } catch {
      }
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener("abort", onAbort, { once: true });
    }
    req.on("error", (e) => safeReject(e));
    req.setTimeout(2e4, () => {
      try {
        req.destroy(new Error("Request timeout"));
      } catch {
      }
    });
    req.end();
  });
}
async function pingOnce(url) {
  const t0 = performance.now();
  const r = await httpsGetBytes(url, 1024);
  if (!r.ok) throw new Error(`Ping failed (HTTP ${r.statusCode})`);
  return performance.now() - t0;
}
async function firstWorkingEndpoint(urls) {
  let lastErr = null;
  for (const url of urls) {
    try {
      const r = await httpsGetBytes(url, 2048);
      if (r.ok) return url;
      lastErr = new Error(`HTTP ${r.statusCode}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(String(lastErr?.message || lastErr || "No reachable endpoint"));
}
function avg(nums) {
  return nums.reduce((a, b) => a + b, 0) / Math.max(nums.length, 1);
}
function gradeForBufferbloat(ms) {
  if (ms <= 5) return "A+";
  if (ms <= 15) return "A";
  if (ms <= 30) return "B";
  if (ms <= 60) return "C";
  if (ms <= 100) return "D";
  return "F";
}
class BufferbloatService extends events.EventEmitter {
  status = {
    running: false,
    lastError: null,
    lastResult: null
  };
  abort = null;
  getStatus() {
    return this.status;
  }
  stop() {
    if (this.abort) {
      this.abort.abort();
      this.abort = null;
    }
    this.status = { ...this.status, running: false };
    return this.status;
  }
  async run() {
    if (this.status.running) throw new Error("Bufferbloat test already running");
    this.status = { ...this.status, running: true, lastError: null };
    this.abort = new AbortController();
    const pingUrl = await firstWorkingEndpoint([
      "https://www.google.com/generate_204",
      "https://clients3.google.com/generate_204",
      "https://www.cloudflare.com/cdn-cgi/trace",
      "https://1.1.1.1/"
    ]);
    const loadUrl = await firstWorkingEndpoint([
      "https://speed.cloudflare.com/__down?bytes=10000000",
      "https://speed.hetzner.de/100MB.bin"
    ]);
    const samples = [];
    const started = performance.now();
    const pushSample = (phase, pingMs) => {
      const s = { t: Math.round(performance.now() - started), phase, pingMs: Math.round(pingMs * 10) / 10 };
      samples.push(s);
      this.emit("sample", s);
    };
    try {
      const idlePings = [];
      for (let i = 0; i < 10; i++) {
        const p = await pingOnce(pingUrl);
        idlePings.push(p);
        pushSample("idle", p);
        await new Promise((r) => setTimeout(r, 180));
      }
      const baselinePingMs = Math.round(avg(idlePings) * 10) / 10;
      const loadPromise = httpsGetBytes(loadUrl, 10 * 1024 * 1024, this.abort.signal).catch(() => null);
      const loadedPings = [];
      const loadStart = performance.now();
      while (performance.now() - loadStart < 6e3) {
        if (this.abort.signal.aborted) throw new Error("Aborted");
        const p = await pingOnce(pingUrl);
        loadedPings.push(p);
        pushSample("load", p);
        await new Promise((r) => setTimeout(r, 180));
      }
      await loadPromise;
      const loadedPingMs = Math.round(avg(loadedPings) * 10) / 10;
      const bufferbloatMs = Math.max(0, Math.round((loadedPingMs - baselinePingMs) * 10) / 10);
      const grade = gradeForBufferbloat(bufferbloatMs);
      const result = {
        ts: Date.now(),
        baselinePingMs,
        loadedPingMs,
        bufferbloatMs,
        grade,
        samples
      };
      this.status = { running: false, lastError: null, lastResult: result };
      this.abort = null;
      return result;
    } catch (e) {
      const msg = String(e?.message || e);
      this.status = { ...this.status, running: false, lastError: msg };
      this.abort = null;
      throw new Error(msg);
    }
  }
}
function runPowerShell$1(script) {
  return new Promise((resolve, reject) => {
    const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script];
    child_process.execFile("powershell.exe", args, { windowsHide: true, maxBuffer: 5 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(String(stderr || err.message || err)));
      resolve(String(stdout || ""));
    });
  });
}
class NetworkInfoService {
  async getInfo() {
    try {
      const json = await runPowerShell$1(
        "$a = Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Sort-Object -Property InterfaceMetric | Select-Object -First 1 Name,InterfaceDescription,ifIndex; if($a){$a | ConvertTo-Json -Depth 3}else{ $null | ConvertTo-Json }"
      );
      const adapter = JSON.parse(json);
      if (!adapter) {
        return { interfaceName: null, type: "unknown", ssid: null, connected: false, lastError: null };
      }
      const iface = String(adapter.Name || "") || null;
      const desc = String(adapter.InterfaceDescription || "");
      let type = "unknown";
      if (/wi-?fi|wireless|wlan/i.test(desc)) type = "wifi";
      else if (/ethernet|gbe|pci[- ]e/i.test(desc)) type = "ethernet";
      let ssid = null;
      if (type === "wifi") {
        try {
          const out = await runPowerShell$1("(netsh wlan show interfaces) | Out-String");
          const m = out.match(/\s*SSID\s*:\s*(.+)\r?\n/i);
          if (m && m[1]) ssid = m[1].trim();
          if (ssid && /BSSID/i.test(ssid)) ssid = null;
        } catch {
          ssid = null;
        }
      }
      return { interfaceName: iface, type, ssid, connected: true, lastError: null };
    } catch (e) {
      return {
        interfaceName: null,
        type: "unknown",
        ssid: null,
        connected: false,
        lastError: String(e?.message || e)
      };
    }
  }
}
function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script];
    child_process.execFile("powershell.exe", args, { windowsHide: true, maxBuffer: 5 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(String(stderr || err.message || err)));
      resolve(String(stdout || ""));
    });
  });
}
class SystemInfoService {
  async getInfo() {
    try {
      const cpus = os.cpus() || [];
      const cpuModel = cpus[0]?.model ? String(cpus[0].model) : null;
      const cpuCores = cpus.length || 0;
      const logicalProcessors = os.cpus().length || 0;
      const totalMemoryGb = Math.round(os.totalmem() / 1024 ** 3 * 10) / 10;
      let cpuManufacturer = null;
      let maxClockSpeed = null;
      let baseClockSpeed = null;
      let currentClockSpeed = null;
      let l2Cache = null;
      let l3Cache = null;
      let cpuArchitecture = null;
      try {
        const cpuOut = await runPowerShell(
          "Get-CimInstance Win32_Processor | Select-Object Manufacturer, MaxClockSpeed, CurrentClockSpeed, L2CacheSize, L3CacheSize, Architecture | ConvertTo-Json"
        );
        const cpuParsed = JSON.parse(cpuOut);
        if (Array.isArray(cpuParsed) && cpuParsed.length > 0) {
          cpuManufacturer = cpuParsed[0].Manufacturer || null;
          maxClockSpeed = cpuParsed[0].MaxClockSpeed ? Math.round(cpuParsed[0].MaxClockSpeed / 1e6) : null;
          currentClockSpeed = cpuParsed[0].CurrentClockSpeed ? Math.round(cpuParsed[0].CurrentClockSpeed / 1e6) : null;
          baseClockSpeed = cpuParsed[0].MaxClockSpeed ? Math.round(cpuParsed[0].MaxClockSpeed / 1e6 * 0.8) : null;
          l2Cache = cpuParsed[0].L2CacheSize ? cpuParsed[0].L2CacheSize / 1024 : null;
          l3Cache = cpuParsed[0].L3CacheSize ? cpuParsed[0].L3CacheSize / 1024 : null;
          cpuArchitecture = cpuParsed[0].Architecture || null;
        }
      } catch {
      }
      const gpus = [];
      try {
        const gpuOut = await runPowerShell(
          "Get-CimInstance Win32_VideoController | Select-Object Name, DriverVersion, AdapterRAM, DriverVersion, VideoProcessor, AdapterDACType | ConvertTo-Json"
        );
        const gpuParsed = JSON.parse(gpuOut);
        if (Array.isArray(gpuParsed)) {
          for (const gpu of gpuParsed) {
            gpus.push({
              name: gpu.Name || null,
              manufacturer: gpu.VideoProcessor || null,
              driverVersion: gpu.DriverVersion || null,
              memory: gpu.AdapterRAM ? Math.round(gpu.AdapterRAM / 1024 ** 3) : null,
              memoryType: gpu.AdapterDACType || null,
              coreClock: null,
              memoryClock: null
            });
          }
        }
      } catch {
      }
      let motherboardManufacturer = null;
      let motherboardProduct = null;
      let motherboardSerial = null;
      let motherboardVersion = null;
      try {
        const moboOut = await runPowerShell(
          "Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer, Product, SerialNumber, Version | ConvertTo-Json"
        );
        const moboParsed = JSON.parse(moboOut);
        if (Array.isArray(moboParsed) && moboParsed.length > 0) {
          motherboardManufacturer = moboParsed[0].Manufacturer || null;
          motherboardProduct = moboParsed[0].Product || null;
          motherboardSerial = moboParsed[0].SerialNumber || null;
          motherboardVersion = moboParsed[0].Version || null;
        }
      } catch {
      }
      let ramSpeed = null;
      const ramSticks = [];
      try {
        const ramOut = await runPowerShell(
          "Get-CimInstance Win32_PhysicalMemory | Select-Object Capacity, Speed, Manufacturer, PartNumber, SerialNumber, ConfiguredClockSpeed | ConvertTo-Json"
        );
        const ramParsed = JSON.parse(ramOut);
        if (Array.isArray(ramParsed)) {
          for (const stick of ramParsed) {
            ramSticks.push({
              capacity: stick.Capacity ? Math.round(stick.Capacity / 1024 ** 3) : 0,
              speed: stick.Speed || 0,
              manufacturer: stick.Manufacturer || null,
              partNumber: stick.PartNumber || null,
              serialNumber: stick.SerialNumber || null,
              configuredClockSpeed: stick.ConfiguredClockSpeed || null
            });
          }
          if (ramSticks.length > 0) {
            ramSpeed = ramSticks[0].speed;
          }
        }
      } catch {
      }
      const storage = [];
      try {
        const storageOut = await runPowerShell(
          "Get-CimInstance Win32_DiskDrive | Select-Object Model, Size, InterfaceType, SerialNumber, FirmwareRevision, Sectors | ConvertTo-Json"
        );
        const storageParsed = JSON.parse(storageOut);
        if (Array.isArray(storageParsed)) {
          for (const disk of storageParsed) {
            storage.push({
              model: disk.Model || null,
              sizeGb: disk.Size ? Math.round(disk.Size / 1024 ** 3) : 0,
              type: disk.InterfaceType || null,
              serialNumber: disk.SerialNumber || null,
              firmware: disk.FirmwareRevision || null,
              interfaceType: disk.InterfaceType || null,
              sectors: disk.Sectors || null
            });
          }
        }
      } catch {
      }
      const osLabel = `${os.type()} ${os.release()}`;
      const osVersion = os.release();
      return {
        os: osLabel,
        osVersion,
        arch: os.arch(),
        hostname: os.hostname(),
        cpu: {
          model: cpuModel,
          manufacturer: cpuManufacturer,
          cores: cpuCores,
          logicalProcessors,
          baseClockSpeed,
          maxClockSpeed,
          currentClockSpeed,
          l2Cache,
          l3Cache,
          architecture: cpuArchitecture
        },
        gpu: gpus,
        motherboard: {
          manufacturer: motherboardManufacturer,
          product: motherboardProduct,
          serialNumber: motherboardSerial,
          version: motherboardVersion
        },
        ram: {
          totalGb: totalMemoryGb,
          speed: ramSpeed,
          slots: ramSticks.length,
          sticks: ramSticks
        },
        storage,
        lastError: null
      };
    } catch (e) {
      return {
        os: "unknown",
        osVersion: "unknown",
        arch: "unknown",
        hostname: "unknown",
        cpu: {
          model: null,
          manufacturer: null,
          cores: 0,
          logicalProcessors: 0,
          baseClockSpeed: null,
          maxClockSpeed: null,
          currentClockSpeed: null,
          l2Cache: null,
          l3Cache: null,
          architecture: null
        },
        gpu: [],
        motherboard: {
          manufacturer: null,
          product: null,
          serialNumber: null,
          version: null
        },
        ram: {
          totalGb: 0,
          speed: null,
          slots: 0,
          sticks: []
        },
        storage: [],
        lastError: String(e?.message || e)
      };
    }
  }
}
class FriendsService extends events.EventEmitter {
  status = {
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    lastError: null
  };
  getDataPath() {
    return path.join(electron.app.getPath("userData"), "friends-data.json");
  }
  loadData() {
    const p = this.getDataPath();
    if (!fs.existsSync(p)) return null;
    try {
      const raw = fs.readFileSync(p, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  saveData() {
    const p = this.getDataPath();
    fs.writeFileSync(p, JSON.stringify(this.status, null, 2), { encoding: "utf-8" });
  }
  ensureInitialized() {
    const data = this.loadData();
    if (data) {
      this.status = data;
    }
  }
  getStatus() {
    return this.status;
  }
  generateFriendCode() {
    return crypto.randomBytes(4).toString("hex").toUpperCase();
  }
  addFriend(username, friendCode) {
    const friend = {
      id: crypto.randomBytes(8).toString("hex"),
      username,
      friendCode,
      status: "offline",
      addedAt: Date.now(),
      lastSeen: Date.now()
    };
    this.status.friends.push(friend);
    this.saveData();
    this.emit("friendAdded", friend);
    return friend;
  }
  removeFriend(friendId) {
    this.status.friends = this.status.friends.filter((f) => f.id !== friendId);
    this.saveData();
    this.emit("friendRemoved", friendId);
  }
  updateFriendStatus(friendId, status) {
    const friend = this.status.friends.find((f) => f.id === friendId);
    if (friend) {
      friend.status = status;
      friend.lastSeen = Date.now();
      this.saveData();
      this.emit("friendStatusChanged", friend);
    }
  }
  sendFriendRequest(toUsername) {
    const request = {
      id: crypto.randomBytes(8).toString("hex"),
      from: "currentUser",
      // In real app, this would be the authenticated user
      fromUsername: toUsername,
      status: "pending",
      createdAt: Date.now()
    };
    this.status.outgoingRequests.push(request);
    this.saveData();
    this.emit("requestSent", request);
    return request;
  }
  acceptFriendRequest(requestId) {
    const request = this.status.incomingRequests.find((r) => r.id === requestId);
    if (request) {
      request.status = "accepted";
      this.addFriend(request.fromUsername, "");
      this.status.incomingRequests = this.status.incomingRequests.filter((r) => r.id !== requestId);
      this.saveData();
      this.emit("requestAccepted", request);
    }
  }
  rejectFriendRequest(requestId) {
    const request = this.status.incomingRequests.find((r) => r.id === requestId);
    if (request) {
      request.status = "rejected";
      this.status.incomingRequests = this.status.incomingRequests.filter((r) => r.id !== requestId);
      this.saveData();
      this.emit("requestRejected", request);
    }
  }
  searchFriend(codeOrUsername) {
    return this.status.friends.find(
      (f) => f.friendCode === codeOrUsername.toUpperCase() || f.username.toLowerCase() === codeOrUsername.toLowerCase()
    ) || null;
  }
}
class ChatService extends events.EventEmitter {
  status = {
    conversations: [],
    messages: [],
    activeConversation: null,
    lastError: null
  };
  getDataPath() {
    return path.join(electron.app.getPath("userData"), "chat-data.json");
  }
  loadData() {
    const p = this.getDataPath();
    if (!fs.existsSync(p)) return null;
    try {
      const raw = fs.readFileSync(p, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  saveData() {
    const p = this.getDataPath();
    fs.writeFileSync(p, JSON.stringify(this.status, null, 2), { encoding: "utf-8" });
  }
  ensureInitialized() {
    const data = this.loadData();
    if (data) {
      this.status = data;
    }
  }
  getStatus() {
    return this.status;
  }
  createDirectConversation(participantId, participantName) {
    const conversation = {
      id: crypto.randomBytes(8).toString("hex"),
      participants: ["currentUser", participantId],
      name: participantName,
      type: "direct",
      lastMessage: null,
      unreadCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.status.conversations.push(conversation);
    this.saveData();
    this.emit("conversationCreated", conversation);
    return conversation;
  }
  createGroupConversation(name, participants) {
    const conversation = {
      id: crypto.randomBytes(8).toString("hex"),
      participants: ["currentUser", ...participants],
      name,
      type: "group",
      lastMessage: null,
      unreadCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.status.conversations.push(conversation);
    this.saveData();
    this.emit("conversationCreated", conversation);
    return conversation;
  }
  sendMessage(conversationId, content, type = "text") {
    const conversation = this.status.conversations.find((c) => c.id === conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    const message = {
      id: crypto.randomBytes(8).toString("hex"),
      conversationId,
      senderId: "currentUser",
      senderName: "You",
      content,
      timestamp: Date.now(),
      type,
      status: "sent"
    };
    this.status.messages.push(message);
    conversation.lastMessage = message;
    conversation.updatedAt = Date.now();
    this.saveData();
    this.emit("messageSent", message);
    return message;
  }
  getMessages(conversationId) {
    return this.status.messages.filter((m) => m.conversationId === conversationId);
  }
  setActiveConversation(conversationId) {
    this.status.activeConversation = conversationId;
    const conversation = this.status.conversations.find((c) => c.id === conversationId);
    if (conversation) {
      conversation.unreadCount = 0;
      this.saveData();
    }
    this.emit("activeConversationChanged", conversationId);
  }
  markAsRead(conversationId) {
    const messages = this.status.messages.filter((m) => m.conversationId === conversationId && m.senderId !== "currentUser");
    for (const message of messages) {
      message.status = "read";
    }
    this.saveData();
    this.emit("messagesMarkedRead", conversationId);
  }
  deleteConversation(conversationId) {
    this.status.conversations = this.status.conversations.filter((c) => c.id !== conversationId);
    this.status.messages = this.status.messages.filter((m) => m.conversationId !== conversationId);
    if (this.status.activeConversation === conversationId) {
      this.status.activeConversation = null;
    }
    this.saveData();
    this.emit("conversationDeleted", conversationId);
  }
}
class CallService extends events.EventEmitter {
  status = {
    activeCall: null,
    incomingCall: null,
    lastError: null
  };
  getStatus() {
    return this.status;
  }
  initiateCall(calleeId, calleeName, type) {
    const call2 = {
      id: crypto.randomBytes(8).toString("hex"),
      type,
      callerId: "currentUser",
      callerName: "You",
      calleeId,
      calleeName,
      status: "ringing",
      startedAt: Date.now(),
      endedAt: null
    };
    this.status.activeCall = call2;
    this.emit("callInitiated", call2);
    return call2;
  }
  receiveCall(call2) {
    this.status.incomingCall = call2;
    this.emit("incomingCall", call2);
  }
  acceptCall(callId) {
    const call2 = this.status.incomingCall || this.status.activeCall;
    if (call2 && call2.id === callId) {
      call2.status = "connected";
      this.status.activeCall = call2;
      this.status.incomingCall = null;
      this.emit("callAccepted", call2);
    }
  }
  rejectCall(callId) {
    const call2 = this.status.incomingCall;
    if (call2 && call2.id === callId) {
      call2.status = "rejected";
      call2.endedAt = Date.now();
      this.status.incomingCall = null;
      this.emit("callRejected", call2);
    }
  }
  endCall(callId) {
    const call2 = this.status.activeCall;
    if (call2 && call2.id === callId) {
      call2.status = "ended";
      call2.endedAt = Date.now();
      this.status.activeCall = null;
      this.emit("callEnded", call2);
    }
  }
  toggleMute(callId, muted) {
    this.emit("muteToggled", { callId, muted });
  }
  toggleVideo(callId, videoEnabled) {
    this.emit("videoToggled", { callId, videoEnabled });
  }
}
let mainWindow = null;
let splashWindow = null;
let tray = null;
const engine = new OptimizationEngine();
const trial = new TrialService();
const settings = new SettingsService();
const tunnel = new TunnelService();
const capture = new PacketCaptureService();
const games = new GamesService();
const speedtest = new SpeedtestService();
const security = new SecurityService();
const auth = new AuthService();
const netTools = new NetworkToolsService();
const bufferbloat = new BufferbloatService();
const netInfo = new NetworkInfoService();
const sysInfo = new SystemInfoService();
const friends = new FriendsService();
const chat = new ChatService();
const call = new CallService();
function createSplashWindow() {
  splashWindow = new electron.BrowserWindow({
    width: 520,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    show: true,
    webPreferences: {
      sandbox: false
    }
  });
  splashWindow.loadFile(path.join(__dirname, "../renderer/splash.html"));
}
function createMainWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1240,
    height: 760,
    minWidth: 1060,
    minHeight: 680,
    backgroundColor: "#070A13",
    title: "Nova Optimizer",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    splashWindow?.close();
    splashWindow = null;
  });
  mainWindow.on("close", (e) => {
    const minimizeToTray = settings.get().minimizeToTray;
    if (minimizeToTray) {
      e.preventDefault();
      mainWindow?.hide();
      new electron.Notification({
        title: "Nova Optimizer",
        body: "Still running in the system tray."
      }).show();
    }
  });
}
function createTray() {
  const iconPngPath = path.join(__dirname, "assets", "tray.png");
  const fallback = electron.nativeImage.createEmpty();
  const icon = fs.existsSync(iconPngPath) && fs.statSync(iconPngPath).size > 0 ? electron.nativeImage.createFromPath(iconPngPath) : fallback;
  tray = new electron.Tray(icon);
  tray.setToolTip("Nova Optimizer");
  tray.on("double-click", () => {
    if (!mainWindow) return;
    mainWindow.show();
  });
  const ctx = electron.Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => mainWindow?.show()
    },
    {
      label: engine.isRunning() ? "Stop Optimization" : "Start Optimization",
      click: () => {
        if (engine.isRunning()) engine.stop();
        else engine.start();
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        settings.set({ ...settings.get(), minimizeToTray: false });
        electron.app.quit();
      }
    }
  ]);
  tray.setContextMenu(ctx);
}
function registerIpc() {
  electron.ipcMain.handle("app:getVersion", () => electron.app.getVersion());
  electron.ipcMain.handle("network:getInfo", async () => {
    return netInfo.getInfo();
  });
  electron.ipcMain.handle("system:getInfo", async () => {
    return sysInfo.getInfo();
  });
  electron.ipcMain.handle("auth:getStatus", async () => {
    return auth.getStatus();
  });
  electron.ipcMain.handle("auth:signOut", async () => {
    return auth.signOut();
  });
  electron.ipcMain.handle("auth:requestOtp", async (_e, email) => {
    return auth.requestOtp(email);
  });
  electron.ipcMain.handle("auth:verifyOtp", async (_e, email, code) => {
    return auth.verifyOtp(email, code);
  });
  electron.ipcMain.handle("auth:connectGoogle", async (_e, args) => {
    return auth.connectGoogle(args);
  });
  electron.ipcMain.handle("friends:getStatus", async () => {
    return friends.getStatus();
  });
  electron.ipcMain.handle("friends:generateCode", async () => {
    return { code: friends.generateFriendCode() };
  });
  electron.ipcMain.handle("friends:add", async (_e, username, friendCode) => {
    return friends.addFriend(username, friendCode);
  });
  electron.ipcMain.handle("friends:remove", async (_e, friendId) => {
    return friends.removeFriend(friendId);
  });
  electron.ipcMain.handle("friends:updateStatus", async (_e, friendId, status) => {
    return friends.updateFriendStatus(friendId, status);
  });
  electron.ipcMain.handle("friends:sendRequest", async (_e, toUsername) => {
    return friends.sendFriendRequest(toUsername);
  });
  electron.ipcMain.handle("friends:acceptRequest", async (_e, requestId) => {
    return friends.acceptFriendRequest(requestId);
  });
  electron.ipcMain.handle("friends:rejectRequest", async (_e, requestId) => {
    return friends.rejectFriendRequest(requestId);
  });
  electron.ipcMain.handle("friends:search", async (_e, codeOrUsername) => {
    return friends.searchFriend(codeOrUsername);
  });
  electron.ipcMain.handle("chat:getStatus", async () => {
    return chat.getStatus();
  });
  electron.ipcMain.handle("chat:createDirect", async (_e, participantId, participantName) => {
    return chat.createDirectConversation(participantId, participantName);
  });
  electron.ipcMain.handle("chat:createGroup", async (_e, name, participants) => {
    return chat.createGroupConversation(name, participants);
  });
  electron.ipcMain.handle("chat:sendMessage", async (_e, conversationId, content, type) => {
    return chat.sendMessage(conversationId, content, type || "text");
  });
  electron.ipcMain.handle("chat:getMessages", async (_e, conversationId) => {
    return chat.getMessages(conversationId);
  });
  electron.ipcMain.handle("chat:setActive", async (_e, conversationId) => {
    return chat.setActiveConversation(conversationId);
  });
  electron.ipcMain.handle("chat:markRead", async (_e, conversationId) => {
    return chat.markAsRead(conversationId);
  });
  electron.ipcMain.handle("chat:deleteConversation", async (_e, conversationId) => {
    return chat.deleteConversation(conversationId);
  });
  electron.ipcMain.handle("call:getStatus", async () => {
    return call.getStatus();
  });
  electron.ipcMain.handle("call:initiate", async (_e, calleeId, calleeName, type) => {
    return call.initiateCall(calleeId, calleeName, type);
  });
  electron.ipcMain.handle("call:receive", async (_e, callData) => {
    return call.receiveCall(callData);
  });
  electron.ipcMain.handle("call:accept", async (_e, callId) => {
    return call.acceptCall(callId);
  });
  electron.ipcMain.handle("call:reject", async (_e, callId) => {
    return call.rejectCall(callId);
  });
  electron.ipcMain.handle("call:end", async (_e, callId) => {
    return call.endCall(callId);
  });
  electron.ipcMain.handle("call:toggleMute", async (_e, callId, muted) => {
    return call.toggleMute(callId, muted);
  });
  electron.ipcMain.handle("call:toggleVideo", async (_e, callId, videoEnabled) => {
    return call.toggleVideo(callId, videoEnabled);
  });
  electron.ipcMain.handle("network:flushDns", async () => {
    return netTools.flushDns();
  });
  electron.ipcMain.handle("network:renewIp", async () => {
    return netTools.renewIp();
  });
  electron.ipcMain.handle("network:releaseIp", async () => {
    return netTools.releaseIp();
  });
  electron.ipcMain.handle("network:resetWinsock", async () => {
    return netTools.resetWinsock();
  });
  electron.ipcMain.handle("network:resetTcpIp", async () => {
    return netTools.resetTcpIp();
  });
  electron.ipcMain.handle("games:scan", async () => {
    return games.scanSteamGames();
  });
  electron.ipcMain.handle("games:openFolder", async (_e, args) => {
    const p = String(args?.path || "");
    if (!p) return { ok: false, error: "Missing path" };
    const r = await electron.shell.openPath(p);
    return r ? { ok: false, error: r } : { ok: true };
  });
  electron.ipcMain.handle(
    "games:launch",
    async (_e, args) => {
      const source = String(args?.source || "").toLowerCase();
      const appId = String(args?.appId || "");
      if (!source || !appId) return { ok: false, error: "Missing source/appId" };
      if (source === "steam") {
        await electron.shell.openExternal(`steam://run/${encodeURIComponent(appId)}`);
        return { ok: true };
      }
      if (source === "epic") {
        await electron.shell.openExternal(`com.epicgames.launcher://apps/${encodeURIComponent(appId)}?action=launch&silent=true`);
        return { ok: true };
      }
      if (source === "windows") {
        const exePath = String(args?.exePath || "").trim();
        const installDir = String(args?.installDir || "").trim();
        if (exePath) {
          const r = await electron.shell.openPath(exePath);
          return r ? { ok: false, error: r } : { ok: true };
        }
        if (installDir) {
          const r = await electron.shell.openPath(installDir);
          return r ? { ok: false, error: r } : { ok: true };
        }
        return { ok: false, error: "Missing exePath/installDir for Windows launch" };
      }
      return { ok: false, error: "Launch not supported for this source yet" };
    }
  );
  electron.ipcMain.handle("speedtest:getStatus", async () => {
    return speedtest.getStatus();
  });
  electron.ipcMain.handle("speedtest:run", async () => {
    const res = await speedtest.run();
    return { ok: true, result: res };
  });
  electron.ipcMain.handle("bufferbloat:getStatus", async () => {
    return bufferbloat.getStatus();
  });
  electron.ipcMain.handle("bufferbloat:start", async () => {
    const res = await bufferbloat.run();
    return { ok: true, result: res };
  });
  electron.ipcMain.handle("bufferbloat:stop", async () => {
    return bufferbloat.stop();
  });
  electron.ipcMain.handle("security:getStatus", async () => {
    return security.getStatus();
  });
  electron.ipcMain.handle("security:refresh", async () => {
    return security.refreshDefenderStatus();
  });
  electron.ipcMain.handle("security:defenderScan", async (_e, scanType) => {
    return security.startDefenderScan(scanType);
  });
  electron.ipcMain.handle("security:getThreats", async () => {
    return security.getThreats();
  });
  electron.ipcMain.handle("security:removeThreat", async (_e, threatId) => {
    return security.removeThreat(threatId);
  });
  electron.ipcMain.handle("trial:get", async () => {
    return trial.getStatus();
  });
  electron.ipcMain.handle("settings:get", async () => {
    return settings.get();
  });
  electron.ipcMain.handle("settings:set", async (_e, patch) => {
    const next = settings.set(patch);
    engine.setMode(next.routingMode);
    engine.setDnsOptimization(next.dnsOptimization);
    engine.setTrafficPriority(next.trafficPriority);
    electron.app.setLoginItemSettings({
      openAtLogin: !!next.startOnBoot
    });
    return next;
  });
  electron.ipcMain.handle("engine:setMode", async (_e, mode) => {
    engine.setMode(mode);
    return engine.getStatus();
  });
  electron.ipcMain.handle("engine:setDns", async (_e, enabled) => {
    engine.setDnsOptimization(!!enabled);
    return engine.getStatus();
  });
  electron.ipcMain.handle("engine:setPriority", async (_e, priority) => {
    engine.setTrafficPriority(priority);
    return engine.getStatus();
  });
  electron.ipcMain.handle("engine:start", async () => {
    engine.start();
    return { running: engine.isRunning() };
  });
  electron.ipcMain.handle("engine:stop", async () => {
    engine.stop();
    return { running: engine.isRunning() };
  });
  electron.ipcMain.handle("engine:getStatus", async () => {
    return engine.getStatus();
  });
  electron.ipcMain.handle("engine:getSample", async () => {
    return engine.getLatestSample();
  });
  electron.ipcMain.handle("engine:addRoute", async (_e, destination, gateway) => {
    await engine.addRoute(destination, gateway);
    return { ok: true };
  });
  electron.ipcMain.handle("engine:deleteRoute", async (_e, destination) => {
    await engine.deleteRoute(destination);
    return { ok: true };
  });
  electron.ipcMain.handle("engine:getRoutes", async () => {
    return await engine.getRoutes();
  });
  engine.on("sample", (sample) => {
    mainWindow?.webContents.send("engine:sample", sample);
  });
  speedtest.on("sample", (sample) => {
    mainWindow?.webContents.send("speedtest:sample", sample);
  });
  bufferbloat.on("sample", (sample) => {
    mainWindow?.webContents.send("bufferbloat:sample", sample);
  });
  electron.ipcMain.handle("logs:export", async () => {
    const logPath = path.join(electron.app.getPath("userData"), "session-log.jsonl");
    if (!fs.existsSync(logPath)) return { ok: true, content: "" };
    const content = fs.readFileSync(logPath, "utf-8");
    return { ok: true, content };
  });
  electron.ipcMain.handle("tunnel:getRegions", async () => {
    return tunnel.getRegions();
  });
  electron.ipcMain.handle("tunnel:getStatus", async () => {
    return tunnel.getStatus();
  });
  electron.ipcMain.handle("tunnel:connect", async (_e, regionId) => {
    return tunnel.connect(regionId);
  });
  electron.ipcMain.handle("tunnel:disconnect", async () => {
    return tunnel.disconnect();
  });
  electron.ipcMain.handle("capture:getStatus", async () => {
    return capture.getStatus();
  });
  electron.ipcMain.handle("capture:start", async (_e, args) => {
    return capture.startCapture(args);
  });
  electron.ipcMain.handle("capture:stop", async () => {
    return capture.stopCapture();
  });
  capture.on("status", (status) => {
    mainWindow?.webContents.send("capture:status", status);
  });
  tunnel.on("status", (status) => {
    mainWindow?.webContents.send("tunnel:status", status);
  });
  engine.on("log", (line) => {
    const logPath = path.join(electron.app.getPath("userData"), "session-log.jsonl");
    fs.writeFileSync(logPath, line + "\n", { encoding: "utf-8", flag: "a" });
  });
}
electron.app.whenReady().then(async () => {
  trial.ensureInitialized();
  settings.ensureInitialized();
  auth.ensureInitialized();
  friends.ensureInitialized();
  chat.ensureInitialized();
  const s = settings.get();
  engine.setMode(s.routingMode);
  engine.setDnsOptimization(s.dnsOptimization);
  engine.setTrafficPriority(s.trafficPriority);
  createSplashWindow();
  createMainWindow();
  createTray();
  registerIpc();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else mainWindow?.show();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
