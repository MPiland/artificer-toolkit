import type { CloudflareOptions } from '@sentry/cloudflare'
import { isSentryConfigured } from './sentry.config'
import { redactSentryEvent } from './sentryPrivacy'

/** Per-request options for `withSentry` in the Worker entry; the DSN is inlined at build time. */
export function serverSentryOptions(): CloudflareOptions {
  return {
    beforeSend: redactSentryEvent,
    beforeSendTransaction: redactSentryEvent,
    dataCollection: {
      httpBodies: [],
      userInfo: false
    },
    dsn: import.meta.env.VITE_SENTRY_DSN,
    enableLogs: true,
    enableMetrics: true,
    enabled: isSentryConfigured(),
    sendDefaultPii: false
  }
}
