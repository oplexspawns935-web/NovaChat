import { EventEmitter } from 'events'
import { randomBytes } from 'crypto'
import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export type Friend = {
  id: string
  username: string
  friendCode: string
  status: 'online' | 'offline' | 'away' | 'busy'
  addedAt: number
  lastSeen: number
}

export type FriendRequest = {
  id: string
  from: string
  fromUsername: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: number
}

export type FriendsStatus = {
  friends: Friend[]
  incomingRequests: FriendRequest[]
  outgoingRequests: FriendRequest[]
  lastError: string | null
}

export class FriendsService extends EventEmitter {
  private status: FriendsStatus = {
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    lastError: null,
  }

  private getDataPath() {
    return join(app.getPath('userData'), 'friends-data.json')
  }

  private loadData(): FriendsStatus | null {
    const p = this.getDataPath()
    if (!existsSync(p)) return null
    try {
      const raw = readFileSync(p, 'utf-8')
      return JSON.parse(raw) as FriendsStatus
    } catch {
      return null
    }
  }

  private saveData() {
    const p = this.getDataPath()
    writeFileSync(p, JSON.stringify(this.status, null, 2), { encoding: 'utf-8' })
  }

  ensureInitialized() {
    const data = this.loadData()
    if (data) {
      this.status = data
    }
  }

  getStatus() {
    return this.status
  }

  generateFriendCode(): string {
    // Generate a 8-character friend code
    return randomBytes(4).toString('hex').toUpperCase()
  }

  addFriend(username: string, friendCode: string): Friend {
    const friend: Friend = {
      id: randomBytes(8).toString('hex'),
      username,
      friendCode,
      status: 'offline',
      addedAt: Date.now(),
      lastSeen: Date.now(),
    }
    this.status.friends.push(friend)
    this.saveData()
    this.emit('friendAdded', friend)
    return friend
  }

  removeFriend(friendId: string) {
    this.status.friends = this.status.friends.filter(f => f.id !== friendId)
    this.saveData()
    this.emit('friendRemoved', friendId)
  }

  updateFriendStatus(friendId: string, status: Friend['status']) {
    const friend = this.status.friends.find(f => f.id === friendId)
    if (friend) {
      friend.status = status
      friend.lastSeen = Date.now()
      this.saveData()
      this.emit('friendStatusChanged', friend)
    }
  }

  sendFriendRequest(toUsername: string): FriendRequest {
    const request: FriendRequest = {
      id: randomBytes(8).toString('hex'),
      from: 'currentUser', // In real app, this would be the authenticated user
      fromUsername: toUsername,
      status: 'pending',
      createdAt: Date.now(),
    }
    this.status.outgoingRequests.push(request)
    this.saveData()
    this.emit('requestSent', request)
    return request
  }

  acceptFriendRequest(requestId: string) {
    const request = this.status.incomingRequests.find(r => r.id === requestId)
    if (request) {
      request.status = 'accepted'
      // Add as friend
      this.addFriend(request.fromUsername, '')
      this.status.incomingRequests = this.status.incomingRequests.filter(r => r.id !== requestId)
      this.saveData()
      this.emit('requestAccepted', request)
    }
  }

  rejectFriendRequest(requestId: string) {
    const request = this.status.incomingRequests.find(r => r.id === requestId)
    if (request) {
      request.status = 'rejected'
      this.status.incomingRequests = this.status.incomingRequests.filter(r => r.id !== requestId)
      this.saveData()
      this.emit('requestRejected', request)
    }
  }

  searchFriend(codeOrUsername: string): Friend | null {
    return this.status.friends.find(
      f => f.friendCode === codeOrUsername.toUpperCase() || f.username.toLowerCase() === codeOrUsername.toLowerCase()
    ) || null
  }
}
