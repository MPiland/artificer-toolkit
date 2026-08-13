import type { DBLike } from '#types'

export interface CampaignAttachmentRecord {
  id: string
  campaignId: string
  assetId: string
  uploaderUserId: string
  displayName: string
  description: string | null
  profile: 'CAMPAIGN_FILE' | 'CAMPAIGN_HANDOUT_MAP'
  sessionId: string | null
  noteSectionId: string | null
  createdAt: string
}
function toRecord(row: Record<string, unknown>): CampaignAttachmentRecord {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    assetId: String(row.asset_id),
    uploaderUserId: String(row.uploader_user_id),
    displayName: String(row.display_name),
    description: row.description as string | null,
    profile: row.profile as CampaignAttachmentRecord['profile'],
    sessionId: row.session_id as string | null,
    noteSectionId: row.note_section_id as string | null,
    createdAt: new Date(row.created_at as string | Date).toISOString()
  }
}
export function createCampaignAttachmentRepository(db: DBLike) {
  return {
    async list(campaignId: string) {
      return (
        await db
          .selectFrom('campaign_attachments')
          .selectAll()
          .where('campaign_id', '=', campaignId)
          .orderBy('created_at', 'desc')
          .orderBy('id', 'desc')
          .execute()
      ).map(toRecord)
    },
    async find(campaignId: string, id: string) {
      const row = await db
        .selectFrom('campaign_attachments')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .where('id', '=', id)
        .executeTakeFirst()
      return row ? toRecord(row) : null
    },
    async insert(
      input: Omit<CampaignAttachmentRecord, 'id' | 'profile' | 'createdAt'> & {
        profile: CampaignAttachmentRecord['profile']
      }
    ) {
      return toRecord(
        await db
          .insertInto('campaign_attachments')
          .values({
            campaign_id: input.campaignId,
            asset_id: input.assetId,
            uploader_user_id: input.uploaderUserId,
            display_name: input.displayName,
            description: input.description,
            profile: input.profile,
            session_id: input.sessionId,
            note_section_id: input.noteSectionId
          })
          .returningAll()
          .executeTakeFirstOrThrow()
      )
    },
    async delete(campaignId: string, id: string) {
      return Boolean(
        await db
          .deleteFrom('campaign_attachments')
          .where('campaign_id', '=', campaignId)
          .where('id', '=', id)
          .returning('id')
          .executeTakeFirst()
      )
    }
  }
}
