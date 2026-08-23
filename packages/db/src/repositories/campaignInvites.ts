import { sql } from 'kysely'

import type { DBLike } from '#types'

import type {
  CampaignContentMaturity,
  CampaignInviteProjection,
  CampaignInviteRecipientRecord,
  CampaignInviteRecord,
  CampaignInviteStatus,
  Timestamp
} from './campaignTypes.js'

type RawInvite = {
  id: string
  listing_id: string
  campaign_id: string
  created_by: string
  recipient_user_id: string
  recipient_username: string
  listing_version: number
  status: CampaignInviteStatus
  expires_at: Timestamp
  responded_at: Timestamp | null
  revoked_at: Timestamp | null
  expired_at: Timestamp | null
  version: number
  created_at: Timestamp
  updated_at: Timestamp
}

type RawInviteProjection = RawInvite & {
  listing_title: string
  content_maturity: CampaignContentMaturity
  host_profile_id: string
  host_username: string
}

const inviteColumns = sql`
  invite.id, invite.listing_id, listing.campaign_id, invite.created_by,
  invite.recipient_user_id, invite.recipient_username, invite.listing_version,
  invite.status, invite.expires_at, invite.responded_at, invite.revoked_at,
  invite.expired_at, invite.version, invite.created_at, invite.updated_at
`

function mapInvite(row: RawInvite): CampaignInviteRecord {
  return {
    id: row.id,
    listingId: row.listing_id,
    campaignId: row.campaign_id,
    createdBy: row.created_by,
    recipientUserId: row.recipient_user_id,
    recipientUsername: row.recipient_username,
    listingVersion: row.listing_version,
    status: row.status,
    expiresAt: row.expires_at,
    respondedAt: row.responded_at,
    revokedAt: row.revoked_at,
    expiredAt: row.expired_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapInviteProjection(row: RawInviteProjection): CampaignInviteProjection {
  return {
    ...mapInvite(row),
    listingTitle: row.listing_title,
    contentMaturity: row.content_maturity,
    hostProfileId: row.host_profile_id,
    hostUsername: row.host_username
  }
}

export function createCampaignInviteRepository(db: DBLike) {
  return {
    async findInviteRecipientByUsername(
      username: string
    ): Promise<CampaignInviteRecipientRecord | null> {
      const result = await sql<{
        user_id: string
        profile_id: string
        username: string
        status: 'ACTIVE' | 'SUSPENDED'
      }>`
        select account.id as user_id, social.id as profile_id, account.username, social.status
        from profiles account
        join social_profiles social on social.user_id = account.id
        where lower(account.username) = lower(${username})
      `.execute(db)
      const row = result.rows[0]
      return row
        ? {
            userId: row.user_id,
            profileId: row.profile_id,
            username: row.username,
            status: row.status
          }
        : null
    },

    async insertInvite(input: {
      listingId: string
      createdBy: string
      recipientUserId: string
      recipientUsername: string
      listingVersion: number
      expiresAt: string
    }): Promise<CampaignInviteRecord> {
      const result = await sql<RawInvite>`
        with inserted as (
          insert into campaign_invites (
            listing_id, created_by, recipient_user_id, recipient_username,
            listing_version, expires_at
          ) values (
            ${input.listingId}::uuid, ${input.createdBy}::uuid,
            ${input.recipientUserId}::uuid, ${input.recipientUsername},
            ${input.listingVersion}, ${input.expiresAt}::timestamptz
          )
          returning *
        )
        select inserted.*, listing.campaign_id
        from inserted
        join social_listings listing on listing.id = inserted.listing_id
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Failed to create Campaign invitation.')
      return mapInvite(row)
    },

    async findInviteById(inviteId: string): Promise<CampaignInviteRecord | null> {
      const result = await sql<RawInvite>`
        select ${inviteColumns}
        from campaign_invites invite
        join social_listings listing on listing.id = invite.listing_id
        where invite.id = ${inviteId}::uuid
      `.execute(db)
      const row = result.rows[0]
      return row ? mapInvite(row) : null
    },

    async lockInvite(inviteId: string): Promise<CampaignInviteRecord | null> {
      const result = await sql<RawInvite>`
        select ${inviteColumns}
        from campaign_invites invite
        join social_listings listing on listing.id = invite.listing_id
        where invite.id = ${inviteId}::uuid
        for update of invite
      `.execute(db)
      const row = result.rows[0]
      return row ? mapInvite(row) : null
    },

    async listReceivedInvites(userId: string): Promise<CampaignInviteProjection[]> {
      const result = await sql<RawInviteProjection>`
        select ${inviteColumns}, listing.title as listing_title,
          listing.content_maturity,
          host_social.id as host_profile_id, host_account.username as host_username
        from campaign_invites invite
        join social_listings listing on listing.id = invite.listing_id
        join campaigns campaign on campaign.id = listing.campaign_id
        join social_profiles host_social on host_social.user_id = campaign.owner_user_id
        join profiles host_account on host_account.id = campaign.owner_user_id
        where invite.recipient_user_id = ${userId}::uuid
        order by case invite.status when 'PENDING' then 0 else 1 end,
          invite.created_at desc, invite.id desc
      `.execute(db)
      return result.rows.map(mapInviteProjection)
    },

    async expireDueReceivedInvites(userId: string, now: string): Promise<string[]> {
      const result = await sql<{ id: string }>`
        update campaign_invites
        set status = 'EXPIRED', expired_at = ${now}::timestamptz,
          version = version + 1, updated_at = ${now}::timestamptz
        where recipient_user_id = ${userId}::uuid
          and status = 'PENDING' and expires_at <= ${now}::timestamptz
        returning id
      `.execute(db)
      return result.rows.map((row) => row.id)
    },

    async expireDueInvites(now: string, limit: number): Promise<string[]> {
      const result = await sql<{ id: string }>`
        with due as (
          select id from campaign_invites
          where status = 'PENDING' and expires_at <= ${now}::timestamptz
          order by expires_at, id
          for update skip locked
          limit ${limit}
        )
        update campaign_invites invite
        set status = 'EXPIRED', expired_at = ${now}::timestamptz,
          version = invite.version + 1, updated_at = ${now}::timestamptz
        from due
        where invite.id = due.id
        returning invite.id
      `.execute(db)
      return result.rows.map((row) => row.id)
    },

    async listInvitesForListing(listingId: string): Promise<CampaignInviteProjection[]> {
      const result = await sql<RawInviteProjection>`
        select ${inviteColumns}, listing.title as listing_title,
          listing.content_maturity,
          host_social.id as host_profile_id, host_account.username as host_username
        from campaign_invites invite
        join social_listings listing on listing.id = invite.listing_id
        join campaigns campaign on campaign.id = listing.campaign_id
        join social_profiles host_social on host_social.user_id = campaign.owner_user_id
        join profiles host_account on host_account.id = campaign.owner_user_id
        where invite.listing_id = ${listingId}::uuid
        order by case invite.status when 'PENDING' then 0 else 1 end,
          invite.created_at desc, invite.id desc
      `.execute(db)
      return result.rows.map(mapInviteProjection)
    },

    async setInviteStatus(input: {
      inviteId: string
      expectedVersion: number
      status: Exclude<CampaignInviteStatus, 'PENDING'>
      now: string
    }): Promise<CampaignInviteRecord | null> {
      const timestampColumn =
        input.status === 'REVOKED'
          ? sql`revoked_at`
          : input.status === 'EXPIRED'
            ? sql`expired_at`
            : sql`responded_at`
      const result = await sql<RawInvite>`
        with updated as (
          update campaign_invites
          set status = ${input.status}, ${timestampColumn} = ${input.now}::timestamptz,
            version = version + 1, updated_at = ${input.now}::timestamptz
          where id = ${input.inviteId}::uuid and version = ${input.expectedVersion}
            and status = 'PENDING'
          returning *
        )
        select updated.*, listing.campaign_id
        from updated
        join social_listings listing on listing.id = updated.listing_id
      `.execute(db)
      const row = result.rows[0]
      return row ? mapInvite(row) : null
    },

    async expirePendingInvites(listingId: string, now: string): Promise<string[]> {
      const result = await sql<{ id: string }>`
        update campaign_invites
        set status = 'EXPIRED', expired_at = ${now}::timestamptz,
          version = version + 1, updated_at = ${now}::timestamptz
        where listing_id = ${listingId}::uuid and status = 'PENDING'
        returning id
      `.execute(db)
      return result.rows.map((row) => row.id)
    },

    async advancePendingInviteListingVersions(
      listingId: string,
      listingVersion: number,
      now: string
    ): Promise<number> {
      const result = await sql<{ id: string }>`
        update campaign_invites
        set listing_version = ${listingVersion}, version = version + 1,
          updated_at = ${now}::timestamptz
        where listing_id = ${listingId}::uuid and status = 'PENDING'
        returning id
      `.execute(db)
      return result.rows.length
    },

    async revokePendingInviteForProfiles(
      firstProfileId: string,
      secondProfileId: string,
      now: string
    ): Promise<string[]> {
      const result = await sql<{ id: string }>`
        update campaign_invites invite
        set status = 'REVOKED', revoked_at = ${now}::timestamptz,
          version = invite.version + 1, updated_at = ${now}::timestamptz
        from social_listings listing, campaigns campaign,
          social_profiles recipient, social_profiles host
        where invite.listing_id = listing.id
          and listing.campaign_id = campaign.id
          and host.user_id = campaign.owner_user_id
          and recipient.user_id = invite.recipient_user_id
          and invite.status = 'PENDING'
          and ((host.id = ${firstProfileId}::uuid and recipient.id = ${secondProfileId}::uuid)
            or (host.id = ${secondProfileId}::uuid and recipient.id = ${firstProfileId}::uuid))
        returning invite.id
      `.execute(db)
      return result.rows.map((row) => row.id)
    }
  }
}
