import {
  claimNotificationDeliveryIntents,
  expireDueCampaignInvites,
  markNotificationDeliveryFailed,
  markNotificationDeliveryRetry,
  markNotificationDeliverySucceeded,
  recordNotificationFeedItem
} from '../_shared/notification-database.ts'
import { renderNotificationEmail } from '../_shared/notification-email.ts'
import {
  parseNotificationPayload,
  payloadMatchesWorkflow
} from '../_shared/notification-payload.ts'
import type { ClaimedNotificationIntent } from '../_shared/notification-types.ts'

// Configure [functions.notification-dispatch] verify_jwt = false: pg_cron cannot present a user JWT.
// The scheduler must send x-notification-dispatch-secret from NOTIFICATION_DISPATCH_SECRET instead.
const CLAIM_LEASE_MILLISECONDS = 5 * 60 * 1_000
const MAX_DELIVERY_ATTEMPTS = 10

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function retryDelayMilliseconds(attemptCount: number): number {
  return Math.min(60 * 2 ** Math.max(0, attemptCount - 1), 60 * 60) * 1_000
}

function errorCode(error: unknown): { retryable: boolean; code: string } {
  if (error instanceof Error && error.message === 'INVALID_PAYLOAD') {
    return { retryable: false, code: 'INVALID_PAYLOAD' }
  }
  if (error instanceof Response) {
    return { retryable: error.status === 429 || error.status >= 500, code: `HTTP_${error.status}` }
  }
  return { retryable: true, code: 'NETWORK' }
}

async function sendEmail(intent: ClaimedNotificationIntent): Promise<void> {
  if (!intent.recipient_email) throw new Error('MISSING_RECIPIENT_EMAIL')
  const payload = parseNotificationPayload(intent.payload)
  if (!payload || !payloadMatchesWorkflow(payload, intent.workflow_key)) {
    throw new Error('INVALID_PAYLOAD')
  }
  const email = renderNotificationEmail(intent.workflow_key, payload)
  if (!email) throw new Error('INVALID_PAYLOAD')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(8_000),
    headers: {
      authorization: `Bearer ${requiredEnvironment('RESEND_API_KEY')}`,
      'content-type': 'application/json',
      'idempotency-key': intent.id
    },
    body: JSON.stringify({
      from: requiredEnvironment('NOTIFICATION_EMAIL_FROM'),
      to: intent.recipient_email,
      subject: email.subject,
      html: email.html
    })
  })
  if (!response.ok) throw response
}

async function dispatchIntent(
  intent: ClaimedNotificationIntent
): Promise<'delivered' | 'retried' | 'failed'> {
  const now = new Date()
  if (intent.operation === 'CANCEL') {
    await markNotificationDeliverySucceeded(intent.id, now.toISOString())
    return 'delivered'
  }

  const payload = parseNotificationPayload(intent.payload)
  if (!payload || !payloadMatchesWorkflow(payload, intent.workflow_key)) {
    await markNotificationDeliveryFailed({
      intentId: intent.id,
      failedAt: now.toISOString(),
      errorCode: 'INVALID_PAYLOAD'
    })
    return 'failed'
  }

  try {
    if (intent.in_app_enabled) await recordNotificationFeedItem(intent.id)
    if (intent.email_enabled) await sendEmail(intent)
    await markNotificationDeliverySucceeded(intent.id, now.toISOString())
    return 'delivered'
  } catch (error) {
    const classified =
      error instanceof Error && error.message === 'MISSING_RECIPIENT_EMAIL'
        ? { retryable: false, code: 'MISSING_RECIPIENT_EMAIL' }
        : errorCode(error)
    if (classified.retryable && intent.attempt_count < MAX_DELIVERY_ATTEMPTS) {
      await markNotificationDeliveryRetry({
        intentId: intent.id,
        nextAttemptAt: new Date(
          now.getTime() + retryDelayMilliseconds(intent.attempt_count)
        ).toISOString(),
        errorCode: classified.code
      })
      return 'retried'
    }
    await markNotificationDeliveryFailed({
      intentId: intent.id,
      failedAt: now.toISOString(),
      errorCode: classified.code
    })
    return 'failed'
  }
}

Deno.serve(async (request) => {
  if (
    request.method !== 'POST' ||
    request.headers.get('x-notification-dispatch-secret') !==
      requiredEnvironment('NOTIFICATION_DISPATCH_SECRET')
  ) {
    return new Response('Unauthorized', { status: 401 })
  }

  const now = new Date()
  try {
    const expiredInvitations = await expireDueCampaignInvites(now.toISOString())
    const intents = await claimNotificationDeliveryIntents({
      now: now.toISOString(),
      staleBefore: new Date(now.getTime() - CLAIM_LEASE_MILLISECONDS).toISOString()
    })
    const result = {
      claimed: intents.length,
      delivered: 0,
      retried: 0,
      failed: 0,
      expiredInvitations
    }
    const outcomes = await Promise.all(intents.map(dispatchIntent))
    for (const outcome of outcomes) {
      result[outcome] += 1
    }
    return Response.json(result)
  } catch (error) {
    console.error('Notification dispatch failed.', {
      code:
        error instanceof Response
          ? `HTTP_${error.status}`
          : error instanceof Error
            ? error.message
            : 'UNKNOWN'
    })
    return new Response('Notification dispatch unavailable', { status: 503 })
  }
})
