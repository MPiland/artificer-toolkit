import { useRouterState } from '@tanstack/react-router'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import type { ConvexReactClient } from 'convex/react'
import type { ReactNode } from 'react'
import { betterAuthClient } from '#app/auth/betterAuthClient'
import { AuthSessionGate } from '#app/auth/AuthSessionGate'

/** Seeds the provider with the token the server minted for this page view, so it does not mint again. */
export function ConvexAuthBoundary({
  client,
  children
}: {
  client: ConvexReactClient
  children: ReactNode
}) {
  const initialToken = useRouterState({ select: (state) => state.matches[0]?.context.initialToken })
  return (
    <ConvexBetterAuthProvider
      client={client}
      authClient={betterAuthClient}
      initialToken={initialToken ?? undefined}
    >
      <AuthSessionGate />
      {children}
    </ConvexBetterAuthProvider>
  )
}
