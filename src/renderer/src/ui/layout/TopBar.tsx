import React from 'react'
import { useEngine } from '../state/EngineContext'
import { useTrial } from '../state/TrialContext'
import { Play, Square, ShieldAlert } from 'lucide-react'
import { motion } from 'framer-motion'

export function TopBar() {
  const { running, start, stop } = useEngine()
  const { trial } = useTrial()

  const expired = !!trial?.expired

  return (
    <div className="relative sticky top-0 z-20 border-b border-white/10 bg-bg1/35 backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-neonBlue/[0.02] via-transparent to-neonPurple/[0.02]" />
      <div className="relative flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3 text-sm text-white/70">
          {expired ? (
            <div className="flex items-center gap-2 rounded-2xl bg-neonPink/10 border border-neonPink/20 px-4 py-2.5">
              <ShieldAlert className="h-4 w-4 text-neonPink" />
              <span className="text-white/90">Trial expired. Upgrade to unlock advanced features.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-4 py-2.5">
              <div className="h-1.5 w-1.5 rounded-full bg-neonBlue shadow-[0_0_8px_rgba(76,201,240,0.6)]" />
              <span className="text-white/60">Trial:</span>
              <span className="text-white font-medium">{trial ? trial.remainingDays : '…'}</span>
              <span className="text-white/60">days left</span>
            </div>
          )}
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          whileHover={{ scale: 1.02 }}
          onClick={running ? stop : start}
          className={running 
            ? 'btn-secondary border-neonPink/30 hover:border-neonPink/50' 
            : 'btn-primary'
          }
        >
          {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? 'Stop Optimization' : 'Boost Now'}
        </motion.button>
      </div>
    </div>
  )
}
