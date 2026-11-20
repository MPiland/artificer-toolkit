import { QueryClient } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRouter,
  RouterProvider
} from '@tanstack/react-router'
import { renderToString } from 'react-dom/server'
import type { ConvexReactClient } from 'convex/react'
import { ConvexAuthBoundary } from './ConvexAuthBoundary'

const provider = vi.hoisted(() => vi.fn())
vi.mock('@convex-dev/better-auth/react', () => ({
  ConvexBetterAuthProvider: (props: { initialToken?: string; children: unknown }) => {
    provider(props.initialToken)
    return props.children
  }
}))
vi.mock('#app/auth/betterAuthClient', () => ({ betterAuthClient: {} }))
vi.mock('#app/auth/AuthSessionGate', () => ({ AuthSessionGate: () => null }))

it.each([
  ['request-minted-jwt', 'request-minted-jwt'],
  [null, undefined]
])('hands the root route token %s to the provider as %s', async (token, expected) => {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    beforeLoad: () => ({ initialToken: token }),
    component: () => null
  })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
    context: { queryClient: new QueryClient() },
    isServer: true,
    Wrap: ({ children }) => (
      <ConvexAuthBoundary client={{} as ConvexReactClient}>{children}</ConvexAuthBoundary>
    )
  })
  await router.load()
  renderToString(<RouterProvider router={router} />)
  expect(provider).toHaveBeenLastCalledWith(expected)
})
