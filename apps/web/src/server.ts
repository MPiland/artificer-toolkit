import './instrument.server'
import * as Sentry from '@sentry/tanstackstart-react'
import handler, { type ServerEntry } from '@tanstack/react-start/server-entry'
import { withSecurityHeaders } from '#app/server/securityHeaders'
import { handleTrpcRequest } from '#app/server/trpc'

const serverEntry = {
  async fetch(request: Request) {
    const url = new URL(request.url)
    if (url.pathname === '/api/trpc' || url.pathname.startsWith('/api/trpc/')) {
      return withSecurityHeaders(await handleTrpcRequest(request))
    }

    return withSecurityHeaders(await handler.fetch(request), { preserveExisting: true })
  }
} satisfies ServerEntry

export default Sentry.wrapFetchWithSentry(serverEntry) satisfies ServerEntry
