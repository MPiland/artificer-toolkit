import handler, { type ServerEntry } from '@tanstack/react-start/server-entry'
import { withSecurityHeaders } from '#app/server/securityHeaders'
import { handleTrpcRequest } from '#app/server/trpc'

export default {
  async fetch(request: Request) {
    const url = new URL(request.url)
    if (url.pathname === '/api/trpc' || url.pathname.startsWith('/api/trpc/')) {
      return withSecurityHeaders(await handleTrpcRequest(request))
    }

    return withSecurityHeaders(await handler.fetch(request), { preserveExisting: true })
  }
} satisfies ServerEntry
