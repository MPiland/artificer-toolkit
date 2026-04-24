import { type QueryClient } from '@tanstack/react-query'
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter
} from '@tanstack/react-router'
import type { User } from '@supabase/supabase-js'
import { type ReactNode, useState } from 'react'
import { AppProviders } from '#app/providers/AppProviders'
import { createAppQueryClient } from '#app/query/createAppQueryClient'
import { RouteErrorState, RouteNotFound } from '#app/routeStates'

interface TestRouterProviderProps {
  children: ReactNode
  initialPath?: string
  forceColorScheme?: 'light' | 'dark'
  defaultColorScheme?: 'light' | 'dark'
}

function createStaticRoute(path: string, getParentRoute: () => ReturnType<typeof createTestRootRoute>) {
  return createRoute({
    getParentRoute,
    path,
    component: () => null
  })
}

function createTestRootRoute() {
  return createRootRouteWithContext<{ queryClient: QueryClient, user: User | null }>()()
}

function createTestRouter(initialPath: string) {
  const queryClient = createAppQueryClient()
  const rootRoute = createTestRootRoute()
  const getParentRoute = () => rootRoute

  const routeTree = rootRoute.addChildren([
    createStaticRoute('/', getParentRoute),
    createStaticRoute('/login', getParentRoute),
    createStaticRoute('/logout', getParentRoute),
    createStaticRoute('/signup', getParentRoute),
    createStaticRoute('/reset-password', getParentRoute),
    createStaticRoute('/update-password', getParentRoute),
    createStaticRoute('/auth/confirmed', getParentRoute),
    createStaticRoute('/home', getParentRoute)
  ])

  const router = createRouter({
    routeTree,
    context: { queryClient, user: null },
    history: createMemoryHistory({
      initialEntries: [initialPath]
    }),
    defaultErrorComponent: RouteErrorState,
    defaultNotFoundComponent: RouteNotFound
  })

  return { queryClient, router }
}

export function TestRouterProvider({
  children,
  initialPath = '/',
  forceColorScheme,
  defaultColorScheme
}: TestRouterProviderProps) {
  const [{ queryClient, router }] = useState(() => createTestRouter(initialPath))

  return (
    <RouterContextProvider router={router}>
      <AppProviders
        queryClient={queryClient}
        forceColorScheme={forceColorScheme}
        defaultColorScheme={defaultColorScheme}
      >
        {children}
      </AppProviders>
    </RouterContextProvider>
  )
}
