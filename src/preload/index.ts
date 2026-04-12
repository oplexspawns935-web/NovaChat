import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('netflux', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  getAuthStatus: () => ipcRenderer.invoke('auth:getStatus'),
  signOut: () => ipcRenderer.invoke('auth:signOut'),
  requestOtp: (email: string) => ipcRenderer.invoke('auth:requestOtp', email),
  verifyOtp: (email: string, code: string) => ipcRenderer.invoke('auth:verifyOtp', email, code),
  connectGoogle: (args: { clientId: string; scopes?: string[] }) => ipcRenderer.invoke('auth:connectGoogle', args),

  flushDns: () => ipcRenderer.invoke('network:flushDns'),
  renewIp: () => ipcRenderer.invoke('network:renewIp'),
  releaseIp: () => ipcRenderer.invoke('network:releaseIp'),
  resetWinsock: () => ipcRenderer.invoke('network:resetWinsock'),
  resetTcpIp: () => ipcRenderer.invoke('network:resetTcpIp'),
  getNetworkInfo: () => ipcRenderer.invoke('network:getInfo'),

  getSystemInfo: () => ipcRenderer.invoke('system:getInfo'),

  getTrial: () => ipcRenderer.invoke('trial:get'),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: any) => ipcRenderer.invoke('settings:set', patch),

  startEngine: () => ipcRenderer.invoke('engine:start'),
  stopEngine: () => ipcRenderer.invoke('engine:stop'),
  getEngineStatus: () => ipcRenderer.invoke('engine:getStatus'),
  getEngineSample: () => ipcRenderer.invoke('engine:getSample'),
  setEngineMode: (mode: any) => ipcRenderer.invoke('engine:setMode', mode),
  setEngineDns: (enabled: boolean) => ipcRenderer.invoke('engine:setDns', enabled),
  setEnginePriority: (priority: any) => ipcRenderer.invoke('engine:setPriority', priority),

  onEngineSample: (cb: (sample: any) => void) => {
    const listener = (_e: any, payload: any) => cb(payload)
    ipcRenderer.on('engine:sample', listener)
    return () => ipcRenderer.removeListener('engine:sample', listener)
  },

  exportLogs: () => ipcRenderer.invoke('logs:export'),

  scanGames: () => ipcRenderer.invoke('games:scan'),
  openGameFolder: (path: string) => ipcRenderer.invoke('games:openFolder', { path }),
  launchGame: (source: string, appId: string, opts?: { exePath?: string; installDir?: string }) =>
    ipcRenderer.invoke('games:launch', { source, appId, ...(opts || {}) }),

  getSpeedtestStatus: () => ipcRenderer.invoke('speedtest:getStatus'),
  runSpeedtest: () => ipcRenderer.invoke('speedtest:run'),

  onSpeedtestSample: (cb: (sample: any) => void) => {
    const listener = (_e: any, payload: any) => cb(payload)
    ipcRenderer.on('speedtest:sample', listener)
    return () => ipcRenderer.removeListener('speedtest:sample', listener)
  },

  getBufferbloatStatus: () => ipcRenderer.invoke('bufferbloat:getStatus'),
  startBufferbloat: () => ipcRenderer.invoke('bufferbloat:start'),
  stopBufferbloat: () => ipcRenderer.invoke('bufferbloat:stop'),

  onBufferbloatSample: (cb: (sample: any) => void) => {
    const listener = (_e: any, payload: any) => cb(payload)
    ipcRenderer.on('bufferbloat:sample', listener)
    return () => ipcRenderer.removeListener('bufferbloat:sample', listener)
  },

  getSecurityStatus: () => ipcRenderer.invoke('security:getStatus'),
  refreshSecurity: () => ipcRenderer.invoke('security:refresh'),
  startDefenderScan: (scanType: 'QuickScan' | 'FullScan') => ipcRenderer.invoke('security:defenderScan', scanType),
  getThreats: () => ipcRenderer.invoke('security:getThreats'),
  removeThreat: (threatId: string) => ipcRenderer.invoke('security:removeThreat', threatId),

  getTunnelRegions: () => ipcRenderer.invoke('tunnel:getRegions'),
  getTunnelStatus: () => ipcRenderer.invoke('tunnel:getStatus'),
  connectTunnel: (regionId: string) => ipcRenderer.invoke('tunnel:connect', regionId),
  disconnectTunnel: () => ipcRenderer.invoke('tunnel:disconnect'),

  getCaptureStatus: () => ipcRenderer.invoke('capture:getStatus'),
  startCapture: (args?: any) => ipcRenderer.invoke('capture:start', args),
  stopCapture: () => ipcRenderer.invoke('capture:stop'),

  onCaptureStatus: (cb: (status: any) => void) => {
    const listener = (_e: any, payload: any) => cb(payload)
    ipcRenderer.on('capture:status', listener)
    return () => ipcRenderer.removeListener('capture:status', listener)
  },

  onTunnelStatus: (cb: (status: any) => void) => {
    const listener = (_e: any, payload: any) => cb(payload)
    ipcRenderer.on('tunnel:status', listener)
    return () => ipcRenderer.removeListener('tunnel:status', listener)
  },

  addRoute: (destination: string, gateway: string) => ipcRenderer.invoke('engine:addRoute', destination, gateway),
  deleteRoute: (destination: string) => ipcRenderer.invoke('engine:deleteRoute', destination),
  getRoutes: () => ipcRenderer.invoke('engine:getRoutes'),

  // Friends API
  getFriendsStatus: () => ipcRenderer.invoke('friends:getStatus'),
  generateFriendCode: () => ipcRenderer.invoke('friends:generateCode'),
  addFriend: (username: string, friendCode: string) => ipcRenderer.invoke('friends:add', username, friendCode),
  removeFriend: (friendId: string) => ipcRenderer.invoke('friends:remove', friendId),
  updateFriendStatus: (friendId: string, status: any) => ipcRenderer.invoke('friends:updateStatus', friendId, status),
  sendFriendRequest: (toUsername: string) => ipcRenderer.invoke('friends:sendRequest', toUsername),
  acceptFriendRequest: (requestId: string) => ipcRenderer.invoke('friends:acceptRequest', requestId),
  rejectFriendRequest: (requestId: string) => ipcRenderer.invoke('friends:rejectRequest', requestId),
  searchFriend: (codeOrUsername: string) => ipcRenderer.invoke('friends:search', codeOrUsername),

  // Chat API
  getChatStatus: () => ipcRenderer.invoke('chat:getStatus'),
  createDirectConversation: (participantId: string, participantName: string) => ipcRenderer.invoke('chat:createDirect', participantId, participantName),
  createGroupConversation: (name: string, participants: string[]) => ipcRenderer.invoke('chat:createGroup', name, participants),
  sendMessage: (conversationId: string, content: string, type?: string) => ipcRenderer.invoke('chat:sendMessage', conversationId, content, type),
  getMessages: (conversationId: string) => ipcRenderer.invoke('chat:getMessages', conversationId),
  setActiveConversation: (conversationId: string) => ipcRenderer.invoke('chat:setActive', conversationId),
  markAsRead: (conversationId: string) => ipcRenderer.invoke('chat:markRead', conversationId),
  deleteConversation: (conversationId: string) => ipcRenderer.invoke('chat:deleteConversation', conversationId),

  // Call API
  getCallStatus: () => ipcRenderer.invoke('call:getStatus'),
  initiateCall: (calleeId: string, calleeName: string, type: 'audio' | 'video') => ipcRenderer.invoke('call:initiate', calleeId, calleeName, type),
  receiveCall: (callData: any) => ipcRenderer.invoke('call:receive', callData),
  acceptCall: (callId: string) => ipcRenderer.invoke('call:accept', callId),
  rejectCall: (callId: string) => ipcRenderer.invoke('call:reject', callId),
  endCall: (callId: string) => ipcRenderer.invoke('call:end', callId),
  toggleMute: (callId: string, muted: boolean) => ipcRenderer.invoke('call:toggleMute', callId, muted),
  toggleVideo: (callId: string, videoEnabled: boolean) => ipcRenderer.invoke('call:toggleVideo', callId, videoEnabled),
})
