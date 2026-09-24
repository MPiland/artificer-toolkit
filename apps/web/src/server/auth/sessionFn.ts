import { createServerFn } from '@tanstack/react-start'
import { getRequest, setResponseHeader } from '@tanstack/react-start/server'
import type { AuthSessionSnapshotDto } from '@artificer-toolkit/schema/api/auth'
import { loadConvexSession } from './convex.server'

export const loadCurrentSessionFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AuthSessionSnapshotDto> => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return loadConvexSession(getRequest())
  }
)
