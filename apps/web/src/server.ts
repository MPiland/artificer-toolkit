import * as Sentry from '@sentry/cloudflare'
import handler, { type ServerEntry } from '@tanstack/react-start/server-entry'
import { serverSentryOptions } from '#app/observability/sentry.server'
import { withSecurityHeaders } from '#app/server/securityHeaders'
import { handleConvexAuthRequest } from '#app/server/auth/convex.server'

const serverEntry = {
  async fetch(request: Request) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/auth/')) {
      return withSecurityHeaders(await handleConvexAuthRequest(request))
    }
    return withSecurityHeaders(await handler.fetch(request), { preserveExisting: true })
  }
} satisfies ServerEntry

export default Sentry.withSentry(serverSentryOptions, serverEntry) satisfies ServerEntry
