import { sql } from 'kysely'

import type { DBLike } from '#types'

import type {
  SocialBlockRecord,
  SocialContentPreference,
  SocialProfileRecord,
  SocialProfileStatus
} from './types.js'

type RawProfile = {
  id: string
  user_id: string
  username: string
  adult_attested_at: string | Date | null
  us_attested_at: string | Date | null
  content_preference: SocialContentPreference
  status: SocialProfileStatus
  version: number
  created_at: string | Date
  updated_at: string | Date
}

const mapProfile = (row: RawProfile): SocialProfileRecord => ({
  id: row.id,
  userId: row.user_id,
  username: row.username,
  adultAttestedAt: row.adult_attested_at,
  usAttestedAt: row.us_attested_at,
  contentPreference: row.content_preference,
  status: row.status,
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

export function createSocialProfileRepository(db: DBLike) {
  return {
    async findSocialProfileByUser(userId: string): Promise<SocialProfileRecord | null> {
      const result = await sql<RawProfile>`
        select social.*, account.username
        from social_profiles social
        join profiles account on account.id = social.user_id
        where social.user_id = ${userId}::uuid
      `.execute(db)
      const row = result.rows[0]
      return row ? mapProfile(row) : null
    },

    async findActiveSocialProfile(
      viewerProfileId: string,
      profileId: string
    ): Promise<SocialProfileRecord | null> {
      const result = await sql<RawProfile>`
        select social.*, account.username
        from social_profiles social
        join profiles account on account.id = social.user_id
        where social.id = ${profileId}::uuid and social.status = 'ACTIVE'
          and social.adult_attested_at is not null
          and social.us_attested_at is not null
          and not exists (
            select 1 from social_blocks block
            where (block.blocker_profile_id = ${viewerProfileId}::uuid
                and block.blocked_profile_id = social.id)
              or (block.blocker_profile_id = social.id
                and block.blocked_profile_id = ${viewerProfileId}::uuid)
          )
      `.execute(db)
      const row = result.rows[0]
      return row ? mapProfile(row) : null
    },

    async attestSocialEligibility(userId: string, now: string): Promise<SocialProfileRecord> {
      const result = await sql<RawProfile>`
        with inserted as (
          insert into social_profiles (user_id, adult_attested_at, us_attested_at)
          values (${userId}::uuid, ${now}::timestamptz, ${now}::timestamptz)
          on conflict (user_id) do update
          set adult_attested_at = coalesce(
                social_profiles.adult_attested_at,
                excluded.adult_attested_at
              ),
              us_attested_at = coalesce(social_profiles.us_attested_at, excluded.us_attested_at),
              version = social_profiles.version + 1,
              updated_at = ${now}::timestamptz
          returning *
        )
        select inserted.*, account.username
        from inserted
        join profiles account on account.id = inserted.user_id
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Failed to attest Social eligibility.')
      return mapProfile(row)
    },

    async setSocialContentPreference(
      userId: string,
      contentPreference: SocialContentPreference,
      adultAttestedAt: string | null,
      now: string
    ): Promise<SocialProfileRecord> {
      const result = await sql<RawProfile>`
        with updated as (
          insert into social_profiles (user_id, adult_attested_at, content_preference)
          values (${userId}::uuid, ${adultAttestedAt}::timestamptz, ${contentPreference})
          on conflict (user_id) do update
          set adult_attested_at = coalesce(
                social_profiles.adult_attested_at,
                excluded.adult_attested_at
              ),
              content_preference = excluded.content_preference,
              version = social_profiles.version + 1,
              updated_at = ${now}::timestamptz
          returning *
        )
        select updated.*, account.username
        from updated
        join profiles account on account.id = updated.user_id
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Failed to update Social content preference.')
      return mapProfile(row)
    },

    async hasSocialBlockEitherDirection(
      firstProfileId: string,
      secondProfileId: string
    ): Promise<boolean> {
      const result = await sql<{ blocked: boolean }>`
        select exists (
          select 1 from social_blocks block
          where (block.blocker_profile_id = ${firstProfileId}::uuid
              and block.blocked_profile_id = ${secondProfileId}::uuid)
            or (block.blocker_profile_id = ${secondProfileId}::uuid
              and block.blocked_profile_id = ${firstProfileId}::uuid)
        ) as blocked
      `.execute(db)
      return result.rows[0]?.blocked ?? false
    },

    async listSocialBlocks(profileId: string): Promise<SocialBlockRecord[]> {
      const result = await sql<{
        blocker_profile_id: string
        blocked_profile_id: string
        blocked_username: string
        created_at: string | Date
      }>`
        select block.blocker_profile_id, block.blocked_profile_id,
          account.username as blocked_username, block.created_at
        from social_blocks block
        join social_profiles blocked on blocked.id = block.blocked_profile_id
        join profiles account on account.id = blocked.user_id
        where block.blocker_profile_id = ${profileId}::uuid
        order by lower(account.username), block.blocked_profile_id
      `.execute(db)
      return result.rows.map((row) => ({
        blockerProfileId: row.blocker_profile_id,
        blockedProfileId: row.blocked_profile_id,
        blockedUsername: row.blocked_username,
        createdAt: row.created_at
      }))
    },

    async createSocialBlock(blockerProfileId: string, blockedProfileId: string): Promise<boolean> {
      const result = await sql<{ blocker_profile_id: string }>`
        insert into social_blocks (blocker_profile_id, blocked_profile_id)
        values (${blockerProfileId}::uuid, ${blockedProfileId}::uuid)
        on conflict do nothing
        returning blocker_profile_id
      `.execute(db)
      return Boolean(result.rows[0])
    },

    async removeSocialBlock(blockerProfileId: string, blockedProfileId: string): Promise<boolean> {
      const result = await sql<{ blocker_profile_id: string }>`
        delete from social_blocks
        where blocker_profile_id = ${blockerProfileId}::uuid
          and blocked_profile_id = ${blockedProfileId}::uuid
        returning blocker_profile_id
      `.execute(db)
      return Boolean(result.rows[0])
    },

    async blockPendingApplications(
      firstProfileId: string,
      secondProfileId: string,
      now: string
    ): Promise<number> {
      const result = await sql<{ id: string }>`
        update social_applications application
        set status = 'BLOCKED', blocked_at = ${now}::timestamptz,
          version = application.version + 1, updated_at = ${now}::timestamptz
        from social_listings listing, campaigns campaign, social_profiles host
        where application.listing_id = listing.id
          and listing.campaign_id = campaign.id
          and host.user_id = campaign.owner_user_id
          and application.status = 'SUBMITTED'
          and ((host.id = ${firstProfileId}::uuid
              and application.applicant_profile_id = ${secondProfileId}::uuid)
            or (host.id = ${secondProfileId}::uuid
              and application.applicant_profile_id = ${firstProfileId}::uuid))
        returning application.id
      `.execute(db)
      return result.rows.length
    }
  }
}
