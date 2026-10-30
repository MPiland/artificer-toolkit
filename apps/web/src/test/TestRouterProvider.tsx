import type { MantineColorScheme } from '@mantine/core'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react'
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter
} from '@tanstack/react-router'
import type { AuthSessionUserDto } from '@artificer-toolkit/schema/api/auth'
import { type ReactNode, useEffect, useState } from 'react'
import { AppProviders } from '#app/providers/AppProviders'
import { createAppQueryClient } from '#app/query/createAppQueryClient'
import { RouteErrorState, RouteNotFound } from '#app/routeStates'
import type { AppRouterContext } from '#app/routerContext'

interface TestRouterProviderProps {
  children: ReactNode
  initialPath?: string
  user?: AuthSessionUserDto | null
  defaultColorScheme?: MantineColorScheme
  convexClient?: ConvexReactClient
}

function createStaticRoute(
  path: string,
  getParentRoute: () => ReturnType<typeof createTestRootRoute>
) {
  return createRoute({
    getParentRoute,
    path,
    component: () => null
  })
}

function createTestRootRoute() {
  return createRootRouteWithContext<AppRouterContext>()()
}

function useTestConvexAuth() {
  return {
    isLoading: false,
    isAuthenticated: false,
    fetchAccessToken: async () => null
  }
}

function createTestRouter(
  initialPath: string,
  user: AuthSessionUserDto | null,
  convexClient?: ConvexReactClient
) {
  const client = convexClient ?? new ConvexReactClient('https://tests.convex.cloud')
  const convex = new ConvexQueryClient(client)
  const queryClient = createAppQueryClient(convex)
  // Static query fixtures do not subscribe to the placeholder deployment.
  if (!convexClient) convex.unsubscribe?.()
  const rootRoute = createTestRootRoute()
  const getParentRoute = () => rootRoute

  const routeTree = rootRoute.addChildren([
    createStaticRoute('/', getParentRoute),
    createStaticRoute('/logout', getParentRoute),
    createStaticRoute('/sign-in', getParentRoute),
    createStaticRoute('/sign-up', getParentRoute),
    createStaticRoute('/reset-password', getParentRoute),
    createStaticRoute('/update-password', getParentRoute),
    createStaticRoute('/auth/confirmed', getParentRoute),
    createStaticRoute('/home', getParentRoute),
    createStaticRoute('/characters', getParentRoute),
    createStaticRoute('/settings', getParentRoute),
    createStaticRoute('/settings/profile', getParentRoute),
    createStaticRoute('/settings/preferences', getParentRoute),
    createStaticRoute('/settings/account', getParentRoute),
    createStaticRoute('/races', getParentRoute),
    createStaticRoute('/races/new', getParentRoute),
    createStaticRoute('/races/$racePublicId/$raceSlug', getParentRoute),
    createStaticRoute('/races/$racePublicId/$raceSlug/edit', getParentRoute),
    createStaticRoute('/spells', getParentRoute),
    createStaticRoute('/backgrounds', getParentRoute)
  ])

  const router = createRouter({
    routeTree,
    context: { queryClient, user },
    history: createMemoryHistory({
      initialEntries: [initialPath]
    }),
    defaultErrorComponent: RouteErrorState,
    defaultNotFoundComponent: RouteNotFound
  })

  return { client, convex, queryClient, router }
}

export function TestRouterProvider({
  children,
  initialPath = '/',
  user = null,
  defaultColorScheme,
  convexClient
}: TestRouterProviderProps) {
  const [{ client, convex, queryClient, router }] = useState(() =>
    createTestRouter(initialPath, user, convexClient)
  )
  // The app's RouterProvider loads the router on every history change; a navigation released
  // after a blocker resolves commits later than its own load, so the harness follows history too.
  useEffect(() => router.history.subscribe(() => void router.load()), [router])
  useEffect(
    () => () => {
      queryClient.clear()
      convex.unsubscribe?.()
      if (!convexClient) void client.close()
    },
    [client, convex, convexClient, queryClient]
  )

  const content = (
    <RouterContextProvider router={router}>
      <AppProviders queryClient={queryClient} defaultColorScheme={defaultColorScheme} env='test'>
        {children}
      </AppProviders>
    </RouterContextProvider>
  )
  return (
    <ConvexProviderWithAuth client={client} useAuth={useTestConvexAuth}>
      {content}
    </ConvexProviderWithAuth>
  )
}
