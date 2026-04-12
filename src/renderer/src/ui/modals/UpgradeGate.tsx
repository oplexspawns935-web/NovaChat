import React from 'react'
import { useTrial } from '../state/TrialContext'
import { PricingModal } from './PricingModal'

export function UpgradeGate() {
  const { trial } = useTrial()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    if (trial?.expired) setOpen(true)
  }, [trial?.expired])

  return <PricingModal open={open} onClose={() => setOpen(false)} force={!!trial?.expired} />
}
