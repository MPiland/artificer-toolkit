import { randomUUID } from 'node:crypto'
import {
  createAccountEntitlementsRepository,
  createCampaignAdjustmentsRepository,
  createCampaignContentRepository,
  createCampaignRepository,
  createSocialRepository,
  withTransaction,
  type CampaignAuthorityRecord,
  type CampaignListRecord,
  type CampaignMembershipRecord,
  type CampaignRole,
  type DBLike
} from '@artificer-toolkit/db'
import type {
  CampaignDetailDto,
  CampaignInviteDto,
  CampaignSummaryDto,
  CreateCampaignInput,
  CreateCampaignInviteInput,
  UpdateCampaignInput
} from '@artificer-toolkit/schema/api/campaigns'
import {
  presentCampaignPlainText,
  presentCampaignRichText
} from '@artificer-toolkit/shared/campaign/textPolicy'
import { ENTITLEMENT_LIMITS, assertEntitlementLimit } from '../account/entitlementService.js'
import { reconcileCharacterAfterCampaignContentRemoval } from '../character/campaignCharacterReconciliation.js'
import {
  enqueueApplicationSubmittedCancellations,
  enqueueInvitationDecisionNotifications,
  enqueueInvitationReceivedCancellations,
  enqueueInvitationReceivedNotification,
  expireDueCampaignInvitationsForUser
} from '../notifications/notificationService.js'
import { acceptSocialAdmission } from '../social/applicationService.js'
import {
  SocialConflictError,
  SocialNotFoundError,
  SocialValidationError
} from '../social/errors.js'
import { mapCampaignInvite, socialIso } from '../social/mapping.js'
import { requireActiveSocialProfile } from '../social/profileService.js'
import { consumeSocialRateLimit } from '../social/rateLimits.js'
import { reconcileCampaignCurrencyDeparture } from './campaignInventoryService.js'
import { broadcastCampaignInvalidation } from './realtimeService.js'

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_INVITE_MS = 7 * DAY_MS
const MAX_INVITE_MS = 30 * DAY_MS
const TRANSFER_MS = 7 * DAY_MS

export class CampaignAccessError extends Error {
  constructor(message = 'You cannot perform this Campaign action.') {
    super(message)
    this.name = 'CampaignAccessError'
  }
}

export class CampaignNotFoundError extends Error {
  constructor() {
    super('Campaign not found.')
    this.name = 'CampaignNotFoundError'
  }
}

export class CampaignConflictError extends Error {
  constructor(message = 'Campaign changed before this action completed.') {
    super(message)
    this.name = 'CampaignConflictError'
  }
}

export class CampaignValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CampaignValidationError'
  }
}

export interface CampaignAuthority {
  campaign: {
    id: string
    publicId: string
    ownerUserId: string
    name: string
    description: string | null
    format: 'ONE_SHOT' | 'ONGOING'
    toneTags: Array<
      'LIGHTHEARTED' | 'HEROIC' | 'SERIOUS' | 'DARK' | 'GRITTY' | 'HORROR' | 'COMEDIC' | 'COZY'
    >
    toneDetails: string | null
    contentMaturity: 'STANDARD' | 'MATURE'
    attunementSlotOverride: number | null
    status: 'ACTIVE' | 'ARCHIVED'
    version: number
    createdAt: string
    updatedAt: string
  }
  membership: {
    userId: string
    role: CampaignRole
    status: 'ACTIVE' | 'LEFT'
    accessStartedAt: string
    joinedAt: string
    leftAt: string | null
  }
  assignedCharacter: { id: string; publicId: string; label: string; systemId: string } | null
}

function toIso(value: string | Date): string {
  return typeof value === 'string' ? new Date(value).toISOString() : value.toISOString()
}

function normalizeAuthority(authority: CampaignAuthorityRecord): CampaignAuthority {
  return {
    campaign: {
      ...authority.campaign,
      createdAt: toIso(authority.campaign.createdAt),
      updatedAt: toIso(authority.campaign.updatedAt)
    },
    membership: {
      userId: authority.membership.userId,
      role: authority.membership.role,
      status: authority.membership.status,
      accessStartedAt: toIso(authority.membership.accessStartedAt),
      joinedAt: toIso(authority.membership.joinedAt),
      leftAt: authority.membership.leftAt ? toIso(authority.membership.leftAt) : null
    },
    assignedCharacter: authority.assignedCharacter
  }
}

export async function resolveCampaignAuthority(
  db: DBLike,
  campaignId: string,
  userId: string
): Promise<CampaignAuthority> {
  const authority = await createCampaignRepository(db).findAuthority(campaignId, userId)
  if (!authority) throw new CampaignNotFoundError()
  return normalizeAuthority(authority)
}

export function assertActiveCampaignMember(authority: CampaignAuthority): void {
  if (authority.membership.status !== 'ACTIVE') throw new CampaignAccessError()
}

export function assertCampaignOwner(authority: CampaignAuthority): void {
  assertActiveCampaignMember(authority)
  if (authority.membership.role !== 'OWNER') throw new CampaignAccessError()
}

export function assertCampaignWritable(authority: CampaignAuthority): void {
  assertActiveCampaignMember(authority)
  if (authority.campaign.status !== 'ACTIVE') {
    throw new CampaignConflictError('Archived Campaigns are read-only.')
  }
}

export function getCampaignCapabilities(
  status: 'ACTIVE' | 'ARCHIVED',
  role: CampaignRole
): CampaignSummaryDto['capabilities'] {
  const readTableChat = true
  const readPartyChat = role === 'PLAYER'
  if (status === 'ARCHIVED') {
    return {
      edit: false,
      archive: false,
      delete: false,
      invite: false,
      manageMembers: false,
      manageCharacters: false,
      assignOwnCharacter: false,
      manageContent: false,
      submitContent: false,
      managePartyInventory: false,
      transferOwnInventory: false,
      manageNotes: false,
      contributeSessionNotes: false,
      readTableChat,
      readPartyChat
    }
  }

  const owner = role === 'OWNER'
  return {
    edit: owner,
    archive: owner,
    delete: owner,
    invite: owner,
    manageMembers: owner,
    manageCharacters: owner,
    assignOwnCharacter: !owner,
    manageContent: owner,
    submitContent: !owner,
    managePartyInventory: owner,
    transferOwnInventory: !owner,
    manageNotes: owner,
    contributeSessionNotes: true,
    readTableChat,
    readPartyChat
  }
}

function mapSummary(record: CampaignListRecord): CampaignSummaryDto {
  const maturity = record.contentMaturity
  return {
    id: record.id,
    publicId: record.publicId,
    name: presentCampaignPlainText(record.name, maturity),
    description: record.description ? presentCampaignRichText(record.description, maturity) : null,
    format: record.format,
    toneTags: record.toneTags,
    toneDetails: record.toneDetails ? presentCampaignPlainText(record.toneDetails, maturity) : null,
    contentMaturity: maturity,
    status: record.status,
    role: record.role,
    version: record.version,
    memberCount: record.memberCount,
    playerCount: record.playerCount,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
    capabilities: getCampaignCapabilities(record.status, record.role),
    assignedCharacter: record.assignedCharacter
  }
}

async function buildDetail(
  db: DBLike,
  authority: CampaignAuthority,
  privateOwnerView = false
): Promise<CampaignDetailDto> {
  const repository = createCampaignRepository(db)
  const [counts, memberships] = await Promise.all([
    repository.countActiveMembers(authority.campaign.id),
    repository.listActiveMemberships(authority.campaign.id)
  ])

  return {
    id: authority.campaign.id,
    publicId: authority.campaign.publicId,
    name: privateOwnerView
      ? authority.campaign.name
      : presentCampaignPlainText(authority.campaign.name, authority.campaign.contentMaturity),
    description:
      privateOwnerView || !authority.campaign.description
        ? authority.campaign.description
        : presentCampaignRichText(
            authority.campaign.description,
            authority.campaign.contentMaturity
          ),
    format: authority.campaign.format,
    toneTags: authority.campaign.toneTags,
    toneDetails:
      privateOwnerView || !authority.campaign.toneDetails
        ? authority.campaign.toneDetails
        : presentCampaignPlainText(
            authority.campaign.toneDetails,
            authority.campaign.contentMaturity
          ),
    contentMaturity: authority.campaign.contentMaturity,
    attunementSlotOverride: authority.campaign.attunementSlotOverride,
    status: authority.campaign.status,
    role: authority.membership.role,
    version: authority.campaign.version,
    memberCount: counts.members,
    playerCount: counts.players,
    createdAt: authority.campaign.createdAt,
    updatedAt: authority.campaign.updatedAt,
    capabilities: getCampaignCapabilities(authority.campaign.status, authority.membership.role),
    assignedCharacter: authority.assignedCharacter,
    memberships: memberships.map((membership) => ({
      userId: membership.userId,
      username: membership.username,
      role: membership.role,
      accessStartedAt: toIso(membership.accessStartedAt),
      acceptedAt: toIso(membership.acceptedAt),
      assignedCharacter: membership.assignedCharacter
    }))
  }
}

async function lockAuthority(
  db: DBLike,
  campaignId: string,
  userId: string
): Promise<CampaignAuthority> {
  const repository = createCampaignRepository(db)
  if (!(await repository.lockCampaign(campaignId))) throw new CampaignNotFoundError()
  return resolveCampaignAuthority(db, campaignId, userId)
}

function assertExpectedVersion(authority: CampaignAuthority, expectedVersion: number): void {
  if (authority.campaign.version !== expectedVersion) throw new CampaignConflictError()
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505'
  )
}

function inviteExpiry(expiresAt?: string): string {
  const now = Date.now()
  const expires = expiresAt ? Date.parse(expiresAt) : now + DEFAULT_INVITE_MS
  if (!Number.isFinite(expires) || expires <= now || expires > now + MAX_INVITE_MS) {
    throw new CampaignValidationError('Invite expiry must be within the next 30 days.')
  }
  return new Date(expires).toISOString()
}

async function requireActivePlayer(
  db: DBLike,
  campaignId: string,
  userId: string
): Promise<CampaignMembershipRecord> {
  const membership = await createCampaignRepository(db).findMembership(campaignId, userId)
  if (!membership || membership.status !== 'ACTIVE' || membership.role !== 'PLAYER') {
    throw new CampaignAccessError()
  }
  return membership
}

async function removeAssignedCharacterCampaignState(
  db: DBLike,
  input: { campaignId: string; characterId: string; actorUserId: string; reason: string }
): Promise<void> {
  await createCampaignContentRepository(db).deleteAssignmentBindings(
    input.campaignId,
    input.characterId
  )
  await reconcileCampaignCurrencyDeparture(db, input)
}

async function reconcileRemovedCharacter(
  db: DBLike,
  input: { campaignId: string; characterId: string; actorUserId: string; reason: string }
): Promise<void> {
  if (!(await reconcileCharacterAfterCampaignContentRemoval(db, input.characterId))) return
  await createCampaignAdjustmentsRepository(db).insertCampaignEvent({
    campaignId: input.campaignId,
    actorUserId: input.actorUserId,
    subjectCharacterId: input.characterId,
    kind: 'CAMPAIGN_CHARACTER_RECONCILED',
    visibility: 'SUBJECT',
    payload: { reason: input.reason }
  })
}

export async function listCampaigns(db: DBLike, userId: string): Promise<CampaignSummaryDto[]> {
  return (await createCampaignRepository(db).listForActiveMember(userId)).map(mapSummary)
}

export async function getCampaign(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<CampaignDetailDto> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  return buildDetail(db, authority)
}

export async function getCampaignSettings(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<CampaignDetailDto> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertCampaignOwner(authority)
  return buildDetail(db, authority, true)
}

export function createCampaign(
  db: DBLike,
  userId: string,
  input: CreateCampaignInput
): Promise<CampaignDetailDto> {
  return withTransaction(db, async (trx) => {
    const entitlementRepository = createAccountEntitlementsRepository(trx)
    const tier = await entitlementRepository.lockTier(userId)
    const limits = ENTITLEMENT_LIMITS[tier]
    const repository = createCampaignRepository(trx)
    assertEntitlementLimit(
      'activeHostedCampaigns',
      await repository.countActiveOwned(userId),
      limits.activeHostedCampaigns
    )
    const campaign = await repository.createCampaign(userId, {
      name: input.name,
      description: input.description ?? null,
      format: input.format,
      tone_tags: input.toneTags,
      tone_details: input.toneDetails ?? null,
      content_maturity: input.contentMaturity
    })
    await repository.insertOwnerMembership(campaign.id, userId)
    return buildDetail(trx, await resolveCampaignAuthority(trx, campaign.id, userId))
  })
}

export async function updateCampaign(
  db: DBLike,
  userId: string,
  input: UpdateCampaignInput
): Promise<CampaignDetailDto> {
  const updated = await withTransaction(db, async (trx) => {
    const socialRepository = createSocialRepository(trx)
    const currentListing = await socialRepository.findSocialListingByCampaign(input.campaignId)
    const lockedListing = currentListing
      ? await socialRepository.lockSocialListing(currentListing.id)
      : null
    const authority = await lockAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    assertExpectedVersion(authority, input.expectedVersion)
    if (
      input.format === 'ONE_SHOT' &&
      lockedListing?.status === 'OPEN' &&
      lockedListing.scheduleKind === 'RECURRING'
    ) {
      throw new CampaignConflictError(
        'Close or reschedule the recurring Social listing before changing this Campaign to One-shot.'
      )
    }

    const nextName = input.name ?? authority.campaign.name
    const nextFormat = input.format ?? authority.campaign.format
    const nextToneTags = input.toneTags ?? authority.campaign.toneTags
    const nextToneDetails =
      input.toneDetails === undefined ? authority.campaign.toneDetails : input.toneDetails
    const nextMaturity = input.contentMaturity ?? authority.campaign.contentMaturity
    const projectionChanged =
      nextName !== authority.campaign.name ||
      nextFormat !== authority.campaign.format ||
      nextToneDetails !== authority.campaign.toneDetails ||
      nextMaturity !== authority.campaign.contentMaturity ||
      nextToneTags.length !== authority.campaign.toneTags.length ||
      nextToneTags.some((tag, index) => tag !== authority.campaign.toneTags[index])
    const materialProjectionChanged =
      nextFormat !== authority.campaign.format ||
      nextToneDetails !== authority.campaign.toneDetails ||
      nextMaturity !== authority.campaign.contentMaturity ||
      nextToneTags.length !== authority.campaign.toneTags.length ||
      nextToneTags.some((tag, index) => tag !== authority.campaign.toneTags[index])

    const updated = await createCampaignRepository(trx).updateCampaign(
      input.campaignId,
      input.expectedVersion,
      {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.format === undefined ? {} : { format: input.format }),
        ...(input.toneTags === undefined ? {} : { tone_tags: input.toneTags }),
        ...(input.toneDetails === undefined ? {} : { tone_details: input.toneDetails }),
        ...(input.contentMaturity === undefined ? {} : { content_maturity: input.contentMaturity }),
        ...(input.attunementSlotOverride === undefined
          ? {}
          : { attunement_slot_override: input.attunementSlotOverride })
      }
    )
    if (!updated) throw new CampaignConflictError()
    if (lockedListing && projectionChanged) {
      const now = new Date().toISOString()
      const synced = await socialRepository.syncSocialListingCampaignProjection({
        listingId: lockedListing.id,
        expectedVersion: lockedListing.version,
        title: nextName,
        campaignFormat: nextFormat,
        toneTags: nextToneTags,
        toneDetails: nextToneDetails,
        contentMaturity: nextMaturity,
        now
      })
      if (!synced) throw new CampaignConflictError()
      if (materialProjectionChanged) {
        const [applicationIds, inviteIds] = await Promise.all([
          socialRepository.expireSubmittedSocialApplications(synced.id, now),
          createCampaignRepository(trx).expirePendingInvites(synced.id, now)
        ])
        await Promise.all([
          enqueueApplicationSubmittedCancellations(trx, applicationIds, now),
          enqueueInvitationReceivedCancellations(trx, inviteIds, now)
        ])
      } else {
        await Promise.all([
          socialRepository.advanceSubmittedSocialApplicationListingVersions(
            synced.id,
            synced.version,
            now
          ),
          createCampaignRepository(trx).advancePendingInviteListingVersions(
            synced.id,
            synced.version,
            now
          )
        ])
      }
    }
    return buildDetail(trx, await resolveCampaignAuthority(trx, input.campaignId, userId))
  })
  const eventId = randomUUID()
  await broadcastCampaignInvalidation(db, input.campaignId, {
    scope: 'TABLE',
    entity: 'CAMPAIGN',
    entityId: input.campaignId,
    event: 'UPDATED',
    eventId,
    cursor: eventId
  })
  return updated
}

export function archiveCampaign(
  db: DBLike,
  userId: string,
  campaignId: string,
  expectedVersion: number
): Promise<CampaignDetailDto> {
  return withTransaction(db, async (trx) => {
    const socialRepository = createSocialRepository(trx)
    const existingListing = await socialRepository.findSocialListingByCampaign(campaignId)
    const lockedListing = existingListing
      ? await socialRepository.lockSocialListing(existingListing.id)
      : null
    const authority = await lockAuthority(trx, campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    assertExpectedVersion(authority, expectedVersion)
    if (!(await createCampaignRepository(trx).archiveCampaign(campaignId, expectedVersion))) {
      throw new CampaignConflictError()
    }
    if (lockedListing) {
      const now = new Date().toISOString()
      const [applicationIds, inviteIds] = await Promise.all([
        socialRepository.expireSubmittedSocialApplications(lockedListing.id, now),
        createCampaignRepository(trx).expirePendingInvites(lockedListing.id, now)
      ])
      await Promise.all([
        enqueueApplicationSubmittedCancellations(trx, applicationIds, now),
        enqueueInvitationReceivedCancellations(trx, inviteIds, now)
      ])
    }
    return buildDetail(trx, await resolveCampaignAuthority(trx, campaignId, userId))
  })
}

export interface DeleteCampaignReconciliation {
  campaignId: string
  assignmentCount: number
  unassignedCharacterIds: string[]
}

export function deleteCampaign(
  db: DBLike,
  userId: string,
  campaignId: string,
  expectedVersion: number
): Promise<DeleteCampaignReconciliation> {
  return withTransaction(db, async (trx) => {
    const socialRepository = createSocialRepository(trx)
    const existingListing = await socialRepository.findSocialListingByCampaign(campaignId)
    const lockedListing = existingListing
      ? await socialRepository.lockSocialListing(existingListing.id)
      : null
    const authority = await lockAuthority(trx, campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    assertExpectedVersion(authority, expectedVersion)
    const repository = createCampaignRepository(trx)
    if (lockedListing) {
      const now = new Date().toISOString()
      const [applicationIds, inviteIds] = await Promise.all([
        socialRepository.expireSubmittedSocialApplications(lockedListing.id, now),
        repository.expirePendingInvites(lockedListing.id, now)
      ])
      await Promise.all([
        enqueueApplicationSubmittedCancellations(trx, applicationIds, now),
        enqueueInvitationReceivedCancellations(trx, inviteIds, now)
      ])
    }
    const unassignedCharacterIds = (await repository.listAssignmentCharacterIds(campaignId)).sort()
    for (const characterId of unassignedCharacterIds) {
      await removeAssignedCharacterCampaignState(trx, {
        campaignId,
        characterId,
        actorUserId: userId,
        reason: 'CAMPAIGN_DELETED'
      })
      const removedCharacterId = await repository.deleteAssignmentByCharacter(
        campaignId,
        characterId
      )
      if (removedCharacterId) {
        await reconcileRemovedCharacter(trx, {
          campaignId,
          characterId: removedCharacterId,
          actorUserId: userId,
          reason: 'CAMPAIGN_DELETED'
        })
      }
    }
    if (!(await repository.deleteCampaign(campaignId, expectedVersion))) {
      throw new CampaignConflictError()
    }
    return {
      campaignId,
      assignmentCount: unassignedCharacterIds.length,
      unassignedCharacterIds
    }
  })
}

export function createCampaignInvite(
  db: DBLike,
  userId: string,
  input: CreateCampaignInviteInput
): Promise<CampaignInviteDto> {
  return withTransaction(db, async (trx) => {
    const host = await requireActiveSocialProfile(trx, userId)
    const socialRepository = createSocialRepository(trx)
    const listing = await socialRepository.lockSocialListing(input.listingPublicId)
    if (!listing || listing.campaignOwnerUserId !== userId) throw new SocialNotFoundError()
    if (
      listing.version !== input.expectedListingVersion ||
      listing.status !== 'OPEN' ||
      listing.moderationStatus !== 'VISIBLE' ||
      listing.campaignStatus !== 'ACTIVE'
    ) {
      throw new SocialConflictError('This Social listing is not available for invitations.')
    }
    const repository = createCampaignRepository(trx)
    const campaign = await repository.lockCampaign(listing.campaignId)
    if (!campaign || campaign.ownerUserId !== userId || campaign.status !== 'ACTIVE') {
      throw new SocialNotFoundError()
    }
    const now = new Date().toISOString()
    await consumeSocialRateLimit(trx, userId, 'INVITE', [{ window: 'HOUR', limit: 20 }], now)
    const recipient = await repository.findInviteRecipientByUsername(input.username)
    if (!recipient || recipient.status !== 'ACTIVE' || recipient.userId === userId) {
      throw new SocialNotFoundError()
    }
    if (await socialRepository.hasSocialBlockEitherDirection(host.id, recipient.profileId)) {
      throw new SocialNotFoundError()
    }
    const membership = await repository.findMembership(campaign.id, recipient.userId)
    if (membership?.status === 'ACTIVE') {
      throw new SocialValidationError('This user is already a Campaign member.')
    }
    const tier = await createAccountEntitlementsRepository(trx).lockTier(userId)
    const counts = await repository.countActiveMembers(campaign.id)
    if (counts.players >= listing.capacity) {
      throw new SocialConflictError('This table no longer has an available seat.')
    }
    assertEntitlementLimit(
      'playerSeatsPerCampaign',
      counts.players,
      ENTITLEMENT_LIMITS[tier].playerSeatsPerCampaign
    )
    let invite
    try {
      invite = await repository.insertInvite({
        listingId: listing.id,
        createdBy: userId,
        recipientUserId: recipient.userId,
        recipientUsername: recipient.username,
        listingVersion: listing.version,
        expiresAt: inviteExpiry(input.expiresAt)
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new SocialConflictError('This user already has a pending invitation.')
      }
      throw error
    }
    await enqueueInvitationReceivedNotification(trx, invite, {
      listingTitle: listing.title,
      hostUsername: host.username,
      occurredAt: now
    })
    return {
      invitePublicId: invite.id,
      listingPublicId: listing.id,
      listingTitle: listing.title,
      hostProfilePublicId: host.id,
      hostUsername: host.username,
      recipientUsername: recipient.username,
      status: invite.status,
      expiresAt: socialIso(invite.expiresAt),
      respondedAt: null,
      createdAt: socialIso(invite.createdAt),
      version: invite.version
    }
  })
}

export async function listReceivedCampaignInvites(
  db: DBLike,
  userId: string
): Promise<CampaignInviteDto[]> {
  return withTransaction(db, async (trx) => {
    const recipient = await requireActiveSocialProfile(trx, userId)
    const socialRepository = createSocialRepository(trx)
    const repository = createCampaignRepository(trx)
    await expireDueCampaignInvitationsForUser(trx, userId, new Date().toISOString())
    const invitations = await repository.listReceivedInvites(userId)
    const visible: CampaignInviteDto[] = []
    for (const invitation of invitations) {
      if (await socialRepository.findActiveSocialProfile(recipient.id, invitation.hostProfileId)) {
        visible.push(mapCampaignInvite(invitation, recipient.contentPreference === 'MATURE'))
      }
    }
    return visible
  })
}

export async function listSentCampaignInvites(
  db: DBLike,
  userId: string,
  listingPublicId: string
): Promise<CampaignInviteDto[]> {
  await requireActiveSocialProfile(db, userId)
  const listing = await createSocialRepository(db).findOwnedSocialListing(userId, listingPublicId)
  if (!listing) throw new SocialNotFoundError()
  return (await createCampaignRepository(db).listInvitesForListing(listing.id)).map((invitation) =>
    mapCampaignInvite(invitation, true)
  )
}

export async function revokeCampaignInvite(
  db: DBLike,
  userId: string,
  invitePublicId: string,
  expectedVersion: number
): Promise<void> {
  const source = await createCampaignRepository(db).lockInvite(invitePublicId)
  if (!source) throw new SocialNotFoundError()
  return withTransaction(db, async (trx) => {
    await requireActiveSocialProfile(trx, userId)
    const repository = createCampaignRepository(trx)
    const listing = await createSocialRepository(trx).lockSocialListing(source.listingId)
    if (!listing || listing.campaignOwnerUserId !== userId) throw new SocialNotFoundError()
    const campaign = await repository.lockCampaign(listing.campaignId)
    if (!campaign || campaign.ownerUserId !== userId) throw new SocialNotFoundError()
    const invite = await repository.lockInvite(invitePublicId)
    if (!invite || invite.listingId !== listing.id) throw new SocialNotFoundError()
    if (invite.status !== 'PENDING' || invite.version !== expectedVersion) {
      throw new SocialConflictError()
    }
    const now = new Date().toISOString()
    const revoked = await repository.setInviteStatus({
      inviteId: invite.id,
      expectedVersion,
      status: 'REVOKED',
      now
    })
    if (!revoked) throw new SocialConflictError()
    await enqueueInvitationReceivedCancellations(trx, [revoked.id], now)
  })
}

export async function acceptCampaignInvite(
  db: DBLike,
  userId: string,
  invitePublicId: string,
  expectedVersion: number
): Promise<CampaignDetailDto> {
  await withTransaction(db, async (trx) => {
    await expireDueCampaignInvitationsForUser(trx, userId, new Date().toISOString())
  })
  const result = await acceptSocialAdmission(db, userId, {
    kind: 'INVITATION',
    publicId: invitePublicId,
    expectedVersion
  })
  if (result.kind !== 'INVITATION') throw new SocialConflictError()
  return getCampaign(db, userId, result.campaignId)
}

export async function declineCampaignInvite(
  db: DBLike,
  userId: string,
  invitePublicId: string,
  expectedVersion: number
): Promise<CampaignInviteDto> {
  await withTransaction(db, async (trx) => {
    await expireDueCampaignInvitationsForUser(trx, userId, new Date().toISOString())
  })
  const source = await createCampaignRepository(db).lockInvite(invitePublicId)
  if (!source) throw new SocialNotFoundError()
  return withTransaction(db, async (trx) => {
    const recipient = await requireActiveSocialProfile(trx, userId)
    const repository = createCampaignRepository(trx)
    const listing = await createSocialRepository(trx).lockSocialListing(source.listingId)
    if (!listing) throw new SocialNotFoundError()
    const campaign = await repository.lockCampaign(listing.campaignId)
    if (!campaign) throw new SocialNotFoundError()
    const invite = await repository.lockInvite(invitePublicId)
    if (!invite || invite.listingId !== listing.id || invite.recipientUserId !== userId)
      throw new SocialNotFoundError()
    if (invite.status !== 'PENDING' || invite.version !== expectedVersion) {
      throw new SocialConflictError()
    }
    const projection = (await repository.listReceivedInvites(userId)).find(
      (item) => item.id === invite.id
    )
    if (!projection) throw new SocialNotFoundError()
    if (
      !(await createSocialRepository(trx).findActiveSocialProfile(
        recipient.id,
        projection.hostProfileId
      ))
    ) {
      throw new SocialNotFoundError()
    }
    const now = new Date().toISOString()
    const declined = await repository.setInviteStatus({
      inviteId: invite.id,
      expectedVersion,
      status: 'DECLINED',
      now
    })
    if (!declined) throw new SocialConflictError()
    await enqueueInvitationDecisionNotifications(trx, declined, {
      hostUserId: campaign.ownerUserId,
      listingTitle: listing.title,
      decision: 'DECLINED',
      occurredAt: now
    })
    return mapCampaignInvite(
      { ...projection, ...declined },
      recipient.contentPreference === 'MATURE'
    )
  })
}

export function leaveCampaign(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<{ characterId: string | null }> {
  return withTransaction(db, async (trx) => {
    const authority = await lockAuthority(trx, campaignId, userId)
    assertCampaignWritable(authority)
    if (authority.membership.role !== 'PLAYER') {
      throw new CampaignAccessError('The Campaign owner cannot leave the Campaign.')
    }
    const repository = createCampaignRepository(trx)
    const assignment = await repository.findAssignmentForUser(campaignId, userId)
    if (assignment) {
      await removeAssignedCharacterCampaignState(trx, {
        campaignId,
        characterId: assignment.characterId,
        actorUserId: userId,
        reason: 'MEMBER_LEFT'
      })
    }
    const characterId = await repository.deleteAssignmentForUser(campaignId, userId)
    if (characterId)
      await reconcileRemovedCharacter(trx, {
        campaignId,
        characterId,
        actorUserId: userId,
        reason: 'MEMBER_LEFT'
      })
    if (!(await repository.leaveMembership(campaignId, userId, new Date().toISOString()))) {
      throw new CampaignConflictError()
    }
    return { characterId }
  })
}

export function removeCampaignMember(
  db: DBLike,
  ownerUserId: string,
  campaignId: string,
  targetUserId: string
): Promise<{ characterId: string | null }> {
  return withTransaction(db, async (trx) => {
    const authority = await lockAuthority(trx, campaignId, ownerUserId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    await requireActivePlayer(trx, campaignId, targetUserId)
    const repository = createCampaignRepository(trx)
    const assignment = await repository.findAssignmentForUser(campaignId, targetUserId)
    if (assignment) {
      await removeAssignedCharacterCampaignState(trx, {
        campaignId,
        characterId: assignment.characterId,
        actorUserId: ownerUserId,
        reason: 'MEMBER_REMOVED'
      })
    }
    const characterId = await repository.deleteAssignmentForUser(campaignId, targetUserId)
    if (characterId)
      await reconcileRemovedCharacter(trx, {
        campaignId,
        characterId,
        actorUserId: ownerUserId,
        reason: 'MEMBER_REMOVED'
      })
    if (!(await repository.leaveMembership(campaignId, targetUserId, new Date().toISOString()))) {
      throw new CampaignConflictError()
    }
    return { characterId }
  })
}

export function assignCampaignCharacter(
  db: DBLike,
  actorUserId: string,
  campaignId: string,
  characterId: string
): Promise<{ characterId: string }> {
  return withTransaction(db, async (trx) => {
    const authority = await lockAuthority(trx, campaignId, actorUserId)
    assertCampaignWritable(authority)
    const repository = createCampaignRepository(trx)
    const character = await repository.findCharacter(characterId)
    if (!character) throw new CampaignValidationError('Character not found.')
    if (authority.membership.role === 'PLAYER') {
      if (character.userId !== actorUserId) throw new CampaignAccessError()
    } else {
      if (character.userId === actorUserId) {
        throw new CampaignAccessError('The Campaign owner cannot assign their own Character.')
      }
      await requireActivePlayer(trx, campaignId, character.userId)
    }

    const current = await repository.findAssignmentForUser(campaignId, character.userId)
    if (current?.characterId === characterId) return { characterId }
    const systems = await repository.listAssignedSystemIdsExceptUser(campaignId, character.userId)
    if (systems.some((systemId) => systemId !== character.systemId)) {
      // ponytail: the first Character establishes compatibility until Campaigns store a system id.
      throw new CampaignValidationError(
        'Character uses a different game system from this Campaign.'
      )
    }

    if (current) {
      await removeAssignedCharacterCampaignState(trx, {
        campaignId,
        characterId: current.characterId,
        actorUserId,
        reason: 'CHARACTER_REPLACED'
      })
      const removedCharacterId = await repository.deleteAssignmentForUser(
        campaignId,
        character.userId
      )
      if (removedCharacterId) {
        await reconcileRemovedCharacter(trx, {
          campaignId,
          characterId: removedCharacterId,
          actorUserId,
          reason: 'CHARACTER_REPLACED'
        })
      }
    }
    try {
      await repository.insertAssignment(campaignId, character.userId, characterId)
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new CampaignConflictError('Character is already assigned to another Campaign.')
      }
      throw error
    }
    return { characterId }
  })
}

export function unassignCampaignCharacter(
  db: DBLike,
  actorUserId: string,
  campaignId: string,
  characterId?: string
): Promise<{ characterId: string | null }> {
  return withTransaction(db, async (trx) => {
    const authority = await lockAuthority(trx, campaignId, actorUserId)
    assertCampaignWritable(authority)
    const repository = createCampaignRepository(trx)
    if (authority.membership.role === 'PLAYER') {
      if (characterId && characterId !== authority.assignedCharacter?.id)
        throw new CampaignAccessError()
      if (authority.assignedCharacter) {
        await removeAssignedCharacterCampaignState(trx, {
          campaignId,
          characterId: authority.assignedCharacter.id,
          actorUserId,
          reason: 'CHARACTER_UNASSIGNED'
        })
      }
      const removedCharacterId = await repository.deleteAssignmentForUser(campaignId, actorUserId)
      if (removedCharacterId)
        await reconcileRemovedCharacter(trx, {
          campaignId,
          characterId: removedCharacterId,
          actorUserId,
          reason: 'CHARACTER_UNASSIGNED'
        })
      return {
        characterId: removedCharacterId
      }
    }

    if (!characterId)
      throw new CampaignValidationError('Character is required for owner unassignment.')
    const assignment = await repository.findAssignmentByCharacter(campaignId, characterId)
    if (!assignment)
      throw new CampaignValidationError('Character is not assigned to this Campaign.')
    await requireActivePlayer(trx, campaignId, assignment.userId)
    await removeAssignedCharacterCampaignState(trx, {
      campaignId,
      characterId,
      actorUserId,
      reason: 'CHARACTER_UNASSIGNED'
    })
    const removedCharacterId = await repository.deleteAssignmentByCharacter(campaignId, characterId)
    if (removedCharacterId)
      await reconcileRemovedCharacter(trx, {
        campaignId,
        characterId: removedCharacterId,
        actorUserId,
        reason: 'CHARACTER_UNASSIGNED'
      })
    return {
      characterId: removedCharacterId
    }
  })
}

export function requestCampaignOwnershipTransfer(
  db: DBLike,
  ownerUserId: string,
  campaignId: string,
  recipientUserId: string
): Promise<void> {
  return withTransaction(db, async (trx) => {
    const authority = await lockAuthority(trx, campaignId, ownerUserId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    await requireActivePlayer(trx, campaignId, recipientUserId)
    await createCampaignRepository(trx).upsertOwnershipTransfer({
      campaignId,
      fromUserId: ownerUserId,
      toUserId: recipientUserId,
      expiresAt: new Date(Date.now() + TRANSFER_MS).toISOString()
    })
  })
}

export function acceptCampaignOwnershipTransfer(
  db: DBLike,
  recipientUserId: string,
  campaignId: string
): Promise<CampaignDetailDto> {
  return withTransaction(db, async (trx) => {
    const socialRepository = createSocialRepository(trx)
    const existingListing = await socialRepository.findSocialListingByCampaign(campaignId)
    const lockedListing = existingListing
      ? await socialRepository.lockSocialListing(existingListing.id)
      : null
    const repository = createCampaignRepository(trx)
    const campaign = await repository.lockCampaign(campaignId)
    if (!campaign) throw new CampaignNotFoundError()
    if (campaign.status !== 'ACTIVE')
      throw new CampaignConflictError('Archived Campaigns are read-only.')
    const transfer = await repository.findOwnershipTransfer(campaignId)
    if (
      !transfer ||
      transfer.toUserId !== recipientUserId ||
      transfer.fromUserId !== campaign.ownerUserId ||
      Date.parse(toIso(transfer.expiresAt)) <= Date.now()
    ) {
      throw new CampaignValidationError('Ownership transfer is invalid or expired.')
    }
    await requireActivePlayer(trx, campaignId, recipientUserId)

    const entitlementRepository = createAccountEntitlementsRepository(trx)
    const userIds = [transfer.fromUserId, recipientUserId].sort()
    const tiers = new Map<string, keyof typeof ENTITLEMENT_LIMITS>()
    for (const userId of userIds) tiers.set(userId, await entitlementRepository.lockTier(userId))
    const recipientTier = tiers.get(recipientUserId)
    if (!recipientTier) throw new CampaignConflictError()
    assertEntitlementLimit(
      'activeHostedCampaigns',
      await repository.countActiveOwned(recipientUserId),
      ENTITLEMENT_LIMITS[recipientTier].activeHostedCampaigns
    )
    const recipientAssignment = await repository.findAssignmentForUser(campaignId, recipientUserId)
    if (recipientAssignment) {
      await removeAssignedCharacterCampaignState(trx, {
        campaignId,
        characterId: recipientAssignment.characterId,
        actorUserId: recipientUserId,
        reason: 'OWNERSHIP_TRANSFER'
      })
      const removedCharacterId = await repository.deleteAssignmentForUser(
        campaignId,
        recipientUserId
      )
      if (removedCharacterId) {
        await reconcileRemovedCharacter(trx, {
          campaignId,
          characterId: removedCharacterId,
          actorUserId: recipientUserId,
          reason: 'OWNERSHIP_TRANSFER'
        })
      }
    }

    const now = new Date().toISOString()
    if (lockedListing && lockedListing.status !== 'CLOSED') {
      const closed = await socialRepository.setSocialListingStatus({
        listingId: lockedListing.id,
        expectedVersion: lockedListing.version,
        status: 'CLOSED',
        now
      })
      if (!closed) throw new CampaignConflictError()
    }
    if (lockedListing) {
      const [applicationIds, inviteIds] = await Promise.all([
        socialRepository.expireSubmittedSocialApplications(lockedListing.id, now),
        repository.expirePendingInvites(lockedListing.id, now)
      ])
      await Promise.all([
        enqueueApplicationSubmittedCancellations(trx, applicationIds, now),
        enqueueInvitationReceivedCancellations(trx, inviteIds, now)
      ])
    }
    if (
      !(await repository.setMembershipRoleAndAccess(campaignId, transfer.fromUserId, 'PLAYER', now))
    ) {
      throw new CampaignConflictError()
    }
    if (!(await repository.setMembershipRoleAndAccess(campaignId, recipientUserId, 'OWNER', now))) {
      throw new CampaignConflictError()
    }
    if (!(await repository.updateCampaignOwner(campaignId, recipientUserId, campaign.version))) {
      throw new CampaignConflictError()
    }
    await repository.deleteOwnershipTransfer(campaignId)
    return buildDetail(trx, await resolveCampaignAuthority(trx, campaignId, recipientUserId))
  })
}
