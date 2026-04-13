import React from 'react'
import { HashRouter, Navigate, Route, Routes, Link, useLocation } from 'react-router-dom'

const API_URL = 'https://novachat-production-8aef.up.railway.app'

function Sidebar() {
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path

  return (
    <div className="w-64 bg-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-white font-bold text-xl">NovaChat</h1>
      </div>
      <nav className="flex-1 p-2">
        <Link
          to="/chat"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive('/chat') ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          <span>#</span>
          <span>Chats</span>
        </Link>
        <Link
          to="/friends"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive('/friends') ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          <span>@</span>
          <span>Friends</span>
        </Link>
        <Link
          to="/settings"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive('/settings') ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          <span>⚙</span>
          <span>Settings</span>
        </Link>
      </nav>
      <div className="p-4 border-t border-gray-700">
        <div className="text-xs text-gray-500">Connected to: {API_URL}</div>
      </div>
    </div>
  )
}

export function NovaChatPage() {
  return (
    <HashRouter>
      <div className="flex h-screen bg-gray-900">
        <Sidebar />
        <div className="flex-1">
          <Routes>
            <Route path="/chat" element={<ChatView />} />
            <Route path="/friends" element={<FriendsView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/" element={<Navigate to="/chat" replace />} />
          </Routes>
        </div>
      </div>
    </HashRouter>
  )
}

function ChatView() {
  const [userId, setUserId] = React.useState<string | null>(null)
  const [username, setUsername] = React.useState('')
  const [friendCode, setFriendCode] = React.useState('')
  const [selectedFriend, setSelectedFriend] = React.useState<any>(null)
  const [messages, setMessages] = React.useState<any[]>([])
  const [newMessage, setNewMessage] = React.useState('')
  const [ws, setWs] = React.useState<WebSocket | null>(null)
  const [friends, setFriends] = React.useState<any[]>([])
  const [inputUsername, setInputUsername] = React.useState('')
  const [inputPassword, setInputPassword] = React.useState('')
  const [inputEmail, setInputEmail] = React.useState('')

  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight
    }
  }, [messages])

  React.useEffect(() => {
    const savedUserId = localStorage.getItem('userId')
    if (savedUserId) {
      setUserId(savedUserId)
      setUsername(localStorage.getItem('username') || '')
      setFriendCode(localStorage.getItem('friendCode') || '')
      connectWebSocket(savedUserId)
      loadFriends(savedUserId)
    }
  }, [])

  const connectWebSocket = (uid: string) => {
    const wsUrl = API_URL.replace('https://', 'wss://').replace('http://', 'ws://')
    const socket = new WebSocket(`${wsUrl}/ws/${uid}`)
    
    socket.onopen = () => {
      console.log('WebSocket connected')
    }
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'message' && data.message.sender_id === selectedFriend?.id) {
        setMessages(prev => [...prev, data.message])
      } else if (data.type === 'message_sent') {
        setMessages(prev => [...prev, data.message])
      } else if (data.type === 'typing') {
        console.log('User is typing:', data.username)
      } else if (data.type === 'incoming_call') {
        console.log('Incoming call:', data.call)
      }
    }
    
    socket.onclose = () => {
      console.log('WebSocket disconnected')
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (userId) connectWebSocket(userId)
      }, 3000)
    }
    
    setWs(socket)
    
    return () => {
      socket.close()
    }
  }

  const loadFriends = async (uid: string) => {
    try {
      const response = await fetch(`${API_URL}/friends/list/${uid}`)
      const data = await response.json()
      setFriends(data.friends || [])
    } catch (error) {
      console.error('Failed to load friends:', error)
    }
  }

  const handleRegister = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/register?username=${encodeURIComponent(inputUsername)}&email=${encodeURIComponent(inputEmail)}&password=${encodeURIComponent(inputPassword)}`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.user_id) {
        setUserId(data.user_id)
        setUsername(data.username)
        setFriendCode(data.friend_code)
        localStorage.setItem('userId', data.user_id)
        localStorage.setItem('username', data.username)
        localStorage.setItem('friendCode', data.friend_code)
        connectWebSocket(data.user_id)
        loadFriends(data.user_id)
        alert('Registration successful! A verification email has been sent to ' + inputEmail + '. Please check your inbox and click the verification link.')
      } else {
        alert(data.detail || 'Registration failed')
      }
    } catch (error) {
      console.error('Registration failed:', error)
      alert('Failed to connect to server. Make sure the Python backend is running.')
    }
  }

  const handleLogin = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/login?username=${encodeURIComponent(inputUsername)}&password=${encodeURIComponent(inputPassword)}`, {
        method: 'POST',
      })
      if (response.status === 401) {
        alert('Invalid credentials')
        return
      }
      const data = await response.json()
      if (data.user_id) {
        setUserId(data.user_id)
        setUsername(data.username)
        setFriendCode(data.friend_code)
        localStorage.setItem('userId', data.user_id)
        localStorage.setItem('username', data.username)
        localStorage.setItem('friendCode', data.friend_code)
        connectWebSocket(data.user_id)
        loadFriends(data.user_id)
      } else {
        alert(data.detail || 'Login failed')
      }
    } catch (error) {
      console.error('Login failed:', error)
      alert('Failed to connect to server. Make sure the Python backend is running.')
    }
  }

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedFriend || !ws) return
    
    ws.send(JSON.stringify({
      type: 'message',
      recipient_id: selectedFriend.id,
      content: newMessage
    }))
    
    setNewMessage('')
  }

  const handleSelectFriend = async (friend: any) => {
    setSelectedFriend(friend)
    setMessages([])
    
    try {
      const response = await fetch(`${API_URL}/messages/${userId}/${friend.id}`)
      const data = await response.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  if (!userId) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900">
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-96">
          <h2 className="text-white font-bold text-xl mb-6 text-center">NovaChat</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none border border-gray-600 focus:border-indigo-500"
            />
            <input
              type="email"
              placeholder="Email"
              value={inputEmail}
              onChange={(e) => setInputEmail(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none border border-gray-600 focus:border-indigo-500"
            />
            <input
              type="password"
              placeholder="Password"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none border border-gray-600 focus:border-indigo-500"
            />
            <button
              onClick={handleRegister}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg transition-colors"
            >
              Register
            </button>
            <button
              onClick={handleLogin}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div className="w-60 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-3 border-b border-gray-700">
          <div className="text-white font-semibold text-sm">Direct Messages</div>
        </div>
        <div className="flex-1 p-2 overflow-y-auto">
          {friends.length === 0 ? (
            <div className="text-gray-500 text-sm">No friends yet</div>
          ) : (
            friends.map((friend) => (
              <div
                key={friend.id}
                onClick={() => handleSelectFriend(friend)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  selectedFriend?.id === friend.id ? 'bg-indigo-600' : 'hover:bg-gray-700'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${friend.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`} />
                <div className="text-white text-sm">{friend.username}</div>
              </div>
            ))
          )}
        </div>
        <div className="p-3 border-t border-gray-700">
          <div className="text-xs text-gray-400 mb-2">Your Friend Code: {friendCode}</div>
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-gray-900">
        {selectedFriend ? (
          <>
            <div className="h-16 border-b border-gray-700 flex items-center px-4">
              <div className="text-white font-semibold">{selectedFriend.username}</div>
            </div>
            <div className="flex-1 overflow-y-auto p-4" ref={messagesEndRef}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`mb-4 ${msg.sender_id === userId ? 'text-right' : 'text-left'}`}
                >
                  <div
                    className={`inline-block px-4 py-2 rounded-lg ${
                      msg.sender_id === userId ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-white'
                    }`}
                  >
                    <div className="text-sm">{msg.content}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="h-16 border-t border-gray-700 flex items-center px-4">
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-lg outline-none border border-gray-600 focus:border-indigo-500"
              />
              <button
                onClick={handleSendMessage}
                className="ml-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-gray-500">Select a friend to start chatting</div>
          </div>
        )}
      </div>
    </div>
  )
}

function FriendsView() {
  const [userId, setUserId] = React.useState<string | null>(null)
  const [friendCode, setFriendCode] = React.useState('')
  const [friends, setFriends] = React.useState<any[]>([])
  const [inputCode, setInputCode] = React.useState('')
  const [friendRequests, setFriendRequests] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const savedUserId = localStorage.getItem('userId')
    if (savedUserId) {
      setUserId(savedUserId)
      setFriendCode(localStorage.getItem('friendCode') || '')
      loadFriends(savedUserId)
      loadFriendRequests(savedUserId)
    }
    setLoading(false)
  }, [])

  const loadFriends = async (uid: string) => {
    try {
      const response = await fetch(`${API_URL}/friends/list/${uid}`)
      const data = await response.json()
      setFriends(data.friends || [])
    } catch (error) {
      console.error('Failed to load friends:', error)
    }
  }

  const loadFriendRequests = async (uid: string) => {
    try {
      const response = await fetch(`${API_URL}/friends/requests/${uid}`)
      const data = await response.json()
      setFriendRequests(data.requests || [])
    } catch (error) {
      console.error('Failed to load friend requests:', error)
    }
  }

  const handleAddFriend = async () => {
    if (!userId || !inputCode) return
    
    try {
      const response = await fetch(`${API_URL}/friends/add?user_id=${userId}&friend_code=${encodeURIComponent(inputCode)}`, {
        method: 'POST',
      })
      const data = await response.json()
      
      if (data.success) {
        loadFriends(userId)
        setInputCode('')
        alert('Friend added successfully!')
      } else {
        alert(data.detail || 'Failed to add friend')
      }
    } catch (error) {
      console.error('Failed to add friend:', error)
      alert('Failed to add friend. Make sure the friend code is correct.')
    }
  }

  const handleAcceptRequest = async (requestId: string) => {
    if (!userId) return
    
    try {
      const response = await fetch(`${API_URL}/friends/accept?user_id=${userId}&request_id=${requestId}`, {
        method: 'POST',
      })
      const data = await response.json()
      
      if (data.success) {
        loadFriends(userId)
        loadFriendRequests(userId)
        alert('Friend request accepted!')
      } else {
        alert(data.detail || 'Failed to accept request')
      }
    } catch (error) {
      console.error('Failed to accept request:', error)
    }
  }

  const handleDeclineRequest = async (requestId: string) => {
    if (!userId) return
    
    try {
      const response = await fetch(`${API_URL}/friends/reject?user_id=${userId}&request_id=${requestId}`, {
        method: 'POST',
      })
      const data = await response.json()
      
      if (data.success) {
        loadFriendRequests(userId)
        alert('Friend request declined')
      } else {
        alert(data.detail || 'Failed to decline request')
      }
    } catch (error) {
      console.error('Failed to decline request:', error)
    }
  }

  return (
    <div className="h-full bg-gray-900">
      <div className="h-16 border-b border-gray-700 flex items-center px-6">
        <div className="text-white font-semibold">Friends</div>
      </div>
      <div className="p-6">
        {!userId ? (
          <div className="text-gray-500 text-center py-8">
            <p className="mb-4">Please register to get your friend code</p>
            <Link to="/chat" className="text-indigo-500 hover:text-indigo-400">Go to Chat to Register</Link>
          </div>
        ) : (
          <div className="mb-6">
            <h2 className="text-white font-semibold mb-3">Your Friend Code</h2>
            <div className="bg-gray-800 px-4 py-3 rounded-lg text-white font-mono text-xl">{friendCode || 'Loading...'}</div>
            <p className="text-gray-500 text-sm mt-2">Share this code with friends to add them</p>
          </div>
        )}
        
        {friendRequests.length > 0 && (
          <div className="mb-6">
            <h2 className="text-white font-semibold mb-3">Friend Requests</h2>
            <div className="space-y-2">
              {friendRequests.map((request) => (
                <div key={request.id} className="bg-gray-800 px-4 py-3 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-white font-semibold">{request.from_username}</div>
                    <div className="text-xs text-gray-500">Wants to add you as a friend</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptRequest(request.id)}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(request.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="mb-6">
          <h2 className="text-white font-semibold mb-3">Add Friend by Code</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter friend code"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-lg outline-none border border-gray-600 focus:border-indigo-500"
            />
            <button
              onClick={handleAddFriend}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </div>
        <div>
          <h2 className="text-white font-semibold mb-3">Your Friends</h2>
          {friends.length === 0 ? (
            <div className="text-gray-500 text-sm">No friends added yet</div>
          ) : (
            <div className="space-y-2">
              {friends.map((friend) => (
                <div key={friend.id} className="bg-gray-800 px-4 py-3 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-white font-semibold">{friend.username}</div>
                    <div className={`text-xs ${friend.status === 'online' ? 'text-green-500' : 'text-gray-500'}`}>
                      {friend.status}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">{friend.friend_code}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SettingsView() {
  const [userId, setUserId] = React.useState<string | null>(null)
  const [username, setUsername] = React.useState('')
  const [friendCode, setFriendCode] = React.useState('')

  React.useEffect(() => {
    const savedUserId = localStorage.getItem('userId')
    if (savedUserId) {
      setUserId(savedUserId)
      setUsername(localStorage.getItem('username') || '')
      setFriendCode(localStorage.getItem('friendCode') || '')
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    localStorage.removeItem('friendCode')
    window.location.reload()
  }

  return (
    <div className="h-full bg-gray-900">
      <div className="h-16 border-b border-gray-700 flex items-center px-6">
        <div className="text-white font-semibold">Settings</div>
      </div>
      <div className="p-6">
        {!userId ? (
          <div className="text-gray-500 text-center py-8">
            <p>Please register to access settings</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-white font-semibold mb-4">Profile</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-400 text-sm">Username</label>
                  <div className="text-white">{username}</div>
                </div>
                <div>
                  <label className="text-gray-400 text-sm">Friend Code</label>
                  <div className="text-white font-mono">{friendCode}</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-white font-semibold mb-4">Account</h3>
              <button
                onClick={handleLogout}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-white font-semibold mb-4">About</h3>
              <div className="space-y-2 text-gray-400 text-sm">
                <div>NovaChat v1.0</div>
                <div>Real-time global chat application</div>
                <div>Backend: {API_URL}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
