/// <reference types="vite/client" />
import { ColorSchemeScript } from '@mantine/core'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { User } from '@supabase/supabase-js'
import { AppProviders } from '#app/providers/AppProviders'
import { RouteErrorState, RouteNotFound } from '#app/routeStates'
import '#css/main.css'
import '@mantine/notifications/styles.layer.css'
import '@mantine/core/styles.layer.css'
import '@mantine/tiptap/styles.layer.css'
import '#css/theme.css'

async function loadCurrentUser() {
  if (import.meta.env.SSR) {
    const { getSupabaseServerClient } = await import('../supabase/server')
    const { data } = await getSupabaseServerClient().auth.getUser()
    return data.user ?? null
  }

  const { getSupabaseBrowserClient } = await import('../supabase/client')
  const { data } = await getSupabaseBrowserClient().auth.getUser()
  return data.user ?? null
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient, user: User | null }>()({
  beforeLoad: async () => {
    const user = await loadCurrentUser()
    return { user }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Artificer Toolkit' },
      {
        name: 'description',
        content: 'Phase 9 frontend platform foundation for the Artificer Toolkit rebuild.'
      }
    ]
  }),
  errorComponent: RouteErrorState,
  notFoundComponent: RouteNotFound,
  component: RootDocument
})

function RootDocument() {
  const { queryClient } = Route.useRouteContext()

  return (
    <html lang='en' data-mantine-color-scheme='dark' suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme='dark' />
        <HeadContent />
      </head>
      <body>
        <AppProviders queryClient={queryClient}>
          <Outlet />
        </AppProviders>
        {import.meta.env.DEV ? <TanStackRouterDevtools position='bottom-right' /> : null}
        {import.meta.env.DEV ? <ReactQueryDevtools buttonPosition='bottom-left' /> : null}
        <Scripts />
      </body>
    </html>
  )
}
