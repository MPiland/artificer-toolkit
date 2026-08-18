import { sql } from 'kysely'

import type { DBLike } from '#types'

import type { SocialApplicationRecord, SocialApplicationStatus } from './types.js'
import type { CampaignContentMaturity } from '../campaignTypes.js'

type RawApplication = {
  id: string
  listing_id: string
  listing_title: string
  content_maturity: CampaignContentMaturity
  campaign_id: string
  host_user_id: string
  applicant_profile_id: string
  applicant_user_id: string
  applicant_username: string
  message: string
  status: SocialApplicationStatus
  listing_version: number
  expectations_snapshot: unknown
  submitted_at: string | Date
  withdrawn_at: string | Date | null
  responded_at: string | Date | null
  expired_at: string | Date | null
  blocked_at: string | Date | null
  version: number
  created_at: string | Date
  updated_at: string | Date
}

const applicationColumns = sql`
  application.id, application.listing_id, listing.title as listing_title,
  listing.content_maturity,
  listing.campaign_id, campaign.owner_user_id as host_user_id,
  application.applicant_profile_id, applicant.user_id as applicant_user_id,
  applicant_account.username as applicant_username,
  application.message, application.status, application.listing_version,
  application.expectations_snapshot, application.submitted_at,
  application.withdrawn_at, application.responded_at, application.expired_at,
  application.blocked_at, application.version,
  application.created_at, application.updated_at
`

const applicationJoins = sql`
  join social_listings listing on listing.id = application.listing_id
  join campaigns campaign on campaign.id = listing.campaign_id
  join social_profiles applicant on applicant.id = application.applicant_profile_id
  join profiles applicant_account on applicant_account.id = applicant.user_id
`

function mapApplication(row: RawApplication): SocialApplicationRecord {
  return {
    id: row.id,
    listingId: row.listing_id,
    listingTitle: row.listing_title,
    contentMaturity: row.content_maturity,
    campaignId: row.campaign_id,
    hostUserId: row.host_user_id,
    applicantProfileId: row.applicant_profile_id,
    applicantUserId: row.applicant_user_id,
    applicantUsername: row.applicant_username,
    message: row.message,
    status: row.status,
    listingVersion: row.listing_version,
    expectationsSnapshot: row.expectations_snapshot,
    submittedAt: row.submitted_at,
    withdrawnAt: row.withdrawn_at,
    respondedAt: row.responded_at,
    expiredAt: row.expired_at,
    blockedAt: row.blocked_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function createSocialApplicationRepository(db: DBLike) {
  return {
    async findSocialApplicationById(
      applicationId: string
    ): Promise<SocialApplicationRecord | null> {
      const result = await sql<RawApplication>`
        select ${applicationColumns}
        from social_applications application
        ${applicationJoins}
        where application.id = ${applicationId}::uuid
      `.execute(db)
      const row = result.rows[0]
      return row ? mapApplication(row) : null
    },

    async listSocialApplicationsForApplicant(
      applicantProfileId: string
    ): Promise<SocialApplicationRecord[]> {
      const result = await sql<RawApplication>`
        select ${applicationColumns}
        from social_applications application
        ${applicationJoins}
        where application.applicant_profile_id = ${applicantProfileId}::uuid
        order by case application.status when 'SUBMITTED' then 0 else 1 end,
          application.submitted_at desc, application.id desc
      `.execute(db)
      return result.rows.map(mapApplication)
    },

    async listSocialApplicationsForListing(listingId: string): Promise<SocialApplicationRecord[]> {
      const result = await sql<RawApplication>`
        select ${applicationColumns}
        from social_applications application
        ${applicationJoins}
        where application.listing_id = ${listingId}::uuid
        order by case application.status when 'SUBMITTED' then 0 else 1 end,
          application.submitted_at desc, application.id desc
      `.execute(db)
      return result.rows.map(mapApplication)
    },

    async insertSocialApplication(input: {
      listingId: string
      applicantProfileId: string
      message: string
      listingVersion: number
      expectationsSnapshot: Record<string, unknown>
    }): Promise<SocialApplicationRecord> {
      const result = await sql<RawApplication>`
        with inserted as (
          insert into social_applications (
            listing_id, applicant_profile_id, message, listing_version, expectations_snapshot
          ) values (
            ${input.listingId}::uuid, ${input.applicantProfileId}::uuid,
            ${input.message}, ${input.listingVersion},
            ${JSON.stringify(input.expectationsSnapshot)}::jsonb
          )
          returning *
        )
        select ${applicationColumns}
        from inserted application
        ${applicationJoins}
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Failed to create Social application.')
      return mapApplication(row)
    },

    async lockSocialApplication(applicationId: string): Promise<SocialApplicationRecord | null> {
      const result = await sql<RawApplication>`
        select ${applicationColumns}
        from social_applications application
        ${applicationJoins}
        where application.id = ${applicationId}::uuid
        for update of application
      `.execute(db)
      const row = result.rows[0]
      return row ? mapApplication(row) : null
    },

    async setSocialApplicationStatus(input: {
      applicationId: string
      expectedVersion: number
      status: Exclude<SocialApplicationStatus, 'SUBMITTED'>
      now: string
    }): Promise<SocialApplicationRecord | null> {
      const timestampColumn =
        input.status === 'WITHDRAWN'
          ? sql`withdrawn_at`
          : input.status === 'EXPIRED'
            ? sql`expired_at`
            : input.status === 'BLOCKED'
              ? sql`blocked_at`
              : sql`responded_at`
      const result = await sql<RawApplication>`
        with updated as (
          update social_applications
          set status = ${input.status}, ${timestampColumn} = ${input.now}::timestamptz,
            version = version + 1, updated_at = ${input.now}::timestamptz
          where id = ${input.applicationId}::uuid
            and version = ${input.expectedVersion} and status = 'SUBMITTED'
          returning *
        )
        select ${applicationColumns}
        from updated application
        ${applicationJoins}
      `.execute(db)
      const row = result.rows[0]
      return row ? mapApplication(row) : null
    },

    async expireSubmittedSocialApplications(listingId: string, now: string): Promise<string[]> {
      const result = await sql<{ id: string }>`
        update social_applications
        set status = 'EXPIRED', expired_at = ${now}::timestamptz,
          version = version + 1, updated_at = ${now}::timestamptz
        where listing_id = ${listingId}::uuid and status = 'SUBMITTED'
        returning id
      `.execute(db)
      return result.rows.map((row) => row.id)
    },

    async advanceSubmittedSocialApplicationListingVersions(
      listingId: string,
      listingVersion: number,
      now: string
    ): Promise<number> {
      const result = await sql<{ id: string }>`
        update social_applications
        set listing_version = ${listingVersion}, version = version + 1,
          updated_at = ${now}::timestamptz
        where listing_id = ${listingId}::uuid and status = 'SUBMITTED'
        returning id
      `.execute(db)
      return result.rows.length
    }
  }
}
