import * as Sentry from '@sentry/tanstackstart-react'
import { redactSentryEvent } from './sentryPrivacy'

interface SentryServerEnvironment {
  dsn?: string
  isProduction: boolean
}

function getSentryServerEnvironment(): SentryServerEnvironment {
  return {
    dsn: process.env.VITE_SENTRY_DSN,
    isProduction: process.env.NODE_ENV === 'production'
  }
}

export function initializeServerSentry(
  environment: SentryServerEnvironment = getSentryServerEnvironment()
): void {
  if (!environment.isProduction || !environment.dsn || Sentry.isInitialized()) {
    return
  }

  Sentry.init({
    beforeSend: redactSentryEvent,
    beforeSendTransaction: redactSentryEvent,
    dataCollection: {
      httpBodies: [],
      userInfo: false
    },
    dsn: environment.dsn,
    enableLogs: true,
    enableMetrics: true,
    sendDefaultPii: false
  })
}
