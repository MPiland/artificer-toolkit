import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  listCampaignInventoryAuditInputSchema,
  campaignInventoryAuditEventDtoSchema
} from '@artificer-toolkit/schema/api/campaignInventory'
import {
  campaignInventoryAuditPageTransportSchema,
  type CampaignInventoryAuditPageTransport
} from '@artificer-toolkit/schema/api/campaignInventoryPages'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { query } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { presentInventoryAuditPayload } from './inventoryAuditPresentation'

export const list = query({
  args: zodToConvexFields(listCampaignInventoryAuditInputSchema.shape),
  returns: zodToConvex(campaignInventoryAuditPageTransportSchema),
  handler: async (ctx, args): Promise<CampaignInventoryAuditPageTransport> => {
    const input = listCampaignInventoryAuditInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER')
      throw new Error('Only the Campaign owner can read inventory audit history.')
    const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
    const cursor = input.cursor
      ? await ctx.db
          .query('campaignEvents')
          .withIndex('by_campaignId_id', (q) =>
            q.eq('campaignId', campaign.id).eq('id', input.cursor!.toLowerCase())
          )
          .unique()
      : null
    if (
      input.cursor &&
      (!cursor?.inventoryAudit || cursor.visibility !== 'OWNER' || cursor.createdAt < cutoff)
    )
      return { events: [], nextCursor: null }
    const read = (sameTime: boolean) =>
      ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_inventoryAudit_createdAt_id', (q) => {
          const scoped = q.eq('campaignId', campaign.id).eq('inventoryAudit', true)
          if (!cursor) return scoped.gte('createdAt', cutoff)
          return sameTime
            ? scoped.eq('createdAt', cursor.createdAt).lt('id', cursor.id)
            : scoped.gte('createdAt', cutoff).lt('createdAt', cursor.createdAt)
        })
        .order('desc')
        .take(input.limit + 1)
    const records = (
      cursor ? (await Promise.all([read(true), read(false)])).flat() : await read(false)
    )
      .sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)
      )
      .slice(0, input.limit + 1)
    const events = records.slice(0, input.limit).map((row) => {
      const { _id, _creationTime, ...raw } = row
      const record = campaignStoredEventSchema.parse(raw)
      const { payload, ...event } = campaignInventoryAuditEventDtoSchema.parse({
        id: record.id,
        campaignId: record.campaignId,
        actorUserId: record.actorUserId,
        subjectCharacterId: record.subjectCharacterId,
        kind: record.type,
        visibility: record.visibility,
        payload: JSON.parse(record.payloadJson) as unknown,
        createdAt: record.createdAt
      })
      const presented = presentInventoryAuditPayload(payload, campaign.contentMaturity)
      return { ...event, payloadJson: JSON.stringify(presented) }
    })
    return campaignInventoryAuditPageTransportSchema.parse({
      events,
      nextCursor: records.length > input.limit ? events.at(-1)!.id : null
    })
  }
})
