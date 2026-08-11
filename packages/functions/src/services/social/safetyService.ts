import {
  createCampaignRepository,
  createSocialRepository,
  withTransaction,
  type DBLike
} from '@artificer-toolkit/db'
import type {
  CreateSocialReportInput,
  SocialBlockDto,
  SocialModerationQueueItemDto,
  SocialModerationReportDto,
  SocialReportReceiptDto,
  TakeSocialModerationActionInput
} from '@artificer-toolkit/schema/api/socialHub'
import {
  SocialAccessError,
  SocialConflictError,
  SocialNotFoundError,
  SocialValidationError
} from './errors.js'
import { mapModerationReport, mapSocialProfile, socialIso } from './mapping.js'
import { requireActiveSocialProfile } from './profileService.js'
import { consumeSocialRateLimit } from './rateLimits.js'

function requireModerator(isSuperAdmin: boolean): void {
  if (!isSuperAdmin) throw new SocialAccessError('Superadmin access is required.')
}

export async function listSocialBlocks(db: DBLike, userId: string): Promise<SocialBlockDto[]> {
  const profile = await requireActiveSocialProfile(db, userId)
  return (await createSocialRepository(db).listSocialBlocks(profile.id)).map((block) => ({
    profile: {
      profilePublicId: block.blockedProfileId,
      username: block.blockedUsername
    },
    createdAt: socialIso(block.createdAt)
  }))
}

export function createSocialBlock(
  db: DBLike,
  userId: string,
  profilePublicId: string
): Promise<SocialBlockDto> {
  return withTransaction(db, async (trx) => {
    const blocker = await requireActiveSocialProfile(trx, userId)
    if (blocker.id === profilePublicId) {
      throw new SocialValidationError('You cannot block your own Social profile.')
    }
    const repository = createSocialRepository(trx)
    const target = await repository.findActiveSocialProfile(blocker.id, profilePublicId)
    if (!target) throw new SocialNotFoundError()
    const now = new Date().toISOString()
    await consumeSocialRateLimit(trx, userId, 'BLOCK', [{ window: 'HOUR', limit: 30 }], now)
    if (!(await repository.createSocialBlock(blocker.id, target.id))) {
      throw new SocialConflictError('This Social profile is already blocked.')
    }
    await Promise.all([
      repository.blockPendingApplications(blocker.id, target.id, now),
      createCampaignRepository(trx).revokePendingInviteForProfiles(blocker.id, target.id, now)
    ])
    return { profile: mapSocialProfile(target), createdAt: now }
  })
}

export function removeSocialBlock(
  db: DBLike,
  userId: string,
  profilePublicId: string
): Promise<void> {
  return withTransaction(db, async (trx) => {
    const blocker = await requireActiveSocialProfile(trx, userId)
    const repository = createSocialRepository(trx)
    const existing = (await repository.listSocialBlocks(blocker.id)).find(
      (block) => block.blockedProfileId === profilePublicId
    )
    if (!existing) throw new SocialNotFoundError()
    const now = new Date().toISOString()
    await consumeSocialRateLimit(trx, userId, 'BLOCK', [{ window: 'HOUR', limit: 30 }], now)
    if (!(await repository.removeSocialBlock(blocker.id, profilePublicId))) {
      throw new SocialConflictError()
    }
  })
}

export function createSocialReport(
  db: DBLike,
  userId: string,
  input: CreateSocialReportInput
): Promise<SocialReportReceiptDto> {
  return withTransaction(db, async (trx) => {
    const reporter = await requireActiveSocialProfile(trx, userId)
    const repository = createSocialRepository(trx)
    const now = new Date().toISOString()
    await consumeSocialRateLimit(
      trx,
      userId,
      'REPORT',
      [
        { window: 'HOUR', limit: 5 },
        { window: 'DAY', limit: 20 }
      ],
      now
    )
    const evidence = await repository.findReportableSocialEvidence({
      reporterProfileId: reporter.id,
      targetKind: input.targetKind,
      targetId: input.targetPublicId
    })
    if (!evidence) throw new SocialNotFoundError()
    const report = await repository.insertSocialReport({
      reporterProfileId: reporter.id,
      targetKind: input.targetKind,
      targetId: input.targetPublicId,
      reason: input.reason,
      details: input.details,
      evidenceSnapshot: evidence.snapshot
    })
    return {
      reportPublicId: report.id,
      status: 'SUBMITTED',
      createdAt: socialIso(report.createdAt)
    }
  })
}

export async function listSocialModerationQueue(
  db: DBLike,
  userId: string,
  isSuperAdmin: boolean
): Promise<SocialModerationQueueItemDto[]> {
  requireModerator(isSuperAdmin)
  await requireActiveSocialProfile(db, userId)
  return (await createSocialRepository(db).listSocialModerationQueue()).map((report) => ({
    reportPublicId: report.id,
    targetKind: report.targetKind,
    reason: report.reason,
    status: report.status,
    createdAt: socialIso(report.createdAt),
    updatedAt: socialIso(report.updatedAt),
    version: report.version
  }))
}

export function openSocialModerationReport(
  db: DBLike,
  userId: string,
  isSuperAdmin: boolean,
  reportPublicId: string
): Promise<SocialModerationReportDto> {
  requireModerator(isSuperAdmin)
  return withTransaction(db, async (trx) => {
    await requireActiveSocialProfile(trx, userId)
    const repository = createSocialRepository(trx)
    const report = await repository.lockSocialReport(reportPublicId)
    if (!report) throw new SocialNotFoundError()
    await repository.insertSocialModerationAction({
      moderatorUserId: userId,
      reportId: report.id,
      action: 'VIEWED',
      affectedProfileId: null,
      affectedListingId: null,
      reason: 'Moderator opened report evidence.',
      beforeState: { reportStatus: report.status, reportVersion: report.version },
      afterState: { reportStatus: report.status, reportVersion: report.version }
    })
    return mapModerationReport(report)
  })
}

function reportStatusForAction(
  action: TakeSocialModerationActionInput['action']
): 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED' | null {
  if (action === 'START_REVIEW') return 'UNDER_REVIEW'
  if (action === 'RESOLVE') return 'RESOLVED'
  if (action === 'DISMISS') return 'DISMISSED'
  return null
}

export function takeSocialModerationAction(
  db: DBLike,
  userId: string,
  isSuperAdmin: boolean,
  input: TakeSocialModerationActionInput
): Promise<SocialModerationReportDto> {
  requireModerator(isSuperAdmin)
  return withTransaction(db, async (trx) => {
    await requireActiveSocialProfile(trx, userId)
    const repository = createSocialRepository(trx)
    const report = await repository.lockSocialReport(input.reportPublicId)
    if (!report) throw new SocialNotFoundError()
    if (report.version !== input.expectedVersion) throw new SocialConflictError()

    const beforeState: Record<string, unknown> = {
      reportStatus: report.status,
      reportVersion: report.version
    }
    const now = new Date().toISOString()
    let updatedReport = report
    const nextReportStatus = reportStatusForAction(input.action)

    if (nextReportStatus) {
      if (
        report.status === 'RESOLVED' ||
        report.status === 'DISMISSED' ||
        (nextReportStatus === 'UNDER_REVIEW' && report.status !== 'SUBMITTED') ||
        (nextReportStatus !== 'UNDER_REVIEW' && report.status !== 'UNDER_REVIEW')
      ) {
        throw new SocialConflictError('This report cannot make that transition.')
      }
      const updated = await repository.setSocialReportStatus({
        reportId: report.id,
        expectedVersion: input.expectedVersion,
        status: nextReportStatus,
        now
      })
      if (!updated) throw new SocialConflictError()
      updatedReport = updated
    } else if (input.action === 'HIDE_LISTING' || input.action === 'RESTORE_LISTING') {
      if (!report.targetListingId) {
        throw new SocialValidationError('This report does not target a listing.')
      }
      const moderationStatus = input.action === 'HIDE_LISTING' ? 'HIDDEN' : 'VISIBLE'
      if (
        !(await repository.setSocialListingModerationStatus(
          report.targetListingId,
          moderationStatus,
          now
        ))
      ) {
        throw new SocialConflictError('The listing is already in that moderation state.')
      }
      beforeState.listingModerationStatus = moderationStatus === 'HIDDEN' ? 'VISIBLE' : 'HIDDEN'
      if (moderationStatus === 'HIDDEN') {
        await Promise.all([
          repository.expireSubmittedSocialApplications(report.targetListingId, now),
          createCampaignRepository(trx).expirePendingInvites(report.targetListingId, now)
        ])
      }
    } else {
      if (!report.targetProfileId) {
        throw new SocialValidationError('This report does not target a Social profile.')
      }
      const profileStatus = input.action === 'SUSPEND_PROFILE' ? 'SUSPENDED' : 'ACTIVE'
      if (!(await repository.setSocialProfileStatus(report.targetProfileId, profileStatus, now))) {
        throw new SocialConflictError('The profile is already in that moderation state.')
      }
      beforeState.profileStatus = profileStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'
      if (profileStatus === 'SUSPENDED') {
        const listingIds = await repository.closeSocialListingsForProfile(
          report.targetProfileId,
          now
        )
        for (const listingId of listingIds) {
          await Promise.all([
            repository.expireSubmittedSocialApplications(listingId, now),
            createCampaignRepository(trx).expirePendingInvites(listingId, now)
          ])
        }
      }
    }

    if (!nextReportStatus) {
      const advanced = await repository.advanceSocialReportVersion({
        reportId: report.id,
        expectedVersion: input.expectedVersion,
        now
      })
      if (!advanced) throw new SocialConflictError()
      updatedReport = advanced
    }

    const afterState: Record<string, unknown> = {
      reportStatus: updatedReport.status,
      reportVersion: updatedReport.version,
      action: input.action,
      ...(input.action === 'HIDE_LISTING' ? { listingModerationStatus: 'HIDDEN' } : {}),
      ...(input.action === 'RESTORE_LISTING' ? { listingModerationStatus: 'VISIBLE' } : {}),
      ...(input.action === 'SUSPEND_PROFILE' ? { profileStatus: 'SUSPENDED' } : {}),
      ...(input.action === 'RESTORE_PROFILE' ? { profileStatus: 'ACTIVE' } : {})
    }
    const affectsListing = input.action === 'HIDE_LISTING' || input.action === 'RESTORE_LISTING'
    const affectsProfile = input.action === 'SUSPEND_PROFILE' || input.action === 'RESTORE_PROFILE'
    await repository.insertSocialModerationAction({
      moderatorUserId: userId,
      reportId: report.id,
      action: input.action,
      affectedProfileId: affectsProfile ? report.targetProfileId : null,
      affectedListingId: affectsListing ? report.targetListingId : null,
      reason: input.reason,
      beforeState,
      afterState
    })
    return mapModerationReport(updatedReport)
  })
}
