import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { getGlobalStartContext } from '@tanstack/react-start'
import type { User } from '@supabase/supabase-js'
import { createAppQueryClient } from '#app/query/createAppQueryClient'
import { RouteErrorState, RouteLoadingState, RouteNotFound } from '#app/routeStates'
import { createAppRouterContext, type AppRouterContext } from './routerContext'

function getCspNonce() {
  if (typeof document !== 'undefined') {
    const element = document.querySelector('meta[property="csp-nonce"]')
    return element instanceof HTMLMetaElement ? element.content : undefined
  }

  try {
    return (getGlobalStartContext() as { nonce?: string } | undefined)?.nonce
  } catch {
    return undefined
  }
}

export function getRouter(user: User | null) {
  const queryClient = createAppQueryClient()
  const nonce = getCspNonce()

  const router = createRouter({
    routeTree,
    context: createAppRouterContext({ nonce, queryClient, user }),
    defaultPreload: 'intent',
    defaultErrorComponent: RouteErrorState,
    defaultNotFoundComponent: RouteNotFound,
    defaultPendingComponent: RouteLoadingState,
    defaultPendingMs: 120,
    defaultPendingMinMs: 160,
    scrollRestoration: true,
    ssr: { nonce }
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
