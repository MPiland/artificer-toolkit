/// <reference types="vite/client" />
import '#css/foundations.css'
import layers from '#css/main.css?url'
import mantineNotificationStyles from '@mantine/notifications/styles.layer.css?url'
import mantineLayers from '@mantine/core/styles.layer.css?url'
import mantineTiptapStyles from '@mantine/tiptap/styles.layer.css?url'
import { ColorSchemeScript } from '@mantine/core'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'
import { AppProviders } from '#app/providers/AppProviders'
import { RouteErrorState, RouteLoadingState, RouteNotFound } from '#app/routeStates'
import { loadCurrentSessionFn } from '#app/server/auth/sessionFn'
import type { AppRouterContext } from '#app/routerContext'
import { isAuthoringStepNavigationState } from '#forms/layout/authoringSearch'

const RouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-router-devtools').then((module) => ({
        default: module.TanStackRouterDevtools
      }))
    )
  : null

const QueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((module) => ({
        default: module.ReactQueryDevtools
      }))
    )
  : null

export const Route = createRootRouteWithContext<AppRouterContext>()({
  shouldReload: ({ location }) => !isAuthoringStepNavigationState(location.state),
  beforeLoad: async () => {
    return loadCurrentSessionFn()
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'Artificer Toolkit' },
      {
        name: 'description',
        content: 'Artificer Toolkit MVP for tabletop RPG authoring and play support.'
      }
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'stylesheet', href: layers },
      { rel: 'stylesheet', href: mantineLayers },
      { rel: 'stylesheet', href: mantineNotificationStyles },
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
          <Suspense fallback={<RouteLoadingState />}>
            <Outlet />
          </Suspense>
        </AppProviders>
        <RootDevtools nonce={nonce} />
        <Scripts />
      </body>
    </html>
  )
}

function RootDevtools({ nonce }: { nonce?: string }) {
  if (!RouterDevtools || !QueryDevtools) {
    return null
  }

  return (
    <>
      <Suspense fallback={null}>
        <RouterDevtools position='bottom-right' />
      </Suspense>
      <Suspense fallback={null}>
        <QueryDevtools buttonPosition='bottom-left' styleNonce={nonce} />
      </Suspense>
    </>
  )
}
