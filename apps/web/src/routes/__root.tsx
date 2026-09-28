/// <reference types="vite/client" />
import '#css/foundations.css'
import layers from '#css/main.css?url'
import mantineNotificationStyles from '@mantine/notifications/styles.layer.css?url'
import mantineLayers from '@mantine/core/styles.layer.css?url'
import mantineTiptapStyles from '@mantine/tiptap/styles.layer.css?url'
import { ColorSchemeScript, getDefaultZIndex } from '@mantine/core'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
  useRouterState
} from '@tanstack/react-router'
import { Suspense, lazy, useEffect, type ReactNode } from 'react'
import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { clearPrivateContentSnapshots } from '#app/data/contentSnapshots/privateContent'
import { AppProviders } from '#app/providers/AppProviders'
import { RouteErrorState, RouteLoadingState, RouteNotFound } from '#app/routeStates'
import { loadCurrentSessionFn } from '#app/server/auth/sessionFn'
import type { AppRouterContext } from '#app/routerContext'
import type { AuthSessionSnapshotDto } from '@artificer-toolkit/schema/api/auth'
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
  beforeLoad: async ({ context }: { context: AppRouterContext }): Promise<AuthSessionSnapshotDto> =>
    context.loadCurrentSession?.() ?? loadCurrentSessionFn(),
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
  component: RootContent,
  shellComponent: RootDocument
})

function RootContent() {
  return (
    <>
      <SessionConvergence />
      <Suspense fallback={<RouteLoadingState />}>
        <Outlet />
      </Suspense>
    </>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  const { nonce, queryClient } = Route.useRouteContext()

  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <script src='/zod-csp-bootstrap.js' />
        <ColorSchemeScript
          defaultColorScheme='auto'
          {...(nonce ? { nonce, suppressHydrationWarning: true } : {})}
        />
        <HeadContent />
      </head>
      <body>
        <AppProviders queryClient={queryClient}>
          {children}
          <RootDevtools nonce={nonce} />
        </AppProviders>
        <Scripts />
      </body>
    </html>
  )
}

function SessionConvergence() {
  const router = useRouter()
  const isNavigating = useRouterState({
    select: (state) => state.isLoading || state.status === 'pending'
  })
  const { user, queryClient } = Route.useRouteContext()
  const { isLoading } = useConvexAuth()
  const snapshot = useQuery(api.account.session, isLoading ? 'skip' : {})

  useEffect(() => {
    if (!snapshot) return
    const identityChanged =
      snapshot.user?.userId !== user?.userId || snapshot.user?.role !== user?.role
    if (identityChanged) {
      queryClient.clear()
      void clearPrivateContentSnapshots()
    }
    // Concurrent invalidation can clear a still-rendered pending match's load promise.
    // Route state retriggers convergence after navigation; identity caches clear immediately.
    if (
      !isNavigating &&
      (identityChanged || snapshot.user?.authoringExperience !== user?.authoringExperience)
    ) {
      void router.invalidate()
    }
  }, [snapshot, user, queryClient, router, isNavigating])

  return null
}

function RootDevtools({ nonce }: { nonce?: string }) {
  if (!RouterDevtools || !QueryDevtools) {
    return null
  }

  return (
    <div style={{ position: 'relative', zIndex: getDefaultZIndex('app') }}>
      <Suspense fallback={null}>
        <RouterDevtools position='bottom-right' />
      </Suspense>
      <Suspense fallback={null}>
        <QueryDevtools buttonPosition='bottom-left' styleNonce={nonce} />
      </Suspense>
    </div>
  )
}
