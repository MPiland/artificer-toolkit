import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  listCampaignEventsInputSchema,
  campaignEventDtoSchema,
  type CampaignEventDto
} from '@artificer-toolkit/schema/api/campaignLiveState'
import {
  campaignEventPageTransportDtoSchema,
  decodeCampaignEventPage,
  type CampaignEventPageTransportDto
} from '@artificer-toolkit/schema/api/campaignEventTransport'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { requireCampaignCharacterAuthority } from './characterState'
import { presentInventoryAuditPayload } from './inventoryAuditPresentation'

export const list = query({
  args: zodToConvexFields(listCampaignEventsInputSchema.shape),
  returns: zodToConvex(campaignEventPageTransportDtoSchema),
  handler: async (ctx, args): Promise<CampaignEventPageTransportDto> => {
    const input = listCampaignEventsInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership, assignment } = await requireCampaignCharacterAuthority(
      ctx,
      input.campaignId,
      input.characterId,
      userId
    )
    const characterId = input.characterId.toLowerCase()
    // TABLE, plus OWNER for the GM and this Character's SUBJECT for its player (the GM included).
    const visibility: CampaignEventDto['visibility'][] = [
      'TABLE',
      ...(membership.role === 'OWNER' ? (['OWNER'] as const) : []),
      ...(assignment.userId === userId ? (['SUBJECT'] as const) : [])
    ]
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
      (!cursor ||
        !cursor.visibleInHistory ||
        cursor.type === 'CAMPAIGN_COPIED' ||
        !visibility.includes(cursor.visibility) ||
        (cursor.visibility === 'SUBJECT' && cursor.subjectCharacterId !== characterId))
    )
      return { events: [], nextCursor: null }

    const subsets = await Promise.all(
      visibility.map(async (scope) => {
        const read = (sameTime: boolean) => {
          const events = ctx.db.query('campaignEvents')
          const scoped =
            scope === 'SUBJECT'
              ? events.withIndex('by_campaignId_history_visibility_subject_createdAt_id', (q) => {
                  const range = q
                    .eq('campaignId', campaign.id)
                    .eq('visibleInHistory', true)
                    .eq('visibility', scope)
                    .eq('subjectCharacterId', characterId)
                  if (!cursor) return range
                  return sameTime
                    ? range.eq('createdAt', cursor.createdAt).lt('id', cursor.id)
                    : range.lt('createdAt', cursor.createdAt)
                })
              : events.withIndex('by_campaignId_visibleInHistory_visibility_createdAt_id', (q) => {
                  const range = q
                    .eq('campaignId', campaign.id)
                    .eq('visibleInHistory', true)
                    .eq('visibility', scope)
                  if (!cursor) return range
                  return sameTime
                    ? range.eq('createdAt', cursor.createdAt).lt('id', cursor.id)
                    : range.lt('createdAt', cursor.createdAt)
                })
          return scoped.order('desc').take(input.limit + 1)
        }
        return cursor ? (await Promise.all([read(true), read(false)])).flat() : read(false)
      })
    )
    const records = subsets
      .flat()
      .sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)
      )
      .slice(0, input.limit + 1)
    const events = records.slice(0, input.limit).map((record) => {
      const { _id, _creationTime, ...stored } = record
      const {
        actorUserId: _actor,
        visibleInHistory: _history,
        commandId: _command,
        inputFingerprint: _fingerprint,
        inventoryAudit: _inventoryAudit,
        ...event
      } = campaignStoredEventSchema.parse(stored)
      return _inventoryAudit
        ? {
            ...event,
            payloadJson: JSON.stringify(
              presentInventoryAuditPayload(
                campaignEventDtoSchema.shape.payload.parse(
                  JSON.parse(event.payloadJson) as unknown
                ),
                campaign.contentMaturity
              )
            )
          }
        : event
    })
    const result = campaignEventPageTransportDtoSchema.parse({
      events,
      nextCursor: records.length > input.limit ? (events.at(-1)?.id ?? null) : null
    })
    decodeCampaignEventPage(result)
    return result
  }
})
