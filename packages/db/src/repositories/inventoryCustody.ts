import type { DBLike, Json } from '#types'
import {
  campaignInventoryEventKinds,
  CampaignCustodyEvent,
  CampaignEventRow,
  CampaignInventoryEventKind
} from './inventoryTypes.js'

function toIsoTimestamp(value: Date | string): string {
  const timestamp = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(timestamp.getTime())) throw new Error('Inventory event timestamp is invalid.')
  return timestamp.toISOString()
}
function campaignEvent(row: CampaignEventRow): CampaignCustodyEvent {
  if (!row.idempotency_key) throw new Error(`Campaign event "${row.id}" has no idempotency key.`)
  return {
    id: row.id,
    campaignId: row.campaign_id,
    actorUserId: row.actor_user_id,
    subjectUserId: row.subject_user_id,
    subjectCharacterId: row.subject_character_id,
    kind: row.kind,
    visibility: row.visibility as CampaignCustodyEvent['visibility'],
    payload: row.payload,
    idempotencyKey: row.idempotency_key,
    createdAt: toIsoTimestamp(row.created_at as Date | string)
  }
}

export function createInventoryCustodyRepository(db: DBLike) {
  async function insertInventoryEvent(input: {
    campaignId: string
    actorUserId: string
    subjectUserId?: string | null
    subjectCharacterId?: string | null
    kind: CampaignInventoryEventKind
    idempotencyKey: string
    payload: Json
  }): Promise<CampaignCustodyEvent> {
    return campaignEvent(
      await db
        .insertInto('campaign_events')
        .values({
          campaign_id: input.campaignId,
          actor_user_id: input.actorUserId,
          subject_user_id: input.subjectUserId ?? null,
          subject_character_id: input.subjectCharacterId ?? null,
          kind: input.kind,
          visibility: 'OWNER',
          payload: input.payload,
          idempotency_key: input.idempotencyKey
        })
        .returningAll()
        .executeTakeFirstOrThrow()
    )
  }
  return {
    async findCampaignEventByIdempotency(campaignId: string, idempotencyKey: string) {
      const row = await db
        .selectFrom('campaign_events')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .where('idempotency_key', '=', idempotencyKey)
        .executeTakeFirst()
      return row ? campaignEvent(row) : null
    },
    insertInventoryEvent,
    async listInventoryAuditEvents(input: {
      campaignId: string
      cursorId?: string
      limit: number
    }) {
      let cursor: { created_at: Date | string; id: string } | undefined
      if (input.cursorId) {
        const row = await db
          .selectFrom('campaign_events')
          .select(['created_at', 'id'])
          .where('campaign_id', '=', input.campaignId)
          .where('id', '=', input.cursorId)
          .where('visibility', '=', 'OWNER')
          .where('kind', 'in', [...campaignInventoryEventKinds])
          .executeTakeFirst()
        if (!row) return { events: [], nextCursor: null }
        cursor = row
      }
      let query = db
        .selectFrom('campaign_events')
        .selectAll()
        .where('campaign_id', '=', input.campaignId)
        .where('visibility', '=', 'OWNER')
        .where('kind', 'in', [...campaignInventoryEventKinds])
      if (cursor) {
        const createdAt = toIsoTimestamp(cursor.created_at)
        query = query.where((eb) =>
          eb.or([
            eb('created_at', '<', createdAt),
            eb.and([eb('created_at', '=', createdAt), eb('id', '<', cursor.id)])
          ])
        )
      }
      const rows = (await query
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(input.limit + 1)
        .execute()) as CampaignEventRow[]
      const hasMore = rows.length > input.limit
      const events = rows.slice(0, input.limit).map(campaignEvent)
      return { events, nextCursor: hasMore ? (events.at(-1)?.id ?? null) : null }
    },
    async insertCustodyEvent(input: {
      campaignId: string
      actorUserId: string
      subjectUserId?: string | null
      subjectCharacterId?: string | null
      idempotencyKey: string
      payload: Json
    }) {
      return insertInventoryEvent({ ...input, kind: 'CUSTODY_TRANSFER' })
    }
  }
}
