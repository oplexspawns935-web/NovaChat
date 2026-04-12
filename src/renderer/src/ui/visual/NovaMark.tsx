import React from 'react'
import clsx from 'clsx'

export function NovaMark({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'grid place-items-center rounded-2xl shadow-glow ring-1 ring-white/10',
        className
      )}
      style={{
        background:
          'linear-gradient(135deg, rgba(181,23,255,0.55), rgba(76,201,240,0.25), rgba(255,77,222,0.35))',
      }}
    >
      <svg viewBox="0 0 64 64" className="h-6 w-6">
        <defs>
          <linearGradient id="novaN" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#B517FF" />
            <stop offset="0.55" stopColor="#4CC9F0" />
            <stop offset="1" stopColor="#FF4DDE" />
          </linearGradient>
        </defs>
        <path
          d="M16 48V16h10l12 20V16h10v32H38L26 28v20H16z"
          fill="url(#novaN)"
        />
      </svg>
    </div>
  )
}
