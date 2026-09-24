import { Resend, type EmailId } from '@convex-dev/resend'

import { components } from './_generated/api'
import type { ActionCtx } from './_generated/server'

const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])

export function requiredEmailEnvironment(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) throw new Error(`${name} must be configured.`)
  return value
}

export function resendRecipient(recipient: string): { recipient: string; testMode: boolean } {
  const testRecipient = process.env.RESEND_TEST_RECIPIENT
  if (testRecipient === undefined) return { recipient, testMode: false }
  if (!/^(delivered|bounced|complained)(\+[a-zA-Z0-9_-]+)?@resend\.dev$/.test(testRecipient)) {
    throw new Error('RESEND_TEST_RECIPIENT must be a Resend test address.')
  }
  return { recipient: testRecipient, testMode: true }
}

function loopbackHttpUrl(name: string): string {
  const value = requiredEmailEnvironment(name)
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a loopback HTTP URL.`)
  }

  if (url.protocol !== 'http:' || !loopbackHosts.has(url.hostname)) {
    throw new Error(`${name} must be a loopback HTTP URL.`)
  }

  return url.toString()
}

export async function sendRenderedEmail(
  ctx: ActionCtx,
  input: {
    recipient: string
    fromEnvironmentVariable: 'AUTH_EMAIL_FROM' | 'NOTIFICATION_EMAIL_FROM'
    subject: string
    html: string
    text?: string
    idempotencyKey?: string
    retryAttempts?: number
  }
): Promise<EmailId | null> {
  const mode = requiredEmailEnvironment('MAIL_DELIVERY_MODE')

  if (mode === 'local') {
    loopbackHttpUrl('CONVEX_SITE_URL')
    const sinkUrl = loopbackHttpUrl('LOCAL_EMAIL_SINK_URL')
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (input.idempotencyKey) headers['idempotency-key'] = input.idempotencyKey

    const response = await fetch(sinkUrl, {
      method: 'POST',
      redirect: 'error',
      headers,
      body: JSON.stringify({
        to: input.recipient,
        subject: input.subject,
        html: input.html,
        text: input.text
      })
    })

    if (!response.ok) throw new Error('Local email sink rejected the message.')
    return null
  }

  if (mode === 'resend') {
    const delivery = resendRecipient(input.recipient)
    const resend = new Resend(components.resend, {
      testMode: delivery.testMode,
      ...(input.retryAttempts === undefined ? {} : { retryAttempts: input.retryAttempts })
    })
    return resend.sendEmail(ctx, {
      from: requiredEmailEnvironment(input.fromEnvironmentVariable),
      to: delivery.recipient,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey })
    })
  }

  throw new Error('MAIL_DELIVERY_MODE must be local or resend.')
}
