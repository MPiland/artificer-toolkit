import type { NotificationIntentPayload, NotificationWorkflowKey } from './notification-types.ts'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function isText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
}

export function parseNotificationPayload(value: unknown): NotificationIntentPayload | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null

  const socialSource =
    isUuid(value.sourcePublicId) &&
    isUuid(value.listingPublicId) &&
    isText(value.listingTitle, 100) &&
    isTimestamp(value.occurredAt)

  switch (value.kind) {
    case 'SOCIAL_APPLICATION_SUBMITTED':
      return socialSource &&
        isText(value.applicantUsername, 30) &&
        hasOnlyKeys(value, [
          'kind',
          'sourcePublicId',
          'listingPublicId',
          'listingTitle',
          'applicantUsername',
          'occurredAt'
        ])
        ? {
            kind: value.kind,
            sourcePublicId: value.sourcePublicId,
            listingPublicId: value.listingPublicId,
            listingTitle: value.listingTitle,
            applicantUsername: value.applicantUsername,
            occurredAt: value.occurredAt
          }
        : null
    case 'SOCIAL_APPLICATION_DECIDED':
      return socialSource &&
        (value.decision === 'ACCEPTED' || value.decision === 'DECLINED') &&
        hasOnlyKeys(value, [
          'kind',
          'sourcePublicId',
          'listingPublicId',
          'listingTitle',
          'decision',
          'occurredAt'
        ])
        ? {
            kind: value.kind,
            sourcePublicId: value.sourcePublicId,
            listingPublicId: value.listingPublicId,
            listingTitle: value.listingTitle,
            decision: value.decision,
            occurredAt: value.occurredAt
          }
        : null
    case 'SOCIAL_INVITATION_RECEIVED':
      return socialSource &&
        isText(value.hostUsername, 30) &&
        isTimestamp(value.expiresAt) &&
        hasOnlyKeys(value, [
          'kind',
          'sourcePublicId',
          'listingPublicId',
          'listingTitle',
          'hostUsername',
          'expiresAt',
          'occurredAt'
        ])
        ? {
            kind: value.kind,
            sourcePublicId: value.sourcePublicId,
            listingPublicId: value.listingPublicId,
            listingTitle: value.listingTitle,
            hostUsername: value.hostUsername,
            expiresAt: value.expiresAt,
            occurredAt: value.occurredAt
          }
        : null
    case 'SOCIAL_INVITATION_DECIDED':
      return socialSource &&
        isText(value.recipientUsername, 30) &&
        (value.decision === 'ACCEPTED' || value.decision === 'DECLINED') &&
        hasOnlyKeys(value, [
          'kind',
          'sourcePublicId',
          'listingPublicId',
          'listingTitle',
          'recipientUsername',
          'decision',
          'occurredAt'
        ])
        ? {
            kind: value.kind,
            sourcePublicId: value.sourcePublicId,
            listingPublicId: value.listingPublicId,
            listingTitle: value.listingTitle,
            recipientUsername: value.recipientUsername,
            decision: value.decision,
            occurredAt: value.occurredAt
          }
        : null
    case 'CAMPAIGN_ANNOUNCEMENT':
      return isUuid(value.announcementPublicId) &&
        isText(value.campaignPublicId, 120) &&
        isText(value.summary, 240) &&
        (value.scope === 'TABLE' || value.scope === 'PARTY') &&
        isTimestamp(value.occurredAt) &&
        hasOnlyKeys(value, [
          'kind',
          'announcementPublicId',
          'campaignPublicId',
          'summary',
          'scope',
          'occurredAt'
        ])
        ? {
            kind: value.kind,
            announcementPublicId: value.announcementPublicId,
            campaignPublicId: value.campaignPublicId,
            summary: value.summary,
            scope: value.scope,
            occurredAt: value.occurredAt
          }
        : null
    default:
      return null
  }
}

export function payloadMatchesWorkflow(
  payload: NotificationIntentPayload,
  workflowKey: NotificationWorkflowKey
): boolean {
  return (
    (workflowKey === 'social-application-submitted' &&
      payload.kind === 'SOCIAL_APPLICATION_SUBMITTED') ||
    (workflowKey === 'social-application-decided' &&
      payload.kind === 'SOCIAL_APPLICATION_DECIDED') ||
    (workflowKey === 'social-invitation-received' &&
      payload.kind === 'SOCIAL_INVITATION_RECEIVED') ||
    (workflowKey === 'social-invitation-decided' && payload.kind === 'SOCIAL_INVITATION_DECIDED') ||
    (workflowKey === 'campaign-announcement' && payload.kind === 'CAMPAIGN_ANNOUNCEMENT')
  )
}
