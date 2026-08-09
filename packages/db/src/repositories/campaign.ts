import { sql } from 'kysely'
import type { DBLike } from '#types'
import { createAuthoredRouteIdRepository } from '../domains/subjects/repositories/authoredRouteId.js'

export type CampaignRole = 'OWNER' | 'PLAYER'
export type CampaignStatus = 'ACTIVE' | 'ARCHIVED'
export type CampaignVisibility = 'PRIVATE' | 'PUBLIC'
export type CampaignMembershipStatus = 'ACTIVE' | 'LEFT'
export type CampaignInviteKind = 'LINK' | 'USERNAME' | 'EMAIL'

type Timestamp = string | Date

export interface CampaignRecord {
  id: string
  publicId: string
  ownerUserId: string
  name: string
  description: string | null
  attunementSlotOverride: number | null
  status: CampaignStatus
  visibility: CampaignVisibility
  version: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface CampaignListRecord extends CampaignRecord {
  role: CampaignRole
  memberCount: number
  playerCount: number
  assignedCharacter: Omit<CampaignCharacterRecord, 'userId' | 'status'> | null
}

export interface CampaignMembershipRecord {
  campaignId: string
  userId: string
  role: CampaignRole
  status: CampaignMembershipStatus
  accessStartedAt: Timestamp
  joinedAt: Timestamp
  leftAt: Timestamp | null
}

export interface CampaignCharacterRecord {
  id: string
  publicId: string
  userId: string
  label: string
  systemId: string
  status: string
}

export interface CampaignAssignmentRecord {
  campaignId: string
  characterId: string
  userId: string
  assignedAt: Timestamp
}

export interface CampaignAuthorityRecord {
  campaign: CampaignRecord
  membership: CampaignMembershipRecord
  assignedCharacter: Omit<CampaignCharacterRecord, 'userId' | 'status'> | null
}

export interface CampaignMembershipProjection {
  userId: string
  username: string
  role: CampaignRole
  accessStartedAt: Timestamp
  acceptedAt: Timestamp
  assignedCharacter: Omit<CampaignCharacterRecord, 'userId' | 'status'> | null
}

export interface CampaignInviteRecord {
  id: string
  campaignId: string
  createdBy: string
  kind: CampaignInviteKind
  targetUserId: string | null
  targetEmail: string | null
  expiresAt: Timestamp
  revokedAt: Timestamp | null
  createdAt: Timestamp
}

export interface CampaignOwnershipTransferRecord {
  campaignId: string
  fromUserId: string
  toUserId: string
  expiresAt: Timestamp
}

interface RawCampaignRow {
  id: string
  public_id: string
  owner_user_id: string
  name: string
  description: string | null
  attunement_slot_override?: number | null
  status: CampaignStatus
  visibility: CampaignVisibility
  version: number
  created_at: Timestamp
  updated_at: Timestamp
}

interface RawCampaignListRow extends RawCampaignRow {
  role: CampaignRole
  member_count: string | number
  player_count: string | number
  character_id: string | null
  character_public_id: string | null
  character_label: string | null
  character_system_id: string | null
}

function mapCampaign(row: RawCampaignRow): CampaignRecord {
  return {
    id: row.id,
    publicId: row.public_id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    description: row.description,
    attunementSlotOverride: row.attunement_slot_override ?? null,
    status: row.status,
    visibility: row.visibility,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function createCampaignRepository(db: DBLike) {
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
          campaign.updated_at desc,
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
          membership.role as membership_role,
          membership.status as membership_status,
          membership.access_started_at,
          membership.joined_at,
          membership.left_at,
          character.id as character_id,
          route.public_id as character_public_id,
          character.label as character_label,
          character.system_id as character_system_id
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
            status: row.status as CampaignStatus,
            visibility: row.visibility as CampaignVisibility
          })
        : null
    },

    async countActiveOwned(userId: string): Promise<number> {
      const result = await sql<{ count: string | number }>`
        select count(*) as count from campaigns
        where owner_user_id = ${userId}::uuid and status = 'ACTIVE'
      `.execute(db)
      return Number(result.rows[0]?.count ?? 0)
    },

    async countPublicOwned(userId: string): Promise<number> {
      const result = await sql<{ count: string | number }>`
        select count(*) as count from campaigns
        where owner_user_id = ${userId}::uuid and status = 'ACTIVE' and visibility = 'PUBLIC'
      `.execute(db)
      return Number(result.rows[0]?.count ?? 0)
    },

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
        select membership.user_id,
          coalesce(profile.username, 'unknown') as username,
          membership.role,
          membership.access_started_at,
          membership.joined_at,
          character.id as character_id,
          route.public_id as character_public_id,
          character.label as character_label,
          character.system_id as character_system_id
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

    async createCampaign(
      ownerUserId: string,
      input: { name: string; description: string | null; visibility: CampaignVisibility }
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
        status: row.status as CampaignStatus,
        visibility: row.visibility as CampaignVisibility
      })
    },

    async updateCampaign(
      campaignId: string,
      expectedVersion: number,
      input: {
        name?: string
        description?: string | null
        attunement_slot_override?: number | null
        visibility?: CampaignVisibility
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
            status: row.status as CampaignStatus,
            visibility: row.visibility as CampaignVisibility
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
      return row && route
        ? mapCampaign({
            ...row,
            public_id: route.publicId,
            status: row.status as CampaignStatus,
            visibility: row.visibility as CampaignVisibility
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
      if (result) {
        await createAuthoredRouteIdRepository(db).delete({
          subjectKind: 'CAMPAIGN',
          subjectId: campaignId
        })
      }
      return Boolean(result)
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
        status: string
      }>`
        select character.id, route.public_id, character.user_id, character.label,
          character.system_id, character.status
        from characters character
        join authored_route_ids route
          on route.subject_kind = 'CHARACTER' and route.subject_id = character.id
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
    },

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
      const result = await sql<{
        id: string
        campaign_id: string
        created_by: string
        kind: CampaignInviteKind
        target_user_id: string | null
        target_email: string | null
        expires_at: Timestamp
        revoked_at: Timestamp | null
        created_at: Timestamp
      }>`
        insert into campaign_invites
          (campaign_id, created_by, kind, token_digest, target_user_id, target_email, expires_at)
        values (
          ${input.campaignId}::uuid,
          ${input.createdBy}::uuid,
          ${input.kind},
          ${input.tokenDigest},
          ${input.targetUserId}::uuid,
          ${input.targetEmail},
          ${input.expiresAt}::timestamptz
        )
        returning id, campaign_id, created_by, kind, target_user_id, target_email, expires_at, revoked_at, created_at
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Failed to create Campaign invite.')
      return {
        id: row.id,
        campaignId: row.campaign_id,
        createdBy: row.created_by,
        kind: row.kind,
        targetUserId: row.target_user_id,
        targetEmail: row.target_email,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
        createdAt: row.created_at
      }
    },

    async lockInviteByDigest(tokenDigest: Uint8Array): Promise<CampaignInviteRecord | null> {
      const result = await sql<{
        id: string
        campaign_id: string
        created_by: string
        kind: CampaignInviteKind
        target_user_id: string | null
        target_email: string | null
        expires_at: Timestamp
        revoked_at: Timestamp | null
        created_at: Timestamp
      }>`
        select id, campaign_id, created_by, kind, target_user_id, target_email, expires_at, revoked_at, created_at
        from campaign_invites
        where token_digest = ${tokenDigest}
        for update
      `.execute(db)
      const row = result.rows[0]
      return row
        ? {
            id: row.id,
            campaignId: row.campaign_id,
            createdBy: row.created_by,
            kind: row.kind,
            targetUserId: row.target_user_id,
            targetEmail: row.target_email,
            expiresAt: row.expires_at,
            revokedAt: row.revoked_at,
            createdAt: row.created_at
          }
        : null
    },

    async findInviteCampaignId(tokenDigest: Uint8Array): Promise<string | null> {
      const result = await sql<{ campaign_id: string }>`
        select campaign_id from campaign_invites where token_digest = ${tokenDigest}
      `.execute(db)
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
      const result = await sql<{ email: string | null }>`
        select lower(email) as email from auth.users where id = ${userId}::uuid
      `.execute(db)
      return result.rows[0]?.email ?? null
    },

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
