import React from 'react'
import clsx from 'clsx'

export function Card({
  title,
  right,
  children,
  className,
}: {
  title?: string
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-white/10 bg-bg1/55 p-5 shadow-card backdrop-blur-xl',
        className
      )}
    >
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white">{title}</div>
          {right}
        </div>
      )}
      {children}
    </div>
  )
}
