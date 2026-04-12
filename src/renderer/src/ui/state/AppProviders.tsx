import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TrialProvider } from './TrialContext'
import { SettingsProvider } from './SettingsContext'
import { EngineProvider } from './EngineContext'

const queryClient = new QueryClient()

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TrialProvider>
        <SettingsProvider>
          <EngineProvider>{children}</EngineProvider>
        </SettingsProvider>
      </TrialProvider>
    </QueryClientProvider>
  )
}
