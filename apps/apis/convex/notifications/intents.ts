import { Resend, type EmailId } from '@convex-dev/resend'
import { notificationWorkflowKeySchema } from '@artificer-toolkit/schema/api/notifications'
import {
  notificationEnqueueInputSchema,
  notificationCancellationInputSchema,
  notificationStoredIntentSchema,
  type NotificationEnqueueInput,
  type NotificationCancellationInput
} from '@artificer-toolkit/schema/projections/notificationPersistence'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'
import { components } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'

export async function cancelQueuedNotificationEmail(ctx: MutationCtx, emailId: EmailId) {
  const resend = new Resend(components.resend)
  const email = await resend.status(ctx, emailId)
  if (email?.status === 'waiting' || email?.status === 'queued')
    await resend.cancelEmail(ctx, emailId)
}

// Only authorized source mutations call these helpers; there is no client notification writer.
export async function enqueueNotification(ctx: MutationCtx, value: NotificationEnqueueInput) {
  const parsed = notificationEnqueueInputSchema.parse(value)
  const { recipientUserId } = parsed
  const input = { ...parsed.data, occurredAt: new Date(parsed.data.occurredAt).toISOString() }
  const data =
    input.kind === 'CAMPAIGN_ANNOUNCEMENT'
      ? { ...input, summary: 'A new Campaign announcement is available.' }
      : { ...input, listingTitle: presentCampaignPlainText(input.listingTitle, 'STANDARD') }
  const workflowKey = notificationWorkflowKeySchema.parse(
    data.kind.toLowerCase().replaceAll('_', '-')
  )
  const sourcePublicId =
    data.kind === 'CAMPAIGN_ANNOUNCEMENT' ? data.announcementPublicId : data.sourcePublicId
  const existing = await ctx.db
    .query('notificationDeliveryIntents')
    .withIndex('by_recipientUserId_workflowKey_sourcePublicId', (q) =>
      q
        .eq('recipientUserId', recipientUserId)
        .eq('workflowKey', workflowKey)
        .eq('sourcePublicId', sourcePublicId)
    )
    .unique()
  if (existing) return existing.id
  const recipient = await ctx.db
    .query('userProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', recipientUserId))
    .unique()
  if (!recipient) return null
  const record = notificationStoredIntentSchema.parse({
    id: crypto.randomUUID(),
    recipientUserId,
    workflowKey,
    sourceKind:
      data.kind === 'CAMPAIGN_ANNOUNCEMENT'
        ? 'CAMPAIGN_ANNOUNCEMENT'
        : data.kind.startsWith('SOCIAL_APPLICATION')
          ? 'SOCIAL_APPLICATION'
          : 'CAMPAIGN_INVITE',
    sourcePublicId,
    groupingKey: data.kind === 'SOCIAL_APPLICATION_SUBMITTED' ? data.listingPublicId : null,
    data,
    occurredAt: data.occurredAt,
    status: 'PENDING',
    attemptCount: 0,
    nextAttemptAt: new Date().toISOString(),
    feedRecorded: false,
    providerEmailId: null,
    dispatchedAt: null,
    cancelledAt: null,
    lastErrorCode: null
  })
  await ctx.db.insert('notificationDeliveryIntents', { ...record, providerEmailId: null })
  return record.id
}

export async function cancelNotification(ctx: MutationCtx, value: NotificationCancellationInput) {
  const input = notificationCancellationInputSchema.parse(value)
  const existing = await ctx.db
    .query('notificationDeliveryIntents')
    .withIndex('by_recipientUserId_workflowKey_sourcePublicId', (q) =>
      q
        .eq('recipientUserId', input.recipientUserId)
        .eq('workflowKey', input.workflowKey)
        .eq('sourcePublicId', input.sourcePublicId)
    )
    .unique()
  if (existing) {
    if (existing.providerEmailId) await cancelQueuedNotificationEmail(ctx, existing.providerEmailId)
    await ctx.db.patch(existing._id, {
      status: 'CANCELLED',
      cancelledAt: existing.cancelledAt ?? input.occurredAt
    })
    return
  }
  const recipient = await ctx.db
    .query('userProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', input.recipientUserId))
    .unique()
  if (!recipient) return
  await ctx.db.insert('notificationDeliveryIntents', {
    ...notificationStoredIntentSchema.parse({
      ...input,
      id: crypto.randomUUID(),
      sourceKind:
        input.workflowKey === 'campaign-announcement'
          ? 'CAMPAIGN_ANNOUNCEMENT'
          : input.workflowKey.startsWith('social-application')
            ? 'SOCIAL_APPLICATION'
            : 'CAMPAIGN_INVITE',
      groupingKey: null,
      data: null,
      status: 'CANCELLED',
      attemptCount: 0,
      nextAttemptAt: input.occurredAt,
      feedRecorded: false,
      providerEmailId: null,
      dispatchedAt: null,
      cancelledAt: input.occurredAt,
      lastErrorCode: null
    }),
    providerEmailId: null
  })
}
