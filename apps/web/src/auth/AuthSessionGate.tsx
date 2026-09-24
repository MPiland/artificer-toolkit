import { useEffect } from 'react'
import { useConvex, useConvexAuth } from 'convex/react'

export function AuthSessionGate() {
  const convex = useConvex()
  const { isLoading, isAuthenticated } = useConvexAuth()

  useEffect(() => {
    // Resolve expectAuth for confirmed guests before root route reads can finish.
    if (!isLoading && !isAuthenticated) convex.setAuth(async () => null)
  }, [convex, isLoading, isAuthenticated])

  return null
}
