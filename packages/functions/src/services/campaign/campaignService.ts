import { createHash, randomBytes } from 'node:crypto'
import {
  createAccountEntitlementsRepository,
  createAccountProfileRepository,
  createCampaignAdjustmentsRepository,
  createCampaignContentRepository,
  createCampaignRepository,
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
import { ENTITLEMENT_LIMITS, assertEntitlementLimit } from '../account/entitlementService.js'
import { reconcileCharacterAfterCampaignContentRemoval } from '../character/campaignCharacterReconciliation.js'
import { reconcileCampaignCurrencyDeparture } from './campaignInventoryService.js'

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
    attunementSlotOverride: number | null
    status: 'ACTIVE' | 'ARCHIVED'
    visibility: 'PRIVATE' | 'PUBLIC'
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
  return {
    id: record.id,
    publicId: record.publicId,
    name: record.name,
    description: record.description,
    status: record.status,
    visibility: record.visibility,
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

async function buildDetail(db: DBLike, authority: CampaignAuthority): Promise<CampaignDetailDto> {
  const repository = createCampaignRepository(db)
  const [counts, memberships] = await Promise.all([
    repository.countActiveMembers(authority.campaign.id),
    repository.listActiveMemberships(authority.campaign.id)
  ])

  return {
    id: authority.campaign.id,
    publicId: authority.campaign.publicId,
    name: authority.campaign.name,
    description: authority.campaign.description,
    attunementSlotOverride: authority.campaign.attunementSlotOverride,
    status: authority.campaign.status,
    visibility: authority.campaign.visibility,
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

function hashInviteToken(token: string): Uint8Array {
  return createHash('sha256').update(token).digest()
}

function inviteExpiry(expiresAt?: string): string {
  const now = Date.now()
  const expires = expiresAt ? Date.parse(expiresAt) : now + DEFAULT_INVITE_MS
  if (!Number.isFinite(expires) || expires <= now || expires > now + MAX_INVITE_MS) {
    throw new CampaignValidationError('Invite expiry must be within the next 30 days.')
  }
  return new Date(expires).toISOString()
}

function invalidInvite(): never {
  throw new CampaignValidationError('Invite is invalid or unavailable.')
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
    const visibility = input.visibility ?? 'PRIVATE'
    if (visibility === 'PUBLIC') {
      assertEntitlementLimit(
        'publicListings',
        await repository.countPublicOwned(userId),
        limits.publicListings
      )
    }

    const campaign = await repository.createCampaign(userId, {
      name: input.name,
      description: input.description ?? null,
      visibility
    })
    await repository.insertOwnerMembership(campaign.id, userId)
    return buildDetail(trx, await resolveCampaignAuthority(trx, campaign.id, userId))
  })
}

export function updateCampaign(
  db: DBLike,
  userId: string,
  input: UpdateCampaignInput
): Promise<CampaignDetailDto> {
  return withTransaction(db, async (trx) => {
    const authority = await lockAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    assertExpectedVersion(authority, input.expectedVersion)

    if (input.visibility === 'PUBLIC' && authority.campaign.visibility !== 'PUBLIC') {
      const tier = await createAccountEntitlementsRepository(trx).lockTier(userId)
      assertEntitlementLimit(
        'publicListings',
        await createCampaignRepository(trx).countPublicOwned(userId),
        ENTITLEMENT_LIMITS[tier].publicListings
      )
    }

    const updated = await createCampaignRepository(trx).updateCampaign(
      input.campaignId,
      input.expectedVersion,
      {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.attunementSlotOverride === undefined
          ? {}
          : { attunement_slot_override: input.attunementSlotOverride }),
        ...(input.visibility === undefined ? {} : { visibility: input.visibility })
      }
    )
    if (!updated) throw new CampaignConflictError()
    return buildDetail(trx, await resolveCampaignAuthority(trx, input.campaignId, userId))
  })
}

export function archiveCampaign(
  db: DBLike,
  userId: string,
  campaignId: string,
  expectedVersion: number
): Promise<CampaignDetailDto> {
  return withTransaction(db, async (trx) => {
    const authority = await lockAuthority(trx, campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    assertExpectedVersion(authority, expectedVersion)
    if (!(await createCampaignRepository(trx).archiveCampaign(campaignId, expectedVersion))) {
      throw new CampaignConflictError()
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
    const authority = await lockAuthority(trx, campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    assertExpectedVersion(authority, expectedVersion)
    const repository = createCampaignRepository(trx)
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
    const authority = await lockAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    const repository = createCampaignRepository(trx)
    let targetUserId: string | null = null
    let targetEmail: string | null = null
    if (input.kind === 'USERNAME') {
      targetUserId = await createAccountProfileRepository(trx).findUserIdByUsername(
        input.target ?? ''
      )
      if (!targetUserId) throw new CampaignValidationError('Invite target was not found.')
    } else if (input.kind === 'EMAIL') {
      targetEmail = input.target?.trim().toLowerCase() ?? ''
      if (!targetEmail.includes('@')) throw new CampaignValidationError('Invite email is invalid.')
    } else {
      await repository.revokeActiveLink(input.campaignId, new Date().toISOString())
    }

    const token = randomBytes(32).toString('base64url')
    const invite = await repository.insertInvite({
      campaignId: input.campaignId,
      createdBy: userId,
      kind: input.kind,
      tokenDigest: hashInviteToken(token),
      targetUserId,
      targetEmail,
      expiresAt: inviteExpiry(input.expiresAt)
    })
    return {
      id: invite.id,
      campaignId: invite.campaignId,
      kind: invite.kind,
      token,
      expiresAt: toIso(invite.expiresAt),
      createdAt: toIso(invite.createdAt)
    }
  })
}

export function revokeCampaignInvite(
  db: DBLike,
  userId: string,
  campaignId: string,
  inviteId: string
): Promise<void> {
  return withTransaction(db, async (trx) => {
    const authority = await lockAuthority(trx, campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    if (
      !(await createCampaignRepository(trx).revokeInvite(
        campaignId,
        inviteId,
        new Date().toISOString()
      ))
    ) {
      throw new CampaignNotFoundError()
    }
  })
}

export function acceptCampaignInvite(
  db: DBLike,
  userId: string,
  token: string
): Promise<CampaignDetailDto> {
  const tokenDigest = hashInviteToken(token)
  return withTransaction(db, async (trx) => {
    const repository = createCampaignRepository(trx)
    const campaignId = await repository.findInviteCampaignId(tokenDigest)
    if (!campaignId) invalidInvite()
    const campaign = await repository.lockCampaign(campaignId)
    if (!campaign) invalidInvite()
    const invite = await repository.lockInviteByDigest(tokenDigest)
    if (
      !invite ||
      invite.campaignId !== campaignId ||
      invite.revokedAt ||
      Date.parse(toIso(invite.expiresAt)) <= Date.now()
    ) {
      invalidInvite()
    }

    if (invite.kind === 'USERNAME' && invite.targetUserId !== userId) invalidInvite()
    if (invite.kind === 'EMAIL') {
      const email = await repository.getAuthEmail(userId)
      if (!email || email !== invite.targetEmail) invalidInvite()
    }

    const existing = await repository.findMembership(campaignId, userId)
    if (existing?.status === 'ACTIVE') {
      return buildDetail(trx, await resolveCampaignAuthority(trx, campaignId, userId))
    }
    if (campaign.status !== 'ACTIVE') invalidInvite()

    const tier = await createAccountEntitlementsRepository(trx).lockTier(campaign.ownerUserId)
    const counts = await repository.countActiveMembers(campaignId)
    assertEntitlementLimit(
      'playerSeatsPerCampaign',
      counts.players,
      ENTITLEMENT_LIMITS[tier].playerSeatsPerCampaign
    )
    await repository.activatePlayerMembership(campaignId, userId, new Date().toISOString())
    return buildDetail(trx, await resolveCampaignAuthority(trx, campaignId, userId))
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
    if (campaign.visibility === 'PUBLIC') {
      assertEntitlementLimit(
        'publicListings',
        await repository.countPublicOwned(recipientUserId),
        ENTITLEMENT_LIMITS[recipientTier].publicListings
      )
    }

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
