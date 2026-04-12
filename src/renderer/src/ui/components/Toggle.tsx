import React from 'react'
import clsx from 'clsx'

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative h-7 w-12 rounded-full border transition',
        checked
          ? 'border-neonBlue/30 bg-neonBlue/25'
          : 'border-white/12 bg-white/5',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={clsx(
          'absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white/80 shadow transition',
          checked ? 'left-6' : 'left-1'
        )}
      />
    </button>
  )
}
