/// <reference types="vite/client" />
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { createServerFn } from '@tanstack/react-start'
import { ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalProvider } from '~components/Modal'
import { theme, resolver } from '~css/theme'
import '~css/main.css'
import '@mantine/notifications/styles.layer.css'
import '@mantine/core/styles.layer.css'
import '@mantine/tiptap/styles.layer.css'
import '~css/theme.css'
import Layout from '../Layout/Layout'
import { getSupabaseServerClient } from '~utils'
import type { QueryClient } from '@tanstack/react-query'

const fetchUser = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
})

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async () => {
    const user = await fetchUser()
    return { user }
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'mobile-web-app-capable',
        content: 'yes',
      },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'application-name', content: 'Artificer Toolkit' },
      { name: 'apple-mobile-web-app-title', content: 'Artificer Toolkit' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'msapplication-starturl', content: '/' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        title: 'Artificer Toolkit',
      },
      {
        name: 'description',
        content: 'Application for building custom TTRPG content',
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
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <MantineProvider theme={theme} cssVariablesResolver={resolver}>
          <Notifications />
          <ModalProvider>{children}</ModalProvider>
        </MantineProvider>
        <TanStackRouterDevtools position='bottom-right' />
        <ReactQueryDevtools buttonPosition='bottom-left' />
        <Scripts />
      </body>
    </html>
  )
}
