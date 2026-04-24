import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { resolver, theme } from '#css/theme'
import { createAppQueryClient } from '#app/query/createAppQueryClient'

interface AppProvidersProps {
  children: ReactNode
  queryClient?: QueryClient
  forceColorScheme?: 'light' | 'dark'
  defaultColorScheme?: 'light' | 'dark'
}

export function AppProviders({
  children,
  queryClient,
  forceColorScheme,
  defaultColorScheme = 'dark'
}: AppProvidersProps) {
  const [fallbackQueryClient] = useState(createAppQueryClient)
  const activeQueryClient = queryClient ?? fallbackQueryClient

  return (
    <QueryClientProvider client={activeQueryClient}>
      <MantineProvider
        theme={theme}
        cssVariablesResolver={resolver}
        defaultColorScheme={defaultColorScheme}
        forceColorScheme={forceColorScheme}
      >
        <Notifications position='top-right' zIndex={9999} />
        {children}
      </MantineProvider>
    </QueryClientProvider>
  )
}
