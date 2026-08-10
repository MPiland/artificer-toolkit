import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { CampaignOwnershipTransferRecord, CampaignRole } from './campaignTypes.js'

export function createCampaignOwnershipTransferRepository(db: DBLike) {
  return {
    async upsertOwnershipTransfer(input: {
      campaignId: string
      fromUserId: string
      toUserId: string
      expiresAt: string
    }): Promise<void> {
      await db
        .insertInto('campaign_ownership_transfers')
        .values({
          campaign_id: input.campaignId,
          from_user_id: input.fromUserId,
          to_user_id: input.toUserId,
          expires_at: input.expiresAt
        })
        .onConflict((conflict) =>
          conflict.column('campaign_id').doUpdateSet({
            from_user_id: input.fromUserId,
            to_user_id: input.toUserId,
            expires_at: input.expiresAt,
            created_at: new Date().toISOString()
          })
        )
        .executeTakeFirstOrThrow()
    },
    async findOwnershipTransfer(
      campaignId: string
    ): Promise<CampaignOwnershipTransferRecord | null> {
      const row = await db
        .selectFrom('campaign_ownership_transfers')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .executeTakeFirst()
      return row
        ? {
            campaignId: row.campaign_id,
            fromUserId: row.from_user_id,
            toUserId: row.to_user_id,
            expiresAt: row.expires_at
          }
        : null
    },
    async setMembershipRoleAndAccess(
      campaignId: string,
      userId: string,
      role: CampaignRole,
      now: string
    ): Promise<boolean> {
      const row = await db
        .updateTable('campaign_memberships')
        .set({ role, access_started_at: now, updated_at: now })
        .where('campaign_id', '=', campaignId)
        .where('user_id', '=', userId)
        .where('status', '=', 'ACTIVE')
        .returning('user_id')
        .executeTakeFirst()
      return Boolean(row)
    },
    async updateCampaignOwner(
      campaignId: string,
      ownerUserId: string,
      expectedVersion: number
    ): Promise<boolean> {
      const row = await db
        .updateTable('campaigns')
        .set({
          owner_user_id: ownerUserId,
          version: sql<number>`version + 1`,
          updated_at: new Date().toISOString()
        })
        .where('id', '=', campaignId)
        .where('version', '=', expectedVersion)
        .returning('id')
        .executeTakeFirst()
      return Boolean(row)
    },
    async deleteOwnershipTransfer(campaignId: string): Promise<void> {
      await db
        .deleteFrom('campaign_ownership_transfers')
        .where('campaign_id', '=', campaignId)
        .executeTakeFirst()
    }
  }
}
