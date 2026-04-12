import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Wallet, Bitcoin, CreditCard, BadgeCheck } from 'lucide-react'

export function PricingModal({
  open,
  onClose,
  force,
}: {
  open: boolean
  onClose: () => void
  force?: boolean
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ y: 14, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 14, opacity: 0, scale: 0.98 }}
            className="w-full max-w-3xl overflow-hidden rounded-2xl bg-bg1/90 shadow-card backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <div className="text-base font-semibold">Upgrade to NetFlux Pro</div>
                <div className="text-xs text-white/55">
                  Payments are not implemented yet. This is a UI placeholder.
                </div>
              </div>
              {!force && (
                <button
                  onClick={onClose}
                  className="rounded-xl p-2 text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-2">
              <PlanCard
                title="Monthly"
                price="$7.99"
                subtitle="Per month"
                bullets={[
                  'Advanced routing presets',
                  'Deep diagnostics & trace visualizer',
                  'Priority optimization controls',
                ]}
              />
              <PlanCard
                title="Lifetime"
                price="$59"
                subtitle="One-time"
                bullets={['Everything in Monthly', 'Lifetime updates (placeholder)', 'Priority support (placeholder)']}
                highlight
              />
            </div>

            <div className="border-t border-white/10 px-6 py-5">
              <div className="mb-3 text-xs font-semibold text-white/70">Payment methods (placeholder)</div>
              <div className="grid gap-3 md:grid-cols-3">
                <PayMethod icon={Wallet} label="Google Pay" />
                <PayMethod icon={Bitcoin} label="Crypto (BTC / ETH)" />
                <PayMethod icon={CreditCard} label="Bank / Card" />
              </div>
              <div className="mt-4 text-xs text-white/45">
                This screen is API-ready: connect your billing provider later.
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function PlanCard({
  title,
  price,
  subtitle,
  bullets,
  highlight,
}: {
  title: string
  price: string
  subtitle: string
  bullets: string[]
  highlight?: boolean
}) {
  return (
    <div
      className={
        'rounded-2xl border p-5 shadow-card ' +
        (highlight
          ? 'border-neonBlue/30 bg-gradient-to-b from-white/10 to-white/5'
          : 'border-white/10 bg-white/5')
      }
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-xs text-white/55">{subtitle}</div>
        </div>
        {highlight && (
          <div className="inline-flex items-center gap-2 rounded-full bg-neonBlue/20 px-3 py-1 text-xs text-white/80">
            <BadgeCheck className="h-4 w-4 text-neonBlue" />
            Best value
          </div>
        )}
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight">{price}</div>
      <div className="mt-4 space-y-2 text-sm text-white/70">
        {bullets.map((b) => (
          <div key={b} className="rounded-xl bg-white/5 px-3 py-2">
            {b}
          </div>
        ))}
      </div>
      <button
        className={highlight ? 'btn-primary mt-5 w-full' : 'btn-secondary mt-5 w-full'}
        onClick={() => {
          // Placeholder only
        }}
      >
        Choose {title}
      </button>
    </div>
  )
}

function PayMethod({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/75">
      <Icon className="h-4 w-4 text-neonBlue" />
      {label}
    </div>
  )
}
