import { createHmac } from 'node:crypto'
import { Novu } from '@novu/api'
import {
  createCampaignRepository,
  createNotificationRepository,
  withTransaction,
  type CampaignInviteRecord,
  type DBLike,
  type SocialApplicationRecord
} from '@artificer-toolkit/db'
import {
  notificationIntentDataSchema,
  type NotificationSessionDto
} from '@artificer-toolkit/schema/api/notifications'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'

const CLAIM_LEASE_MILLISECONDS = 5 * 60 * 1_000
const MAX_DELIVERY_ATTEMPTS = 10
// ponytail: 10 deliveries per minute is the measured-volume ceiling; raise it only after backlog or latency evidence.
export const NOTIFICATION_DISPATCH_LIMIT = 10

export interface NotificationDispatchResult {
  claimed: number
  delivered: number
  retried: number
  failed: number
  expiredInvitations: number
}

function cancellationKey(workflowKey: string, sourcePublicId: string): string {
  return `${workflowKey}:${sourcePublicId}`
}

function notificationListingTitle(value: string): string {
  return presentCampaignPlainText(value, 'STANDARD')
}

export async function enqueueApplicationSubmittedNotification(
  db: DBLike,
  application: SocialApplicationRecord,
  occurredAt: string
): Promise<void> {
  await createNotificationRepository(db).insertDeliveryIntent({
    operation: 'TRIGGER',
    workflowKey: 'social-application-submitted',
    sourceKind: 'SOCIAL_APPLICATION',
    sourcePublicId: application.id,
    recipientUserId: application.hostUserId,
    groupingKey: application.listingId,
    occurredAt,
    payload: {
      kind: 'SOCIAL_APPLICATION_SUBMITTED',
      sourcePublicId: application.id,
      listingPublicId: application.listingId,
      listingTitle: notificationListingTitle(application.listingTitle),
      applicantUsername: application.applicantUsername,
      occurredAt
    }
  })
}

export async function enqueueApplicationDecisionNotifications(
  db: DBLike,
  application: SocialApplicationRecord,
  decision: 'ACCEPTED' | 'DECLINED',
  occurredAt: string
): Promise<void> {
  const repository = createNotificationRepository(db)
  await Promise.all([
    repository.insertDeliveryIntent({
      operation: 'CANCEL',
      workflowKey: 'social-application-submitted',
      sourceKind: 'SOCIAL_APPLICATION',
      sourcePublicId: application.id,
      recipientUserId: application.hostUserId,
      occurredAt
    }),
    repository.insertDeliveryIntent({
      operation: 'TRIGGER',
      workflowKey: 'social-application-decided',
      sourceKind: 'SOCIAL_APPLICATION',
      sourcePublicId: application.id,
      recipientUserId: application.applicantUserId,
      occurredAt,
      payload: {
        kind: 'SOCIAL_APPLICATION_DECIDED',
        sourcePublicId: application.id,
        listingPublicId: application.listingId,
        listingTitle: notificationListingTitle(application.listingTitle),
        decision,
        occurredAt
      }
    })
  ])
}

export async function enqueueApplicationSubmittedCancellations(
  db: DBLike,
  applicationIds: string[],
  occurredAt: string
): Promise<void> {
  await createNotificationRepository(db).insertApplicationSubmittedCancellations(
    applicationIds,
    occurredAt
  )
}

export async function enqueueInvitationReceivedNotification(
  db: DBLike,
  invitation: CampaignInviteRecord,
  input: { listingTitle: string; hostUsername: string; occurredAt: string }
): Promise<void> {
  await createNotificationRepository(db).insertDeliveryIntent({
    operation: 'TRIGGER',
    workflowKey: 'social-invitation-received',
    sourceKind: 'CAMPAIGN_INVITE',
    sourcePublicId: invitation.id,
    recipientUserId: invitation.recipientUserId,
    occurredAt: input.occurredAt,
    payload: {
      kind: 'SOCIAL_INVITATION_RECEIVED',
      sourcePublicId: invitation.id,
      listingPublicId: invitation.listingId,
      listingTitle: notificationListingTitle(input.listingTitle),
      hostUsername: input.hostUsername,
      expiresAt: new Date(invitation.expiresAt).toISOString(),
      occurredAt: input.occurredAt
    }
  })
}

export async function enqueueInvitationDecisionNotifications(
  db: DBLike,
  invitation: CampaignInviteRecord,
  input: {
    hostUserId: string
    listingTitle: string
    decision: 'ACCEPTED' | 'DECLINED'
    occurredAt: string
  }
): Promise<void> {
  const repository = createNotificationRepository(db)
  await Promise.all([
    repository.insertDeliveryIntent({
      operation: 'CANCEL',
      workflowKey: 'social-invitation-received',
      sourceKind: 'CAMPAIGN_INVITE',
      sourcePublicId: invitation.id,
      recipientUserId: invitation.recipientUserId,
      occurredAt: input.occurredAt
    }),
    repository.insertDeliveryIntent({
      operation: 'TRIGGER',
      workflowKey: 'social-invitation-decided',
      sourceKind: 'CAMPAIGN_INVITE',
      sourcePublicId: invitation.id,
      recipientUserId: input.hostUserId,
      occurredAt: input.occurredAt,
      payload: {
        kind: 'SOCIAL_INVITATION_DECIDED',
        sourcePublicId: invitation.id,
        listingPublicId: invitation.listingId,
        listingTitle: notificationListingTitle(input.listingTitle),
        recipientUsername: invitation.recipientUsername,
        decision: input.decision,
        occurredAt: input.occurredAt
      }
    })
  ])
}

export async function enqueueInvitationReceivedCancellations(
  db: DBLike,
  inviteIds: string[],
  occurredAt: string
): Promise<void> {
  await createNotificationRepository(db).insertInvitationReceivedCancellations(
    inviteIds,
    occurredAt
  )
}

export function expireDueCampaignInvitations(
  db: DBLike,
  now: string,
  limit = NOTIFICATION_DISPATCH_LIMIT
): Promise<number> {
  return withTransaction(db, async (trx) => {
    const inviteIds = await createCampaignRepository(trx).expireDueInvites(now, limit)
    await enqueueInvitationReceivedCancellations(trx, inviteIds, now)
    return inviteIds.length
  })
}

export function expireDueCampaignInvitationsForUser(
  db: DBLike,
  userId: string,
  now: string
): Promise<number> {
  return withTransaction(db, async (trx) => {
    const inviteIds = await createCampaignRepository(trx).expireDueReceivedInvites(userId, now)
    await enqueueInvitationReceivedCancellations(trx, inviteIds, now)
    return inviteIds.length
  })
}

export async function createNotificationSession(
  db: DBLike,
  userId: string,
  config: { secretKey: string; applicationIdentifier: string }
): Promise<NotificationSessionDto> {
  const recipientId = await createNotificationRepository(db).findRecipientIdForUser(userId)
  if (!recipientId) throw new Error('Notification recipient is unavailable.')

  return {
    recipientId,
    subscriberHash: createHmac('sha256', config.secretKey).update(recipientId).digest('hex'),
    applicationIdentifier: config.applicationIdentifier
  }
}

function retryDelayMilliseconds(attemptCount: number): number {
  return Math.min(60 * 2 ** Math.max(0, attemptCount - 1), 60 * 60) * 1_000
}

function deliveryError(error: unknown): { retryable: boolean; code: string } {
  if (typeof error !== 'object' || error === null) return { retryable: true, code: 'NETWORK' }

  const candidate = error as { statusCode?: unknown; status?: unknown }
  const status =
    typeof candidate.statusCode === 'number'
      ? candidate.statusCode
      : typeof candidate.status === 'number'
        ? candidate.status
        : undefined
  if (status === undefined) return { retryable: true, code: 'NETWORK' }

  return {
    retryable: status === 429 || status >= 500,
    code: `HTTP_${status}`
  }
}

export async function dispatchPendingNotifications(
  db: DBLike,
  secretKey: string
): Promise<NotificationDispatchResult> {
  const now = new Date()
  const expiredInvitations = await expireDueCampaignInvitations(db, now.toISOString())
  const repository = createNotificationRepository(db)
  const staleBefore = new Date(now.getTime() - CLAIM_LEASE_MILLISECONDS).toISOString()
  await repository.suppressCancelledDeliveryTriggers(now.toISOString(), staleBefore)
  const exhaustedIntents = await repository.markExhaustedDeliveryIntents(
    now.toISOString(),
    staleBefore
  )
  const intents = await repository.claimDeliveryIntents({
    limit: NOTIFICATION_DISPATCH_LIMIT,
    now: now.toISOString(),
    staleBefore
  })
  const novu = new Novu({ secretKey, retryConfig: { strategy: 'none' } })
  const result: NotificationDispatchResult = {
    claimed: intents.length,
    delivered: 0,
    retried: 0,
    failed: exhaustedIntents,
    expiredInvitations
  }

  for (const intent of intents) {
    try {
      if (intent.operation === 'CANCEL') {
        await novu.cancel(cancellationKey(intent.workflowKey, intent.sourcePublicId), intent.id)
      } else {
        const payload = notificationIntentDataSchema.safeParse(intent.payload)
        if (!payload.success) {
          await repository.markDeliveryFailed({
            intentId: intent.id,
            failedAt: new Date().toISOString(),
            errorCode: 'INVALID_PAYLOAD'
          })
          result.failed += 1
          continue
        }
        await novu.trigger(
          {
            workflowId: intent.workflowKey,
            to: {
              subscriberId: intent.recipientNotificationId,
              ...(intent.recipientEmail ? { email: intent.recipientEmail } : {}),
              ...(intent.recipientUsername ? { firstName: intent.recipientUsername } : {})
            },
            payload: payload.data,
            transactionId: cancellationKey(intent.workflowKey, intent.sourcePublicId)
          },
          intent.id
        )
      }
      await repository.markDeliverySucceeded(intent.id, new Date().toISOString())
      result.delivered += 1
    } catch (error) {
      const classified = deliveryError(error)
      if (classified.retryable && intent.attemptCount < MAX_DELIVERY_ATTEMPTS) {
        await repository.markDeliveryRetry({
          intentId: intent.id,
          nextAttemptAt: new Date(
            Date.now() + retryDelayMilliseconds(intent.attemptCount)
          ).toISOString(),
          errorCode: classified.code
        })
        result.retried += 1
      } else {
        await repository.markDeliveryFailed({
          intentId: intent.id,
          failedAt: new Date().toISOString(),
          errorCode: classified.code
        })
        result.failed += 1
      }
    }
  }

  return result
}
