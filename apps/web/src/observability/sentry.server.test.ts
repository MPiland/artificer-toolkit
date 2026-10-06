import { afterEach, describe, expect, it, vi } from 'vitest'
import { serverSentryOptions } from './sentry.server'
import { sentryPrivacyOptions } from './sentryPrivacy'

const DSN = 'https://public@example.ingest.sentry.io/1'

describe('serverSentryOptions', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('reports errors and telemetry without default PII in a configured production build', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_SENTRY_DSN', DSN)

    expect(serverSentryOptions()).toEqual({
      ...sentryPrivacyOptions,
      dsn: DSN,
      enabled: true
    })
  })

  it.each([
    { dsn: DSN, production: false },
    { dsn: '', production: true }
  ])('stays disabled outside a configured production build: %j', ({ dsn, production }) => {
    vi.stubEnv('PROD', production)
    vi.stubEnv('VITE_SENTRY_DSN', dsn)

    expect(serverSentryOptions().enabled).toBe(false)
  })
})
