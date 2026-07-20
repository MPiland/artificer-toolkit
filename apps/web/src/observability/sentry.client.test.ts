import { beforeEach, describe, expect, it, vi } from 'vitest'
import { captureClientException, initializeClientSentry } from './sentry.client'

const sentryMocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  feedbackIntegration: vi.fn(() => ({ name: 'Feedback' })),
  init: vi.fn(),
  isInitialized: vi.fn(() => false)
}))

vi.mock('@sentry/tanstackstart-react', () => sentryMocks)

const productionClient = {
  dsn: 'https://public@example.ingest.sentry.io/123',
  isProduction: true,
  isServer: false
}

describe('client Sentry configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sentryMocks.isInitialized.mockReturnValue(false)
  })

  it('initializes production browser error reporting and opt-in feedback only', () => {
    initializeClientSentry(productionClient)

    expect(sentryMocks.feedbackIntegration).toHaveBeenCalledWith({
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
    expect(sentryMocks.init).toHaveBeenCalledWith({
      dataCollection: {
        httpBodies: [],
        userInfo: false
      },
      dsn: productionClient.dsn,
      enableLogs: false,
      enableMetrics: false,
      integrations: [{ name: 'Feedback' }],
      sendDefaultPii: false
    })
  })

  it.each([
    { ...productionClient, dsn: undefined },
    { ...productionClient, isProduction: false },
    { ...productionClient, isServer: true }
  ])('does not initialize outside a configured production browser', (environment) => {
    initializeClientSentry(environment)

    expect(sentryMocks.init).not.toHaveBeenCalled()
  })

  it('does not initialize more than once', () => {
    sentryMocks.isInitialized.mockReturnValue(true)

    initializeClientSentry(productionClient)

    expect(sentryMocks.init).not.toHaveBeenCalled()
  })

  it('captures handled client errors only after initialization', () => {
    const error = new Error('Route failed')
    sentryMocks.isInitialized.mockReturnValue(true)

    captureClientException(error, productionClient)

    expect(sentryMocks.captureException).toHaveBeenCalledWith(error)
  })
})
