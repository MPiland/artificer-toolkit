import type { DBLike } from '#types'

export interface CampaignPlaySettingsRecord {
  campaignId: string
  normalCadenceDays: number | null
  expectedDurationMinutes: number | null
  quorum: number | null
  absentCharacterPolicy: string | null
  contentGuidance: string | null
  allowedContentRules: string | null
  tableConduct: string | null
  contentBoundaries: string | null
  safetyPractices: string[]
  liveSafetyMethod: string | null
  version: number
  updatedAt: string
}

function toRecord(row: Record<string, unknown>): CampaignPlaySettingsRecord {
  return {
    campaignId: String(row.campaign_id),
    normalCadenceDays: row.normal_cadence_days as number | null,
    expectedDurationMinutes: row.expected_duration_minutes as number | null,
    quorum: row.quorum as number | null,
    absentCharacterPolicy: row.absent_character_policy as string | null,
    contentGuidance: row.content_guidance as string | null,
    allowedContentRules: row.allowed_content_rules as string | null,
    tableConduct: row.table_conduct as string | null,
    contentBoundaries: row.content_boundaries as string | null,
    safetyPractices: row.safety_practices as string[],
    liveSafetyMethod: row.live_safety_method as string | null,
    version: Number(row.version),
    updatedAt: new Date(row.updated_at as string | Date).toISOString()
  }
}

export function createCampaignSettingsRepository(db: DBLike) {
  return {
    async find(campaignId: string): Promise<CampaignPlaySettingsRecord | null> {
      const row = await db
        .selectFrom('campaign_play_settings')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .executeTakeFirst()
      return row ? toRecord(row) : null
    },
    async save(
      input: Omit<CampaignPlaySettingsRecord, 'version' | 'updatedAt'> & {
        expectedVersion: number
      }
    ): Promise<CampaignPlaySettingsRecord | null> {
      const values = {
        normal_cadence_days: input.normalCadenceDays,
        expected_duration_minutes: input.expectedDurationMinutes,
        quorum: input.quorum,
        absent_character_policy: input.absentCharacterPolicy,
        content_guidance: input.contentGuidance,
        allowed_content_rules: input.allowedContentRules,
        table_conduct: input.tableConduct,
        content_boundaries: input.contentBoundaries,
        safety_practices: input.safetyPractices,
        live_safety_method: input.liveSafetyMethod
      }
      const updated = await db
        .updateTable('campaign_play_settings')
        .set((eb) => ({
          ...values,
          version: eb('version', '+', 1),
          updated_at: new Date().toISOString()
        }))
        .where('campaign_id', '=', input.campaignId)
        .where('version', '=', input.expectedVersion)
        .returningAll()
        .executeTakeFirst()
      if (updated) return toRecord(updated)
      if (input.expectedVersion !== 0) return null
      const inserted = await db
        .insertInto('campaign_play_settings')
        .values({ campaign_id: input.campaignId, ...values })
        .onConflict((oc) => oc.column('campaign_id').doNothing())
        .returningAll()
        .executeTakeFirst()
      return inserted ? toRecord(inserted) : null
    }
  }
}
