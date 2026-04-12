import { app, BrowserWindow, ipcMain, nativeImage, Notification, Tray, Menu, shell } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs'
import { OptimizationEngine } from './services/OptimizationEngine'
import { TrialService } from './services/TrialService'
import { SettingsService } from './services/SettingsService'
import { TunnelService } from './services/TunnelService'
import { PacketCaptureService } from './services/PacketCaptureService'
import { GamesService } from './services/GamesService'
import { SpeedtestService } from './services/SpeedtestService'
import { SecurityService } from './services/SecurityService'
import { AuthService } from './services/AuthService'
import { NetworkToolsService } from './services/NetworkToolsService'
import { BufferbloatService } from './services/BufferbloatService'
import { NetworkInfoService } from './services/NetworkInfoService'
import { SystemInfoService } from './services/SystemInfoService'
import { FriendsService } from './services/FriendsService'
import { ChatService } from './services/ChatService'
import { CallService } from './services/CallService'

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let tray: Tray | null = null

const engine = new OptimizationEngine()
const trial = new TrialService()
const settings = new SettingsService()
const tunnel = new TunnelService()
const capture = new PacketCaptureService()
const games = new GamesService()
const speedtest = new SpeedtestService()
const security = new SecurityService()
const auth = new AuthService()
const netTools = new NetworkToolsService()
const bufferbloat = new BufferbloatService()
const netInfo = new NetworkInfoService()
const sysInfo = new SystemInfoService()
const friends = new FriendsService()
const chat = new ChatService()
const call = new CallService()

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 520,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    show: true,
    webPreferences: {
      sandbox: false,
    },
  })

  splashWindow.loadFile(join(__dirname, '../renderer/splash.html'))
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 760,
    minWidth: 1060,
    minHeight: 680,
    backgroundColor: '#070A13',
    title: 'Nova Optimizer',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    splashWindow?.close()
    splashWindow = null
  })

  mainWindow.on('close', (e) => {
    const minimizeToTray = settings.get().minimizeToTray
    if (minimizeToTray) {
      e.preventDefault()
      mainWindow?.hide()

      new Notification({
        title: 'Nova Optimizer',
        body: 'Still running in the system tray.',
      }).show()
    }
  })
}

function createTray() {
  const iconPngPath = join(__dirname, 'assets', 'tray.png')
  const fallback = nativeImage.createEmpty()
  const icon =
    existsSync(iconPngPath) && statSync(iconPngPath).size > 0
      ? nativeImage.createFromPath(iconPngPath)
      : fallback

  tray = new Tray(icon)
  tray.setToolTip('Nova Optimizer')

  tray.on('double-click', () => {
    if (!mainWindow) return
    mainWindow.show()
  })

  const ctx = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => mainWindow?.show(),
    },
    {
      label: engine.isRunning() ? 'Stop Optimization' : 'Start Optimization',
      click: () => {
        if (engine.isRunning()) engine.stop()
        else engine.start()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        settings.set({ ...settings.get(), minimizeToTray: false })
        app.quit()
      },
    },
  ])

  tray.setContextMenu(ctx)
}

function registerIpc() {
  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('network:getInfo', async () => {
    return netInfo.getInfo()
  })

  ipcMain.handle('system:getInfo', async () => {
    return sysInfo.getInfo()
  })

  ipcMain.handle('auth:getStatus', async () => {
    return auth.getStatus()
  })

  ipcMain.handle('auth:signOut', async () => {
    return auth.signOut()
  })

  ipcMain.handle('auth:requestOtp', async (_e, email) => {
    return auth.requestOtp(email)
  })

  ipcMain.handle('auth:verifyOtp', async (_e, email, code) => {
    return auth.verifyOtp(email, code)
  })

  ipcMain.handle('auth:connectGoogle', async (_e, args) => {
    return auth.connectGoogle(args)
  })

  // Friends service
  ipcMain.handle('friends:getStatus', async () => {
    return friends.getStatus()
  })

  ipcMain.handle('friends:generateCode', async () => {
    return { code: friends.generateFriendCode() }
  })

  ipcMain.handle('friends:add', async (_e, username: string, friendCode: string) => {
    return friends.addFriend(username, friendCode)
  })

  ipcMain.handle('friends:remove', async (_e, friendId: string) => {
    return friends.removeFriend(friendId)
  })

  ipcMain.handle('friends:updateStatus', async (_e, friendId: string, status: any) => {
    return friends.updateFriendStatus(friendId, status)
  })

  ipcMain.handle('friends:sendRequest', async (_e, toUsername: string) => {
    return friends.sendFriendRequest(toUsername)
  })

  ipcMain.handle('friends:acceptRequest', async (_e, requestId: string) => {
    return friends.acceptFriendRequest(requestId)
  })

  ipcMain.handle('friends:rejectRequest', async (_e, requestId: string) => {
    return friends.rejectFriendRequest(requestId)
  })

  ipcMain.handle('friends:search', async (_e, codeOrUsername: string) => {
    return friends.searchFriend(codeOrUsername)
  })

  // Chat service
  ipcMain.handle('chat:getStatus', async () => {
    return chat.getStatus()
  })

  ipcMain.handle('chat:createDirect', async (_e, participantId: string, participantName: string) => {
    return chat.createDirectConversation(participantId, participantName)
  })

  ipcMain.handle('chat:createGroup', async (_e, name: string, participants: string[]) => {
    return chat.createGroupConversation(name, participants)
  })

  ipcMain.handle('chat:sendMessage', async (_e, conversationId: string, content: string, type?: string) => {
    return chat.sendMessage(conversationId, content, (type as any) || 'text')
  })

  ipcMain.handle('chat:getMessages', async (_e, conversationId: string) => {
    return chat.getMessages(conversationId)
  })

  ipcMain.handle('chat:setActive', async (_e, conversationId: string) => {
    return chat.setActiveConversation(conversationId)
  })

  ipcMain.handle('chat:markRead', async (_e, conversationId: string) => {
    return chat.markAsRead(conversationId)
  })

  ipcMain.handle('chat:deleteConversation', async (_e, conversationId: string) => {
    return chat.deleteConversation(conversationId)
  })

  // Call service
  ipcMain.handle('call:getStatus', async () => {
    return call.getStatus()
  })

  ipcMain.handle('call:initiate', async (_e, calleeId: string, calleeName: string, type: 'audio' | 'video') => {
    return call.initiateCall(calleeId, calleeName, type)
  })

  ipcMain.handle('call:receive', async (_e, callData: any) => {
    return call.receiveCall(callData)
  })

  ipcMain.handle('call:accept', async (_e, callId: string) => {
    return call.acceptCall(callId)
  })

  ipcMain.handle('call:reject', async (_e, callId: string) => {
    return call.rejectCall(callId)
  })

  ipcMain.handle('call:end', async (_e, callId: string) => {
    return call.endCall(callId)
  })

  ipcMain.handle('call:toggleMute', async (_e, callId: string, muted: boolean) => {
    return call.toggleMute(callId, muted)
  })

  ipcMain.handle('call:toggleVideo', async (_e, callId: string, videoEnabled: boolean) => {
    return call.toggleVideo(callId, videoEnabled)
  })

  ipcMain.handle('network:flushDns', async () => {
    return netTools.flushDns()
  })

  ipcMain.handle('network:renewIp', async () => {
    return netTools.renewIp()
  })

  ipcMain.handle('network:releaseIp', async () => {
    return netTools.releaseIp()
  })

  ipcMain.handle('network:resetWinsock', async () => {
    return netTools.resetWinsock()
  })

  ipcMain.handle('network:resetTcpIp', async () => {
    return netTools.resetTcpIp()
  })

  ipcMain.handle('games:scan', async () => {
    return games.scanSteamGames()
  })

  ipcMain.handle('games:openFolder', async (_e, args: { path: string }) => {
    const p = String(args?.path || '')
    if (!p) return { ok: false, error: 'Missing path' }
    const r = await shell.openPath(p)
    return r ? { ok: false, error: r } : { ok: true }
  })

  ipcMain.handle(
    'games:launch',
    async (_e, args: { source: string; appId: string; exePath?: string; installDir?: string }) => {
    const source = String(args?.source || '').toLowerCase()
    const appId = String(args?.appId || '')
    if (!source || !appId) return { ok: false, error: 'Missing source/appId' }

    if (source === 'steam') {
      await shell.openExternal(`steam://run/${encodeURIComponent(appId)}`)
      return { ok: true }
    }

    if (source === 'epic') {
      // Epic launcher deep link. Works for many titles where appId is Epic AppName.
      // Example: com.epicgames.launcher://apps/Fortnite?action=launch&silent=true
      await shell.openExternal(`com.epicgames.launcher://apps/${encodeURIComponent(appId)}?action=launch&silent=true`)
      return { ok: true }
    }

    if (source === 'windows') {
      const exePath = String(args?.exePath || '').trim()
      const installDir = String(args?.installDir || '').trim()

      if (exePath) {
        const r = await shell.openPath(exePath)
        return r ? { ok: false, error: r } : { ok: true }
      }

      if (installDir) {
        const r = await shell.openPath(installDir)
        return r ? { ok: false, error: r } : { ok: true }
      }

      return { ok: false, error: 'Missing exePath/installDir for Windows launch' }
    }

    // Epic/Windows launch is best-effort (varies by title). We'll expand this with per-launcher URIs.
    return { ok: false, error: 'Launch not supported for this source yet' }
  }
  )

  ipcMain.handle('speedtest:getStatus', async () => {
    return speedtest.getStatus()
  })

  ipcMain.handle('speedtest:run', async () => {
    const res = await speedtest.run()
    return { ok: true, result: res }
  })

  ipcMain.handle('bufferbloat:getStatus', async () => {
    return bufferbloat.getStatus()
  })

  ipcMain.handle('bufferbloat:start', async () => {
    const res = await bufferbloat.run()
    return { ok: true, result: res }
  })

  ipcMain.handle('bufferbloat:stop', async () => {
    return bufferbloat.stop()
  })

  ipcMain.handle('security:getStatus', async () => {
    return security.getStatus()
  })

  ipcMain.handle('security:refresh', async () => {
    return security.refreshDefenderStatus()
  })

  ipcMain.handle('security:defenderScan', async (_e, scanType) => {
    return security.startDefenderScan(scanType)
  })

  ipcMain.handle('security:getThreats', async () => {
    return security.getThreats()
  })

  ipcMain.handle('security:removeThreat', async (_e, threatId: string) => {
    return security.removeThreat(threatId)
  })

  ipcMain.handle('trial:get', async () => {
    return trial.getStatus()
  })

  ipcMain.handle('settings:get', async () => {
    return settings.get()
  })

  ipcMain.handle('settings:set', async (_e, patch) => {
    const next = settings.set(patch)

    engine.setMode(next.routingMode)
    engine.setDnsOptimization(next.dnsOptimization)
    engine.setTrafficPriority(next.trafficPriority)

    app.setLoginItemSettings({
      openAtLogin: !!next.startOnBoot,
    })

    return next
  })

  ipcMain.handle('engine:setMode', async (_e, mode) => {
    engine.setMode(mode)
    return engine.getStatus()
  })

  ipcMain.handle('engine:setDns', async (_e, enabled) => {
    engine.setDnsOptimization(!!enabled)
    return engine.getStatus()
  })

  ipcMain.handle('engine:setPriority', async (_e, priority) => {
    engine.setTrafficPriority(priority)
    return engine.getStatus()
  })

  ipcMain.handle('engine:start', async () => {
    engine.start()
    return { running: engine.isRunning() }
  })

  ipcMain.handle('engine:stop', async () => {
    engine.stop()
    return { running: engine.isRunning() }
  })

  ipcMain.handle('engine:getStatus', async () => {
    return engine.getStatus()
  })

  ipcMain.handle('engine:getSample', async () => {
    return engine.getLatestSample()
  })

  ipcMain.handle('engine:addRoute', async (_e, destination: string, gateway: string) => {
    await engine.addRoute(destination, gateway)
    return { ok: true }
  })

  ipcMain.handle('engine:deleteRoute', async (_e, destination: string) => {
    await engine.deleteRoute(destination)
    return { ok: true }
  })

  ipcMain.handle('engine:getRoutes', async () => {
    return await engine.getRoutes()
  })

  engine.on('sample', (sample) => {
    mainWindow?.webContents.send('engine:sample', sample)
  })

  speedtest.on('sample', (sample) => {
    mainWindow?.webContents.send('speedtest:sample', sample)
  })

  bufferbloat.on('sample', (sample) => {
    mainWindow?.webContents.send('bufferbloat:sample', sample)
  })

  ipcMain.handle('logs:export', async () => {
    const logPath = join(app.getPath('userData'), 'session-log.jsonl')
    if (!existsSync(logPath)) return { ok: true, content: '' }
    const content = readFileSync(logPath, 'utf-8')
    return { ok: true, content }
  })

  ipcMain.handle('tunnel:getRegions', async () => {
    return tunnel.getRegions()
  })

  ipcMain.handle('tunnel:getStatus', async () => {
    return tunnel.getStatus()
  })

  ipcMain.handle('tunnel:connect', async (_e, regionId) => {
    return tunnel.connect(regionId)
  })

  ipcMain.handle('tunnel:disconnect', async () => {
    return tunnel.disconnect()
  })

  ipcMain.handle('capture:getStatus', async () => {
    return capture.getStatus()
  })

  ipcMain.handle('capture:start', async (_e, args) => {
    return capture.startCapture(args)
  })

  ipcMain.handle('capture:stop', async () => {
    return capture.stopCapture()
  })

  // Forward capture status events to renderer
  capture.on('status', (status) => {
    mainWindow?.webContents.send('capture:status', status)
  })

  // Forward tunnel status events to renderer
  tunnel.on('status', (status) => {
    mainWindow?.webContents.send('tunnel:status', status)
  })

  engine.on('log', (line) => {
    const logPath = join(app.getPath('userData'), 'session-log.jsonl')
    writeFileSync(logPath, line + '\n', { encoding: 'utf-8', flag: 'a' })
  })
}

app.whenReady().then(async () => {
  trial.ensureInitialized()
  settings.ensureInitialized()
  auth.ensureInitialized()
  friends.ensureInitialized()
  chat.ensureInitialized()

  const s = settings.get()
  engine.setMode(s.routingMode)
  engine.setDnsOptimization(s.dnsOptimization)
  engine.setTrafficPriority(s.trafficPriority)

  createSplashWindow()
  createMainWindow()
  createTray()
  registerIpc()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    else mainWindow?.show()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
