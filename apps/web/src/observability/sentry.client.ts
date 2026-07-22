import * as Sentry from '@sentry/tanstackstart-react'
import { isSentryConfigured } from './sentry.config'

interface SentryEnvironment {
  dsn?: string
  isProduction: boolean
  isServer: boolean
}

function getSentryEnvironment(): SentryEnvironment {
  return {
    dsn: import.meta.env.VITE_SENTRY_DSN,
    isProduction: import.meta.env.PROD,
    isServer: import.meta.env.SSR
  }
}

export function initializeClientSentry(environment = getSentryEnvironment()): void {
  if (environment.isServer || !isSentryConfigured(environment) || Sentry.isInitialized()) {
    return
  }

  Sentry.init({
    dataCollection: {
      httpBodies: [],
      userInfo: false
    },
    dsn: environment.dsn,
    enableLogs: true,
    enableMetrics: true,
    sendDefaultPii: false,
    integrations: [
      Sentry.feedbackIntegration({
        autoInject: false,
        colorScheme: 'system',
        enableScreenshot: true,
        formTitle: 'Send feedback',
        isEmailRequired: false,
        messageLabel: 'What were you trying to do, and what happened?',
        messagePlaceholder: 'Tell me what felt broken, confusing, or missing.',
        showEmail: true,
        showName: false,
        submitButtonLabel: 'Send feedback',
        successMessageText: 'Thanks - your feedback was sent.'
      })
    ]
  })
}

export function captureClientException(error: unknown, environment = getSentryEnvironment()): void {
  if (environment.isServer || !isSentryConfigured(environment) || !Sentry.isInitialized()) {
    return
  }

  Sentry.captureException(error)
}
