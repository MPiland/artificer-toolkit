/// <reference types="vite/client" />
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ReactNode } from 'react'
import { MantineProvider, ColorSchemeScript } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalProvider } from '#components/Modal'
import { theme, resolver } from '#css/theme'
import '#css/main.css'
import '@mantine/notifications/styles.layer.css'
import '@mantine/core/styles.layer.css'
import '@mantine/tiptap/styles.layer.css'
import '#css/theme.css'
import Layout from '../Layout/Layout'
import { getSupabaseBrowserClient } from '#supabase'
import type { QueryClient } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient; user: User | null }>()({
  beforeLoad: async () => {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase.auth.getUser()
    return { user: data.user ?? null }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'application-name', content: 'Artificer Toolkit' },
      { name: 'apple-mobile-web-app-title', content: 'Artificer Toolkit' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'msapplication-starturl', content: '/' },
      { title: 'Artificer Toolkit' },
      { name: 'description', content: 'Your digital companion for TTRPG homebrew creation' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        // DM Sans: body — clean geometric sans
        // Syne: headings — distinctive, confident, zero genre connotations
        // JetBrains Mono: stats, badges, numbers
        href: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Syne:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap',
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Layout />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
        <HeadContent />
      </head>
      <body>
        <MantineProvider theme={theme} cssVariablesResolver={resolver} defaultColorScheme="dark">
          <Notifications position="top-right" zIndex={9999} />
          <ModalProvider>{children}</ModalProvider>
        </MantineProvider>
        <TanStackRouterDevtools position="bottom-right" />
        <ReactQueryDevtools buttonPosition="bottom-left" />
        <Scripts />
      </body>
    </html>
  )
}
