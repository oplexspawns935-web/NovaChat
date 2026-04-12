import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { UpgradeGate } from '../modals/UpgradeGate'

export function AppShell() {
  return (
    <div className="min-h-screen bg-bg0 text-white">
      <div className="fixed inset-0 bg-neon-radial" />
      <div className="relative flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <TopBar />
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <UpgradeGate />
    </div>
  )
}
