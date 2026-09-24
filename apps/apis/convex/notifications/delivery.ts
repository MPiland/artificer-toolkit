import { Resend } from '@convex-dev/resend'
import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  notificationStoredIntentSchema,
  type NotificationCancellationInput
} from '@artificer-toolkit/schema/projections/notificationPersistence'
import {
  notificationFeedItemDtoSchema,
  notificationIntentDataSchema,
  notificationWorkflowKeySchema
} from '@artificer-toolkit/schema/api/notifications'
import { components, internal } from '../_generated/api'
import { internalQuery, type MutationCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import { readAuthUser } from '../lib/authUserReads'
import { retainedFeed } from './feed'
import { cancelNotification, cancelQueuedNotificationEmail } from './intents'
import { expireDueInvitations } from '../social/invitationExpiry'
import { requiredEmailEnvironment, resendRecipient } from '../emailTransport'
import { isNotificationSourceEligible } from './source'

const attemptArgs = {
  intentId: v.id('notificationDeliveryIntents'),
  attempt: v.number()
}

async function cancelUnavailableIntent(
  ctx: MutationCtx,
  row: Pick<NotificationCancellationInput, 'recipientUserId' | 'sourcePublicId' | 'workflowKey'>
) {
  await cancelNotification(ctx, {
    recipientUserId: row.recipientUserId,
    sourcePublicId: row.sourcePublicId,
    workflowKey: row.workflowKey,
    occurredAt: new Date().toISOString()
  })
}

export const dispatch = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = new Date().toISOString()
    await expireDueInvitations(ctx, now)
    // Existing notification policy: at most ten claims per one-minute dispatcher run.
    const due = await ctx.db
      .query('notificationDeliveryIntents')
      .withIndex('by_status_nextAttemptAt', (q) =>
        q.eq('status', 'PENDING').lte('nextAttemptAt', now)
      )
      .take(10)
    for (const row of due) {
      const { _id, _creationTime, ...stored } = row
      const parsed = notificationStoredIntentSchema.safeParse(stored)
      if (!parsed.success || !parsed.data.data) {
        await ctx.db.patch(_id, {
          status: 'FAILED',
          lastErrorCode: 'INVALID_PAYLOAD'
        })
        continue
      }
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', row.recipientUserId))
        .unique()
      if (!profile) {
        if (row.providerEmailId) await cancelQueuedNotificationEmail(ctx, row.providerEmailId)
        await ctx.db.patch(_id, {
          status: 'FAILED',
          lastErrorCode: 'RECIPIENT_UNAVAILABLE'
        })
        continue
      }
      // The component owns provider retries. Enqueue acknowledgement is not delivery success.
      if (row.providerEmailId) {
        const email = await new Resend(components.resend).status(ctx, row.providerEmailId)
        if (!email || email.status === 'failed' || email.status === 'cancelled') {
          await ctx.db.patch(_id, {
            status: 'FAILED',
            lastErrorCode: 'DELIVERY_ERROR'
          })
        } else if (email.status === 'waiting' || email.status === 'queued') {
          await ctx.db.patch(_id, {
            nextAttemptAt: new Date(Date.now() + 60_000).toISOString()
          })
        } else {
          // Preserve the existing contract: dispatched means provider acceptance, not inbox delivery.
          await ctx.db.patch(_id, {
            status: 'DISPATCHED',
            dispatchedAt: now,
            lastErrorCode: null
          })
        }
        continue
      }
      if (!(await isNotificationSourceEligible(ctx, row.recipientUserId, parsed.data.data))) {
        await cancelUnavailableIntent(ctx, row)
        continue
      }
      if (row.attemptCount >= 10) {
        await ctx.db.patch(_id, {
          status: 'FAILED',
          lastErrorCode: 'ATTEMPTS_EXHAUSTED'
        })
        continue
      }
      const channels = profile.notificationPreferences?.[
        row.sourceKind === 'CAMPAIGN_ANNOUNCEMENT' ? 'campaign' : 'social'
      ] ?? { inApp: true, email: true }
      if (channels.inApp && !row.feedRecorded) {
        const retained = await retainedFeed(ctx, row.recipientUserId)
        const item = notificationFeedItemDtoSchema.parse({
          id: row.id,
          workflowKey: row.workflowKey,
          sourceKind: row.sourceKind,
          sourcePublicId: row.sourcePublicId,
          groupingKey: row.groupingKey,
          data: parsed.data.data,
          occurredAt: row.occurredAt,
          seenAt: null,
          readAt: null
        })
        const inserted = await ctx.db.insert('notificationFeedItems', {
          ...item,
          userId: row.recipientUserId
        })
        const ordered = [
          ...retained.map((entry) => ({
            rowId: entry._id,
            id: entry.id,
            occurredAt: entry.occurredAt
          })),
          { rowId: inserted, id: item.id, occurredAt: item.occurredAt }
        ].sort(
          (left, right) =>
            Date.parse(right.occurredAt) - Date.parse(left.occurredAt) ||
            (left.id < right.id ? 1 : left.id > right.id ? -1 : 0)
        )
        for (const expired of ordered.slice(25)) await ctx.db.delete(expired.rowId)
        await ctx.db.patch(_id, { feedRecorded: true })
      }
      if (!channels.email) {
        await ctx.db.patch(_id, {
          status: 'DISPATCHED',
          dispatchedAt: now,
          lastErrorCode: null
        })
        continue
      }
      const attempt = row.attemptCount + 1
      await ctx.db.patch(_id, {
        attemptCount: attempt,
        nextAttemptAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        lastErrorCode: null
      })
      await ctx.scheduler.runAfter(0, internal.notifications.deliveryAction.send, {
        intentId: _id,
        attempt
      })
    }
    return due.length
  }
})

export const emailInput = internalQuery({
  args: attemptArgs,
  returns: v.union(
    v.null(),
    v.object({
      id: v.string(),
      recipient: v.string(),
      workflowKey: zodToConvex(notificationWorkflowKeySchema),
      data: zodToConvex(notificationIntentDataSchema)
    })
  ),
  handler: async (ctx, { intentId, attempt }) => {
    const row = await ctx.db.get(intentId)
    if (!row || row.status !== 'PENDING' || row.attemptCount !== attempt || row.providerEmailId)
      return null
    const { _id, _creationTime, ...stored } = row
    const intent = notificationStoredIntentSchema.parse(stored)
    if (!intent.data) return null
    if (!(await isNotificationSourceEligible(ctx, row.recipientUserId, intent.data))) return null
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', row.recipientUserId))
      .unique()
    if (!profile) return null
    const channels =
      profile.notificationPreferences?.[
        row.sourceKind === 'CAMPAIGN_ANNOUNCEMENT' ? 'campaign' : 'social'
      ]
    if (channels?.email === false) return null
    const recipient = await readAuthUser(ctx, profile.authUserId)
    if (!recipient) return null
    return {
      id: row.id,
      recipient: recipient.email,
      workflowKey: row.workflowKey,
      data: intent.data
    }
  }
})

export const enqueueRendered = internalMutation({
  args: { ...attemptArgs, subject: v.string(), html: v.string() },
  returns: v.null(),
  handler: async (ctx, { intentId, attempt, subject, html }) => {
    const input = await ctx.runQuery(internal.notifications.delivery.emailInput, {
      intentId,
      attempt
    })
    if (!input) {
      const row = await ctx.db.get(intentId)
      if (row && row.status === 'PENDING' && row.attemptCount === attempt && !row.providerEmailId) {
        const { _id, _creationTime, ...stored } = row
        const intent = notificationStoredIntentSchema.parse(stored)
        if (
          intent.data &&
          !(await isNotificationSourceEligible(ctx, row.recipientUserId, intent.data))
        )
          await cancelUnavailableIntent(ctx, row)
      }
      return null
    }
    if (requiredEmailEnvironment('MAIL_DELIVERY_MODE') !== 'resend')
      throw new Error('Resend delivery is not configured.')
    const delivery = resendRecipient(input.recipient)
    // Component enqueue and provider handle persistence commit together, including cancellation reads.
    const providerEmailId = await new Resend(components.resend, {
      testMode: delivery.testMode,
      retryAttempts: 10
    }).sendEmail(ctx, {
      from: requiredEmailEnvironment('NOTIFICATION_EMAIL_FROM'),
      to: delivery.recipient,
      subject,
      html,
      idempotencyKey: input.id
    })
    await ctx.db.patch(intentId, {
      providerEmailId,
      nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
      lastErrorCode: null
    })
    return null
  }
})

export const complete = internalMutation({
  args: attemptArgs,
  returns: v.null(),
  handler: async (ctx, { intentId, attempt }) => {
    const row = await ctx.db.get(intentId)
    if (!row || row.status !== 'PENDING' || row.attemptCount !== attempt || row.providerEmailId)
      return null
    const { _id, _creationTime, ...stored } = row
    const intent = notificationStoredIntentSchema.parse(stored)
    if (
      intent.data &&
      !(await isNotificationSourceEligible(ctx, row.recipientUserId, intent.data))
    ) {
      await cancelUnavailableIntent(ctx, row)
      return null
    }
    await ctx.db.patch(intentId, {
      status: 'DISPATCHED',
      dispatchedAt: new Date().toISOString(),
      lastErrorCode: null
    })
    return null
  }
})

export const retry = internalMutation({
  args: attemptArgs,
  returns: v.null(),
  handler: async (ctx, { intentId, attempt }) => {
    const row = await ctx.db.get(intentId)
    if (!row || row.status !== 'PENDING' || row.attemptCount !== attempt || row.providerEmailId)
      return null
    await ctx.db.patch(intentId, {
      status: attempt >= 10 ? 'FAILED' : 'PENDING',
      lastErrorCode: attempt >= 10 ? 'ATTEMPTS_EXHAUSTED' : 'DELIVERY_ERROR',
      nextAttemptAt: new Date(
        Date.now() + Math.min(60 * 2 ** Math.max(0, attempt - 1), 3600) * 1000
      ).toISOString()
    })
    return null
  }
})

export const purgeRecipient = internalMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    if (profile) throw new Error('Cannot purge an active account notification history.')
    const rows = await ctx.db
      .query('notificationDeliveryIntents')
      .withIndex('by_recipientUserId', (q) => q.eq('recipientUserId', userId))
      .take(50)
    for (const row of rows) {
      if (row.providerEmailId) await cancelQueuedNotificationEmail(ctx, row.providerEmailId)
      await ctx.db.delete(row._id)
    }
    if (rows.length === 50)
      await ctx.scheduler.runAfter(0, internal.notifications.delivery.purgeRecipient, { userId })
    return null
  }
})
