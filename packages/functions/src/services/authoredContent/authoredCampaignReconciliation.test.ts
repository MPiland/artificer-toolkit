import type { DBLike } from '@artificer-toolkit/db'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  author: '00000000-0000-4000-8000-000000000002',
  character: '00000000-0000-4000-8000-000000000003',
  spell: '00000000-0000-4000-8000-000000000004',
  version: '00000000-0000-4000-8000-000000000005',
  player: '00000000-0000-4000-8000-000000000006',
  draft: '00000000-0000-4000-8000-000000000007',
  draftCharacter: '00000000-0000-4000-8000-000000000008'
}

const order: string[] = []
const mocks = vi.hoisted(() => ({
  shares: {
    listByRoot: vi.fn(),
    lockSharesForActivation: vi.fn(),
    lockSharesForRemoval: vi.fn()
  },
  entitlements: { lockTier: vi.fn() },
  campaigns: {
    listAssignmentCharacterIds: vi.fn(),
    findCampaignByCharacter: vi.fn(),
    lockCampaign: vi.fn(),
    lockMembershipForShare: vi.fn(),
    advanceCampaignVersion: vi.fn()
  },
  characters: {
    listByUser: vi.fn(),
    findAuthoredById: vi.fn(),
    findById: vi.fn(),
    findUpdatedAtByIdForUpdate: vi.fn()
  },
  drafts: {
    findByCharacter: vi.fn(),
    listByUser: vi.fn(),
    lockByIds: vi.fn()
  },
  mechanics: { listCharacterIdsByAuthoredRoot: vi.fn() },
  overlays: { lockAssignment: vi.fn(), findCurrentChecksum: vi.fn(), publish: vi.fn() },
  vehicles: { listByDefinitionsForUpdate: vi.fn() },
  evacuation: { lockOwners: vi.fn(), lockOwnerGraphs: vi.fn() },
  events: { insertCampaignEvent: vi.fn() },
  referencesRoot: vi.fn(),
  commitActive: vi.fn(),
  commitDraft: vi.fn(),
  commitDraftOnly: vi.fn(),
  resolveContext: vi.fn(),
  prepareOverlay: vi.fn(),
  removeShares: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createCampaignContentShareRepository: () => mocks.shares,
  createAccountEntitlementsRepository: () => mocks.entitlements,
  createCampaignRepository: () => mocks.campaigns,
  createCharacterRepository: () => mocks.characters,
  createCharacterBuilderDraftRepository: () => mocks.drafts,
  createCharacterMechanicsProjectionRepository: () => mocks.mechanics,
  createCampaignCharacterMechanicsProjectionRepository: () => mocks.overlays,
  createCampaignVehicleRepository: () => mocks.vehicles,
  createCampaignVehicleEvacuationRepository: () => mocks.evacuation,
  createCampaignAdjustmentsRepository: () => mocks.events
}))
vi.mock('../character/builderReconciliation.js', () => ({
  characterReferencesAuthoredRoot: mocks.referencesRoot
}))
vi.mock('../character/characterStructuralReconciliationCommit.js', () => ({
  commitCharacterStructuralReconciliation: mocks.commitActive,
  commitCharacterDraftSourceLoss: mocks.commitDraft,
  commitCharacterDraftOnlySourceLoss: mocks.commitDraftOnly
}))
vi.mock('../character/campaignCharacterSheet.js', () => ({
  resolveCharacterLiveSessionRuleContext: mocks.resolveContext
}))
vi.mock('../campaign/campaignCharacterMechanicsProjection.js', () => ({
  prepareCampaignCharacterMechanicsProjection: mocks.prepareOverlay
}))
vi.mock('../campaign/campaignContentShareRemoval.js', () => ({
  removeCampaignContentSharesAndReconcileInTransaction: mocks.removeShares
}))

const {
  prepareAuthoredCampaignMutation,
  reconcileAuthoredActivationInTransaction,
  reconcileAuthoredDeletionInTransaction
} = await import('./authoredCampaignReconciliation.js')
const { createEmptyCharacterAuthored } = await import('../character/builderService.js')

const campaign = {
  id: ids.campaign,
  publicId: 'campaign-public',
  ownerUserId: ids.author,
  name: 'Campaign',
  description: null,
  format: 'ONGOING' as const,
  toneTags: [],
  toneDetails: null,
  contentMaturity: 'STANDARD' as const,
  attunementSlotOverride: null,
  status: 'ACTIVE' as const,
  version: 3,
  createdAt: '2026-08-22T00:00:00.000Z',
  updatedAt: '2026-08-22T00:00:00.000Z'
}
const share = {
  campaignId: ids.campaign,
  subjectKind: 'SPELL' as const,
  subjectId: ids.spell,
  sharedBy: ids.author,
  createdAt: '2026-08-22T00:00:00.000Z',
  updatedAt: '2026-08-22T00:00:00.000Z'
}
const snapshot = {
  id: ids.character,
  userId: ids.author,
  systemId: 'system-1'
} as unknown as CharacterAuthored
const row = {
  status: 'ACTIVE',
  stream_version: 4,
  rule_pack_revision_id: 'revision-1'
}

describe('authored Campaign mutation reconciliation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    order.length = 0
    mocks.shares.listByRoot.mockResolvedValue([share])
    mocks.entitlements.lockTier.mockImplementation(async () => {
      order.push('entitlement')
      return 'FREE'
    })
    mocks.campaigns.listAssignmentCharacterIds.mockResolvedValue([ids.character])
    mocks.campaigns.findCampaignByCharacter.mockResolvedValue({
      campaignId: ids.campaign,
      characterId: ids.character,
      userId: ids.author,
      assignedAt: '2026-08-22T00:00:00.000Z'
    })
    mocks.campaigns.lockCampaign.mockImplementation(async () => {
      order.push('campaign')
      return campaign
    })
    mocks.campaigns.lockMembershipForShare.mockImplementation(async () => {
      order.push('membership')
      return {
        campaignId: ids.campaign,
        userId: ids.author,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: '2026-08-22T00:00:00.000Z',
        joinedAt: '2026-08-22T00:00:00.000Z',
        leftAt: null
      }
    })
    mocks.campaigns.advanceCampaignVersion.mockResolvedValue({ ...campaign, version: 4 })
    mocks.characters.listByUser.mockResolvedValue([{ id: ids.character }])
    mocks.characters.findAuthoredById.mockResolvedValue(snapshot)
    mocks.characters.findById.mockResolvedValue(row)
    mocks.characters.findUpdatedAtByIdForUpdate.mockImplementation(async () => {
      order.push('character')
      return '2026-08-22T00:00:00.000Z'
    })
    mocks.drafts.findByCharacter.mockResolvedValue(null)
    mocks.drafts.listByUser.mockResolvedValue([])
    mocks.drafts.lockByIds.mockResolvedValue([])
    mocks.mechanics.listCharacterIdsByAuthoredRoot.mockResolvedValue([ids.character])
    mocks.referencesRoot.mockReturnValue(true)
    mocks.shares.lockSharesForActivation.mockImplementation(async () => {
      order.push('share')
      return { locked: [share], missing: [] }
    })
    mocks.shares.lockSharesForRemoval.mockResolvedValue({ locked: [share], missing: [] })
    mocks.overlays.lockAssignment.mockImplementation(async () => {
      order.push('assignment')
    })
    mocks.vehicles.listByDefinitionsForUpdate.mockResolvedValue([])
    mocks.evacuation.lockOwners.mockResolvedValue({
      campaignOwner: { id: 'inventory-owner' },
      vehicleOwners: new Map()
    })
    mocks.commitActive.mockResolvedValue({
      kind: 'DRAFT',
      character: snapshot,
      streamVersion: 5
    })
    mocks.events.insertCampaignEvent.mockResolvedValue({ id: 'event-1' })
    mocks.removeShares.mockResolvedValue({ campaignVersion: 4 })
  })

  it('locks only Campaign share authority before activation root mutation', async () => {
    await prepareAuthoredCampaignMutation({} as DBLike, {
      kind: 'ACTIVATED',
      ownerUserId: ids.author,
      subjectKind: 'SPELL',
      subjectId: ids.spell
    })

    expect(order).toEqual(['entitlement', 'campaign', 'share', 'membership'])
    expect(mocks.characters.listByUser).not.toHaveBeenCalled()
    expect(mocks.mechanics.listCharacterIdsByAuthoredRoot).not.toHaveBeenCalled()
    expect(mocks.drafts.listByUser).not.toHaveBeenCalled()
    expect(mocks.overlays.lockAssignment).not.toHaveBeenCalled()
    expect(mocks.characters.findUpdatedAtByIdForUpdate).not.toHaveBeenCalled()
    expect(mocks.drafts.lockByIds).not.toHaveBeenCalled()
  })

  it('leaves Characters and drafts untouched while advancing each shared Campaign once', async () => {
    const plan = await prepareAuthoredCampaignMutation({} as DBLike, {
      kind: 'ACTIVATED',
      ownerUserId: ids.author,
      subjectKind: 'SPELL',
      subjectId: ids.spell
    })

    await reconcileAuthoredActivationInTransaction({
      db: {} as DBLike,
      plan,
      versionId: ids.version
    })

    expect(mocks.commitActive).not.toHaveBeenCalled()
    expect(mocks.commitDraft).not.toHaveBeenCalled()
    expect(mocks.commitDraftOnly).not.toHaveBeenCalled()
    expect(mocks.overlays.publish).not.toHaveBeenCalled()
    expect(mocks.campaigns.advanceCampaignVersion).toHaveBeenCalledOnce()
    expect(mocks.events.insertCampaignEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'CAMPAIGN_AUTHORED_CONTENT_ACTIVATED',
        payload: expect.objectContaining({ versionId: ids.version })
      })
    )
  })

  it('removes owner dependencies before reusing the B2 authored-delete primitive', async () => {
    const plan = await prepareAuthoredCampaignMutation({} as DBLike, {
      kind: 'DELETED',
      ownerUserId: ids.author,
      subjectKind: 'SPELL',
      subjectId: ids.spell
    })

    await reconcileAuthoredDeletionInTransaction({ db: {} as DBLike, plan })

    expect(mocks.commitActive).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLossTargets: [{ subjectKind: 'SPELL', subjectId: ids.spell }]
      })
    )
    expect(mocks.commitActive.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.removeShares.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.removeShares).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorUserId: ids.author,
        operation: 'AUTHORED_DELETED',
        expectedCampaignVersion: 3
      })
    )
  })

  it('discovers, locks, and reconciles an owner draft with no canonical Character row', async () => {
    const draftCharacter = createEmptyCharacterAuthored({
      id: ids.draftCharacter,
      userId: ids.author,
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      systemId: '00000000-0000-4000-8000-000000000009'
    })
    draftCharacter.intent.background.backgroundId = ids.spell
    const draft = {
      id: ids.draft,
      characterId: ids.draftCharacter,
      userId: ids.author,
      systemId: draftCharacter.systemId,
      label: 'Draft only',
      status: 'DRAFT' as const,
      mode: 'create' as const,
      payload: { character: draftCharacter },
      draftState: 'DRAFT_ONLY' as const,
      baseActiveUpdatedAt: null,
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z'
    }
    mocks.shares.listByRoot.mockResolvedValue([])
    mocks.characters.listByUser.mockResolvedValue([])
    mocks.drafts.listByUser.mockResolvedValue([draft])
    mocks.drafts.lockByIds.mockImplementation(async () => {
      order.push('draft')
      return [draft]
    })

    const plan = await prepareAuthoredCampaignMutation({} as DBLike, {
      kind: 'DELETED',
      ownerUserId: ids.author,
      subjectKind: 'BACKGROUND',
      subjectId: ids.spell
    })
    await reconcileAuthoredDeletionInTransaction({ db: {} as DBLike, plan })

    expect(mocks.drafts.lockByIds).toHaveBeenCalledWith({
      draftIds: [ids.draft],
      userId: ids.author
    })
    expect(mocks.commitDraftOnly).toHaveBeenCalledWith({
      db: expect.anything(),
      characterId: ids.draftCharacter,
      userId: ids.author,
      sourceLossTargets: [{ subjectKind: 'BACKGROUND', subjectId: ids.spell }]
    })
  })

  it('carries a locked non-owner vector-only dependent into authored deletion', async () => {
    const playerSnapshot = { ...snapshot, userId: ids.player } as CharacterAuthored
    mocks.characters.listByUser.mockResolvedValue([])
    mocks.characters.findAuthoredById.mockResolvedValue(playerSnapshot)
    mocks.referencesRoot.mockReturnValue(false)

    const plan = await prepareAuthoredCampaignMutation({} as DBLike, {
      kind: 'DELETED',
      ownerUserId: ids.author,
      subjectKind: 'SPELL',
      subjectId: ids.spell
    })
    await reconcileAuthoredDeletionInTransaction({ db: {} as DBLike, plan })

    expect(mocks.removeShares).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ knownDependentCharacterIds: [ids.character] })
    )
    expect(mocks.commitActive).not.toHaveBeenCalled()
  })
})
