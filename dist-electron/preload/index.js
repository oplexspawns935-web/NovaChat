"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("netflux", {
  getVersion: () => electron.ipcRenderer.invoke("app:getVersion"),
  getAuthStatus: () => electron.ipcRenderer.invoke("auth:getStatus"),
  signOut: () => electron.ipcRenderer.invoke("auth:signOut"),
  requestOtp: (email) => electron.ipcRenderer.invoke("auth:requestOtp", email),
  verifyOtp: (email, code) => electron.ipcRenderer.invoke("auth:verifyOtp", email, code),
  connectGoogle: (args) => electron.ipcRenderer.invoke("auth:connectGoogle", args),
  flushDns: () => electron.ipcRenderer.invoke("network:flushDns"),
  renewIp: () => electron.ipcRenderer.invoke("network:renewIp"),
  releaseIp: () => electron.ipcRenderer.invoke("network:releaseIp"),
  resetWinsock: () => electron.ipcRenderer.invoke("network:resetWinsock"),
  resetTcpIp: () => electron.ipcRenderer.invoke("network:resetTcpIp"),
  getNetworkInfo: () => electron.ipcRenderer.invoke("network:getInfo"),
  getSystemInfo: () => electron.ipcRenderer.invoke("system:getInfo"),
  getTrial: () => electron.ipcRenderer.invoke("trial:get"),
  getSettings: () => electron.ipcRenderer.invoke("settings:get"),
  setSettings: (patch) => electron.ipcRenderer.invoke("settings:set", patch),
  startEngine: () => electron.ipcRenderer.invoke("engine:start"),
  stopEngine: () => electron.ipcRenderer.invoke("engine:stop"),
  getEngineStatus: () => electron.ipcRenderer.invoke("engine:getStatus"),
  getEngineSample: () => electron.ipcRenderer.invoke("engine:getSample"),
  setEngineMode: (mode) => electron.ipcRenderer.invoke("engine:setMode", mode),
  setEngineDns: (enabled) => electron.ipcRenderer.invoke("engine:setDns", enabled),
  setEnginePriority: (priority) => electron.ipcRenderer.invoke("engine:setPriority", priority),
  onEngineSample: (cb) => {
    const listener = (_e, payload) => cb(payload);
    electron.ipcRenderer.on("engine:sample", listener);
    return () => electron.ipcRenderer.removeListener("engine:sample", listener);
  },
  exportLogs: () => electron.ipcRenderer.invoke("logs:export"),
  scanGames: () => electron.ipcRenderer.invoke("games:scan"),
  openGameFolder: (path) => electron.ipcRenderer.invoke("games:openFolder", { path }),
  launchGame: (source, appId, opts) => electron.ipcRenderer.invoke("games:launch", { source, appId, ...opts || {} }),
  getSpeedtestStatus: () => electron.ipcRenderer.invoke("speedtest:getStatus"),
  runSpeedtest: () => electron.ipcRenderer.invoke("speedtest:run"),
  onSpeedtestSample: (cb) => {
    const listener = (_e, payload) => cb(payload);
    electron.ipcRenderer.on("speedtest:sample", listener);
    return () => electron.ipcRenderer.removeListener("speedtest:sample", listener);
  },
  getBufferbloatStatus: () => electron.ipcRenderer.invoke("bufferbloat:getStatus"),
  startBufferbloat: () => electron.ipcRenderer.invoke("bufferbloat:start"),
  stopBufferbloat: () => electron.ipcRenderer.invoke("bufferbloat:stop"),
  onBufferbloatSample: (cb) => {
    const listener = (_e, payload) => cb(payload);
    electron.ipcRenderer.on("bufferbloat:sample", listener);
    return () => electron.ipcRenderer.removeListener("bufferbloat:sample", listener);
  },
  getSecurityStatus: () => electron.ipcRenderer.invoke("security:getStatus"),
  refreshSecurity: () => electron.ipcRenderer.invoke("security:refresh"),
  startDefenderScan: (scanType) => electron.ipcRenderer.invoke("security:defenderScan", scanType),
  getThreats: () => electron.ipcRenderer.invoke("security:getThreats"),
  removeThreat: (threatId) => electron.ipcRenderer.invoke("security:removeThreat", threatId),
  getTunnelRegions: () => electron.ipcRenderer.invoke("tunnel:getRegions"),
  getTunnelStatus: () => electron.ipcRenderer.invoke("tunnel:getStatus"),
  connectTunnel: (regionId) => electron.ipcRenderer.invoke("tunnel:connect", regionId),
  disconnectTunnel: () => electron.ipcRenderer.invoke("tunnel:disconnect"),
  getCaptureStatus: () => electron.ipcRenderer.invoke("capture:getStatus"),
  startCapture: (args) => electron.ipcRenderer.invoke("capture:start", args),
  stopCapture: () => electron.ipcRenderer.invoke("capture:stop"),
  onCaptureStatus: (cb) => {
    const listener = (_e, payload) => cb(payload);
    electron.ipcRenderer.on("capture:status", listener);
    return () => electron.ipcRenderer.removeListener("capture:status", listener);
  },
  onTunnelStatus: (cb) => {
    const listener = (_e, payload) => cb(payload);
    electron.ipcRenderer.on("tunnel:status", listener);
    return () => electron.ipcRenderer.removeListener("tunnel:status", listener);
  },
  addRoute: (destination, gateway) => electron.ipcRenderer.invoke("engine:addRoute", destination, gateway),
  deleteRoute: (destination) => electron.ipcRenderer.invoke("engine:deleteRoute", destination),
  getRoutes: () => electron.ipcRenderer.invoke("engine:getRoutes"),
  // Friends API
  getFriendsStatus: () => electron.ipcRenderer.invoke("friends:getStatus"),
  generateFriendCode: () => electron.ipcRenderer.invoke("friends:generateCode"),
  addFriend: (username, friendCode) => electron.ipcRenderer.invoke("friends:add", username, friendCode),
  removeFriend: (friendId) => electron.ipcRenderer.invoke("friends:remove", friendId),
  updateFriendStatus: (friendId, status) => electron.ipcRenderer.invoke("friends:updateStatus", friendId, status),
  sendFriendRequest: (toUsername) => electron.ipcRenderer.invoke("friends:sendRequest", toUsername),
  acceptFriendRequest: (requestId) => electron.ipcRenderer.invoke("friends:acceptRequest", requestId),
  rejectFriendRequest: (requestId) => electron.ipcRenderer.invoke("friends:rejectRequest", requestId),
  searchFriend: (codeOrUsername) => electron.ipcRenderer.invoke("friends:search", codeOrUsername),
  // Chat API
  getChatStatus: () => electron.ipcRenderer.invoke("chat:getStatus"),
  createDirectConversation: (participantId, participantName) => electron.ipcRenderer.invoke("chat:createDirect", participantId, participantName),
  createGroupConversation: (name, participants) => electron.ipcRenderer.invoke("chat:createGroup", name, participants),
  sendMessage: (conversationId, content, type) => electron.ipcRenderer.invoke("chat:sendMessage", conversationId, content, type),
  getMessages: (conversationId) => electron.ipcRenderer.invoke("chat:getMessages", conversationId),
  setActiveConversation: (conversationId) => electron.ipcRenderer.invoke("chat:setActive", conversationId),
  markAsRead: (conversationId) => electron.ipcRenderer.invoke("chat:markRead", conversationId),
  deleteConversation: (conversationId) => electron.ipcRenderer.invoke("chat:deleteConversation", conversationId),
  // Call API
  getCallStatus: () => electron.ipcRenderer.invoke("call:getStatus"),
  initiateCall: (calleeId, calleeName, type) => electron.ipcRenderer.invoke("call:initiate", calleeId, calleeName, type),
  receiveCall: (callData) => electron.ipcRenderer.invoke("call:receive", callData),
  acceptCall: (callId) => electron.ipcRenderer.invoke("call:accept", callId),
  rejectCall: (callId) => electron.ipcRenderer.invoke("call:reject", callId),
  endCall: (callId) => electron.ipcRenderer.invoke("call:end", callId),
  toggleMute: (callId, muted) => electron.ipcRenderer.invoke("call:toggleMute", callId, muted),
  toggleVideo: (callId, videoEnabled) => electron.ipcRenderer.invoke("call:toggleVideo", callId, videoEnabled)
});
