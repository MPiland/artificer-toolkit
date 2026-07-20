interface SentryConfigurationEnvironment {
  dsn?: string
  isProduction: boolean
}

function getSentryConfigurationEnvironment(): SentryConfigurationEnvironment {
  return {
    dsn: import.meta.env.VITE_SENTRY_DSN,
    isProduction: import.meta.env.PROD
  }
}

export function isSentryConfigured(
  environment: SentryConfigurationEnvironment = getSentryConfigurationEnvironment()
): boolean {
  return environment.isProduction && Boolean(environment.dsn)
}
