import type { DBLike } from '#types'

export interface CampaignAnnouncementRecord {
  id: string
  campaignId: string
  commandId: string
  inputFingerprint: string
  authorUserId: string
  scope: 'TABLE' | 'PARTY'
  partyId: string | null
  title: string
  body: string
  createdAt: string
}
function toRecord(row: Record<string, unknown>): CampaignAnnouncementRecord {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    commandId: String(row.command_id),
    inputFingerprint: String(row.input_fingerprint),
    authorUserId: String(row.author_user_id),
    scope: row.scope as CampaignAnnouncementRecord['scope'],
    partyId: row.party_id as string | null,
    title: String(row.title),
    body: String(row.body),
    createdAt: new Date(row.created_at as string | Date).toISOString()
  }
}
export function createCampaignAnnouncementRepository(db: DBLike) {
  return {
    async list(campaignId: string) {
      return (
        await db
          .selectFrom('campaign_announcements')
          .selectAll()
          .where('campaign_id', '=', campaignId)
          .orderBy('created_at', 'desc')
          .orderBy('id', 'desc')
          .execute()
      ).map(toRecord)
    },
    async find(campaignId: string, id: string) {
      const row = await db
        .selectFrom('campaign_announcements')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .where('id', '=', id)
        .executeTakeFirst()
      return row ? toRecord(row) : null
    },
    async findByCommand(campaignId: string, commandId: string) {
      const row = await db
        .selectFrom('campaign_announcements')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .where('command_id', '=', commandId)
        .executeTakeFirst()
      return row ? toRecord(row) : null
    },
    async insert(input: Omit<CampaignAnnouncementRecord, 'id' | 'createdAt'>) {
      return toRecord(
        await db
          .insertInto('campaign_announcements')
          .values({
            campaign_id: input.campaignId,
            command_id: input.commandId,
            input_fingerprint: input.inputFingerprint,
            author_user_id: input.authorUserId,
            scope: input.scope,
            party_id: input.partyId,
            title: input.title,
            body: input.body
          })
          .returningAll()
          .executeTakeFirstOrThrow()
      )
    }
  }
}
