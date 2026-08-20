import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const mocks = vi.hoisted(() => ({
  repository: {
    listForActiveMember: vi.fn(),
    findAuthority: vi.fn(),
    lockCampaign: vi.fn(),
    countActiveOwned: vi.fn(),
    countActiveMembers: vi.fn(),
    listActiveMemberships: vi.fn(),
    createCampaign: vi.fn(),
    updateCampaign: vi.fn(),
    archiveCampaign: vi.fn(),
    deleteCampaign: vi.fn(),
    insertOwnerMembership: vi.fn(),
    findMembership: vi.fn(),
    activatePlayerMembership: vi.fn(),
    leaveMembership: vi.fn(),
    findCharacter: vi.fn(),
    findAssignmentForUser: vi.fn(),
    findAssignmentByCharacter: vi.fn(),
    listAssignedSystemIdsExceptUser: vi.fn(),
    deleteAssignmentForUser: vi.fn(),
    deleteAssignmentByCharacter: vi.fn(),
    insertAssignment: vi.fn(),
    listAssignmentCharacterIds: vi.fn(),
    findInviteRecipientByUsername: vi.fn(),
    insertInvite: vi.fn(),
    lockInvite: vi.fn(),
    listReceivedInvites: vi.fn(),
    listInvitesForListing: vi.fn(),
    expireDueReceivedInvites: vi.fn(),
    setInviteStatus: vi.fn(),
    expirePendingInvites: vi.fn(),
    advancePendingInviteListingVersions: vi.fn(),
    revokePendingInviteForProfiles: vi.fn(),
    upsertOwnershipTransfer: vi.fn(),
    findOwnershipTransfer: vi.fn(),
    setMembershipRoleAndAccess: vi.fn(),
    updateCampaignOwner: vi.fn(),
    deleteOwnershipTransfer: vi.fn()
  },
  content: { deleteAssignmentBindings: vi.fn() },
  character: { findAuthoredById: vi.fn(), findById: vi.fn() },
  mechanics: { requireCurrent: vi.fn() },
  campaignMechanics: { publish: vi.fn(), requireCurrent: vi.fn(), lockAssignment: vi.fn() },
  prepareCampaignMechanics: vi.fn(),
  events: { insertCampaignEvent: vi.fn() },
  reconcileCharacter: vi.fn(),
  reconcileCurrency: vi.fn(),
  lockTier: vi.fn(),
  social: {
    findSocialListingByCampaign: vi.fn(),
    findOwnedSocialListing: vi.fn(),
    lockSocialListing: vi.fn(),
    setSocialListingStatus: vi.fn(),
    expireSubmittedSocialApplications: vi.fn(),
    advanceSubmittedSocialApplicationListingVersions: vi.fn(),
    syncSocialListingCampaignProjection: vi.fn(),
    hasSocialBlockEitherDirection: vi.fn(),
    findActiveSocialProfile: vi.fn()
  },
  acceptSocialAdmission: vi.fn(),
  requireActiveSocialProfile: vi.fn(),
  consumeSocialRateLimit: vi.fn(),
  notifications: {
    enqueueApplicationSubmittedCancellations: vi.fn(),
    enqueueInvitationDecisionNotifications: vi.fn(),
    enqueueInvitationReceivedCancellations: vi.fn(),
    enqueueInvitationReceivedNotification: vi.fn(),
    expireDueCampaignInvitationsForUser: vi.fn()
  },
  transaction: { isTransaction: true }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCampaignRepository: () => mocks.repository,
    createCampaignContentRepository: () => mocks.content,
    createCampaignAdjustmentsRepository: () => mocks.events,
    createCharacterRepository: () => mocks.character,
    createCharacterMechanicsProjectionRepository: () => mocks.mechanics,
    createCampaignCharacterMechanicsProjectionRepository: () => mocks.campaignMechanics,
    createAccountEntitlementsRepository: () => ({ lockTier: mocks.lockTier }),
    createSocialRepository: () => mocks.social,
    withTransaction: (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) =>
      callback(mocks.transaction as DBLike)
  }
})

vi.mock('../character/campaignCharacterReconciliation.js', () => ({
  reconcileCharacterAfterCampaignContentRemoval: mocks.reconcileCharacter
}))

vi.mock('../character/campaignCharacterSheet.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../character/campaignCharacterSheet.js')>()
  return {
    ...actual,
    checksumCampaignCharacterMechanicalContext: vi.fn(() => 'a'.repeat(64)),
    resolveCharacterLiveSessionRuleContext: vi.fn()
  }
})
vi.mock('./campaignCharacterMechanicsProjection.js', () => ({
  CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION: 3,
  prepareCampaignCharacterMechanicsProjection: mocks.prepareCampaignMechanics
}))

vi.mock('../notifications/notificationService.js', () => ({
  ...mocks.notifications
}))

vi.mock('../social/applicationService.js', () => ({
  acceptSocialAdmission: mocks.acceptSocialAdmission
}))

vi.mock('../social/profileService.js', () => ({
  requireActiveSocialProfile: mocks.requireActiveSocialProfile
}))

vi.mock('../social/rateLimits.js', () => ({
  consumeSocialRateLimit: mocks.consumeSocialRateLimit
}))

vi.mock('./campaignInventoryService.js', () => ({
  reconcileCampaignCurrencyDeparture: mocks.reconcileCurrency
}))

vi.mock('./realtimeService.js', () => ({ broadcastCampaignInvalidation: vi.fn() }))

const {
  CampaignConflictError,
  acceptCampaignInvite,
  acceptCampaignOwnershipTransfer,
  assignCampaignCharacter,
  createCampaignInvite,
  declineCampaignInvite,
  deleteCampaign,
  leaveCampaign,
  listSentCampaignInvites,
  revokeCampaignInvite,
  unassignCampaignCharacter,
  getCampaignCapabilities,
  listCampaigns,
  updateCampaign
} = await import('./campaignService.js')

const campaign = {
  id: '00000000-0000-4000-8000-000000000001',
  publicId: 'campaign-public-id',
  ownerUserId: '00000000-0000-4000-8000-000000000010',
  name: 'Game',
  description: null,
  format: 'ONGOING' as const,
  toneTags: ['HEROIC' as const],
  toneDetails: null,
  contentMaturity: 'STANDARD' as const,
  attunementSlotOverride: null,
  status: 'ACTIVE' as const,
  version: 3,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z'
}

function authority(userId: string, role: 'OWNER' | 'PLAYER') {
  return {
    campaign,
    membership: {
      campaignId: campaign.id,
      userId,
      role,
      status: 'ACTIVE' as const,
      accessStartedAt: '2026-08-01T00:00:00.000Z',
      joinedAt: '2026-08-01T00:00:00.000Z',
      leftAt: null
    },
    assignedCharacter: null
  }
}

describe('Campaign lifecycle service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.repository.lockCampaign.mockResolvedValue(campaign)
    mocks.repository.findAuthority.mockImplementation(async (_campaignId: string, userId: string) =>
      authority(userId, userId === campaign.ownerUserId ? 'OWNER' : 'PLAYER')
    )
    mocks.repository.countActiveMembers.mockResolvedValue({ members: 2, players: 1 })
    mocks.repository.listActiveMemberships.mockResolvedValue([])
    mocks.repository.findMembership.mockResolvedValue({
      campaignId: campaign.id,
      userId: '00000000-0000-4000-8000-000000000020',
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: '2026-08-01T00:00:00.000Z',
      joinedAt: '2026-08-01T00:00:00.000Z',
      leftAt: null
    })
    mocks.lockTier.mockResolvedValue('FREE')
    mocks.repository.countActiveOwned.mockResolvedValue(0)
    mocks.repository.listAssignmentCharacterIds.mockResolvedValue([])
    mocks.character.findAuthoredById.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000004',
      userId: '00000000-0000-4000-8000-000000000020'
    })
    mocks.character.findById.mockResolvedValue({
      rule_pack_revision_id: 'revision-1',
      stream_version: 1
    })
    mocks.mechanics.requireCurrent.mockResolvedValue({
      projectionChecksum: 'a'.repeat(64),
      characterStreamVersion: 1
    })
    mocks.prepareCampaignMechanics.mockResolvedValue({ projectionChecksum: 'b'.repeat(64) })
    mocks.repository.expireDueReceivedInvites.mockResolvedValue([])
    mocks.repository.expirePendingInvites.mockResolvedValue([])
    mocks.social.expireSubmittedSocialApplications.mockResolvedValue([])
    mocks.notifications.expireDueCampaignInvitationsForUser.mockResolvedValue(0)
    mocks.social.findSocialListingByCampaign.mockResolvedValue(null)
    mocks.social.hasSocialBlockEitherDirection.mockResolvedValue(false)
    mocks.requireActiveSocialProfile.mockImplementation(async (_db: DBLike, userId: string) => ({
      id: userId === campaign.ownerUserId ? '00000000-0000-4000-8000-000000000011' : userId,
      userId,
      username: userId === campaign.ownerUserId ? 'host-user' : 'player-user',
      status: 'ACTIVE',
      adultAttestedAt: '2026-08-01T00:00:00.000Z',
      contentPreference: 'STANDARD',
      version: 1,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z'
    }))
  })

  it('excludes owners from PARTY chat and makes archives read-only', () => {
    expect(getCampaignCapabilities('ACTIVE', 'OWNER')).toMatchObject({
      edit: true,
      readTableChat: true,
      readPartyChat: false
    })
    expect(getCampaignCapabilities('ACTIVE', 'PLAYER')).toMatchObject({
      edit: false,
      assignOwnCharacter: true,
      readTableChat: true,
      readPartyChat: true
    })
    expect(getCampaignCapabilities('ARCHIVED', 'PLAYER')).toEqual(
      expect.objectContaining({
        edit: false,
        assignOwnCharacter: false,
        contributeSessionNotes: false,
        readTableChat: true,
        readPartyChat: true
      })
    )
  })

  it('keeps archived Campaigns in active-member history', async () => {
    mocks.repository.listForActiveMember.mockResolvedValue([
      {
        ...campaign,
        status: 'ARCHIVED',
        role: 'PLAYER',
        memberCount: 2,
        playerCount: 1
      }
    ])

    await expect(listCampaigns({} as DBLike, campaign.ownerUserId)).resolves.toEqual([
      expect.objectContaining({
        id: campaign.id,
        status: 'ARCHIVED',
        capabilities: expect.objectContaining({ edit: false, readTableChat: true })
      })
    ])
  })

  it('creates a username-bound inbox invitation without a bearer token', async () => {
    const playerId = '00000000-0000-4000-8000-000000000020'
    const listing = {
      id: '00000000-0000-4000-8000-000000000040',
      campaignId: campaign.id,
      campaignOwnerUserId: campaign.ownerUserId,
      campaignStatus: 'ACTIVE',
      hostProfileId: '00000000-0000-4000-8000-000000000011',
      hostUsername: 'host-user',
      status: 'OPEN',
      moderationStatus: 'VISIBLE',
      title: 'Friday table',
      version: 2,
      capacity: 5
    }
    mocks.social.lockSocialListing.mockResolvedValue(listing)
    mocks.repository.findInviteRecipientByUsername.mockResolvedValue({
      userId: playerId,
      profileId: '00000000-0000-4000-8000-000000000021',
      username: 'player-user',
      status: 'ACTIVE'
    })
    mocks.repository.findMembership.mockResolvedValue(null)
    mocks.repository.insertInvite.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000030',
      listingId: listing.id,
      campaignId: campaign.id,
      createdBy: campaign.ownerUserId,
      recipientUserId: playerId,
      recipientUsername: 'player-user',
      listingVersion: 2,
      status: 'PENDING',
      expiresAt: '2099-01-01T00:00:00.000Z',
      respondedAt: null,
      revokedAt: null,
      expiredAt: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      version: 1
    })
    const result = await createCampaignInvite({} as DBLike, campaign.ownerUserId, {
      listingPublicId: listing.id,
      expectedListingVersion: 2,
      username: 'player-user'
    })

    expect(result).toMatchObject({
      invitePublicId: '00000000-0000-4000-8000-000000000030',
      recipientUsername: 'player-user',
      status: 'PENDING'
    })
    expect(result).not.toHaveProperty('token')
    expect(mocks.repository.insertInvite).toHaveBeenCalledWith(
      expect.not.objectContaining({ token: expect.anything(), tokenDigest: expect.anything() })
    )
    expect(mocks.notifications.enqueueInvitationReceivedNotification).toHaveBeenCalledWith(
      mocks.transaction,
      expect.objectContaining({ id: result.invitePublicId }),
      expect.objectContaining({ listingTitle: 'Friday table', hostUsername: 'host-user' })
    )
  })

  it('lists sent invitations only for the authenticated listing owner', async () => {
    const listing = {
      id: '00000000-0000-4000-8000-000000000040',
      title: 'Friday table'
    }
    const invitation = {
      id: '00000000-0000-4000-8000-000000000030',
      listingId: listing.id,
      campaignId: campaign.id,
      createdBy: campaign.ownerUserId,
      recipientUserId: '00000000-0000-4000-8000-000000000020',
      recipientUsername: 'player-user',
      listingVersion: 2,
      status: 'PENDING' as const,
      expiresAt: '2099-01-01T00:00:00.000Z',
      respondedAt: null,
      revokedAt: null,
      expiredAt: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      version: 1,
      listingTitle: listing.title,
      contentMaturity: 'STANDARD' as const,
      hostProfileId: '00000000-0000-4000-8000-000000000011',
      hostUsername: 'host-user'
    }
    mocks.social.findOwnedSocialListing.mockResolvedValue(listing)
    mocks.repository.listInvitesForListing.mockResolvedValue([invitation])

    await expect(
      listSentCampaignInvites({} as DBLike, campaign.ownerUserId, listing.id)
    ).resolves.toEqual([
      expect.objectContaining({
        invitePublicId: invitation.id,
        listingPublicId: listing.id,
        recipientUsername: invitation.recipientUsername,
        status: 'PENDING'
      })
    ])
    expect(mocks.social.findOwnedSocialListing).toHaveBeenCalledWith(
      campaign.ownerUserId,
      listing.id
    )
    expect(mocks.repository.listInvitesForListing).toHaveBeenCalledWith(listing.id)
  })

  it('denies sent invitation history for a listing the user does not own', async () => {
    mocks.social.findOwnedSocialListing.mockResolvedValue(null)

    await expect(
      listSentCampaignInvites(
        {} as DBLike,
        '00000000-0000-4000-8000-000000000099',
        '00000000-0000-4000-8000-000000000040'
      )
    ).rejects.toMatchObject({ name: 'SocialNotFoundError' })
    expect(mocks.repository.listInvitesForListing).not.toHaveBeenCalled()
  })

  it('cancels receipt and triggers an ended notification when the host revokes an invitation', async () => {
    const playerId = '00000000-0000-4000-8000-000000000020'
    const listing = {
      id: '00000000-0000-4000-8000-000000000040',
      campaignId: campaign.id,
      campaignOwnerUserId: campaign.ownerUserId,
      title: 'Friday table'
    }
    const invitation = {
      id: '00000000-0000-4000-8000-000000000030',
      listingId: listing.id,
      campaignId: campaign.id,
      createdBy: campaign.ownerUserId,
      recipientUserId: playerId,
      recipientUsername: 'player-user',
      listingVersion: 2,
      status: 'PENDING' as const,
      expiresAt: '2099-01-01T00:00:00.000Z',
      respondedAt: null,
      revokedAt: null,
      expiredAt: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      version: 1
    }
    const revoked = { ...invitation, status: 'REVOKED' as const, version: 2 }
    mocks.repository.lockInvite.mockResolvedValue(invitation)
    mocks.social.lockSocialListing.mockResolvedValue(listing)
    mocks.repository.setInviteStatus.mockResolvedValue(revoked)

    await revokeCampaignInvite(
      {} as DBLike,
      campaign.ownerUserId,
      invitation.id,
      invitation.version
    )

    expect(mocks.notifications.enqueueInvitationReceivedCancellations).toHaveBeenCalledWith(
      mocks.transaction,
      [revoked.id],
      expect.any(String)
    )
  })

  it('cancels receipt and triggers the host decision when the recipient declines', async () => {
    const playerId = '00000000-0000-4000-8000-000000000020'
    const listing = {
      id: '00000000-0000-4000-8000-000000000040',
      campaignId: campaign.id,
      campaignOwnerUserId: campaign.ownerUserId,
      title: 'Friday table'
    }
    const invitation = {
      id: '00000000-0000-4000-8000-000000000030',
      listingId: listing.id,
      campaignId: campaign.id,
      createdBy: campaign.ownerUserId,
      recipientUserId: playerId,
      recipientUsername: 'player-user',
      listingVersion: 2,
      status: 'PENDING' as const,
      expiresAt: '2099-01-01T00:00:00.000Z',
      respondedAt: null,
      revokedAt: null,
      expiredAt: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      version: 1
    }
    const projection = {
      ...invitation,
      listingTitle: listing.title,
      contentMaturity: 'STANDARD' as const,
      hostProfileId: '00000000-0000-4000-8000-000000000011',
      hostUsername: 'host-user'
    }
    const declined = { ...invitation, status: 'DECLINED' as const, version: 2 }
    mocks.repository.lockInvite.mockResolvedValue(invitation)
    mocks.social.lockSocialListing.mockResolvedValue(listing)
    mocks.repository.listReceivedInvites.mockResolvedValue([projection])
    mocks.repository.setInviteStatus.mockResolvedValue(declined)
    mocks.social.findActiveSocialProfile.mockResolvedValue({
      id: projection.hostProfileId,
      username: projection.hostUsername
    })

    await declineCampaignInvite({} as DBLike, playerId, invitation.id, invitation.version)

    expect(mocks.notifications.enqueueInvitationDecisionNotifications).toHaveBeenCalledWith(
      mocks.transaction,
      declined,
      {
        hostUserId: campaign.ownerUserId,
        listingTitle: listing.title,
        decision: 'DECLINED',
        occurredAt: expect.any(String)
      }
    )
  })

  it('emits no notification for a stale invitation revoke', async () => {
    const invitation = {
      id: '00000000-0000-4000-8000-000000000030',
      listingId: '00000000-0000-4000-8000-000000000040',
      status: 'PENDING',
      version: 1
    }
    mocks.repository.lockInvite.mockResolvedValue(invitation)
    mocks.social.lockSocialListing.mockResolvedValue({
      id: invitation.listingId,
      campaignId: campaign.id,
      campaignOwnerUserId: campaign.ownerUserId
    })

    await expect(
      revokeCampaignInvite({} as DBLike, campaign.ownerUserId, invitation.id, 2)
    ).rejects.toMatchObject({ name: 'SocialConflictError' })
    expect(mocks.notifications.enqueueInvitationReceivedCancellations).not.toHaveBeenCalled()
  })

  it('routes invitation acceptance through the shared Social admission transaction', async () => {
    const playerId = '00000000-0000-4000-8000-000000000020'
    mocks.acceptSocialAdmission.mockResolvedValue({ kind: 'INVITATION', campaignId: campaign.id })

    await acceptCampaignInvite({} as DBLike, playerId, '00000000-0000-4000-8000-000000000030', 1)

    expect(mocks.acceptSocialAdmission).toHaveBeenCalledWith(expect.anything(), playerId, {
      kind: 'INVITATION',
      publicId: '00000000-0000-4000-8000-000000000030',
      expectedVersion: 1
    })
  })

  it('demotes the former owner before promotion and resets both PARTY cutoffs', async () => {
    const recipientId = '00000000-0000-4000-8000-000000000020'
    mocks.repository.findOwnershipTransfer.mockResolvedValue({
      campaignId: campaign.id,
      fromUserId: campaign.ownerUserId,
      toUserId: recipientId,
      expiresAt: '2099-01-01T00:00:00.000Z'
    })
    mocks.repository.setMembershipRoleAndAccess.mockResolvedValue(true)
    mocks.repository.updateCampaignOwner.mockResolvedValue(true)

    await acceptCampaignOwnershipTransfer({} as DBLike, recipientId, campaign.id)

    const roleChanges = mocks.repository.setMembershipRoleAndAccess.mock.calls
    expect(roleChanges[0]?.slice(0, 3)).toEqual([campaign.id, campaign.ownerUserId, 'PLAYER'])
    expect(roleChanges[1]?.slice(0, 3)).toEqual([campaign.id, recipientId, 'OWNER'])
    expect(roleChanges[0]?.[3]).toBe(roleChanges[1]?.[3])
    expect(mocks.repository.setMembershipRoleAndAccess.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.repository.setMembershipRoleAndAccess.mock.invocationCallOrder[1] ?? 0
    )
    expect(mocks.repository.setMembershipRoleAndAccess.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.repository.updateCampaignOwner.mock.invocationCallOrder[0] ?? 0
    )
  })

  it('closes the Social listing before transferring Campaign ownership', async () => {
    const recipientId = '00000000-0000-4000-8000-000000000020'
    mocks.repository.findOwnershipTransfer.mockResolvedValue({
      campaignId: campaign.id,
      fromUserId: campaign.ownerUserId,
      toUserId: recipientId,
      expiresAt: '2099-01-01T00:00:00.000Z'
    })
    mocks.repository.setMembershipRoleAndAccess.mockResolvedValue(true)
    mocks.repository.updateCampaignOwner.mockResolvedValue(true)
    const listing = { id: '00000000-0000-4000-8000-000000000040', status: 'OPEN', version: 2 }
    mocks.social.findSocialListingByCampaign.mockResolvedValue(listing)
    mocks.social.lockSocialListing.mockResolvedValue(listing)
    mocks.social.setSocialListingStatus.mockResolvedValue({
      ...listing,
      status: 'CLOSED',
      version: 3
    })

    await acceptCampaignOwnershipTransfer({} as DBLike, recipientId, campaign.id)

    expect(mocks.social.setSocialListingStatus).toHaveBeenCalledWith(
      expect.objectContaining({ listingId: listing.id, status: 'CLOSED' })
    )
    expect(mocks.social.setSocialListingStatus.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.repository.updateCampaignOwner.mock.invocationCallOrder[0] ?? 0
    )
  })

  it('reconciles a leaving player before removing their assignment', async () => {
    const playerId = '00000000-0000-4000-8000-000000000020'
    const characterId = '00000000-0000-4000-8000-000000000021'
    mocks.repository.findAssignmentForUser.mockResolvedValue({ characterId })
    mocks.repository.deleteAssignmentForUser.mockResolvedValue(characterId)
    mocks.repository.leaveMembership.mockResolvedValue(true)
    mocks.reconcileCharacter.mockResolvedValue(true)

    await expect(leaveCampaign({} as DBLike, playerId, campaign.id)).resolves.toEqual({
      characterId
    })

    expect(mocks.content.deleteAssignmentBindings).toHaveBeenCalledWith(campaign.id, characterId)
    expect(mocks.reconcileCharacter).toHaveBeenCalledWith(expect.anything(), characterId)
    expect(mocks.reconcileCurrency).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        campaignId: campaign.id,
        characterId,
        actorUserId: playerId,
        reason: 'MEMBER_LEFT'
      })
    )
    expect(mocks.content.deleteAssignmentBindings.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.reconcileCurrency.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.reconcileCurrency.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.repository.deleteAssignmentForUser.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.repository.deleteAssignmentForUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.reconcileCharacter.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.events.insertCampaignEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: campaign.id,
        subjectCharacterId: characterId,
        kind: 'CAMPAIGN_CHARACTER_RECONCILED',
        visibility: 'SUBJECT',
        payload: { reason: 'MEMBER_LEFT' }
      })
    )
  })

  it('reconciles an unassigned character after deleting the assignment', async () => {
    const characterId = '00000000-0000-4000-8000-000000000021'
    mocks.repository.findAssignmentByCharacter.mockResolvedValue({
      userId: '00000000-0000-4000-8000-000000000020'
    })
    mocks.repository.deleteAssignmentByCharacter.mockResolvedValue(characterId)

    await expect(
      unassignCampaignCharacter({} as DBLike, campaign.ownerUserId, campaign.id, characterId)
    ).resolves.toEqual({ characterId })

    expect(mocks.content.deleteAssignmentBindings).toHaveBeenCalledWith(campaign.id, characterId)
    expect(mocks.reconcileCurrency).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reason: 'CHARACTER_UNASSIGNED', characterId })
    )
  })

  it('reconciles a replaced character before inserting the new assignment', async () => {
    const oldCharacterId = '00000000-0000-4000-8000-000000000021'
    const newCharacterId = '00000000-0000-4000-8000-000000000022'
    mocks.repository.findCharacter.mockResolvedValue({
      id: newCharacterId,
      userId: '00000000-0000-4000-8000-000000000020',
      systemId: 'system',
      label: 'New character'
    })
    mocks.repository.findAssignmentForUser.mockResolvedValue({ characterId: oldCharacterId })
    mocks.repository.listAssignedSystemIdsExceptUser.mockResolvedValue([])
    mocks.repository.deleteAssignmentForUser.mockResolvedValue(oldCharacterId)

    await expect(
      assignCampaignCharacter(
        {} as DBLike,
        '00000000-0000-4000-8000-000000000020',
        campaign.id,
        newCharacterId
      )
    ).resolves.toEqual({ characterId: newCharacterId })

    expect(mocks.content.deleteAssignmentBindings).toHaveBeenCalledWith(campaign.id, oldCharacterId)
    expect(mocks.content.deleteAssignmentBindings.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.reconcileCurrency.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.reconcileCurrency.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.repository.deleteAssignmentForUser.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.repository.deleteAssignmentForUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.reconcileCharacter.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.reconcileCharacter.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.repository.insertAssignment.mock.invocationCallOrder[0] ?? 0
    )
  })

  it('reconciles the recipient character before promoting them to owner', async () => {
    const recipientId = '00000000-0000-4000-8000-000000000020'
    const characterId = '00000000-0000-4000-8000-000000000021'
    mocks.repository.findOwnershipTransfer.mockResolvedValue({
      campaignId: campaign.id,
      fromUserId: campaign.ownerUserId,
      toUserId: recipientId,
      expiresAt: '2099-01-01T00:00:00.000Z'
    })
    mocks.repository.findAssignmentForUser.mockResolvedValue({ characterId })
    mocks.repository.deleteAssignmentForUser.mockResolvedValue(characterId)
    mocks.repository.setMembershipRoleAndAccess.mockResolvedValue(true)
    mocks.repository.updateCampaignOwner.mockResolvedValue(true)

    await acceptCampaignOwnershipTransfer({} as DBLike, recipientId, campaign.id)

    expect(mocks.content.deleteAssignmentBindings).toHaveBeenCalledWith(campaign.id, characterId)
    expect(mocks.repository.deleteAssignmentForUser).toHaveBeenCalledWith(campaign.id, recipientId)
    expect(mocks.repository.deleteAssignmentForUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.reconcileCharacter.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.reconcileCharacter.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.repository.setMembershipRoleAndAccess.mock.invocationCallOrder[0] ?? 0
    )
  })

  it('reconciles assigned characters in deterministic order before deleting a Campaign', async () => {
    const firstCharacterId = '00000000-0000-4000-8000-000000000020'
    const secondCharacterId = '00000000-0000-4000-8000-000000000021'
    mocks.repository.listAssignmentCharacterIds.mockResolvedValue([
      secondCharacterId,
      firstCharacterId
    ])
    mocks.repository.deleteAssignmentByCharacter.mockImplementation(
      async (_campaignId: string, characterId: string) => characterId
    )
    mocks.repository.deleteCampaign.mockResolvedValue(true)

    await expect(
      deleteCampaign({} as DBLike, campaign.ownerUserId, campaign.id, campaign.version)
    ).resolves.toMatchObject({ unassignedCharacterIds: [firstCharacterId, secondCharacterId] })

    expect(mocks.content.deleteAssignmentBindings.mock.calls).toEqual([
      [campaign.id, firstCharacterId],
      [campaign.id, secondCharacterId]
    ])
    expect(mocks.reconcileCurrency.mock.invocationCallOrder.at(-1)).toBeLessThan(
      mocks.repository.deleteCampaign.mock.invocationCallOrder[0] ?? 0
    )
    expect(
      mocks.repository.deleteAssignmentByCharacter.mock.invocationCallOrder.at(-1)
    ).toBeLessThan(mocks.reconcileCharacter.mock.invocationCallOrder.at(-1) ?? 0)
  })

  it('rejects a stale version before an update', async () => {
    await expect(
      updateCampaign({} as DBLike, campaign.ownerUserId, {
        campaignId: campaign.id,
        name: 'Changed',
        expectedVersion: 2
      })
    ).rejects.toBeInstanceOf(CampaignConflictError)
    expect(mocks.repository.updateCampaign).not.toHaveBeenCalled()
  })

  it('forwards the attunement slot override through the owner update', async () => {
    mocks.repository.updateCampaign.mockResolvedValue(campaign)

    await updateCampaign({} as DBLike, campaign.ownerUserId, {
      campaignId: campaign.id,
      attunementSlotOverride: 4,
      expectedVersion: campaign.version
    })

    expect(mocks.repository.updateCampaign).toHaveBeenCalledWith(campaign.id, campaign.version, {
      attunement_slot_override: 4
    })
  })

  it('synchronizes a name-only listing projection without expiring pending admission', async () => {
    const listing = {
      id: '00000000-0000-4000-8000-000000000040',
      status: 'OPEN',
      scheduleKind: 'FLEXIBLE',
      version: 4
    }
    mocks.social.findSocialListingByCampaign.mockResolvedValue(listing)
    mocks.social.lockSocialListing.mockResolvedValue(listing)
    mocks.repository.updateCampaign.mockResolvedValue({ ...campaign, name: 'Renamed table' })
    mocks.social.syncSocialListingCampaignProjection.mockResolvedValue({
      ...listing,
      version: 5
    })

    await updateCampaign({} as DBLike, campaign.ownerUserId, {
      campaignId: campaign.id,
      name: 'Renamed table',
      expectedVersion: campaign.version
    })

    expect(mocks.social.syncSocialListingCampaignProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        listingId: listing.id,
        expectedVersion: 4,
        title: 'Renamed table',
        campaignFormat: 'ONGOING',
        toneTags: ['HEROIC'],
        contentMaturity: 'STANDARD'
      })
    )
    expect(mocks.social.advanceSubmittedSocialApplicationListingVersions).toHaveBeenCalledWith(
      listing.id,
      5,
      expect.any(String)
    )
    expect(mocks.repository.advancePendingInviteListingVersions).toHaveBeenCalledWith(
      listing.id,
      5,
      expect.any(String)
    )
    expect(mocks.social.expireSubmittedSocialApplications).not.toHaveBeenCalled()
    expect(mocks.repository.expirePendingInvites).not.toHaveBeenCalled()
  })

  it('expires pending admission when Campaign maturity changes', async () => {
    const listing = {
      id: '00000000-0000-4000-8000-000000000040',
      status: 'OPEN',
      scheduleKind: 'FLEXIBLE',
      version: 4
    }
    mocks.social.findSocialListingByCampaign.mockResolvedValue(listing)
    mocks.social.lockSocialListing.mockResolvedValue(listing)
    mocks.repository.updateCampaign.mockResolvedValue({
      ...campaign,
      contentMaturity: 'MATURE'
    })
    mocks.social.syncSocialListingCampaignProjection.mockResolvedValue({
      ...listing,
      version: 5
    })
    mocks.social.expireSubmittedSocialApplications.mockResolvedValue(['application-id'])
    mocks.repository.expirePendingInvites.mockResolvedValue(['invite-id'])

    await updateCampaign({} as DBLike, campaign.ownerUserId, {
      campaignId: campaign.id,
      contentMaturity: 'MATURE',
      expectedVersion: campaign.version
    })

    expect(mocks.social.expireSubmittedSocialApplications).toHaveBeenCalledWith(
      listing.id,
      expect.any(String)
    )
    expect(mocks.repository.expirePendingInvites).toHaveBeenCalledWith(
      listing.id,
      expect.any(String)
    )
    expect(mocks.social.advanceSubmittedSocialApplicationListingVersions).not.toHaveBeenCalled()
    expect(mocks.repository.advancePendingInviteListingVersions).not.toHaveBeenCalled()
    expect(mocks.notifications.enqueueApplicationSubmittedCancellations).toHaveBeenCalledWith(
      mocks.transaction,
      ['application-id'],
      expect.any(String)
    )
    expect(mocks.notifications.enqueueInvitationReceivedCancellations).toHaveBeenCalledWith(
      mocks.transaction,
      ['invite-id'],
      expect.any(String)
    )
  })

  it('rejects changing an open recurring Campaign to One-shot', async () => {
    const listing = {
      id: '00000000-0000-4000-8000-000000000040',
      status: 'OPEN',
      scheduleKind: 'RECURRING',
      version: 4
    }
    mocks.social.findSocialListingByCampaign.mockResolvedValue(listing)
    mocks.social.lockSocialListing.mockResolvedValue(listing)

    await expect(
      updateCampaign({} as DBLike, campaign.ownerUserId, {
        campaignId: campaign.id,
        format: 'ONE_SHOT',
        expectedVersion: campaign.version
      })
    ).rejects.toThrow('Close or reschedule')
    expect(mocks.repository.updateCampaign).not.toHaveBeenCalled()
    expect(mocks.social.syncSocialListingCampaignProjection).not.toHaveBeenCalled()
  })

  it('rejects writes after archive', async () => {
    mocks.repository.findAuthority.mockResolvedValue({
      ...authority(campaign.ownerUserId, 'OWNER'),
      campaign: { ...campaign, status: 'ARCHIVED' }
    })

    await expect(
      updateCampaign({} as DBLike, campaign.ownerUserId, {
        campaignId: campaign.id,
        name: 'Changed',
        expectedVersion: campaign.version
      })
    ).rejects.toThrow('read-only')
    expect(mocks.repository.updateCampaign).not.toHaveBeenCalled()
  })
})
