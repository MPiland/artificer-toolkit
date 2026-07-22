import * as Sentry from '@sentry/tanstackstart-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeServerSentry } from './sentry.server'

vi.mock('@sentry/tanstackstart-react', () => ({
  init: vi.fn(),
  isInitialized: vi.fn()
}))

describe('initializeServerSentry', () => {
  beforeEach(() => {
    vi.mocked(Sentry.init).mockClear()
    vi.mocked(Sentry.isInitialized).mockReset().mockReturnValue(false)
  })

  it('initializes error reporting without default PII in production', () => {
    initializeServerSentry({ dsn: 'https://public@example.ingest.sentry.io/1', isProduction: true })

    expect(Sentry.init).toHaveBeenCalledWith({
      dataCollection: {
        httpBodies: [],
        userInfo: false
      },
      dsn: 'https://public@example.ingest.sentry.io/1',
      enableLogs: false,
      enableMetrics: true,
      sendDefaultPii: true
    })
  })

  it.each([
    { dsn: 'https://public@example.ingest.sentry.io/1', isProduction: false },
    { dsn: undefined, isProduction: true }
  ])('does not initialize outside configured production', (environment) => {
    initializeServerSentry(environment)

    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('does not initialize twice', () => {
    vi.mocked(Sentry.isInitialized).mockReturnValue(true)

    initializeServerSentry({ dsn: 'https://public@example.ingest.sentry.io/1', isProduction: true })

    expect(Sentry.init).not.toHaveBeenCalled()
  })
})
