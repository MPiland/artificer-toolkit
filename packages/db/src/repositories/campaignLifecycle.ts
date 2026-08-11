import { sql } from 'kysely'
import type { DBLike } from '#types'
import { createAuthoredRouteIdRepository } from '../domains/subjects/repositories/authoredRouteId.js'
import {
  mapCampaign,
  type CampaignAuthorityRecord,
  type CampaignListRecord,
  type CampaignContentMaturity,
  type CampaignFormat,
  type CampaignMembershipStatus,
  type CampaignRecord,
  type CampaignRole,
  type CampaignStatus,
  type CampaignToneTag,
  type RawCampaignListRow,
  type RawCampaignRow,
  type Timestamp
} from './campaignTypes.js'

export function createCampaignLifecycleRepository(db: DBLike) {
  return {
    async listForActiveMember(userId: string): Promise<CampaignListRecord[]> {
      const result = await sql<RawCampaignListRow>`
        select campaign.*, campaign_route.public_id,
          membership.role,
          character.id as character_id,
          route.public_id as character_public_id,
          character.label as character_label,
          character.system_id as character_system_id,
          (select count(*) from campaign_memberships counted
            where counted.campaign_id = campaign.id and counted.status = 'ACTIVE') as member_count,
          (select count(*) from campaign_memberships counted
            where counted.campaign_id = campaign.id and counted.status = 'ACTIVE' and counted.role = 'PLAYER') as player_count
        from campaigns campaign
        join authored_route_ids campaign_route
          on campaign_route.subject_kind = 'CAMPAIGN' and campaign_route.subject_id = campaign.id
        join campaign_memberships membership on membership.campaign_id = campaign.id
        left join campaign_character_assignments assignment
          on assignment.campaign_id = campaign.id and assignment.user_id = membership.user_id
        left join characters character on character.id = assignment.character_id
        left join authored_route_ids route
          on route.subject_kind = 'CHARACTER' and route.subject_id = character.id
        where membership.user_id = ${userId}::uuid and membership.status = 'ACTIVE'
        order by case when campaign.status = 'ACTIVE' then 0 else 1 end,
          campaign.created_at desc,
          campaign.id desc
      `.execute(db)
      return result.rows.map((row) => ({
        ...mapCampaign(row),
        role: row.role,
        memberCount: Number(row.member_count),
        playerCount: Number(row.player_count),
        assignedCharacter:
          row.character_id &&
          row.character_public_id &&
          row.character_label &&
          row.character_system_id
            ? {
                id: row.character_id,
                publicId: row.character_public_id,
                label: row.character_label,
                systemId: row.character_system_id
              }
            : null
      }))
    },
    async findAuthority(
      campaignId: string,
      userId: string
    ): Promise<CampaignAuthorityRecord | null> {
      const result = await sql<
        RawCampaignRow & {
          membership_role: CampaignRole
          membership_status: CampaignMembershipStatus
          access_started_at: Timestamp
          joined_at: Timestamp
          left_at: Timestamp | null
          character_id: string | null
          character_public_id: string | null
          character_label: string | null
          character_system_id: string | null
        }
      >`
        select campaign.*, campaign_route.public_id,
          membership.role as membership_role, membership.status as membership_status,
          membership.access_started_at, membership.joined_at, membership.left_at,
          character.id as character_id, route.public_id as character_public_id,
          character.label as character_label, character.system_id as character_system_id
        from campaigns campaign
        join authored_route_ids campaign_route
          on campaign_route.subject_kind = 'CAMPAIGN' and campaign_route.subject_id = campaign.id
        join campaign_memberships membership on membership.campaign_id = campaign.id
        left join campaign_character_assignments assignment
          on assignment.campaign_id = campaign.id and assignment.user_id = membership.user_id
        left join characters character on character.id = assignment.character_id
        left join authored_route_ids route
          on route.subject_kind = 'CHARACTER' and route.subject_id = character.id
        where campaign.id = ${campaignId}::uuid and membership.user_id = ${userId}::uuid
      `.execute(db)
      const row = result.rows[0]
      if (!row) return null
      return {
        campaign: mapCampaign(row),
        membership: {
          campaignId: row.id,
          userId,
          role: row.membership_role,
          status: row.membership_status,
          accessStartedAt: row.access_started_at,
          joinedAt: row.joined_at,
          leftAt: row.left_at
        },
        assignedCharacter:
          row.character_id &&
          row.character_public_id &&
          row.character_label &&
          row.character_system_id
            ? {
                id: row.character_id,
                publicId: row.character_public_id,
                label: row.character_label,
                systemId: row.character_system_id
              }
            : null
      }
    },
    async lockCampaign(campaignId: string): Promise<CampaignRecord | null> {
      const row = await db
        .selectFrom('campaigns')
        .selectAll()
        .where('id', '=', campaignId)
        .forUpdate()
        .executeTakeFirst()
      const route = row
        ? await createAuthoredRouteIdRepository(db).findBySubject({
            subjectKind: 'CAMPAIGN',
            subjectId: campaignId
          })
        : null
      return row && route
        ? mapCampaign({
            ...row,
            public_id: route.publicId,
            status: row.status as CampaignStatus
          })
        : null
    },
    async countActiveOwned(userId: string): Promise<number> {
      const result = await sql<{
        count: string | number
      }>`select count(*) as count from campaigns where owner_user_id = ${userId}::uuid and status = 'ACTIVE'`.execute(
        db
      )
      return Number(result.rows[0]?.count ?? 0)
    },
    async createCampaign(
      ownerUserId: string,
      input: {
        name: string
        description: string | null
        format: CampaignFormat
        tone_tags: CampaignToneTag[]
        tone_details: string | null
        content_maturity: CampaignContentMaturity
        attunement_slot_override?: number | null
      }
    ): Promise<CampaignRecord> {
      const row = await db
        .insertInto('campaigns')
        .values({ owner_user_id: ownerUserId, ...input })
        .returningAll()
        .executeTakeFirstOrThrow()
      const route = await createAuthoredRouteIdRepository(db).ensure({
        subjectKind: 'CAMPAIGN',
        subjectId: row.id
      })
      return mapCampaign({
        ...row,
        public_id: route.publicId,
        status: row.status as CampaignStatus
      })
    },
    async updateCampaign(
      campaignId: string,
      expectedVersion: number,
      input: {
        name?: string
        description?: string | null
        format?: CampaignFormat
        tone_tags?: CampaignToneTag[]
        tone_details?: string | null
        content_maturity?: CampaignContentMaturity
        attunement_slot_override?: number | null
      }
    ): Promise<CampaignRecord | null> {
      const row = await db
        .updateTable('campaigns')
        .set({ ...input, version: sql<number>`version + 1`, updated_at: new Date().toISOString() })
        .where('id', '=', campaignId)
        .where('version', '=', expectedVersion)
        .returningAll()
        .executeTakeFirst()
      const route = row
        ? await createAuthoredRouteIdRepository(db).findBySubject({
            subjectKind: 'CAMPAIGN',
            subjectId: campaignId
          })
        : null
      return row && route
        ? mapCampaign({
            ...row,
            public_id: route.publicId,
            status: row.status as CampaignStatus
          })
        : null
    },
    async archiveCampaign(
      campaignId: string,
      expectedVersion: number
    ): Promise<CampaignRecord | null> {
      const row = await db
        .updateTable('campaigns')
        .set({
          status: 'ARCHIVED',
          version: sql<number>`version + 1`,
          updated_at: new Date().toISOString()
        })
        .where('id', '=', campaignId)
        .where('version', '=', expectedVersion)
        .returningAll()
        .executeTakeFirst()
      const route = row
        ? await createAuthoredRouteIdRepository(db).findBySubject({
            subjectKind: 'CAMPAIGN',
            subjectId: campaignId
          })
        : null
      if (row) {
        const now = new Date().toISOString()
        await sql`
          update social_listings
          set status = 'CLOSED', version = version + 1, updated_at = ${now}::timestamptz
          where campaign_id = ${campaignId}::uuid and status <> 'CLOSED'
        `.execute(db)
        await sql`
          update social_applications application
          set status = 'EXPIRED', expired_at = ${now}::timestamptz,
            version = version + 1, updated_at = ${now}::timestamptz
          from social_listings listing
          where listing.campaign_id = ${campaignId}::uuid
            and application.listing_id = listing.id and application.status = 'SUBMITTED'
        `.execute(db)
        await sql`
          update campaign_invites invite
          set status = 'EXPIRED', expired_at = ${now}::timestamptz,
            version = version + 1, updated_at = ${now}::timestamptz
          from social_listings listing
          where listing.campaign_id = ${campaignId}::uuid
            and invite.listing_id = listing.id and invite.status = 'PENDING'
        `.execute(db)
      }
      return row && route
        ? mapCampaign({
            ...row,
            public_id: route.publicId,
            status: row.status as CampaignStatus
          })
        : null
    },
    async deleteCampaign(campaignId: string, expectedVersion: number): Promise<boolean> {
      const result = await db
        .deleteFrom('campaigns')
        .where('id', '=', campaignId)
        .where('version', '=', expectedVersion)
        .returning('id')
        .executeTakeFirst()
      if (result)
        await createAuthoredRouteIdRepository(db).delete({
          subjectKind: 'CAMPAIGN',
          subjectId: campaignId
        })
      return Boolean(result)
    }
  }
}
