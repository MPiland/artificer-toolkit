import { sql } from 'kysely'

import type {
  SocialReportReason,
  SocialReportRecord,
  SocialReportStatus,
  SocialReportTargetKind
} from './types.js'

export type RawSocialReport = {
  id: string
  reporter_profile_id: string
  reporter_username: string
  target_profile_id: string | null
  target_listing_id: string | null
  target_application_id: string | null
  reason: SocialReportReason
  details: string
  evidence_snapshot: unknown
  status: SocialReportStatus
  review_started_at: string | Date | null
  resolved_at: string | Date | null
  version: number
  created_at: string | Date
  updated_at: string | Date
}

export const socialReportColumns = sql.raw(`
  report.id, report.reporter_profile_id,
  reporter_account.username as reporter_username,
  report.target_profile_id, report.target_listing_id, report.target_application_id,
  report.reason, report.details, report.evidence_snapshot, report.status,
  report.review_started_at, report.resolved_at, report.version,
  report.created_at, report.updated_at
`)

function reportTargetKind(row: RawSocialReport): SocialReportTargetKind {
  if (row.target_profile_id) return 'PROFILE'
  if (row.target_listing_id) return 'LISTING'
  return 'APPLICATION'
}

export function mapSocialReport(row: RawSocialReport): SocialReportRecord {
  return {
    id: row.id,
    reporterProfileId: row.reporter_profile_id,
    reporterUsername: row.reporter_username,
    targetKind: reportTargetKind(row),
    targetProfileId: row.target_profile_id,
    targetListingId: row.target_listing_id,
    targetApplicationId: row.target_application_id,
    reason: row.reason,
    details: row.details,
    evidenceSnapshot: row.evidence_snapshot,
    status: row.status,
    reviewStartedAt: row.review_started_at,
    resolvedAt: row.resolved_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
