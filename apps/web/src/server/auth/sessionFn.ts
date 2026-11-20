import { createServerFn } from '@tanstack/react-start'
import { getRequest, setResponseHeader } from '@tanstack/react-start/server'
import type { AuthSessionSnapshotDto } from '@artificer-toolkit/schema/api/auth'
import { loadConvexSession, requestToken } from './convex.server'

export const loadCurrentSessionFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AuthSessionSnapshotDto> => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return loadConvexSession(getRequest(), requestToken)
  }
)

/** The token the server already minted for this request, handed to the browser as `initialToken`. */
export const loadInitialTokenFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<string | null> => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return requestToken(getRequest())
  }
)
