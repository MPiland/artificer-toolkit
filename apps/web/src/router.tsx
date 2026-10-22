import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { getGlobalStartContext } from '@tanstack/react-start'
import type { AuthSessionUserDto } from '@artificer-toolkit/schema/api/auth'
import { createAppQueryClient } from '#app/query/createAppQueryClient'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { betterAuthClient } from '#app/auth/betterAuthClient'
import { AuthSessionGate } from '#app/auth/AuthSessionGate'
import { api } from '@artificer-toolkit/apis/convex/api'
import { loadCurrentSessionFn } from '#app/server/auth/sessionFn'
import { RouteErrorState, RouteLoadingState, RouteNotFound } from '#app/routeStates'
import type { AppRouterContext } from './routerContext'
import { isRecord } from '#app/forms/utils/valueGuards'

function getCspNonce() {
  if (typeof document !== 'undefined') {
    const element = document.querySelector('meta[property="csp-nonce"]')
    return element instanceof HTMLMetaElement ? element.content : undefined
  }

  try {
    const context: unknown = getGlobalStartContext()
    return isRecord(context) && typeof context.nonce === 'string' ? context.nonce : undefined
  } catch {
    return undefined
  }
}

export function getRouter(user: AuthSessionUserDto | null = null) {
  // Per-router clients keep SSR caches isolated. Provider hooks and query loaders
  // share this client in the browser; it is never serialized into route context.
  const convex = new ConvexQueryClient(import.meta.env.VITE_CONVEX_URL, { expectAuth: true })
  const queryClient = createAppQueryClient(convex)
  const nonce = getCspNonce()

  const router = createRouter({
    routeTree,
    context: {
      nonce,
      queryClient,
      user,
      loadCurrentSession: () =>
        typeof document === 'undefined'
          ? loadCurrentSessionFn()
          : convex.convexClient.query(api.account.session, {})
    } satisfies AppRouterContext,
    Wrap: ({ children }) => (
      <ConvexBetterAuthProvider client={convex.convexClient} authClient={betterAuthClient}>
        <AuthSessionGate />
        {children}
      </ConvexBetterAuthProvider>
    ),
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
