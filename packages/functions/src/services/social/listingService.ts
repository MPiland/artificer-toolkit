import {
  createAccountEntitlementsRepository,
  createCampaignRepository,
  createSocialRepository,
  withTransaction,
  type DBLike,
  type CampaignRecord,
  type SocialListingRecord,
  type SocialListingWrite
} from '@artificer-toolkit/db'
import type {
  CreateSocialListingInput,
  SocialDiscoveryInput,
  SocialDiscoveryPageDto,
  SocialListingDto,
  UpdateSocialListingInput
} from '@artificer-toolkit/schema/api/socialHub'
import { ENTITLEMENT_LIMITS, assertEntitlementLimit } from '../account/entitlementService.js'
import {
  enqueueApplicationSubmittedCancellations,
  enqueueInvitationReceivedCancellations
} from '../notifications/notificationService.js'
import {
  SocialAccessError,
  SocialConflictError,
  SocialNotFoundError,
  SocialValidationError
} from './errors.js'
import { listingExpectations, mapSocialListing, socialIso } from './mapping.js'
import { requireActiveSocialProfile } from './profileService.js'

function toListingWrite(
  input: CreateSocialListingInput | UpdateSocialListingInput,
  campaign: CampaignRecord
): SocialListingWrite {
  const schedule = input.schedule
  return {
    title: campaign.name,
    summary: input.summary,
    audience: input.audience,
    systemId: input.systemId,
    campaignFormat: campaign.format,
    toneTags: campaign.toneTags,
    toneDetails: campaign.toneDetails,
    contentMaturity: campaign.contentMaturity,
    playMode: input.playMode,
    capacity: input.capacity,
    scheduleKind: schedule.kind,
    timeZone: schedule.timeZone,
    scheduleSummary: schedule.summary,
    startsAt: schedule.kind === 'ONE_TIME' ? schedule.startsAt : null,
    weekday: schedule.kind === 'RECURRING' ? schedule.weekday : null,
    localStartTime: schedule.kind === 'RECURRING' ? schedule.localStartTime : null,
    recurrence: schedule.kind === 'RECURRING' ? schedule.recurrence : null,
    city: input.location?.city ?? null,
    stateCode: input.location?.stateCode ?? null,
    contentGuidance: input.expectations.contentGuidance,
    attendancePolicy: input.expectations.attendancePolicy,
    allowedContentRules: input.expectations.allowedContentRules,
    tableConduct: input.expectations.tableConduct,
    contentBoundaries: input.expectations.contentBoundaries,
    safetyPractices: input.expectations.safetyPractices,
    safetyDetails: input.expectations.safetyDetails,
    isFree: true,
    priceAmount: null,
    priceCurrency: null
  }
}

function sameArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function isMaterialListingEdit(current: SocialListingRecord, next: SocialListingWrite): boolean {
  return (
    current.audience !== next.audience ||
    current.systemId !== next.systemId ||
    current.playMode !== next.playMode ||
    current.scheduleKind !== next.scheduleKind ||
    current.timeZone !== next.timeZone ||
    current.scheduleSummary !== next.scheduleSummary ||
    (current.startsAt ? socialIso(current.startsAt) : null) !== next.startsAt ||
    current.weekday !== next.weekday ||
    current.localStartTime?.slice(0, 5) !== next.localStartTime ||
    current.recurrence !== next.recurrence ||
    current.city !== next.city ||
    current.stateCode !== next.stateCode ||
    current.contentGuidance !== next.contentGuidance ||
    current.attendancePolicy !== next.attendancePolicy ||
    current.allowedContentRules !== next.allowedContentRules ||
    current.tableConduct !== next.tableConduct ||
    current.contentBoundaries !== next.contentBoundaries ||
    !sameArray(current.safetyPractices, next.safetyPractices) ||
    current.safetyDetails !== next.safetyDetails
  )
}

function assertScheduleAllowedForCampaign(
  campaign: Pick<CampaignRecord, 'format'>,
  scheduleKind: SocialListingWrite['scheduleKind']
) {
  if (campaign.format === 'ONE_SHOT' && scheduleKind === 'RECURRING') {
    throw new SocialValidationError('One-shot Campaigns cannot use a recurring schedule.')
  }
}

function assertFreeListing(
  listing: Pick<SocialListingRecord, 'isFree' | 'priceAmount' | 'priceCurrency'>
) {
  if (!listing.isFree || listing.priceAmount !== null || listing.priceCurrency !== null) {
    throw new SocialValidationError('Paid Social listings are not available.')
  }
}

async function assertCapacityWithinTier(
  db: DBLike,
  ownerUserId: string,
  capacity: number,
  activePlayerCount: number
): Promise<keyof typeof ENTITLEMENT_LIMITS> {
  const tier = await createAccountEntitlementsRepository(db).lockTier(ownerUserId)
  const tierCapacity = ENTITLEMENT_LIMITS[tier].playerSeatsPerCampaign
  if (capacity < activePlayerCount) {
    throw new SocialValidationError('Capacity cannot be lower than the active player count.')
  }
  if (capacity > tierCapacity) {
    throw new SocialValidationError('Capacity exceeds the account player-seat limit.')
  }
  return tier
}

export async function searchSocialListings(
  db: DBLike,
  userId: string,
  input: SocialDiscoveryInput
): Promise<SocialDiscoveryPageDto> {
  const viewer = await requireActiveSocialProfile(db, userId)
  const limit = input.limit ?? 20
  const records = await createSocialRepository(db).searchSocialListings(viewer.id, {
    ...input,
    limit,
    cursor: input.cursor
      ? { publishedAt: input.cursor.publishedAt, listingId: input.cursor.listingPublicId }
      : undefined
  })
  const hasNextPage = records.length > limit
  const pageRecords = hasNextPage ? records.slice(0, limit) : records
  const last = pageRecords.at(-1)
  return {
    items: pageRecords.map((listing) =>
      mapSocialListing(listing, {
        showMatureText: viewer.contentPreference === 'MATURE' || listing.hostProfileId === viewer.id
      })
    ),
    nextCursor:
      hasNextPage && last?.publishedAt
        ? { publishedAt: socialIso(last.publishedAt), listingPublicId: last.id }
        : null
  }
}

export async function getSocialListing(
  db: DBLike,
  userId: string,
  listingPublicId: string
): Promise<SocialListingDto> {
  const viewer = await requireActiveSocialProfile(db, userId)
  const repository = createSocialRepository(db)
  const listing =
    (await repository.findOwnedSocialListing(userId, listingPublicId)) ??
    (await repository.findVisibleSocialListing(viewer.id, listingPublicId))
  if (!listing) throw new SocialNotFoundError()
  return mapSocialListing(listing, {
    showMatureText: viewer.contentPreference === 'MATURE' || listing.hostProfileId === viewer.id
  })
}

export async function getOwnedSocialListing(
  db: DBLike,
  userId: string,
  listingPublicId: string
): Promise<SocialListingDto> {
  await requireActiveSocialProfile(db, userId)
  const listing = await createSocialRepository(db).findOwnedSocialListing(userId, listingPublicId)
  if (!listing) throw new SocialNotFoundError()
  return mapSocialListing(listing, { privateOwnerView: true })
}

export async function listOwnedSocialListings(
  db: DBLike,
  userId: string
): Promise<SocialListingDto[]> {
  await requireActiveSocialProfile(db, userId)
  return (await createSocialRepository(db).listOwnedSocialListings(userId)).map((listing) =>
    mapSocialListing(listing, { privateOwnerView: true })
  )
}

export function createSocialListing(
  db: DBLike,
  userId: string,
  input: CreateSocialListingInput
): Promise<SocialListingDto> {
  return withTransaction(db, async (trx) => {
    await requireActiveSocialProfile(trx, userId)
    await assertCapacityWithinTier(trx, userId, input.capacity, 0)
    const campaign = await createCampaignRepository(trx).lockCampaign(input.campaignId)
    if (!campaign) throw new SocialNotFoundError()
    if (campaign.ownerUserId !== userId) throw new SocialAccessError()
    if (campaign.status !== 'ACTIVE') {
      throw new SocialConflictError('Archived Campaigns cannot have Social listings.')
    }
    assertScheduleAllowedForCampaign(campaign, input.schedule.kind)
    try {
      return mapSocialListing(
        await createSocialRepository(trx).createSocialListing(
          input.campaignId,
          toListingWrite(input, campaign)
        ),
        { privateOwnerView: true }
      )
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: unknown }).code === '23505'
      ) {
        throw new SocialConflictError('This Campaign already has a Social listing.')
      }
      throw error
    }
  })
}

export async function updateSocialListing(
  db: DBLike,
  userId: string,
  input: UpdateSocialListingInput
): Promise<SocialListingDto> {
  return withTransaction(db, async (trx) => {
    await requireActiveSocialProfile(trx, userId)
    const repository = createSocialRepository(trx)
    const preliminary = await repository.findSocialListingById(input.listingPublicId)
    if (!preliminary || preliminary.campaignOwnerUserId !== userId) {
      throw new SocialNotFoundError()
    }
    await assertCapacityWithinTier(trx, userId, input.capacity, preliminary.activePlayerCount)
    const current = await repository.lockSocialListing(input.listingPublicId)
    if (!current || current.campaignOwnerUserId !== userId) throw new SocialNotFoundError()
    if (input.capacity < current.activePlayerCount) {
      throw new SocialValidationError('Capacity cannot be lower than the active player count.')
    }
    const campaign = await createCampaignRepository(trx).lockCampaign(current.campaignId)
    if (!campaign || campaign.ownerUserId !== userId) throw new SocialNotFoundError()
    if (campaign.status !== 'ACTIVE') {
      throw new SocialConflictError('Archived Campaigns cannot be edited in Social Hub.')
    }
    if (current.version !== input.expectedVersion) throw new SocialConflictError()
    const next = toListingWrite(input, campaign)
    assertScheduleAllowedForCampaign(campaign, next.scheduleKind)
    const updated = await repository.updateSocialListing(
      current.id,
      input.expectedVersion,
      next,
      new Date().toISOString()
    )
    if (!updated) throw new SocialConflictError()
    if (isMaterialListingEdit(current, next)) {
      const now = new Date().toISOString()
      const [applicationIds, inviteIds] = await Promise.all([
        repository.expireSubmittedSocialApplications(current.id, now),
        createCampaignRepository(trx).expirePendingInvites(current.id, now)
      ])
      await Promise.all([
        enqueueApplicationSubmittedCancellations(trx, applicationIds, now),
        enqueueInvitationReceivedCancellations(trx, inviteIds, now)
      ])
    } else {
      const now = new Date().toISOString()
      await Promise.all([
        repository.advanceSubmittedSocialApplicationListingVersions(
          current.id,
          updated.version,
          now
        ),
        createCampaignRepository(trx).advancePendingInviteListingVersions(
          current.id,
          updated.version,
          now
        )
      ])
    }
    return mapSocialListing(updated, { privateOwnerView: true })
  })
}

export async function openSocialListing(
  db: DBLike,
  userId: string,
  listingPublicId: string,
  expectedVersion: number
): Promise<SocialListingDto> {
  return withTransaction(db, async (trx) => {
    await requireActiveSocialProfile(trx, userId)
    const repository = createSocialRepository(trx)
    const preliminary = await repository.findSocialListingById(listingPublicId)
    if (!preliminary || preliminary.campaignOwnerUserId !== userId) {
      throw new SocialNotFoundError()
    }
    const tier = await assertCapacityWithinTier(
      trx,
      userId,
      preliminary.capacity,
      preliminary.activePlayerCount
    )
    const listing = await repository.lockSocialListing(listingPublicId)
    if (!listing || listing.campaignOwnerUserId !== userId) throw new SocialNotFoundError()
    const campaign = await createCampaignRepository(trx).lockCampaign(listing.campaignId)
    if (!campaign || campaign.ownerUserId !== userId) throw new SocialNotFoundError()
    if (listing.version !== expectedVersion) throw new SocialConflictError()
    if (listing.status !== 'DRAFT') {
      throw new SocialConflictError('Only draft Social listings can be opened.')
    }
    if (campaign.status !== 'ACTIVE') {
      throw new SocialConflictError('Archived Campaigns cannot be listed.')
    }
    assertScheduleAllowedForCampaign(campaign, listing.scheduleKind)
    if (listing.moderationStatus !== 'VISIBLE') {
      throw new SocialAccessError('A hidden Social listing cannot be opened.')
    }
    assertFreeListing(listing)
    if (listing.audience === 'PUBLIC') {
      const usage = await createAccountEntitlementsRepository(trx).countUsage(userId)
      assertEntitlementLimit(
        'publicListings',
        usage.publicListings,
        ENTITLEMENT_LIMITS[tier].publicListings
      )
    }
    const opened = await repository.setSocialListingStatus({
      listingId: listing.id,
      expectedVersion,
      status: 'OPEN',
      now: new Date().toISOString()
    })
    if (!opened) throw new SocialConflictError()
    return mapSocialListing(opened, { privateOwnerView: true })
  })
}

export function closeSocialListing(
  db: DBLike,
  userId: string,
  listingPublicId: string,
  expectedVersion: number
): Promise<SocialListingDto> {
  return withTransaction(db, async (trx) => {
    await requireActiveSocialProfile(trx, userId)
    const repository = createSocialRepository(trx)
    const listing = await repository.lockSocialListing(listingPublicId)
    if (!listing || listing.campaignOwnerUserId !== userId) throw new SocialNotFoundError()
    const campaign = await createCampaignRepository(trx).lockCampaign(listing.campaignId)
    if (!campaign || campaign.ownerUserId !== userId) throw new SocialNotFoundError()
    if (listing.version !== expectedVersion) throw new SocialConflictError()
    if (listing.status !== 'OPEN') {
      throw new SocialConflictError('Only open Social listings can be closed.')
    }
    const now = new Date().toISOString()
    const closed = await repository.setSocialListingStatus({
      listingId: listing.id,
      expectedVersion,
      status: 'CLOSED',
      now
    })
    if (!closed) throw new SocialConflictError()
    const [applicationIds, inviteIds] = await Promise.all([
      repository.expireSubmittedSocialApplications(listing.id, now),
      createCampaignRepository(trx).expirePendingInvites(listing.id, now)
    ])
    await Promise.all([
      enqueueApplicationSubmittedCancellations(trx, applicationIds, now),
      enqueueInvitationReceivedCancellations(trx, inviteIds, now)
    ])
    return mapSocialListing(closed, { privateOwnerView: true })
  })
}

export function deleteSocialListingDraft(
  db: DBLike,
  userId: string,
  listingPublicId: string,
  expectedVersion: number
): Promise<void> {
  return withTransaction(db, async (trx) => {
    await requireActiveSocialProfile(trx, userId)
    const repository = createSocialRepository(trx)
    const listing = await repository.lockSocialListing(listingPublicId)
    if (!listing || listing.campaignOwnerUserId !== userId) throw new SocialNotFoundError()
    const campaign = await createCampaignRepository(trx).lockCampaign(listing.campaignId)
    if (!campaign || campaign.ownerUserId !== userId) throw new SocialNotFoundError()
    if (listing.status !== 'DRAFT' || listing.version !== expectedVersion) {
      throw new SocialConflictError('Only the current draft Social listing can be deleted.')
    }
    if (!(await repository.deleteDraftSocialListing(listing.id, expectedVersion))) {
      throw new SocialConflictError()
    }
  })
}

export { listingExpectations }
