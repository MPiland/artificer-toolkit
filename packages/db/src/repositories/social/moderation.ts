import { sql } from 'kysely'

import type { DBLike } from '#types'

import type {
  SocialModerationAction,
  SocialModerationQueueRecord,
  SocialProfileStatus,
  SocialReportRecord,
  SocialReportStatus
} from './types.js'
import { mapSocialReport, socialReportColumns, type RawSocialReport } from './reportRows.js'

type RawModerationQueue = Pick<
  RawSocialReport,
  | 'id'
  | 'target_profile_id'
  | 'target_listing_id'
  | 'target_application_id'
  | 'reason'
  | 'status'
  | 'version'
  | 'created_at'
  | 'updated_at'
>

export function createSocialModerationRepository(db: DBLike) {
  return {
    async listSocialModerationQueue(): Promise<SocialModerationQueueRecord[]> {
      const result = await sql<RawModerationQueue>`
        select report.id, report.target_profile_id, report.target_listing_id,
          report.target_application_id, report.reason, report.status,
          report.version, report.created_at, report.updated_at
        from social_reports report
        order by case report.status
          when 'SUBMITTED' then 0 when 'UNDER_REVIEW' then 1 else 2 end,
          report.created_at, report.id
      `.execute(db)
      return result.rows.map((row) => {
        return {
          id: row.id,
          targetKind: row.target_profile_id
            ? 'PROFILE'
            : row.target_listing_id
              ? 'LISTING'
              : 'APPLICATION',
          reason: row.reason,
          status: row.status,
          version: row.version,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }
      })
    },

    async lockSocialReport(reportId: string): Promise<SocialReportRecord | null> {
      const result = await sql<RawSocialReport>`
        select ${socialReportColumns}
        from social_reports report
        join social_profiles reporter on reporter.id = report.reporter_profile_id
        join profiles reporter_account on reporter_account.id = reporter.user_id
        where report.id = ${reportId}::uuid
        for update of report
      `.execute(db)
      const row = result.rows[0]
      return row ? mapSocialReport(row) : null
    },

    async insertSocialModerationAction(input: {
      moderatorUserId: string
      reportId: string
      action: SocialModerationAction
      affectedProfileId: string | null
      affectedListingId: string | null
      reason: string
      beforeState: Record<string, unknown>
      afterState: Record<string, unknown>
    }): Promise<string> {
      const result = await sql<{ id: string }>`
        insert into social_moderation_actions (
          moderator_user_id, report_id, action, affected_profile_id,
          affected_listing_id, reason, before_state, after_state
        ) values (
          ${input.moderatorUserId}::uuid, ${input.reportId}::uuid, ${input.action},
          ${input.affectedProfileId}::uuid, ${input.affectedListingId}::uuid,
          ${input.reason}, ${JSON.stringify(input.beforeState)}::jsonb,
          ${JSON.stringify(input.afterState)}::jsonb
        )
        returning id
      `.execute(db)
      const id = result.rows[0]?.id
      if (!id) throw new Error('Failed to audit Social moderation action.')
      return id
    },

    async setSocialReportStatus(input: {
      reportId: string
      expectedVersion: number
      status: SocialReportStatus
      now: string
    }): Promise<SocialReportRecord | null> {
      const result = await sql<RawSocialReport>`
        with updated as (
          update social_reports
          set status = ${input.status},
            review_started_at = case when ${input.status} = 'UNDER_REVIEW'
              then ${input.now}::timestamptz else review_started_at end,
            resolved_at = case when ${input.status} in ('RESOLVED', 'DISMISSED')
              then ${input.now}::timestamptz else null end,
            version = version + 1, updated_at = ${input.now}::timestamptz
          where id = ${input.reportId}::uuid and version = ${input.expectedVersion}
          returning *
        )
        select ${socialReportColumns}
        from updated report
        join social_profiles reporter on reporter.id = report.reporter_profile_id
        join profiles reporter_account on reporter_account.id = reporter.user_id
      `.execute(db)
      const row = result.rows[0]
      return row ? mapSocialReport(row) : null
    },

    async setSocialListingModerationStatus(
      listingId: string,
      status: 'VISIBLE' | 'HIDDEN',
      now: string
    ): Promise<boolean> {
      const result = await sql<{ id: string }>`
        update social_listings
        set moderation_status = ${status}, version = version + 1,
          updated_at = ${now}::timestamptz
        where id = ${listingId}::uuid and moderation_status <> ${status}
        returning id
      `.execute(db)
      return Boolean(result.rows[0])
    },

    async setSocialProfileStatus(
      profileId: string,
      status: SocialProfileStatus,
      now: string
    ): Promise<boolean> {
      const result = await sql<{ id: string }>`
        update social_profiles
        set status = ${status}, version = version + 1, updated_at = ${now}::timestamptz
        where id = ${profileId}::uuid and status <> ${status}
        returning id
      `.execute(db)
      return Boolean(result.rows[0])
    },

    async closeSocialListingsForProfile(profileId: string, now: string): Promise<string[]> {
      const result = await sql<{ id: string }>`
        update social_listings listing
        set status = 'CLOSED', version = listing.version + 1,
          updated_at = ${now}::timestamptz
        from campaigns campaign, social_profiles profile
        where listing.campaign_id = campaign.id
          and campaign.owner_user_id = profile.user_id
          and profile.id = ${profileId}::uuid and listing.status <> 'CLOSED'
        returning listing.id
      `.execute(db)
      return result.rows.map((row) => row.id)
    }
  }
}
