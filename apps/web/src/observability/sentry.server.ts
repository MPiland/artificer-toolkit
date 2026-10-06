import type { CloudflareOptions } from '@sentry/cloudflare'
import { isSentryConfigured } from './sentry.config'
import { sentryPrivacyOptions } from './sentryPrivacy'

/** Per-request options for `withSentry` in the Worker entry; the DSN is inlined at build time. */
export function serverSentryOptions(): CloudflareOptions {
  return {
    ...sentryPrivacyOptions,
    dsn: import.meta.env.VITE_SENTRY_DSN,
    enabled: isSentryConfigured()
  }
}
