import type { DBLike } from '#types'

export interface CampaignVehicleRecord {
  id: string
  campaignId: string
  contentVersionId: string
  label: string | null
  version: number
  createdAt: string
  updatedAt: string
}
function toRecord(row: Record<string, unknown>): CampaignVehicleRecord {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    contentVersionId: String(row.content_version_id),
    label: row.label as string | null,
    version: Number(row.version),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString()
  }
}
export function createCampaignVehicleRepository(db: DBLike) {
  return {
    async list(campaignId: string) {
      return (
        await db
          .selectFrom('campaign_vehicles')
          .selectAll()
          .where('campaign_id', '=', campaignId)
          .orderBy('created_at')
          .orderBy('id')
          .execute()
      ).map(toRecord)
    },
    async find(campaignId: string, id: string) {
      const row = await db
        .selectFrom('campaign_vehicles')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .where('id', '=', id)
        .executeTakeFirst()
      return row ? toRecord(row) : null
    },
    async insert(input: { campaignId: string; contentVersionId: string; label: string | null }) {
      return toRecord(
        await db
          .insertInto('campaign_vehicles')
          .values({
            campaign_id: input.campaignId,
            content_version_id: input.contentVersionId,
            label: input.label
          })
          .returningAll()
          .executeTakeFirstOrThrow()
      )
    },
    async update(input: {
      campaignId: string
      id: string
      label: string | null
      expectedVersion: number
    }) {
      const row = await db
        .updateTable('campaign_vehicles')
        .set((eb) => ({
          label: input.label,
          version: eb('version', '+', 1),
          updated_at: new Date().toISOString()
        }))
        .where('campaign_id', '=', input.campaignId)
        .where('id', '=', input.id)
        .where('version', '=', input.expectedVersion)
        .returningAll()
        .executeTakeFirst()
      return row ? toRecord(row) : null
    },
    async delete(input: { campaignId: string; id: string; expectedVersion: number }) {
      return Boolean(
        await db
          .deleteFrom('campaign_vehicles')
          .where('campaign_id', '=', input.campaignId)
          .where('id', '=', input.id)
          .where('version', '=', input.expectedVersion)
          .returning('id')
          .executeTakeFirst()
      )
    }
  }
}
