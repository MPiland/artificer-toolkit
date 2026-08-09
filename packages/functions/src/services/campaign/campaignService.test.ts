import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const mocks = vi.hoisted(() => ({
  repository: {
    listForActiveMember: vi.fn(),
    findAuthority: vi.fn(),
    lockCampaign: vi.fn(),
    countActiveOwned: vi.fn(),
    countPublicOwned: vi.fn(),
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
    revokeActiveLink: vi.fn(),
    insertInvite: vi.fn(),
    lockInviteByDigest: vi.fn(),
    findInviteCampaignId: vi.fn(),
    revokeInvite: vi.fn(),
    getAuthEmail: vi.fn(),
    upsertOwnershipTransfer: vi.fn(),
    findOwnershipTransfer: vi.fn(),
    setMembershipRoleAndAccess: vi.fn(),
    updateCampaignOwner: vi.fn(),
    deleteOwnershipTransfer: vi.fn()
  },
  content: { deleteAssignmentBindings: vi.fn() },
  events: { insertCampaignEvent: vi.fn() },
  reconcileCharacter: vi.fn(),
  reconcileCurrency: vi.fn(),
  lockTier: vi.fn(),
  findUserIdByUsername: vi.fn(),
  transaction: { isTransaction: true }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCampaignRepository: () => mocks.repository,
    createCampaignContentRepository: () => mocks.content,
    createCampaignAdjustmentsRepository: () => mocks.events,
    createAccountEntitlementsRepository: () => ({ lockTier: mocks.lockTier }),
    createAccountProfileRepository: () => ({ findUserIdByUsername: mocks.findUserIdByUsername }),
    withTransaction: (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) =>
      callback(mocks.transaction as DBLike)
  }
})

vi.mock('../character/campaignCharacterReconciliation.js', () => ({
  reconcileCharacterAfterCampaignContentRemoval: mocks.reconcileCharacter
}))

vi.mock('./campaignInventoryService.js', () => ({
  reconcileCampaignCurrencyDeparture: mocks.reconcileCurrency
}))

const {
  CampaignConflictError,
  acceptCampaignInvite,
  acceptCampaignOwnershipTransfer,
  assignCampaignCharacter,
  createCampaignInvite,
  deleteCampaign,
  leaveCampaign,
  unassignCampaignCharacter,
  getCampaignCapabilities,
  listCampaigns,
  updateCampaign
} = await import('./campaignService.js')

const campaign = {
  id: '00000000-0000-4000-8000-000000000001',
  ownerUserId: '00000000-0000-4000-8000-000000000010',
  name: 'Game',
  description: null,
  attunementSlotOverride: null,
  status: 'ACTIVE' as const,
  visibility: 'PRIVATE' as const,
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

  it('stores only the invite hash and rejects expiry beyond thirty days', async () => {
    mocks.repository.insertInvite.mockImplementation(
      async (input: { tokenDigest: Uint8Array }) => ({
        id: '00000000-0000-4000-8000-000000000030',
        campaignId: campaign.id,
        createdBy: campaign.ownerUserId,
        kind: 'LINK',
        targetUserId: null,
        targetEmail: null,
        expiresAt: '2026-08-08T00:00:00.000Z',
        revokedAt: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        tokenDigest: input.tokenDigest
      })
    )

    const invite = await createCampaignInvite({} as DBLike, campaign.ownerUserId, {
      campaignId: campaign.id,
      kind: 'LINK'
    })
    const persisted = mocks.repository.insertInvite.mock.calls[0]?.[0] as {
      tokenDigest: Uint8Array
    }
    expect(Buffer.from(persisted.tokenDigest)).toEqual(
      createHash('sha256').update(invite.token).digest()
    )
    expect(Buffer.from(persisted.tokenDigest).toString()).not.toBe(invite.token)

    await expect(
      createCampaignInvite({} as DBLike, campaign.ownerUserId, {
        campaignId: campaign.id,
        kind: 'LINK',
        expiresAt: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString()
      })
    ).rejects.toThrow('within the next 30 days')
  })

  it('serializes the final seat check behind the Campaign and owner entitlement locks', async () => {
    const playerId = '00000000-0000-4000-8000-000000000020'
    mocks.repository.findInviteCampaignId.mockResolvedValue(campaign.id)
    mocks.repository.lockInviteByDigest.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000030',
      campaignId: campaign.id,
      createdBy: campaign.ownerUserId,
      kind: 'LINK',
      targetUserId: null,
      targetEmail: null,
      expiresAt: '2099-01-01T00:00:00.000Z',
      revokedAt: null,
      createdAt: '2026-08-01T00:00:00.000Z'
    })
    mocks.repository.findMembership.mockResolvedValue(null)
    mocks.repository.activatePlayerMembership.mockResolvedValue(undefined)

    await acceptCampaignInvite({} as DBLike, playerId, 'secret')

    expect(mocks.repository.lockCampaign.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.lockTier.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.lockTier.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.repository.countActiveMembers.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.repository.countActiveMembers.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.repository.activatePlayerMembership.mock.invocationCallOrder[0] ?? 0
    )
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

  it('enforces the recipient public-listing limit before transferring a public Campaign', async () => {
    const recipientId = '00000000-0000-4000-8000-000000000020'
    mocks.repository.lockCampaign.mockResolvedValue({ ...campaign, visibility: 'PUBLIC' })
    mocks.repository.findOwnershipTransfer.mockResolvedValue({
      campaignId: campaign.id,
      fromUserId: campaign.ownerUserId,
      toUserId: recipientId,
      expiresAt: '2099-01-01T00:00:00.000Z'
    })
    mocks.repository.countPublicOwned.mockResolvedValue(1)

    await expect(
      acceptCampaignOwnershipTransfer({} as DBLike, recipientId, campaign.id)
    ).rejects.toThrow('publicListings')
    expect(mocks.repository.setMembershipRoleAndAccess).not.toHaveBeenCalled()
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
