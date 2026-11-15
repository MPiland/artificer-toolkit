import type { ReactNode } from 'react'
import { ColorSchemeScript } from '@mantine/core'
import type { QueryClient } from '@tanstack/react-query'
import { AppProviders } from '#app/providers/AppProviders'
import '#css/main.css'
import '@mantine/notifications/styles.layer.css'
import '@mantine/core/styles.layer.css'
import '@mantine/tiptap/styles.layer.css'

type StoryFrameProps = {
  theme: unknown
  queryClient: QueryClient
  children: ReactNode
}

/** The app providers and full-height canvas every Storybook preview renders a story inside. */
export function StoryFrame({ theme, queryClient, children }: StoryFrameProps) {
  const colorScheme = theme === 'light' ? 'light' : 'dark'

  return (
    <AppProviders
      key={colorScheme}
      defaultColorScheme={colorScheme}
      forceColorScheme={colorScheme}
      queryClient={queryClient}
    >
      <ColorSchemeScript defaultColorScheme={colorScheme} />
      <div style={{ blockSize: '100dvh' }}>{children}</div>
    </AppProviders>
  )
}
