export {}

declare global {
  interface Window {
    netflux: {
      getVersion: () => Promise<string>
      getAuthStatus: () => Promise<any>
      signOut: () => Promise<any>
      requestOtp: (email: string) => Promise<any>
      verifyOtp: (email: string, code: string) => Promise<any>
      connectGoogle: (args: { clientId: string; scopes?: string[] }) => Promise<any>

      flushDns: () => Promise<any>
      renewIp: () => Promise<any>
      releaseIp: () => Promise<any>
      resetWinsock: () => Promise<any>
      resetTcpIp: () => Promise<any>
      getNetworkInfo: () => Promise<any>
      getSystemInfo: () => Promise<any>
      getTrial: () => Promise<{ startedAt: number; expiresAt: number; remainingDays: number; expired: boolean }>
      getSettings: () => Promise<any>
      setSettings: (patch: any) => Promise<any>
      startEngine: () => Promise<{ running: boolean }>
      stopEngine: () => Promise<{ running: boolean }>
      getEngineStatus: () => Promise<any>
      getEngineSample: () => Promise<any>
      setEngineMode: (mode: any) => Promise<any>
      setEngineDns: (enabled: boolean) => Promise<any>
      setEnginePriority: (priority: any) => Promise<any>
      onEngineSample: (cb: (sample: any) => void) => () => void
      exportLogs: () => Promise<{ ok: boolean; content: string }>

      scanGames: () => Promise<{ status: any; games: any[] }>
      openGameFolder: (path: string) => Promise<any>
      launchGame: (source: string, appId: string, opts?: { exePath?: string; installDir?: string }) => Promise<any>

      getSpeedtestStatus: () => Promise<any>
      runSpeedtest: () => Promise<{ ok: boolean; result: any }>
      onSpeedtestSample: (cb: (sample: any) => void) => () => void

      getBufferbloatStatus: () => Promise<any>
      startBufferbloat: () => Promise<{ ok: boolean; result: any }>
      stopBufferbloat: () => Promise<any>
      onBufferbloatSample: (cb: (sample: any) => void) => () => void

      getSecurityStatus: () => Promise<any>
      refreshSecurity: () => Promise<any>
      startDefenderScan: (scanType: 'QuickScan' | 'FullScan') => Promise<any>
      getThreats: () => Promise<any[]>
      removeThreat: (threatId: string) => Promise<{ ok: boolean; error?: string }>

      getTunnelRegions: () => Promise<any[]>
      getTunnelStatus: () => Promise<any>
      connectTunnel: (regionId: string) => Promise<any>
      disconnectTunnel: () => Promise<any>

      getCaptureStatus: () => Promise<any>
      startCapture: (args?: any) => Promise<any>
      stopCapture: () => Promise<any>
      onCaptureStatus: (cb: (status: any) => void) => () => void
      onTunnelStatus: (cb: (status: any) => void) => () => void
      
      addRoute: (destination: string, gateway: string) => Promise<{ ok: boolean }>
      deleteRoute: (destination: string) => Promise<{ ok: boolean }>
      getRoutes: () => Promise<string[]>

      // Friends API
      getFriendsStatus: () => Promise<any>
      generateFriendCode: () => Promise<{ code: string }>
      addFriend: (username: string, friendCode: string) => Promise<any>
      removeFriend: (friendId: string) => Promise<void>
      updateFriendStatus: (friendId: string, status: any) => Promise<void>
      sendFriendRequest: (toUsername: string) => Promise<any>
      acceptFriendRequest: (requestId: string) => Promise<void>
      rejectFriendRequest: (requestId: string) => Promise<void>
      searchFriend: (codeOrUsername: string) => Promise<any>

      // Chat API
      getChatStatus: () => Promise<any>
      createDirectConversation: (participantId: string, participantName: string) => Promise<any>
      createGroupConversation: (name: string, participants: string[]) => Promise<any>
      sendMessage: (conversationId: string, content: string, type?: string) => Promise<any>
      getMessages: (conversationId: string) => Promise<any[]>
      setActiveConversation: (conversationId: string) => Promise<void>
      markAsRead: (conversationId: string) => Promise<void>
      deleteConversation: (conversationId: string) => Promise<void>

      // Call API
      getCallStatus: () => Promise<any>
      initiateCall: (calleeId: string, calleeName: string, type: 'audio' | 'video') => Promise<any>
      receiveCall: (callData: any) => Promise<void>
      acceptCall: (callId: string) => Promise<void>
      rejectCall: (callId: string) => Promise<void>
      endCall: (callId: string) => Promise<void>
      toggleMute: (callId: string, muted: boolean) => Promise<void>
      toggleVideo: (callId: string, videoEnabled: boolean) => Promise<void>
    }
  }
}
