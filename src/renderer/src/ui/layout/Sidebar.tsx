import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  Activity,
  Gamepad2,
  Gauge,
  Shield,
  Route,
  Radar,
  Sliders,
  FileText,
  User,
} from 'lucide-react'
import { NovaMark } from '../visual/NovaMark'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: Activity },
  { to: '/games', label: 'Games Boost', icon: Gamepad2 },
  { to: '/speedtest', label: 'Speedtest', icon: Gauge },
  { to: '/routing', label: 'Routing Control', icon: Route },
  { to: '/analyzer', label: 'Network Analyzer', icon: Radar },
  { to: '/settings', label: 'Optimization', icon: Sliders },
  { to: '/security', label: 'Security', icon: Shield },
  { to: '/logs', label: 'Logs & Reports', icon: FileText },
  { to: '/auth', label: 'Sign In', icon: User },
]

export function Sidebar() {
  return (
    <aside className="relative w-[280px] shrink-0 border-r border-white/10 bg-bg1/60 backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-b from-neonBlue/[0.02] via-transparent to-neonPurple/[0.02]" />
      <div className="relative">
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="relative">
            <NovaMark className="h-10 w-10" />
            <div className="absolute -inset-1 rounded-full bg-neonBlue/20 blur-xl" />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-wide text-white">Nova</div>
            <div className="text-xs text-white/55">Optimizer</div>
          </div>
        </div>

        <nav className="px-3 pb-5 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                [
                  'group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-[13px] font-medium transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-neonBlue/10 to-neonPurple/10 text-white shadow-glow'
                    : 'text-white/60 hover:bg-white/5 hover:text-white',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <n.icon className={`h-4 w-4 transition-colors ${isActive ? 'text-neonBlue' : 'text-white/50 group-hover:text-white'}`} />
                  <span className="relative">{n.label}</span>
                  {isActive && (
                    <div className="absolute right-2 h-1.5 w-1.5 rounded-full bg-neonBlue shadow-[0_0_8px_rgba(76,201,240,0.8)]" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 pb-6 pt-2">
          <div className="rounded-2xl bg-white/5 px-4 py-3 border border-white/5">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <div className="h-1.5 w-1.5 rounded-full bg-neonPurple/60" />
              <span>Precision routing is currently simulated.</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
