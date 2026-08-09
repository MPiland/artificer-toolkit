import type { DBLike, DbTables, Json } from '#types'

type RuntimeTimestamp = Date | string
type CampaignAdjustmentRow = Omit<
  DbTables['campaign_adjustments']['Row'],
  'created_at' | 'updated_at'
> & {
  created_at: RuntimeTimestamp
  updated_at: RuntimeTimestamp
}
type CampaignEventRow = Omit<DbTables['campaign_events']['Row'], 'created_at'> & {
  created_at: RuntimeTimestamp
}

export type CampaignAdjustmentVisibility = 'VISIBLE' | 'SECRET'
export type CampaignEventVisibility = 'TABLE' | 'OWNER' | 'SUBJECT'

export interface CampaignAdjustment {
  id: string
  campaignId: string
  characterId: string
  family: string
  slotKey: string
  payload: Json
  visibility: CampaignAdjustmentVisibility
  createdBy: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface CampaignHistoryEvent {
  id: string
  campaignId: string
  actorUserId: string | null
  subjectUserId: string | null
  subjectCharacterId: string | null
  kind: string
  visibility: CampaignEventVisibility
  payload: Json
  idempotencyKey: string | null
  createdAt: string
}

export type CampaignHistoryViewer = { kind: 'OWNER' } | { kind: 'SUBJECT'; characterId: string }

function toIsoString(value: RuntimeTimestamp): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid database timestamp "${value}".`)
  return date.toISOString()
}

function toAdjustment(row: CampaignAdjustmentRow): CampaignAdjustment {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    characterId: row.character_id,
    family: row.family,
    slotKey: row.slot_key,
    payload: row.payload,
    visibility: row.visibility as CampaignAdjustmentVisibility,
    createdBy: row.created_by,
    version: row.version,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  }
}

function toEvent(row: CampaignEventRow): CampaignHistoryEvent {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    actorUserId: row.actor_user_id,
    subjectUserId: row.subject_user_id,
    subjectCharacterId: row.subject_character_id,
    kind: row.kind,
    visibility: row.visibility as CampaignEventVisibility,
    payload: row.payload,
    idempotencyKey: row.idempotency_key,
    createdAt: toIsoString(row.created_at)
  }
}

export function createCampaignAdjustmentsRepository(db: DBLike) {
  return {
    async listAdjustments(campaignId: string, characterId: string): Promise<CampaignAdjustment[]> {
      const rows = (await db
        .selectFrom('campaign_adjustments')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .where('character_id', '=', characterId)
        .orderBy('family', 'asc')
        .orderBy('slot_key', 'asc')
        .orderBy('id', 'asc')
        .execute()) as CampaignAdjustmentRow[]
      return rows.map(toAdjustment)
    },

    async findAdjustment(input: {
      campaignId: string
      characterId: string
      family: string
      slotKey: string
    }): Promise<CampaignAdjustment | null> {
      const row = (await db
        .selectFrom('campaign_adjustments')
        .selectAll()
        .where('campaign_id', '=', input.campaignId)
        .where('character_id', '=', input.characterId)
        .where('family', '=', input.family)
        .where('slot_key', '=', input.slotKey)
        .executeTakeFirst()) as CampaignAdjustmentRow | undefined
      return row ? toAdjustment(row) : null
    },

    async lockAdjustment(input: {
      campaignId: string
      characterId: string
      family: string
      slotKey: string
    }): Promise<CampaignAdjustment | null> {
      const row = (await db
        .selectFrom('campaign_adjustments')
        .selectAll()
        .where('campaign_id', '=', input.campaignId)
        .where('character_id', '=', input.characterId)
        .where('family', '=', input.family)
        .where('slot_key', '=', input.slotKey)
        .forUpdate()
        .executeTakeFirst()) as CampaignAdjustmentRow | undefined
      return row ? toAdjustment(row) : null
    },

    async saveAdjustment(input: {
      campaignId: string
      characterId: string
      family: string
      slotKey: string
      payload: Json
      visibility: CampaignAdjustmentVisibility
      createdBy: string
      expectedVersion: number
      updatedAt: string
    }): Promise<CampaignAdjustment | null> {
      const existing = (await db
        .updateTable('campaign_adjustments')
        .set({
          payload: input.payload,
          visibility: input.visibility,
          updated_at: input.updatedAt,
          version: input.expectedVersion + 1
        })
        .where('campaign_id', '=', input.campaignId)
        .where('character_id', '=', input.characterId)
        .where('family', '=', input.family)
        .where('slot_key', '=', input.slotKey)
        .where('version', '=', input.expectedVersion)
        .returningAll()
        .executeTakeFirst()) as CampaignAdjustmentRow | undefined
      if (existing) return toAdjustment(existing)
      if (input.expectedVersion !== 0) return null

      const row = (await db
        .insertInto('campaign_adjustments')
        .values({
          campaign_id: input.campaignId,
          character_id: input.characterId,
          family: input.family,
          slot_key: input.slotKey,
          payload: input.payload,
          visibility: input.visibility,
          created_by: input.createdBy,
          version: 0,
          updated_at: input.updatedAt
        })
        .onConflict((conflict) =>
          conflict.columns(['campaign_id', 'character_id', 'family', 'slot_key']).doNothing()
        )
        .returningAll()
        .executeTakeFirst()) as CampaignAdjustmentRow | undefined
      return row ? toAdjustment(row) : null
    },

    async deleteAdjustmentById(input: {
      campaignId: string
      id: string
      expectedVersion: number
    }): Promise<boolean> {
      const row = await db
        .deleteFrom('campaign_adjustments')
        .where('campaign_id', '=', input.campaignId)
        .where('id', '=', input.id)
        .where('version', '=', input.expectedVersion)
        .returning('id')
        .executeTakeFirst()
      return Boolean(row)
    },

    async deleteAdjustmentBySlot(input: {
      campaignId: string
      characterId: string
      family: string
      slotKey: string
      expectedVersion: number
    }): Promise<boolean> {
      const row = await db
        .deleteFrom('campaign_adjustments')
        .where('campaign_id', '=', input.campaignId)
        .where('character_id', '=', input.characterId)
        .where('family', '=', input.family)
        .where('slot_key', '=', input.slotKey)
        .where('version', '=', input.expectedVersion)
        .returning('id')
        .executeTakeFirst()
      return Boolean(row)
    },

    async listVisibleEvents(input: {
      campaignId: string
      viewer: CampaignHistoryViewer
      cursorId?: string
      limit: number
    }): Promise<CampaignHistoryEvent[]> {
      const viewer = input.viewer
      let cursor: { created_at: RuntimeTimestamp; id: string } | undefined
      if (input.cursorId) {
        let cursorQuery = db
          .selectFrom('campaign_events')
          .select(['created_at', 'id'])
          .where('campaign_id', '=', input.campaignId)
          .where('id', '=', input.cursorId)
        if (viewer.kind === 'OWNER') {
          cursorQuery = cursorQuery.where('visibility', 'in', ['TABLE', 'OWNER'])
        } else {
          const characterId = viewer.characterId
          cursorQuery = cursorQuery.where((expressionBuilder) =>
            expressionBuilder.or([
              expressionBuilder('visibility', '=', 'TABLE'),
              expressionBuilder.and([
                expressionBuilder('visibility', '=', 'SUBJECT'),
                expressionBuilder('subject_character_id', '=', characterId)
              ])
            ])
          )
        }
        cursor = await cursorQuery.executeTakeFirst()
        if (!cursor) return []
      }

      let query = db
        .selectFrom('campaign_events')
        .selectAll()
        .where('campaign_id', '=', input.campaignId)
      if (viewer.kind === 'OWNER') {
        query = query.where('visibility', 'in', ['TABLE', 'OWNER'])
      } else {
        const characterId = viewer.characterId
        query = query.where((expressionBuilder) =>
          expressionBuilder.or([
            expressionBuilder('visibility', '=', 'TABLE'),
            expressionBuilder.and([
              expressionBuilder('visibility', '=', 'SUBJECT'),
              expressionBuilder('subject_character_id', '=', characterId)
            ])
          ])
        )
      }
      if (cursor) {
        const createdAt = toIsoString(cursor.created_at)
        query = query.where((expressionBuilder) =>
          expressionBuilder.or([
            expressionBuilder('created_at', '<', createdAt),
            expressionBuilder.and([
              expressionBuilder('created_at', '=', createdAt),
              expressionBuilder('id', '<', cursor.id)
            ])
          ])
        )
      }

      const rows = (await query
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(input.limit + 1)
        .execute()) as CampaignEventRow[]
      return rows.map(toEvent)
    },

    async insertCampaignEvent(input: {
      campaignId: string
      actorUserId: string | null
      subjectUserId?: string | null
      subjectCharacterId?: string | null
      kind: string
      visibility: CampaignEventVisibility
      payload: Json
      idempotencyKey?: string | null
    }): Promise<CampaignHistoryEvent> {
      const row = (await db
        .insertInto('campaign_events')
        .values({
          campaign_id: input.campaignId,
          actor_user_id: input.actorUserId,
          subject_user_id: input.subjectUserId ?? null,
          subject_character_id: input.subjectCharacterId ?? null,
          kind: input.kind,
          visibility: input.visibility,
          payload: input.payload,
          idempotency_key: input.idempotencyKey ?? null
        })
        .returningAll()
        .executeTakeFirstOrThrow()) as CampaignEventRow
      return toEvent(row)
    }
  }
}
