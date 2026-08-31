import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createEmptyCharacterAuthored } from '../character/builderService.js'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  owner: '00000000-0000-4000-8000-000000000002',
  author: '00000000-0000-4000-8000-000000000003',
  characterOwner: '00000000-0000-4000-8000-000000000004',
  character: '00000000-0000-4000-8000-000000000005',
  spell: '00000000-0000-4000-8000-000000000006',
  vehicleDefinition: '00000000-0000-4000-8000-000000000007',
  vehicle: '00000000-0000-4000-8000-000000000008',
  campaignOwner: '00000000-0000-4000-8000-000000000009',
  vehicleOwner: '00000000-0000-4000-8000-000000000010',
  command: '00000000-0000-4000-8000-000000000011',
  event: '00000000-0000-4000-8000-000000000012'
}

const mocks = vi.hoisted(() => ({
  shares: {
    lockSharesForRemoval: vi.fn(),
    lockCurrentRoot: vi.fn(),
    unshareRootExpectingAuthor: vi.fn()
  },
  campaign: {
    lockActiveMembershipForUpdate: vi.fn(),
    lockActiveMembershipForShare: vi.fn(),
    lockMembershipForShare: vi.fn(),
    listAssignmentCharacterIds: vi.fn(),
    advanceCampaignVersion: vi.fn()
  },
  vehicles: { listByDefinitionsForUpdate: vi.fn() },
  evacuation: { lockOwners: vi.fn(), lockOwnerGraphs: vi.fn(), evacuate: vi.fn() },
  drafts: { findByCharacter: vi.fn() },
  characters: { findAuthoredById: vi.fn(), findById: vi.fn(), findUpdatedAtByIdForUpdate: vi.fn() },
  overlays: { lockAssignment: vi.fn(), findCurrentChecksum: vi.fn(), publish: vi.fn() },
  inventory: { findCampaignEventByIdempotency: vi.fn() },
  events: { insertCampaignEvent: vi.fn() },
  references: vi.fn(),
  commitActive: vi.fn(),
  commitDraft: vi.fn(),
  commitDraftOnly: vi.fn(),
  resolveContext: vi.fn(),
  prepareOverlay: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createCampaignContentShareRepository: () => mocks.shares,
  createCampaignRepository: () => mocks.campaign,
  createCampaignVehicleRepository: () => mocks.vehicles,
  createCampaignVehicleEvacuationRepository: () => mocks.evacuation,
  createCharacterBuilderDraftRepository: () => mocks.drafts,
  createCharacterRepository: () => mocks.characters,
  createCampaignCharacterMechanicsProjectionRepository: () => mocks.overlays,
  createInventoryRepository: () => mocks.inventory,
  createCampaignAdjustmentsRepository: () => mocks.events
}))
vi.mock('../character/builderReconciliation.js', () => ({
  characterReferencesAuthoredRoot: mocks.references
}))
vi.mock('../character/characterStructuralReconciliationCommit.js', () => ({
  commitCharacterStructuralReconciliation: mocks.commitActive,
  commitCharacterDraftSourceLoss: mocks.commitDraft,
  commitCharacterDraftOnlySourceLoss: mocks.commitDraftOnly
}))
vi.mock('../character/campaignCharacterSheet.js', () => ({
  resolveCharacterLiveSessionRuleContext: mocks.resolveContext
}))
vi.mock('./campaignCharacterMechanicsProjection.js', () => ({
  prepareCampaignCharacterMechanicsProjection: mocks.prepareOverlay
}))

const { findCampaignContentRemovalReceipt, removeCampaignContentSharesAndReconcileInTransaction } =
  await import('./campaignContentShareRemoval.js')

const campaign = {
  id: ids.campaign,
  publicId: 'campaign-public',
  ownerUserId: ids.owner,
  name: 'Campaign',
  description: null,
  format: 'ONGOING' as const,
  toneTags: [],
  toneDetails: null,
  contentMaturity: 'STANDARD' as const,
  gameSystemId: '00000000-0000-4000-8000-000000000301',
  primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000302',
  additionalRulesCatalogueIds: [],
  attunementSlotOverride: null,
  status: 'ACTIVE' as const,
  version: 3,
  createdAt: '2026-08-22T00:00:00.000Z',
  updatedAt: '2026-08-22T00:00:00.000Z'
}

function share(subjectKind: 'SPELL' | 'VEHICLE' = 'SPELL') {
  return {
    campaignId: ids.campaign,
    subjectKind,
    subjectId: subjectKind === 'SPELL' ? ids.spell : ids.vehicleDefinition,
    sharedBy: ids.author,
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z'
  }
}

function input(selected = share()) {
  return {
    actorUserId: ids.owner,
    campaign,
    commandId: ids.command,
    expectedCampaignVersion: campaign.version,
    operation: 'UNSHARE' as const,
    shares: [selected]
  }
}

describe('Campaign content share removal transaction', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    const selected = share()
    mocks.inventory.findCampaignEventByIdempotency.mockResolvedValue(null)
    mocks.shares.lockSharesForRemoval.mockResolvedValue({ locked: [selected], missing: [] })
    mocks.shares.unshareRootExpectingAuthor.mockResolvedValue(selected)
    mocks.shares.lockCurrentRoot.mockResolvedValue({
      isMaster: false,
      ownerUserId: ids.author,
      identity: { subjectKind: 'SPELL', subjectId: ids.spell }
    })
    mocks.campaign.lockActiveMembershipForShare.mockImplementation(
      async (_campaignId: string, userId: string) => ({
        campaignId: ids.campaign,
        userId,
        role: userId === ids.owner ? 'OWNER' : 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: '2026-08-22T00:00:00.000Z',
        joinedAt: '2026-08-22T00:00:00.000Z',
        leftAt: null
      })
    )
    mocks.campaign.lockMembershipForShare.mockImplementation(
      async (_campaignId: string, userId: string) => ({
        campaignId: ids.campaign,
        userId,
        role: 'PLAYER',
        status: 'LEFT',
        accessStartedAt: '2026-08-22T00:00:00.000Z',
        joinedAt: '2026-08-22T00:00:00.000Z',
        leftAt: '2026-08-22T01:00:00.000Z'
      })
    )
    mocks.campaign.listAssignmentCharacterIds.mockResolvedValue([ids.character])
    mocks.characters.findAuthoredById.mockResolvedValue({
      id: ids.character,
      userId: ids.characterOwner
    })
    mocks.characters.findById.mockResolvedValue({
      status: 'ACTIVE',
      stream_version: 4,
      rule_pack_revision_id: 'revision-1'
    })
    mocks.characters.findUpdatedAtByIdForUpdate.mockResolvedValue('2026-08-22T00:00:00.000Z')
    mocks.drafts.findByCharacter.mockResolvedValue(null)
    mocks.references.mockReturnValue(true)
    mocks.vehicles.listByDefinitionsForUpdate.mockResolvedValue([])
    mocks.evacuation.lockOwners.mockResolvedValue({
      campaignOwner: { id: ids.campaignOwner },
      vehicleOwners: new Map()
    })
    mocks.evacuation.lockOwnerGraphs.mockResolvedValue(undefined)
    mocks.overlays.findCurrentChecksum.mockResolvedValue('overlay-before')
    mocks.commitActive.mockResolvedValue({
      kind: 'ACTIVE',
      character: { id: ids.character },
      streamVersion: 5,
      mechanics: { projectionChecksum: 'base-after' }
    })
    mocks.resolveContext.mockResolvedValue({ adjustments: [], attunementSlotOverride: null })
    mocks.prepareOverlay.mockResolvedValue({ projectionChecksum: 'overlay-after' })
    mocks.campaign.advanceCampaignVersion.mockResolvedValue({ ...campaign, version: 4 })
    mocks.events.insertCampaignEvent.mockImplementation(async (event: { kind: string }) => ({
      id: event.kind === 'CAMPAIGN_CONTENT_SHARES_REMOVED' ? ids.event : crypto.randomUUID()
    }))
  })

  it('removes last access, republishes a still-valid Character, and advances once', async () => {
    const result = await removeCampaignContentSharesAndReconcileInTransaction({} as DBLike, input())

    expect(mocks.commitActive).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedStreamVersion: 4,
        sourceLossTargets: [{ subjectKind: 'SPELL', subjectId: ids.spell }]
      })
    )
    expect(mocks.overlays.publish).toHaveBeenCalledWith(
      expect.objectContaining({ expectedPriorOverlayChecksum: 'overlay-before' })
    )
    expect(result).toMatchObject({
      campaignVersion: 4,
      affectedCharacters: [{ characterId: ids.character, status: 'ACTIVE', streamVersion: 5 }]
    })
    expect(mocks.shares.lockSharesForRemoval.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.campaign.lockActiveMembershipForShare.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.evacuation.lockOwners.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.overlays.lockAssignment.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.overlays.lockAssignment.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.characters.findUpdatedAtByIdForUpdate.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.characters.findUpdatedAtByIdForUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.shares.lockCurrentRoot.mock.invocationCallOrder[0] ?? 0
    )
  })

  it('preserves a Character when its owner still owns the current root', async () => {
    mocks.shares.lockCurrentRoot.mockResolvedValue({
      isMaster: false,
      ownerUserId: ids.characterOwner,
      identity: { subjectKind: 'SPELL', subjectId: ids.spell }
    })

    const result = await removeCampaignContentSharesAndReconcileInTransaction({} as DBLike, input())

    expect(result.affectedCharacters).toEqual([])
    expect(mocks.commitActive).not.toHaveBeenCalled()
    expect(mocks.shares.unshareRootExpectingAuthor).toHaveBeenCalledOnce()
  })

  it('prunes a draft-only reference without advancing canonical Character state', async () => {
    const draftCharacter = createEmptyCharacterAuthored({
      id: ids.character,
      userId: ids.characterOwner,
      systemId: '00000000-0000-4000-8000-000000000015',
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000315'
    })
    draftCharacter.intent.spellSelections = [
      {
        id: '00000000-0000-4000-8000-000000000017',
        source: { kind: 'CLASS', classId: '00000000-0000-4000-8000-000000000016' },
        timing: {
          kind: 'CLASS_LEVEL',
          classId: '00000000-0000-4000-8000-000000000016',
          classLevel: 1
        },
        spells: [ids.spell]
      }
    ]
    mocks.drafts.findByCharacter.mockResolvedValue({ payload: { character: draftCharacter } })
    mocks.references.mockReturnValueOnce(false).mockReturnValueOnce(true)

    const result = await removeCampaignContentSharesAndReconcileInTransaction({} as DBLike, input())

    expect(mocks.commitDraftOnly).toHaveBeenCalledWith({
      db: {},
      characterId: ids.character,
      userId: ids.characterOwner,
      sourceLossTargets: [{ subjectKind: 'SPELL', subjectId: ids.spell }]
    })
    expect(mocks.commitActive).not.toHaveBeenCalled()
    expect(result.affectedCharacters).toEqual([
      { characterId: ids.character, status: 'ACTIVE', streamVersion: 4 }
    ])
  })

  it('records DRAFT only when structural reconciliation reports unresolved structure', async () => {
    mocks.commitActive.mockResolvedValue({
      kind: 'DRAFT',
      character: { id: ids.character },
      streamVersion: 5
    })

    const result = await removeCampaignContentSharesAndReconcileInTransaction({} as DBLike, input())

    expect(result.affectedCharacters).toEqual([
      { characterId: ids.character, status: 'DRAFT', streamVersion: 5 }
    ])
    expect(mocks.overlays.publish).not.toHaveBeenCalled()
  })

  it('evacuates a matching Campaign Vehicle and writes immutable evidence before receipt', async () => {
    const selected = share('VEHICLE')
    mocks.shares.lockSharesForRemoval.mockResolvedValue({ locked: [selected], missing: [] })
    mocks.shares.unshareRootExpectingAuthor.mockResolvedValue(selected)
    mocks.campaign.listAssignmentCharacterIds.mockResolvedValue([])
    mocks.vehicles.listByDefinitionsForUpdate.mockResolvedValue([
      { id: ids.vehicle, vehicleDefinitionId: ids.vehicleDefinition }
    ])
    mocks.evacuation.lockOwners.mockResolvedValue({
      campaignOwner: { id: ids.campaignOwner },
      vehicleOwners: new Map([[ids.vehicle, { id: ids.vehicleOwner }]])
    })
    mocks.evacuation.evacuate.mockResolvedValue({
      formerVehicleId: ids.vehicle,
      sourceOwnerId: ids.vehicleOwner,
      destinationOwnerId: ids.campaignOwner,
      transferredTopLevelItemIds: ['00000000-0000-4000-8000-000000000013'],
      transferredCurrencyGroupIds: ['00000000-0000-4000-8000-000000000014'],
      currencyTransfers: [],
      sourceOwnerVersion: 1,
      destinationOwnerVersion: 2
    })

    const result = await removeCampaignContentSharesAndReconcileInTransaction(
      {} as DBLike,
      input(selected)
    )

    expect(mocks.evacuation.evacuate).toHaveBeenCalledOnce()
    expect(result.evacuatedVehicles).toEqual([
      expect.objectContaining({
        vehicleId: ids.vehicle,
        vehicleDefinitionId: ids.vehicleDefinition
      })
    ])
    const kinds = mocks.events.insertCampaignEvent.mock.calls.map(([event]) => event.kind)
    expect(kinds).toContain('CAMPAIGN_VEHICLE_EVACUATED')
    expect(kinds.at(-1)).toBe('CAMPAIGN_CONTENT_SHARES_REMOVED')
  })

  it('reuses reconciliation for authored deletion even when the former sharer is no longer active', async () => {
    mocks.campaign.listAssignmentCharacterIds.mockResolvedValue([])

    const result = await removeCampaignContentSharesAndReconcileInTransaction({} as DBLike, {
      ...input(),
      actorUserId: ids.author,
      operation: 'AUTHORED_DELETED'
    })

    expect(mocks.campaign.lockMembershipForShare).toHaveBeenCalledWith(ids.campaign, ids.author)
    expect(mocks.campaign.lockActiveMembershipForShare).not.toHaveBeenCalled()
    expect(result.removedShares).toEqual([
      { subjectKind: 'SPELL', subjectId: ids.spell, sharedBy: ids.author }
    ])
  })

  it('reconciles a locked vector-only non-owner dependent during authored deletion', async () => {
    mocks.references.mockReturnValue(false)

    await removeCampaignContentSharesAndReconcileInTransaction({} as DBLike, {
      ...input(),
      actorUserId: ids.author,
      operation: 'AUTHORED_DELETED',
      knownDependentCharacterIds: [ids.character]
    })

    expect(mocks.commitActive).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedStreamVersion: 4,
        sourceLossTargets: [{ subjectKind: 'SPELL', subjectId: ids.spell }]
      })
    )
  })

  it('does not advance Campaign version or append a receipt after late reconciliation failure', async () => {
    mocks.commitActive.mockRejectedValue(new Error('projection failed'))

    await expect(
      removeCampaignContentSharesAndReconcileInTransaction({} as DBLike, input())
    ).rejects.toThrow('projection failed')
    expect(mocks.campaign.advanceCampaignVersion).not.toHaveBeenCalled()
    expect(
      mocks.events.insertCampaignEvent.mock.calls.some(
        ([event]) => event.kind === 'CAMPAIGN_CONTENT_SHARES_REMOVED'
      )
    ).toBe(false)
  })

  it('replays only an identical direct-unshare request', async () => {
    const selected = {
      subjectKind: 'SPELL' as const,
      subjectId: ids.spell,
      sharedBy: ids.author
    }
    mocks.inventory.findCampaignEventByIdempotency.mockResolvedValue({
      id: ids.event,
      actorUserId: ids.owner,
      kind: 'CAMPAIGN_CONTENT_SHARES_REMOVED',
      payload: {
        request: {
          operation: 'UNSHARE',
          shares: [selected],
          departingMembership: null
        },
        receipt: {
          campaignVersion: 4,
          removedShares: [selected],
          affectedCharacters: [],
          evacuatedVehicles: []
        }
      }
    })

    await expect(
      findCampaignContentRemovalReceipt({} as DBLike, ids.campaign, ids.command, ids.owner, {
        operation: 'UNSHARE',
        shares: [selected]
      })
    ).resolves.toMatchObject({ eventId: ids.event, removedShares: [selected] })
    await expect(
      findCampaignContentRemovalReceipt({} as DBLike, ids.campaign, ids.command, ids.owner, {
        operation: 'UNSHARE',
        shares: [{ ...selected, subjectId: ids.vehicleDefinition }]
      })
    ).rejects.toThrow('Command ID was already used.')
  })

  it('rejects replay across operation, departing member, or membership epoch', async () => {
    const departing = {
      userId: ids.author,
      expectedAccessStartedAt: '2026-08-22T00:00:00.000Z'
    }
    const selected = {
      subjectKind: 'SPELL' as const,
      subjectId: ids.spell,
      sharedBy: ids.author
    }
    mocks.inventory.findCampaignEventByIdempotency.mockResolvedValue({
      id: ids.event,
      actorUserId: ids.owner,
      kind: 'CAMPAIGN_CONTENT_SHARES_REMOVED',
      payload: {
        request: {
          operation: 'MEMBER_REMOVED',
          shares: [selected],
          departingMembership: departing
        },
        receipt: {
          campaignVersion: 4,
          removedShares: [selected],
          affectedCharacters: [],
          evacuatedVehicles: []
        }
      }
    })

    const changed = [
      { operation: 'MEMBER_LEFT' as const, departingMembership: departing },
      {
        operation: 'MEMBER_REMOVED' as const,
        departingMembership: { ...departing, userId: ids.characterOwner }
      },
      {
        operation: 'MEMBER_REMOVED' as const,
        departingMembership: {
          ...departing,
          expectedAccessStartedAt: '2026-08-22T00:00:01.000Z'
        }
      }
    ]
    for (const expectation of changed) {
      await expect(
        findCampaignContentRemovalReceipt(
          {} as DBLike,
          ids.campaign,
          ids.command,
          ids.owner,
          expectation
        )
      ).rejects.toThrow('Command ID was already used.')
    }
  })
})
