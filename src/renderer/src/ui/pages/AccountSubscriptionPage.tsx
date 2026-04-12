import React from 'react'
import { Card } from '../components/Card'
import { useTrial } from '../state/TrialContext'

export function AccountSubscriptionPage() {
  const { trial } = useTrial()

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Login / Signup">
        <div className="space-y-3 text-sm text-white/70">
          <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
            <div className="text-sm font-semibold">Mock auth UI</div>
            <div className="mt-1 text-xs text-white/55">
              Not implemented. Wire up to your API later.
            </div>
          </div>

          <div className="grid gap-3">
            <input
              placeholder="Email"
              className="rounded-2xl bg-black/25 px-4 py-3 text-sm outline-none ring-1 ring-white/12"
            />
            <input
              placeholder="Password"
              type="password"
              className="rounded-2xl bg-black/25 px-4 py-3 text-sm outline-none ring-1 ring-white/12"
            />
            <button className="btn-secondary py-3">
              Continue
            </button>
          </div>
        </div>
      </Card>

      <Card title="Subscription">
        <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
          <div className="text-sm font-semibold">Free Trial</div>
          <div className="mt-2 text-sm text-white/70">
            {trial
              ? trial.expired
                ? 'Your trial has ended.'
                : `Remaining days: ${trial.remainingDays}`
              : 'Loading…'}
          </div>
          <div className="mt-1 text-xs text-white/55">
            After expiry, advanced optimization features are disabled.
          </div>
        </div>

        <div className="mt-4 text-sm text-white/70">
          Pricing & payment UI lives in the upgrade modal shown after trial expiry.
        </div>
      </Card>
    </div>
  )
}
