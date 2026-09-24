import { Resend, type EmailId } from '@convex-dev/resend'
import { register } from '@convex-dev/resend/test'
import { convexTest } from 'convex-test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { components, internal } from './_generated/api'
import { sendRenderedEmail } from './emailTransport'
import type { ActionCtx } from './_generated/server'
import schema from './schema'

const t = convexTest(schema, import.meta.glob('./**/*.*s'))
register(t)

const environmentKeys = [
  'AUTH_EMAIL_FROM',
  'NOTIFICATION_EMAIL_FROM',
  'CONVEX_SITE_URL',
  'LOCAL_EMAIL_SINK_URL',
  'MAIL_DELIVERY_MODE',
  'RESEND_API_KEY',
  'RESEND_TEST_RECIPIENT',
  'SITE_URL'
] as const
const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]])
) as Record<(typeof environmentKeys)[number], string | undefined>

function configureEnvironment(values: Partial<Record<(typeof environmentKeys)[number], string>>) {
  for (const key of environmentKeys) {
    const value = values[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

function localEnvironment(
  overrides: Partial<Record<(typeof environmentKeys)[number], string>> = {}
) {
  configureEnvironment({
    MAIL_DELIVERY_MODE: 'local',
    SITE_URL: 'http://localhost:3000',
    CONVEX_SITE_URL: 'http://127.0.0.1:3210',
    LOCAL_EMAIL_SINK_URL: 'http://127.0.0.1:8025/messages',
    ...overrides
  })
}

const recoveryEmail = {
  action: 'recovery' as const,
  recipient: 'player@example.test',
  actionUrl: 'http://localhost:3000/verify-password-reset',
  token: '123456'
}
const emailChangeEmail = {
  action: 'email_change' as const,
  recipient: 'player@example.test',
  actionUrl: 'http://localhost:3000/api/auth/verify-email?token=change-token'
}
const testActionContext = {} as ActionCtx

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const key of environmentKeys) {
    const value = originalEnvironment[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('authentication email delivery', () => {
  it('adds an idempotency header for local rendered email delivery', async () => {
    localEnvironment()
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      sendRenderedEmail(testActionContext, {
        recipient: 'player@example.test',
        fromEnvironmentVariable: 'NOTIFICATION_EMAIL_FROM',
        subject: 'A notification',
        html: '<p>A notification</p>',
        idempotencyKey: 'notification-123'
      })
    ).resolves.toBeNull()

    const [, request] = fetchMock.mock.calls[0]!
    expect(request!.headers).toEqual({
      'content-type': 'application/json',
      'idempotency-key': 'notification-123'
    })
  })

  it('posts the rendered recovery email to the local sink', async () => {
    localEnvironment()
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(t.action(internal.email.send, recoveryEmail)).resolves.toBeNull()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8025/messages',
      expect.objectContaining({ method: 'POST', redirect: 'error' })
    )
    const [, request] = fetchMock.mock.calls[0]!
    expect(JSON.parse(request!.body as string)).toMatchObject({
      to: recoveryEmail.recipient,
      subject: 'Reset your Artificer Toolkit password',
      text: expect.stringContaining('Verification code: 123456')
    })
  })

  it('posts the rendered email-change email to the local sink', async () => {
    localEnvironment()
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(t.action(internal.email.send, emailChangeEmail)).resolves.toBeNull()

    const [, request] = fetchMock.mock.calls[0]!
    expect(JSON.parse(request!.body as string)).toMatchObject({
      to: emailChangeEmail.recipient,
      subject: 'Confirm your new Artificer Toolkit email',
      text: expect.stringContaining('Confirm your email change')
    })
  })

  it('rejects invalid recovery input and off-origin destinations', async () => {
    localEnvironment()
    const missingRecoveryToken = {
      action: recoveryEmail.action,
      recipient: recoveryEmail.recipient,
      actionUrl: recoveryEmail.actionUrl
    }

    await expect(t.action(internal.email.send, missingRecoveryToken)).rejects.toThrow(
      'Recovery requires a verification code'
    )
    await expect(
      t.action(internal.email.send, { ...recoveryEmail, token: 'wrong' })
    ).rejects.toThrow()
    await expect(
      t.action(internal.email.send, {
        ...recoveryEmail,
        actionUrl: 'https://attacker.example.test/reset'
      })
    ).rejects.toThrow('configured site origin')
  })

  it('rejects nonloopback local delivery targets and unknown modes', async () => {
    localEnvironment({ CONVEX_SITE_URL: 'https://cloud.example.test' })
    await expect(t.action(internal.email.send, recoveryEmail)).rejects.toThrow('CONVEX_SITE_URL')

    localEnvironment({ LOCAL_EMAIL_SINK_URL: 'https://sink.example.test/messages' })
    await expect(t.action(internal.email.send, recoveryEmail)).rejects.toThrow(
      'LOCAL_EMAIL_SINK_URL'
    )

    localEnvironment({ MAIL_DELIVERY_MODE: 'preview' })
    await expect(t.action(internal.email.send, recoveryEmail)).rejects.toThrow('MAIL_DELIVERY_MODE')
  })

  it('enqueues real delivery through the registered Resend component', async () => {
    configureEnvironment({
      MAIL_DELIVERY_MODE: 'resend',
      SITE_URL: 'https://app.example.test',
      AUTH_EMAIL_FROM: 'Artificer Toolkit <auth@example.test>',
      RESEND_API_KEY: 'test-key'
    })
    const sendEmail = vi.spyOn(Resend.prototype, 'sendEmail')

    await expect(
      t.action(internal.email.send, {
        ...recoveryEmail,
        actionUrl: 'https://app.example.test/verify-password-reset'
      })
    ).resolves.toBeNull()

    expect(sendEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        from: 'Artificer Toolkit <auth@example.test>',
        to: recoveryEmail.recipient,
        subject: 'Reset your Artificer Toolkit password',
        text: expect.stringContaining('Verification code: 123456')
      })
    )
    expect(components.resend).toBeDefined()
  })

  it('routes authentication delivery to the configured Resend test recipient', async () => {
    configureEnvironment({
      MAIL_DELIVERY_MODE: 'resend',
      SITE_URL: 'https://app.example.test',
      AUTH_EMAIL_FROM: 'Artificer Toolkit <auth@example.test>',
      RESEND_API_KEY: 'test-key',
      RESEND_TEST_RECIPIENT: 'delivered+auth_probe@resend.dev'
    })
    const sendEmail = vi.spyOn(Resend.prototype, 'sendEmail')

    await t.action(internal.email.send, {
      ...recoveryEmail,
      actionUrl: 'https://app.example.test/verify-password-reset'
    })

    expect(sendEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ to: 'delivered+auth_probe@resend.dev' })
    )
  })

  it.each(['invalid@example.test', ''])(
    'fails closed without sending for an invalid Resend test recipient: %j',
    async (testRecipient) => {
      configureEnvironment({
        MAIL_DELIVERY_MODE: 'resend',
        SITE_URL: 'https://app.example.test',
        AUTH_EMAIL_FROM: 'Artificer Toolkit <auth@example.test>',
        RESEND_API_KEY: 'test-key',
        RESEND_TEST_RECIPIENT: testRecipient
      })
      const sendEmail = vi.spyOn(Resend.prototype, 'sendEmail')

      await expect(
        t.action(internal.email.send, {
          ...recoveryEmail,
          actionUrl: 'https://app.example.test/verify-password-reset'
        })
      ).rejects.toThrow('RESEND_TEST_RECIPIENT')
      expect(sendEmail).not.toHaveBeenCalled()
    }
  )

  it('uses the notification sender, idempotency key, and retry configuration for Resend', async () => {
    configureEnvironment({
      MAIL_DELIVERY_MODE: 'resend',
      NOTIFICATION_EMAIL_FROM: 'Artificer Toolkit <notifications@example.test>',
      RESEND_API_KEY: 'test-key'
    })
    const sendEmail = vi.spyOn(Resend.prototype, 'sendEmail')
    let retryAttempts: number | undefined
    let testMode: boolean | undefined
    sendEmail.mockImplementation(function (this: Resend) {
      retryAttempts = this.config.retryAttempts
      testMode = this.config.testMode
      return Promise.resolve('email-id' as EmailId)
    })

    await expect(
      sendRenderedEmail(testActionContext, {
        recipient: 'player@example.test',
        fromEnvironmentVariable: 'NOTIFICATION_EMAIL_FROM',
        subject: 'A notification',
        html: '<p>A notification</p>',
        text: 'A notification',
        idempotencyKey: 'notification-123',
        retryAttempts: 2
      })
    ).resolves.toBe('email-id')

    expect(sendEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        from: 'Artificer Toolkit <notifications@example.test>',
        idempotencyKey: 'notification-123'
      })
    )
    expect(retryAttempts).toBe(2)
    expect(testMode).toBe(false)
  })
})
