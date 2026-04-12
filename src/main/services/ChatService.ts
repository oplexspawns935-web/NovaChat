import { EventEmitter } from 'events'
import { randomBytes } from 'crypto'
import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export type Message = {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  content: string
  timestamp: number
  type: 'text' | 'image' | 'file' | 'call'
  status: 'sent' | 'delivered' | 'read'
}

export type Conversation = {
  id: string
  participants: string[]
  name: string
  type: 'direct' | 'group'
  lastMessage: Message | null
  unreadCount: number
  createdAt: number
  updatedAt: number
}

export type ChatStatus = {
  conversations: Conversation[]
  messages: Message[]
  activeConversation: string | null
  lastError: string | null
}

export class ChatService extends EventEmitter {
  private status: ChatStatus = {
    conversations: [],
    messages: [],
    activeConversation: null,
    lastError: null,
  }

  private getDataPath() {
    return join(app.getPath('userData'), 'chat-data.json')
  }

  private loadData(): ChatStatus | null {
    const p = this.getDataPath()
    if (!existsSync(p)) return null
    try {
      const raw = readFileSync(p, 'utf-8')
      return JSON.parse(raw) as ChatStatus
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

  createDirectConversation(participantId: string, participantName: string): Conversation {
    const conversation: Conversation = {
      id: randomBytes(8).toString('hex'),
      participants: ['currentUser', participantId],
      name: participantName,
      type: 'direct',
      lastMessage: null,
      unreadCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.status.conversations.push(conversation)
    this.saveData()
    this.emit('conversationCreated', conversation)
    return conversation
  }

  createGroupConversation(name: string, participants: string[]): Conversation {
    const conversation: Conversation = {
      id: randomBytes(8).toString('hex'),
      participants: ['currentUser', ...participants],
      name,
      type: 'group',
      lastMessage: null,
      unreadCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.status.conversations.push(conversation)
    this.saveData()
    this.emit('conversationCreated', conversation)
    return conversation
  }

  sendMessage(conversationId: string, content: string, type: Message['type'] = 'text'): Message {
    const conversation = this.status.conversations.find(c => c.id === conversationId)
    if (!conversation) {
      throw new Error('Conversation not found')
    }

    const message: Message = {
      id: randomBytes(8).toString('hex'),
      conversationId,
      senderId: 'currentUser',
      senderName: 'You',
      content,
      timestamp: Date.now(),
      type,
      status: 'sent',
    }

    this.status.messages.push(message)
    conversation.lastMessage = message
    conversation.updatedAt = Date.now()
    this.saveData()
    this.emit('messageSent', message)
    return message
  }

  getMessages(conversationId: string): Message[] {
    return this.status.messages.filter(m => m.conversationId === conversationId)
  }

  setActiveConversation(conversationId: string) {
    this.status.activeConversation = conversationId
    const conversation = this.status.conversations.find(c => c.id === conversationId)
    if (conversation) {
      conversation.unreadCount = 0
      this.saveData()
    }
    this.emit('activeConversationChanged', conversationId)
  }

  markAsRead(conversationId: string) {
    const messages = this.status.messages.filter(m => m.conversationId === conversationId && m.senderId !== 'currentUser')
    for (const message of messages) {
      message.status = 'read'
    }
    this.saveData()
    this.emit('messagesMarkedRead', conversationId)
  }

  deleteConversation(conversationId: string) {
    this.status.conversations = this.status.conversations.filter(c => c.id !== conversationId)
    this.status.messages = this.status.messages.filter(m => m.conversationId !== conversationId)
    if (this.status.activeConversation === conversationId) {
      this.status.activeConversation = null
    }
    this.saveData()
    this.emit('conversationDeleted', conversationId)
  }
}
