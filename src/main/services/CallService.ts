import { EventEmitter } from 'events'
import { randomBytes } from 'crypto'

export type Call = {
  id: string
  type: 'audio' | 'video'
  callerId: string
  callerName: string
  calleeId: string
  calleeName: string
  status: 'ringing' | 'connected' | 'ended' | 'rejected'
  startedAt: number
  endedAt: number | null
}

export type CallStatus = {
  activeCall: Call | null
  incomingCall: Call | null
  lastError: string | null
}

export class CallService extends EventEmitter {
  private status: CallStatus = {
    activeCall: null,
    incomingCall: null,
    lastError: null,
  }

  getStatus() {
    return this.status
  }

  initiateCall(calleeId: string, calleeName: string, type: 'audio' | 'video'): Call {
    const call: Call = {
      id: randomBytes(8).toString('hex'),
      type,
      callerId: 'currentUser',
      callerName: 'You',
      calleeId,
      calleeName,
      status: 'ringing',
      startedAt: Date.now(),
      endedAt: null,
    }
    this.status.activeCall = call
    this.emit('callInitiated', call)
    return call
  }

  receiveCall(call: Call) {
    this.status.incomingCall = call
    this.emit('incomingCall', call)
  }

  acceptCall(callId: string) {
    const call = this.status.incomingCall || this.status.activeCall
    if (call && call.id === callId) {
      call.status = 'connected'
      this.status.activeCall = call
      this.status.incomingCall = null
      this.emit('callAccepted', call)
    }
  }

  rejectCall(callId: string) {
    const call = this.status.incomingCall
    if (call && call.id === callId) {
      call.status = 'rejected'
      call.endedAt = Date.now()
      this.status.incomingCall = null
      this.emit('callRejected', call)
    }
  }

  endCall(callId: string) {
    const call = this.status.activeCall
    if (call && call.id === callId) {
      call.status = 'ended'
      call.endedAt = Date.now()
      this.status.activeCall = null
      this.emit('callEnded', call)
    }
  }

  toggleMute(callId: string, muted: boolean) {
    this.emit('muteToggled', { callId, muted })
  }

  toggleVideo(callId: string, videoEnabled: boolean) {
    this.emit('videoToggled', { callId, videoEnabled })
  }
}
