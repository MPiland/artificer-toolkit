import { sql } from 'kysely'

import type { DBLike } from '#types'

import type {
  SocialReportEvidence,
  SocialReportReason,
  SocialReportRecord,
  SocialReportTargetKind
} from './types.js'
import { mapSocialReport, socialReportColumns, type RawSocialReport } from './reportRows.js'

export function createSocialReportRepository(db: DBLike) {
  return {
    async findReportableSocialEvidence(input: {
      reporterProfileId: string
      targetKind: SocialReportTargetKind
      targetId: string
    }): Promise<SocialReportEvidence | null> {
      if (input.targetKind === 'PROFILE') {
        const result = await sql<{ snapshot: Record<string, unknown> }>`
          select jsonb_build_object(
            'profilePublicId', target.id,
            'username', account.username,
            'status', target.status
          ) as snapshot
          from social_profiles target
          join profiles account on account.id = target.user_id
          where target.id = ${input.targetId}::uuid
            and target.id <> ${input.reporterProfileId}::uuid
            and (
              (target.status = 'ACTIVE' and not exists (
                select 1 from social_blocks block
                where (block.blocker_profile_id = ${input.reporterProfileId}::uuid
                    and block.blocked_profile_id = target.id)
                  or (block.blocker_profile_id = target.id
                    and block.blocked_profile_id = ${input.reporterProfileId}::uuid)
              ))
              or exists (
                select 1 from social_blocks block
                where (block.blocker_profile_id = ${input.reporterProfileId}::uuid
                    and block.blocked_profile_id = target.id)
                  or (block.blocker_profile_id = target.id
                    and block.blocked_profile_id = ${input.reporterProfileId}::uuid)
              )
            )
        `.execute(db)
        const snapshot = result.rows[0]?.snapshot
        return snapshot ? { targetKind: 'PROFILE', targetId: input.targetId, snapshot } : null
      }

      if (input.targetKind === 'LISTING') {
        const result = await sql<{ snapshot: Record<string, unknown> }>`
          select jsonb_build_object(
            'listingPublicId', listing.id,
            'title', listing.title,
            'summary', listing.summary,
            'status', listing.status,
            'audience', listing.audience,
            'moderationStatus', listing.moderation_status,
            'hostProfilePublicId', host.id,
            'hostUsername', host_account.username,
            'systemId', listing.system_id,
            'format', listing.campaign_format,
            'toneTags', listing.tone_tags,
            'toneDetails', listing.tone_details,
            'contentMaturity', listing.content_maturity,
            'playMode', listing.play_mode,
            'schedule', jsonb_build_object(
              'kind', listing.schedule_kind,
              'timeZone', listing.time_zone,
              'summary', listing.schedule_summary,
              'startsAt', listing.starts_at,
              'weekday', listing.weekday,
              'localStartTime', listing.local_start_time,
              'recurrence', listing.recurrence
            ),
            'location', case when listing.city is null then null else
              jsonb_build_object('city', listing.city, 'stateCode', listing.state_code) end,
            'expectations', jsonb_build_object(
              'contentGuidance', listing.content_guidance,
              'attendancePolicy', listing.attendance_policy,
              'allowedContentRules', listing.allowed_content_rules,
              'tableConduct', listing.table_conduct,
              'contentBoundaries', listing.content_boundaries,
              'safetyPractices', listing.safety_practices,
              'safetyDetails', listing.safety_details
            ),
            'version', listing.version,
            'capturedAt', now()
          ) as snapshot
          from social_listings listing
          join campaigns campaign on campaign.id = listing.campaign_id
          join social_profiles host on host.user_id = campaign.owner_user_id
          join profiles host_account on host_account.id = campaign.owner_user_id
          join social_profiles reporter on reporter.id = ${input.reporterProfileId}::uuid
          where listing.id = ${input.targetId}::uuid
            and (
              campaign.owner_user_id = reporter.user_id
              or exists (
                select 1 from social_applications application
                where application.listing_id = listing.id
                  and application.applicant_profile_id = reporter.id
              )
              or exists (
                select 1 from campaign_invites invite
                where invite.listing_id = listing.id
                  and invite.recipient_user_id = reporter.user_id
              )
              or (
                listing.status = 'OPEN' and listing.audience = 'PUBLIC'
                and listing.moderation_status = 'VISIBLE' and host.status = 'ACTIVE'
                and not exists (
                  select 1 from social_blocks block
                  where (block.blocker_profile_id = reporter.id
                      and block.blocked_profile_id = host.id)
                    or (block.blocker_profile_id = host.id
                      and block.blocked_profile_id = reporter.id)
                )
              )
            )
        `.execute(db)
        const snapshot = result.rows[0]?.snapshot
        return snapshot ? { targetKind: 'LISTING', targetId: input.targetId, snapshot } : null
      }

      const result = await sql<{ snapshot: Record<string, unknown> }>`
        select jsonb_build_object(
          'applicationPublicId', application.id,
          'listingPublicId', listing.id,
          'listingTitle', listing.title,
          'applicantProfilePublicId', applicant.id,
          'applicantUsername', applicant_account.username,
          'hostProfilePublicId', host.id,
          'hostUsername', host_account.username,
          'message', application.message,
          'status', application.status,
          'listingVersion', application.listing_version,
          'expectations', application.expectations_snapshot,
          'submittedAt', application.submitted_at,
          'respondedAt', application.responded_at,
          'version', application.version,
          'capturedAt', now()
        ) as snapshot
        from social_applications application
        join social_listings listing on listing.id = application.listing_id
        join campaigns campaign on campaign.id = listing.campaign_id
        join social_profiles applicant on applicant.id = application.applicant_profile_id
        join profiles applicant_account on applicant_account.id = applicant.user_id
        join social_profiles host on host.user_id = campaign.owner_user_id
        join profiles host_account on host_account.id = host.user_id
        join social_profiles reporter on reporter.id = ${input.reporterProfileId}::uuid
        where application.id = ${input.targetId}::uuid
          and (application.applicant_profile_id = reporter.id
            or campaign.owner_user_id = reporter.user_id)
      `.execute(db)
      const snapshot = result.rows[0]?.snapshot
      return snapshot ? { targetKind: 'APPLICATION', targetId: input.targetId, snapshot } : null
    },
    async insertSocialReport(input: {
      reporterProfileId: string
      targetKind: SocialReportTargetKind
      targetId: string
      reason: SocialReportReason
      details: string
      evidenceSnapshot: Record<string, unknown>
    }): Promise<SocialReportRecord> {
      const targetProfileId = input.targetKind === 'PROFILE' ? input.targetId : null
      const targetListingId = input.targetKind === 'LISTING' ? input.targetId : null
      const targetApplicationId = input.targetKind === 'APPLICATION' ? input.targetId : null
      const result = await sql<RawSocialReport>`
        with inserted as (
          insert into social_reports (
            reporter_profile_id, target_profile_id, target_listing_id,
            target_application_id, reason, details, evidence_snapshot
          ) values (
            ${input.reporterProfileId}::uuid, ${targetProfileId}::uuid,
            ${targetListingId}::uuid, ${targetApplicationId}::uuid,
            ${input.reason}, ${input.details}, ${JSON.stringify(input.evidenceSnapshot)}::jsonb
          )
          returning *
        )
        select ${socialReportColumns}
        from inserted report
        join social_profiles reporter on reporter.id = report.reporter_profile_id
        join profiles reporter_account on reporter_account.id = reporter.user_id
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Failed to create Social report.')
      return mapSocialReport(row)
    }
  }
}
