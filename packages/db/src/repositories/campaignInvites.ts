import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { CampaignInviteKind, CampaignInviteRecord, Timestamp } from './campaignTypes.js'

type RawInvite = {
  id: string
  campaign_id: string
  created_by: string
  kind: CampaignInviteKind
  target_user_id: string | null
  target_email: string | null
  expires_at: Timestamp
  revoked_at: Timestamp | null
  created_at: Timestamp
}
const mapInvite = (row: RawInvite): CampaignInviteRecord => ({
  id: row.id,
  campaignId: row.campaign_id,
  createdBy: row.created_by,
  kind: row.kind,
  targetUserId: row.target_user_id,
  targetEmail: row.target_email,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at,
  createdAt: row.created_at
})

export function createCampaignInviteRepository(db: DBLike) {
  return {
    async revokeActiveLink(campaignId: string, now: string): Promise<void> {
      await db
        .updateTable('campaign_invites')
        .set({ revoked_at: now, updated_at: now })
        .where('campaign_id', '=', campaignId)
        .where('kind', '=', 'LINK')
        .where('revoked_at', 'is', null)
        .execute()
    },
    async insertInvite(input: {
      campaignId: string
      createdBy: string
      kind: CampaignInviteKind
      tokenDigest: Uint8Array
      targetUserId: string | null
      targetEmail: string | null
      expiresAt: string
    }): Promise<CampaignInviteRecord> {
      const result = await sql<RawInvite>`
        insert into campaign_invites (campaign_id, created_by, kind, token_digest, target_user_id, target_email, expires_at)
        values (${input.campaignId}::uuid, ${input.createdBy}::uuid, ${input.kind}, ${input.tokenDigest}, ${input.targetUserId}::uuid, ${input.targetEmail}, ${input.expiresAt}::timestamptz)
        returning id, campaign_id, created_by, kind, target_user_id, target_email, expires_at, revoked_at, created_at
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Failed to create Campaign invite.')
      return mapInvite(row)
    },
    async lockInviteByDigest(tokenDigest: Uint8Array): Promise<CampaignInviteRecord | null> {
      const result = await sql<RawInvite>`
        select id, campaign_id, created_by, kind, target_user_id, target_email, expires_at, revoked_at, created_at
        from campaign_invites where token_digest = ${tokenDigest} for update
      `.execute(db)
      const row = result.rows[0]
      return row ? mapInvite(row) : null
    },
    async findInviteCampaignId(tokenDigest: Uint8Array): Promise<string | null> {
      const result = await sql<{
        campaign_id: string
      }>`select campaign_id from campaign_invites where token_digest = ${tokenDigest}`.execute(db)
      return result.rows[0]?.campaign_id ?? null
    },
    async revokeInvite(campaignId: string, inviteId: string, now: string): Promise<boolean> {
      const row = await db
        .updateTable('campaign_invites')
        .set({ revoked_at: now, updated_at: now })
        .where('campaign_id', '=', campaignId)
        .where('id', '=', inviteId)
        .where('revoked_at', 'is', null)
        .returning('id')
        .executeTakeFirst()
      return Boolean(row)
    },
    async getAuthEmail(userId: string): Promise<string | null> {
      const result = await sql<{
        email: string | null
      }>`select lower(email) as email from auth.users where id = ${userId}::uuid`.execute(db)
      return result.rows[0]?.email ?? null
    }
  }
}
