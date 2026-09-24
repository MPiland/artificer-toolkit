import { Resend } from '@convex-dev/resend'
import { v } from 'convex/values'
import { components } from '../_generated/api'
import { internalQuery } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { cancelQueuedNotificationEmail } from './intents'

const workflowKey = 'campaign-announcement' as const

function requireSourcePublicIds(sourcePublicIds: string[]) {
  if (
    sourcePublicIds.length < 1 ||
    sourcePublicIds.length > 2 ||
    new Set(sourcePublicIds).size !== sourcePublicIds.length
  )
    throw new Error('One or two unique fixture notification source IDs are required.')
}

const deliveryResult = v.object({
  sourcePublicId: v.string(),
  status: v.union(
    v.literal('PENDING'),
    v.literal('DISPATCHED'),
    v.literal('CANCELLED'),
    v.literal('FAILED')
  ),
  feedRecorded: v.boolean(),
  attemptCount: v.number(),
  providerEmailId: v.union(v.null(), v.string()),
  providerStatus: v.union(v.null(), v.string())
})

export const readFixtureDelivery = internalQuery({
  args: { userId: v.string(), sourcePublicIds: v.array(v.string()) },
  returns: v.array(v.union(v.null(), deliveryResult)),
  handler: async (ctx, { userId, sourcePublicIds }) => {
    await requireFixtureAccount(ctx, userId)
    requireSourcePublicIds(sourcePublicIds)
    return Promise.all(
      sourcePublicIds.map(async (sourcePublicId) => {
        const row = await ctx.db
          .query('notificationDeliveryIntents')
          .withIndex('by_recipientUserId_workflowKey_sourcePublicId', (q) =>
            q
              .eq('recipientUserId', userId)
              .eq('workflowKey', workflowKey)
              .eq('sourcePublicId', sourcePublicId)
          )
          .unique()
        if (!row) return null
        const provider = row.providerEmailId
          ? await new Resend(components.resend).status(ctx, row.providerEmailId)
          : null
        return {
          sourcePublicId: row.sourcePublicId,
          status: row.status,
          feedRecorded: row.feedRecorded,
          attemptCount: row.attemptCount,
          providerEmailId: row.providerEmailId,
          providerStatus: provider?.status ?? null
        }
      })
    )
  }
})

export const removeFixtureDelivery = internalMutation({
  args: { userId: v.string(), sourcePublicIds: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { userId, sourcePublicIds }) => {
    await requireFixtureAccount(ctx, userId)
    requireSourcePublicIds(sourcePublicIds)
    const [intents, feedItems] = await Promise.all([
      ctx.db
        .query('notificationDeliveryIntents')
        .withIndex('by_recipientUserId', (q) => q.eq('recipientUserId', userId))
        .take(3),
      ctx.db
        .query('notificationFeedItems')
        .withIndex('by_userId_occurredAt_id', (q) => q.eq('userId', userId))
        .take(3)
    ])
    const sourceIds = new Set(sourcePublicIds)
    if (
      intents.length > 2 ||
      feedItems.length > 2 ||
      intents.some(
        (intent) => intent.workflowKey !== workflowKey || !sourceIds.has(intent.sourcePublicId)
      ) ||
      feedItems.some(
        (item) => item.workflowKey !== workflowKey || !sourceIds.has(item.sourcePublicId)
      )
    )
      throw new Error('Fixture notification delivery dependency mismatch.')
    for (const intent of intents) {
      if (intent.providerEmailId) await cancelQueuedNotificationEmail(ctx, intent.providerEmailId)
      await ctx.db.delete(intent._id)
    }
    for (const item of feedItems) await ctx.db.delete(item._id)
    return null
  }
})
