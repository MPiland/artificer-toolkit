import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import type { User } from '@supabase/supabase-js'
import { createAppQueryClient } from '#app/query/createAppQueryClient'
import { RouteErrorState, RouteNotFound } from '#app/routeStates'

export function getRouter(user: User | null) {
  const queryClient = createAppQueryClient()

  const router = createRouter({
    routeTree,
    context: { queryClient, user, accessToken: null },
    defaultPreload: 'intent',
    defaultErrorComponent: RouteErrorState,
    defaultNotFoundComponent: RouteNotFound,
    scrollRestoration: true
  })
  setupRouterSsrQueryIntegration({
    router,
    queryClient
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
