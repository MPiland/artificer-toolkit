import {
  createAccountEntitlementsRepository,
  createCampaignRepository,
  createSocialRepository,
  withTransaction,
  type CampaignInviteRecord,
  type DBLike,
  type SocialApplicationRecord
} from '@artificer-toolkit/db'
import type {
  DecideSocialApplicationInput,
  SocialApplicationDto,
  SubmitSocialApplicationInput
} from '@artificer-toolkit/schema/api/socialHub'
import { ENTITLEMENT_LIMITS, assertEntitlementLimit } from '../account/entitlementService.js'
import { SocialConflictError, SocialNotFoundError, SocialValidationError } from './errors.js'
import { listingExpectations, mapSocialApplication, socialIso } from './mapping.js'
import { hasActiveSocialEligibility, requireActiveSocialProfile } from './profileService.js'
import { consumeSocialRateLimit } from './rateLimits.js'

type AdmissionSource =
  | { kind: 'APPLICATION'; publicId: string; expectedVersion: number }
  | { kind: 'INVITATION'; publicId: string; expectedVersion: number }

export type SocialAdmissionResult =
  | { kind: 'APPLICATION'; campaignId: string; application: SocialApplicationRecord }
  | { kind: 'INVITATION'; campaignId: string; invitation: CampaignInviteRecord }

function socialUnavailable(): never {
  throw new SocialNotFoundError()
}

export async function acceptSocialAdmission(
  db: DBLike,
  actorUserId: string,
  source: AdmissionSource
): Promise<SocialAdmissionResult> {
  await requireActiveSocialProfile(db, actorUserId)
  const sourceLookup =
    source.kind === 'APPLICATION'
      ? await createSocialRepository(db).findSocialApplicationById(source.publicId)
      : await createCampaignRepository(db).lockInvite(source.publicId)
  if (!sourceLookup) socialUnavailable()

  return withTransaction(db, async (trx) => {
    const socialRepository = createSocialRepository(trx)
    const campaignRepository = createCampaignRepository(trx)
    const listing = await socialRepository.lockSocialListing(sourceLookup.listingId)
    if (!listing) socialUnavailable()
    const campaign = await campaignRepository.lockCampaign(listing.campaignId)
    if (!campaign) socialUnavailable()

    const lockedSource =
      source.kind === 'APPLICATION'
        ? await socialRepository.lockSocialApplication(source.publicId)
        : await campaignRepository.lockInvite(source.publicId)
    if (!lockedSource || lockedSource.listingId !== listing.id) socialUnavailable()

    const admittedUserId =
      source.kind === 'APPLICATION'
        ? (lockedSource as SocialApplicationRecord).applicantUserId
        : (lockedSource as CampaignInviteRecord).recipientUserId
    if (source.kind === 'APPLICATION') {
      const application = lockedSource as SocialApplicationRecord
      if (
        actorUserId !== campaign.ownerUserId ||
        application.hostUserId !== campaign.ownerUserId ||
        listing.audience !== 'PUBLIC'
      ) {
        socialUnavailable()
      }
    } else {
      const invitation = lockedSource as CampaignInviteRecord
      if (actorUserId !== invitation.recipientUserId) socialUnavailable()
    }

    const existingMembership = await campaignRepository.findMembership(campaign.id, admittedUserId)
    const alreadyAccepted = lockedSource.status === 'ACCEPTED'
    if (alreadyAccepted) {
      if (existingMembership?.status !== 'ACTIVE' || existingMembership.role !== 'PLAYER') {
        socialUnavailable()
      }
      return source.kind === 'APPLICATION'
        ? {
            kind: 'APPLICATION',
            campaignId: campaign.id,
            application: lockedSource as SocialApplicationRecord
          }
        : {
            kind: 'INVITATION',
            campaignId: campaign.id,
            invitation: lockedSource as CampaignInviteRecord
          }
    }

    const pendingStatus = source.kind === 'APPLICATION' ? 'SUBMITTED' : 'PENDING'
    if (
      lockedSource.status !== pendingStatus ||
      lockedSource.version !== source.expectedVersion ||
      lockedSource.listingVersion !== listing.version
    ) {
      throw new SocialConflictError()
    }
    if (
      source.kind === 'INVITATION' &&
      Date.parse(socialIso((lockedSource as CampaignInviteRecord).expiresAt)) <= Date.now()
    ) {
      socialUnavailable()
    }

    const host = await createSocialRepository(trx).findSocialProfileByUser(campaign.ownerUserId)
    const admittedProfile =
      await createSocialRepository(trx).findSocialProfileByUser(admittedUserId)
    if (
      !host ||
      !hasActiveSocialEligibility(host) ||
      !admittedProfile ||
      !hasActiveSocialEligibility(admittedProfile) ||
      listing.status !== 'OPEN' ||
      listing.moderationStatus !== 'VISIBLE' ||
      campaign.status !== 'ACTIVE' ||
      (await socialRepository.hasSocialBlockEitherDirection(host.id, admittedProfile.id))
    ) {
      socialUnavailable()
    }

    if (existingMembership?.status !== 'ACTIVE') {
      const tier = await createAccountEntitlementsRepository(trx).lockTier(campaign.ownerUserId)
      const counts = await campaignRepository.countActiveMembers(campaign.id)
      if (counts.players >= listing.capacity) {
        throw new SocialConflictError('This table no longer has an available seat.')
      }
      assertEntitlementLimit(
        'playerSeatsPerCampaign',
        counts.players,
        ENTITLEMENT_LIMITS[tier].playerSeatsPerCampaign
      )
      await campaignRepository.activatePlayerMembership(
        campaign.id,
        admittedUserId,
        new Date().toISOString()
      )
    } else if (existingMembership.role !== 'PLAYER') {
      throw new SocialConflictError('The Campaign owner cannot be admitted as a player.')
    }

    const now = new Date().toISOString()
    if (source.kind === 'APPLICATION') {
      const application = await socialRepository.setSocialApplicationStatus({
        applicationId: source.publicId,
        expectedVersion: source.expectedVersion,
        status: 'ACCEPTED',
        now
      })
      if (!application) throw new SocialConflictError()
      return { kind: 'APPLICATION', campaignId: campaign.id, application }
    }

    const invitation = await campaignRepository.setInviteStatus({
      inviteId: source.publicId,
      expectedVersion: source.expectedVersion,
      status: 'ACCEPTED',
      now
    })
    if (!invitation) throw new SocialConflictError()
    return { kind: 'INVITATION', campaignId: campaign.id, invitation }
  })
}

export async function listOwnSocialApplications(
  db: DBLike,
  userId: string
): Promise<SocialApplicationDto[]> {
  const profile = await requireActiveSocialProfile(db, userId)
  const repository = createSocialRepository(db)
  const applications = await repository.listSocialApplicationsForApplicant(profile.id)
  const visible: SocialApplicationDto[] = []
  for (const application of applications) {
    const host = await repository.findSocialProfileByUser(application.hostUserId)
    if (
      host &&
      hasActiveSocialEligibility(host) &&
      !(await repository.hasSocialBlockEitherDirection(profile.id, host.id))
    ) {
      visible.push(
        mapSocialApplication(application, {
          privateApplicationText: true,
          showMatureText: profile.contentPreference === 'MATURE'
        })
      )
    }
  }
  return visible
}

export async function listSocialApplicationsForListing(
  db: DBLike,
  userId: string,
  listingPublicId: string
): Promise<SocialApplicationDto[]> {
  const host = await requireActiveSocialProfile(db, userId)
  const repository = createSocialRepository(db)
  const listing = await repository.findOwnedSocialListing(userId, listingPublicId)
  if (!listing) throw new SocialNotFoundError()
  const applications = await repository.listSocialApplicationsForListing(listing.id)
  const visible: SocialApplicationDto[] = []
  for (const application of applications) {
    const applicant = await repository.findSocialProfileByUser(application.applicantUserId)
    if (
      applicant &&
      hasActiveSocialEligibility(applicant) &&
      !(await repository.hasSocialBlockEitherDirection(host.id, applicant.id))
    ) {
      visible.push(mapSocialApplication(application, { showMatureText: true }))
    }
  }
  return visible
}

export function submitSocialApplication(
  db: DBLike,
  userId: string,
  input: SubmitSocialApplicationInput
): Promise<SocialApplicationDto> {
  return withTransaction(db, async (trx) => {
    const applicant = await requireActiveSocialProfile(trx, userId)
    const now = new Date().toISOString()
    await consumeSocialRateLimit(
      trx,
      userId,
      'APPLICATION',
      [
        { window: 'HOUR', limit: 10 },
        { window: 'DAY', limit: 30 }
      ],
      now
    )
    const repository = createSocialRepository(trx)
    const listing = await repository.lockSocialListing(input.listingPublicId)
    if (!listing || listing.campaignOwnerUserId === userId) socialUnavailable()
    const visibleListing = await repository.findVisibleSocialListing(
      applicant.id,
      input.listingPublicId
    )
    if (!visibleListing || visibleListing.version !== listing.version) socialUnavailable()
    if (listing.version !== input.expectedListingVersion) throw new SocialConflictError()
    if (listing.activePlayerCount >= listing.capacity) {
      throw new SocialConflictError('This table no longer has an available seat.')
    }
    const membership = await createCampaignRepository(trx).findMembership(
      listing.campaignId,
      userId
    )
    if (membership?.status === 'ACTIVE') {
      throw new SocialValidationError('You are already a member of this Campaign.')
    }
    try {
      return mapSocialApplication(
        await repository.insertSocialApplication({
          listingId: listing.id,
          applicantProfileId: applicant.id,
          message: input.message,
          listingVersion: listing.version,
          expectationsSnapshot: listingExpectations(listing, { privateOwnerView: true })
        }),
        {
          privateApplicationText: true,
          showMatureText: applicant.contentPreference === 'MATURE'
        }
      )
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: unknown }).code === '23505'
      ) {
        throw new SocialConflictError('You already have an active application for this listing.')
      }
      throw error
    }
  })
}

export function withdrawSocialApplication(
  db: DBLike,
  userId: string,
  applicationPublicId: string,
  expectedVersion: number
): Promise<SocialApplicationDto> {
  return withTransaction(db, async (trx) => {
    const applicant = await requireActiveSocialProfile(trx, userId)
    const repository = createSocialRepository(trx)
    const application = await repository.lockSocialApplication(applicationPublicId)
    if (!application || application.applicantUserId !== userId) throw new SocialNotFoundError()
    if (application.status !== 'SUBMITTED' || application.version !== expectedVersion) {
      throw new SocialConflictError()
    }
    const updated = await repository.setSocialApplicationStatus({
      applicationId: application.id,
      expectedVersion,
      status: 'WITHDRAWN',
      now: new Date().toISOString()
    })
    if (!updated) throw new SocialConflictError()
    return mapSocialApplication(updated, {
      privateApplicationText: true,
      showMatureText: applicant.contentPreference === 'MATURE'
    })
  })
}

export function decideSocialApplication(
  db: DBLike,
  userId: string,
  input: DecideSocialApplicationInput
): Promise<SocialApplicationDto> {
  if (input.decision === 'ACCEPT') {
    return acceptSocialAdmission(db, userId, {
      kind: 'APPLICATION',
      publicId: input.applicationPublicId,
      expectedVersion: input.expectedVersion
    }).then((result) => {
      if (result.kind !== 'APPLICATION') throw new SocialConflictError()
      return mapSocialApplication(result.application, { showMatureText: true })
    })
  }

  return withTransaction(db, async (trx) => {
    await requireActiveSocialProfile(trx, userId)
    const repository = createSocialRepository(trx)
    const application = await repository.lockSocialApplication(input.applicationPublicId)
    if (!application || application.hostUserId !== userId) throw new SocialNotFoundError()
    if (application.status !== 'SUBMITTED' || application.version !== input.expectedVersion) {
      throw new SocialConflictError()
    }
    const host = await requireActiveSocialProfile(trx, userId)
    const applicant = await repository.findSocialProfileByUser(application.applicantUserId)
    if (
      !applicant ||
      !hasActiveSocialEligibility(applicant) ||
      (await repository.hasSocialBlockEitherDirection(host.id, applicant.id))
    ) {
      socialUnavailable()
    }
    const declined = await repository.setSocialApplicationStatus({
      applicationId: application.id,
      expectedVersion: input.expectedVersion,
      status: 'DECLINED',
      now: new Date().toISOString()
    })
    if (!declined) throw new SocialConflictError()
    return mapSocialApplication(declined, { showMatureText: true })
  })
}
