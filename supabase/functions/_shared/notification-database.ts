import type { ClaimedNotificationIntent } from './notification-types.ts'

type RpcValue = Record<string, unknown>

function isWorkflowKey(value: unknown): boolean {
  return (
    value === 'social-application-submitted' ||
    value === 'social-application-decided' ||
    value === 'social-invitation-received' ||
    value === 'social-invitation-decided' ||
    value === 'campaign-announcement'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function secretKey(): string {
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (secretKeys) {
    const parsed: unknown = JSON.parse(secretKeys)
    if (isRecord(parsed) && typeof parsed.default === 'string') {
      return parsed.default
    }
  }
  return requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY')
}

async function request(path: string, init: RequestInit): Promise<Response> {
  const key = secretKey()
  return fetch(`${requiredEnvironment('SUPABASE_URL')}${path}`, {
    ...init,
    signal: AbortSignal.timeout(8_000),
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...init.headers
    }
  })
}

async function rpc(name: string, body: RpcValue): Promise<unknown> {
  const response = await request(`/rest/v1/rpc/${name}`, {
    method: 'POST',
    body: JSON.stringify(body)
  })
  if (!response.ok) throw response
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

export async function claimNotificationDeliveryIntents(input: {
  now: string
  staleBefore: string
}): Promise<ClaimedNotificationIntent[]> {
  const value = await rpc('claim_notification_delivery_intents', {
    p_limit: 10,
    p_now: input.now,
    p_stale_before: input.staleBefore
  })
  return Array.isArray(value) ? value.filter(isClaimedNotificationIntent) : []
}

function isClaimedNotificationIntent(value: unknown): value is ClaimedNotificationIntent {
  if (typeof value !== 'object' || value === null) return false
  if (!isRecord(value)) return false
  const row = value
  return (
    typeof row.id === 'string' &&
    (row.operation === 'TRIGGER' || row.operation === 'CANCEL') &&
    isWorkflowKey(row.workflow_key) &&
    typeof row.source_kind === 'string' &&
    typeof row.source_public_id === 'string' &&
    typeof row.recipient_notification_id === 'string' &&
    typeof row.recipient_user_id === 'string' &&
    (typeof row.grouping_key === 'string' || row.grouping_key === null) &&
    typeof row.attempt_count === 'number' &&
    (typeof row.recipient_email === 'string' || row.recipient_email === null) &&
    (typeof row.recipient_username === 'string' || row.recipient_username === null) &&
    typeof row.in_app_enabled === 'boolean' &&
    typeof row.email_enabled === 'boolean'
  )
}

export function recordNotificationFeedItem(intentId: string): Promise<unknown> {
  return rpc('record_notification_feed_item', {
    p_intent_id: intentId
  })
}

export async function expireDueCampaignInvites(now: string): Promise<number> {
  const value = await rpc('notification_expire_due_campaign_invites', {
    p_now: now,
    p_limit: 10
  })
  return typeof value === 'number' ? value : 0
}

export function markNotificationDeliverySucceeded(
  intentId: string,
  deliveredAt: string
): Promise<unknown> {
  return rpc('notification_mark_delivery_succeeded', {
    p_intent_id: intentId,
    p_delivered_at: deliveredAt
  })
}

export function markNotificationDeliveryRetry(input: {
  intentId: string
  nextAttemptAt: string
  errorCode: string
}): Promise<unknown> {
  return rpc('notification_mark_delivery_retry', {
    p_intent_id: input.intentId,
    p_next_attempt_at: input.nextAttemptAt,
    p_error_code: input.errorCode
  })
}

export function markNotificationDeliveryFailed(input: {
  intentId: string
  failedAt: string
  errorCode: string
}): Promise<unknown> {
  return rpc('notification_mark_delivery_failed', {
    p_intent_id: input.intentId,
    p_failed_at: input.failedAt,
    p_error_code: input.errorCode
  })
}
