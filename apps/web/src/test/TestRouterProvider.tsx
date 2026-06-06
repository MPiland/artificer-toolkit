import type { MantineColorScheme } from '@mantine/core'
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
import type { AppRouterContext } from '#app/routerContext'

interface TestRouterProviderProps {
  children: ReactNode
  initialPath?: string
  user?: User | null
  defaultColorScheme?: MantineColorScheme
}

function createStaticRoute(path: string, getParentRoute: () => ReturnType<typeof createTestRootRoute>) {
  return createRoute({
    getParentRoute,
    path,
    component: () => null
  })
}

function createTestRootRoute() {
  return createRootRouteWithContext<AppRouterContext>()()
}

function createTestRouter(initialPath: string, user: User | null) {
  const queryClient = createAppQueryClient()
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

  return { queryClient, router }
}

export function TestRouterProvider({
  children,
  initialPath = '/',
  user = null,
  defaultColorScheme
}: TestRouterProviderProps) {
  const [{ queryClient, router }] = useState(() => createTestRouter(initialPath, user))

  return (
    <RouterContextProvider router={router}>
      <AppProviders
        queryClient={queryClient}
        defaultColorScheme={defaultColorScheme}
      >
        {children}
      </AppProviders>
    </RouterContextProvider>
  )
}
