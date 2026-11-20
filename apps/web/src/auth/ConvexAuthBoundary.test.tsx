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
  [null, undefined],
  [undefined, undefined]
])('hands the server token %s to the provider as %s', (token, expected) => {
  renderToString(
    <ConvexAuthBoundary client={{} as ConvexReactClient} initialToken={token}>
      {null}
    </ConvexAuthBoundary>
  )
  expect(provider).toHaveBeenLastCalledWith(expected)
})
