import React from 'react'

export function FriendsPage() {
  return (
    <div className="flex h-screen bg-gray-900">
      <div className="w-64 bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-white font-bold">NovaChat</h1>
        </div>
        <div className="p-4 flex-1">
          <div className="text-gray-400 text-sm">Friends list coming soon...</div>
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="text-white font-semibold">Friends</div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400">Friend management coming soon...</div>
        </div>
      </div>
    </div>
  )
}
