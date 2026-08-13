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
  type NotificationFeedDto,
  type NotificationPreferencesDto,
  type UpdateNotificationPreferencesInput
} from '@artificer-toolkit/schema/api/notifications'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'

// ponytail: 10 deliveries per minute is the measured-volume ceiling; raise it only after backlog or latency evidence.
export const NOTIFICATION_DISPATCH_LIMIT = 10

function notificationListingTitle(value: string): string {
  return presentCampaignPlainText(value, 'STANDARD')
}

export async function enqueueCampaignAnnouncementNotification(
  db: DBLike,
  input: {
    announcementPublicId: string
    campaignPublicId: string
    recipientUserId: string
    scope: 'TABLE' | 'PARTY'
    occurredAt: string
  }
): Promise<void> {
  await createNotificationRepository(db).insertDeliveryIntent({
    operation: 'TRIGGER',
    workflowKey: 'campaign-announcement',
    sourceKind: 'CAMPAIGN_ANNOUNCEMENT',
    sourcePublicId: input.announcementPublicId,
    recipientUserId: input.recipientUserId,
    payload: {
      kind: 'CAMPAIGN_ANNOUNCEMENT',
      announcementPublicId: input.announcementPublicId,
      campaignPublicId: input.campaignPublicId,
      summary: 'A new Campaign announcement is available.',
      scope: input.scope,
      occurredAt: input.occurredAt
    },
    occurredAt: input.occurredAt
  })
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

export async function getNotificationFeed(
  db: DBLike,
  userId: string
): Promise<NotificationFeedDto> {
  const repository = createNotificationRepository(db)
  const [records, unseenCount] = await Promise.all([
    repository.listFeed(userId),
    repository.countUnseenFeedItems(userId)
  ])
  return {
    unseenCount,
    items: records.map((record) => ({
      id: record.id,
      workflowKey: record.workflowKey,
      sourceKind: record.sourceKind,
      sourcePublicId: record.sourcePublicId,
      groupingKey: record.groupingKey,
      data: notificationIntentDataSchema.parse(record.payload),
      occurredAt: record.occurredAt,
      seenAt: record.seenAt,
      readAt: record.readAt
    }))
  }
}

export async function markAllNotificationsSeen(db: DBLike, userId: string): Promise<void> {
  await createNotificationRepository(db).markAllFeedItemsSeen(userId, new Date().toISOString())
}

export async function markNotificationRead(
  db: DBLike,
  userId: string,
  feedItemId: string
): Promise<void> {
  const updated = await createNotificationRepository(db).markFeedItemRead({
    userId,
    feedItemId,
    readAt: new Date().toISOString()
  })
  if (!updated) throw new Error('Notification is unavailable.')
}

export function getNotificationPreferences(
  db: DBLike,
  userId: string
): Promise<NotificationPreferencesDto> {
  return createNotificationRepository(db).getPreferences(userId)
}

export function updateNotificationPreferences(
  db: DBLike,
  userId: string,
  input: UpdateNotificationPreferencesInput
): Promise<NotificationPreferencesDto> {
  return createNotificationRepository(db).updatePreferences({
    userId,
    category: input.category,
    inApp: input.inApp,
    email: input.email,
    updatedAt: new Date().toISOString()
  })
}
