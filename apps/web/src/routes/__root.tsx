/// <reference types="vite/client" />
import '#css/foundations.css'
import mantineStyles from '#css/main.css?url'
import mantineNotificationStyles from '@mantine/notifications/styles.layer.css?url'
import mantineLayers from '@mantine/core/styles.layer.css?url'
import mantineTiptapStyles from '@mantine/tiptap/styles.layer.css?url'
import { ColorSchemeScript } from '@mantine/core'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { Suspense } from 'react'
import { AppProviders } from '#app/providers/AppProviders'
import { RouteErrorState, RouteNotFound } from '#app/routeStates'
import { loadCurrentSessionFn } from '#app/server/auth/sessionFn'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import type { AppRouterContext } from '#app/router'

export const Route = createRootRouteWithContext<AppRouterContext>()({
  beforeLoad: async () => {
    return loadCurrentSessionFn()
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
    ],
    links: [
      { rel: 'stylesheet', href: mantineStyles },
      { rel: 'stylesheet', href: mantineNotificationStyles },
      { rel: 'stylesheet', href: mantineLayers },
      { rel: 'stylesheet', href: mantineTiptapStyles }
    ]
  }),
  errorComponent: RouteErrorState,
  notFoundComponent: RouteNotFound,
  component: RootDocument
})

function RootDocument() {
  const { nonce, queryClient } = Route.useRouteContext()

  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <ColorSchemeScript
          defaultColorScheme='auto'
          {...(nonce ? { nonce, suppressHydrationWarning: true } : {})}
        />
        <HeadContent />
      </head>
      <body>
        <AppProviders queryClient={queryClient}>
          <Outlet />
        </AppProviders>
        <Suspense fallback={null}>
          <TanStackRouterDevtools position='bottom-right' />
        </Suspense>
        <Suspense fallback={null}>
          <ReactQueryDevtools buttonPosition='bottom-left' styleNonce={nonce} />
        </Suspense>
        <Scripts />
      </body>
    </html>
  )
}
