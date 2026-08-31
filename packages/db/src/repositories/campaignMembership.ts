import { sql } from 'kysely'
import type { DBLike } from '#types'
import type {
  CampaignAssignmentRecord,
  CampaignCharacterRecord,
  CampaignMembershipProjection,
  CampaignMembershipRecord,
  CampaignMembershipStatus,
  CampaignRole,
  Timestamp
} from './campaignTypes.js'

export function createCampaignMembershipRepository(db: DBLike) {
  return {
    async countActiveMembers(campaignId: string): Promise<{ members: number; players: number }> {
      const result = await sql<{ members: string | number; players: string | number }>`
        select count(*) as members, count(*) filter (where role = 'PLAYER') as players
        from campaign_memberships
        where campaign_id = ${campaignId}::uuid and status = 'ACTIVE'
      `.execute(db)
      return {
        members: Number(result.rows[0]?.members ?? 0),
        players: Number(result.rows[0]?.players ?? 0)
      }
    },
    async listActiveMemberships(campaignId: string): Promise<CampaignMembershipProjection[]> {
      const result = await sql<{
        user_id: string
        username: string
        role: CampaignRole
        access_started_at: Timestamp
        joined_at: Timestamp
        character_id: string | null
        character_public_id: string | null
        character_label: string | null
        character_system_id: string | null
      }>`
        select membership.user_id, coalesce(profile.username, 'unknown') as username, membership.role,
          membership.access_started_at, membership.joined_at, character.id as character_id,
          route.public_id as character_public_id, character.label as character_label, character.system_id as character_system_id
        from campaign_memberships membership
        join profiles profile on profile.id = membership.user_id
        left join campaign_character_assignments assignment
          on assignment.campaign_id = membership.campaign_id and assignment.user_id = membership.user_id
        left join characters character on character.id = assignment.character_id
        left join authored_route_ids route
          on route.subject_kind = 'CHARACTER' and route.subject_id = character.id
        where membership.campaign_id = ${campaignId}::uuid and membership.status = 'ACTIVE'
        order by case when membership.role = 'OWNER' then 0 else 1 end, membership.joined_at, membership.user_id
      `.execute(db)
      return result.rows.map((row) => ({
        userId: row.user_id,
        username: row.username,
        role: row.role,
        accessStartedAt: row.access_started_at,
        acceptedAt: row.joined_at,
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
    async insertOwnerMembership(campaignId: string, userId: string): Promise<void> {
      await db
        .insertInto('campaign_memberships')
        .values({ campaign_id: campaignId, user_id: userId, role: 'OWNER' })
        .executeTakeFirstOrThrow()
    },
    async findMembership(
      campaignId: string,
      userId: string
    ): Promise<CampaignMembershipRecord | null> {
      const row = await db
        .selectFrom('campaign_memberships')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .where('user_id', '=', userId)
        .executeTakeFirst()
      return row
        ? {
            campaignId: row.campaign_id,
            userId: row.user_id,
            role: row.role as CampaignRole,
            status: row.status as CampaignMembershipStatus,
            accessStartedAt: row.access_started_at,
            joinedAt: row.joined_at,
            leftAt: row.left_at
          }
        : null
    },
    async lockActiveMembershipForShare(
      campaignId: string,
      userId: string
    ): Promise<CampaignMembershipRecord | null> {
      const row = await db
        .selectFrom('campaign_memberships')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .where('user_id', '=', userId)
        .where('status', '=', 'ACTIVE')
        .forShare()
        .executeTakeFirst()
      return row
        ? {
            campaignId: row.campaign_id,
            userId: row.user_id,
            role: row.role as CampaignRole,
            status: row.status as CampaignMembershipStatus,
            accessStartedAt: row.access_started_at,
            joinedAt: row.joined_at,
            leftAt: row.left_at
          }
        : null
    },
    async lockMembershipForShare(
      campaignId: string,
      userId: string
    ): Promise<CampaignMembershipRecord | null> {
      const row = await db
        .selectFrom('campaign_memberships')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .where('user_id', '=', userId)
        .forShare()
        .executeTakeFirst()
      return row
        ? {
            campaignId: row.campaign_id,
            userId: row.user_id,
            role: row.role as CampaignRole,
            status: row.status as CampaignMembershipStatus,
            accessStartedAt: row.access_started_at,
            joinedAt: row.joined_at,
            leftAt: row.left_at
          }
        : null
    },
    async lockActiveMembershipForUpdate(
      campaignId: string,
      userId: string
    ): Promise<CampaignMembershipRecord | null> {
      const row = await db
        .selectFrom('campaign_memberships')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .where('user_id', '=', userId)
        .where('status', '=', 'ACTIVE')
        .forUpdate()
        .executeTakeFirst()
      return row
        ? {
            campaignId: row.campaign_id,
            userId: row.user_id,
            role: row.role as CampaignRole,
            status: row.status as CampaignMembershipStatus,
            accessStartedAt: row.access_started_at,
            joinedAt: row.joined_at,
            leftAt: row.left_at
          }
        : null
    },
    async activatePlayerMembership(campaignId: string, userId: string, now: string): Promise<void> {
      await db
        .insertInto('campaign_memberships')
        .values({
          campaign_id: campaignId,
          user_id: userId,
          role: 'PLAYER',
          status: 'ACTIVE',
          access_started_at: now,
          joined_at: now,
          left_at: null,
          updated_at: now
        })
        .onConflict((conflict) =>
          conflict.columns(['campaign_id', 'user_id']).doUpdateSet({
            role: 'PLAYER',
            status: 'ACTIVE',
            access_started_at: now,
            joined_at: now,
            left_at: null,
            updated_at: now
          })
        )
        .executeTakeFirstOrThrow()
    },
    async leaveMembership(campaignId: string, userId: string, now: string): Promise<boolean> {
      const row = await db
        .updateTable('campaign_memberships')
        .set({ status: 'LEFT', left_at: now, updated_at: now })
        .where('campaign_id', '=', campaignId)
        .where('user_id', '=', userId)
        .where('status', '=', 'ACTIVE')
        .returning('user_id')
        .executeTakeFirst()
      return Boolean(row)
    },
    async findCharacter(characterId: string): Promise<CampaignCharacterRecord | null> {
      const result = await sql<{
        id: string
        public_id: string
        user_id: string
        label: string
        system_id: string
        primary_rules_catalogue_id: string
        status: string
      }>`
        select character.id, route.public_id, character.user_id, character.label, character.system_id, character.primary_rules_catalogue_id, character.status
        from characters character
        join authored_route_ids route on route.subject_kind = 'CHARACTER' and route.subject_id = character.id
        where character.id = ${characterId}::uuid
      `.execute(db)
      const row = result.rows[0]
      return row
        ? {
            id: row.id,
            publicId: row.public_id,
            userId: row.user_id,
            label: row.label,
            systemId: row.system_id,
            primaryRulesCatalogueId: row.primary_rules_catalogue_id,
            status: row.status
          }
        : null
    },
    async findAssignmentForUser(
      campaignId: string,
      userId: string
    ): Promise<CampaignAssignmentRecord | null> {
      const row = await db
        .selectFrom('campaign_character_assignments')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .where('user_id', '=', userId)
        .executeTakeFirst()
      return row
        ? {
            campaignId: row.campaign_id,
            characterId: row.character_id,
            userId: row.user_id,
            assignedAt: row.assigned_at
          }
        : null
    },
    async findAssignmentByCharacter(
      campaignId: string,
      characterId: string
    ): Promise<CampaignAssignmentRecord | null> {
      const row = await db
        .selectFrom('campaign_character_assignments')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .where('character_id', '=', characterId)
        .executeTakeFirst()
      return row
        ? {
            campaignId: row.campaign_id,
            characterId: row.character_id,
            userId: row.user_id,
            assignedAt: row.assigned_at
          }
        : null
    },
    async findCampaignByCharacter(characterId: string): Promise<CampaignAssignmentRecord | null> {
      const row = await db
        .selectFrom('campaign_character_assignments')
        .selectAll()
        .where('character_id', '=', characterId)
        .executeTakeFirst()
      return row
        ? {
            campaignId: row.campaign_id,
            characterId: row.character_id,
            userId: row.user_id,
            assignedAt: row.assigned_at
          }
        : null
    },
    async listAssignedSystemIdsExceptUser(campaignId: string, userId: string): Promise<string[]> {
      const rows = await db
        .selectFrom('campaign_character_assignments as assignment')
        .innerJoin('characters as character', 'character.id', 'assignment.character_id')
        .select('character.system_id')
        .distinct()
        .where('assignment.campaign_id', '=', campaignId)
        .where('assignment.user_id', '!=', userId)
        .execute()
      return rows.map((row) => row.system_id)
    },
    async deleteAssignmentForUser(campaignId: string, userId: string): Promise<string | null> {
      const row = await db
        .deleteFrom('campaign_character_assignments')
        .where('campaign_id', '=', campaignId)
        .where('user_id', '=', userId)
        .returning('character_id')
        .executeTakeFirst()
      return row?.character_id ?? null
    },
    async deleteAssignmentByCharacter(
      campaignId: string,
      characterId: string
    ): Promise<string | null> {
      const row = await db
        .deleteFrom('campaign_character_assignments')
        .where('campaign_id', '=', campaignId)
        .where('character_id', '=', characterId)
        .returning('character_id')
        .executeTakeFirst()
      return row?.character_id ?? null
    },
    async insertAssignment(campaignId: string, userId: string, characterId: string): Promise<void> {
      await db
        .insertInto('campaign_character_assignments')
        .values({ campaign_id: campaignId, user_id: userId, character_id: characterId })
        .executeTakeFirstOrThrow()
    },
    async listAssignmentCharacterIds(campaignId: string): Promise<string[]> {
      const rows = await db
        .selectFrom('campaign_character_assignments')
        .select('character_id')
        .where('campaign_id', '=', campaignId)
        .execute()
      return rows.map((row) => row.character_id)
    }
  }
}
