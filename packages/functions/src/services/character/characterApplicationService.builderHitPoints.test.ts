import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike } from '@artificer-toolkit/db'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderResolution } from './builderService.js'

const mocks = vi.hoisted(() => ({
  deleteDraft: vi.fn(),
  ensureRouteIdentity: vi.fn(),
  evaluatePolicy: vi.fn(),
  findActiveVocabulary: vi.fn(),
  findBuilderDraft: vi.fn(),
  findAuthoredCharacter: vi.fn(),
  findCharacterRow: vi.fn(),
  findUpdatedAtForUpdate: vi.fn(),
  listAdjustments: vi.fn(),
  listResourceUsage: vi.fn(),
  loadBuilderContext: vi.fn(),
  loadActiveCreatures: vi.fn(),
  reconcileCharacter: vi.fn(),
  resolveBuilder: vi.fn(),
  resolveRuleBinding: vi.fn(),
  lockCampaignContent: vi.fn(),
  loadCampaignContent: vi.fn(),
  loadVersionVector: vi.fn(),
  lockCampaignAssignment: vi.fn(),
  requireCurrentMechanics: vi.fn(),
  publishMechanics: vi.fn(),
  compileMechanics: vi.fn(),
  replaceCampaignBindings: vi.fn(),
  upsertCharacter: vi.fn(),
  withCharacterLimit: vi.fn()
}))

vi.mock('@artificer-toolkit/db', () => {
  return {
    checksumCanonicalJson: (value: unknown) => JSON.stringify(value) ?? '',
    ConcurrencyError: class ConcurrencyError extends Error {},
    createAuthoredRouteIdRepository: () => ({
      ensure: mocks.ensureRouteIdentity
    }),
    createCharacterBuilderDraftRepository: () => ({
      delete: mocks.deleteDraft,
      findByCharacter: mocks.findBuilderDraft
    }),
    createCharacterMechanicsProjectionRepository: () => ({
      publish: mocks.publishMechanics,
      requireCurrent: mocks.requireCurrentMechanics
    }),
    createCampaignCharacterMechanicsProjectionRepository: () => ({
      lockAssignment: mocks.lockCampaignAssignment
    }),
    createCharacterRepository: () => ({
      findAuthoredById: mocks.findAuthoredCharacter,
      findById: mocks.findCharacterRow,
      findUpdatedAtByIdForUpdate: mocks.findUpdatedAtForUpdate,
      upsertAuthored: mocks.upsertCharacter
    }),
    createCharacterEventRepository: () => ({}),
    createCharacterSheetAdjustmentRepository: () => ({
      listByCharacter: mocks.listAdjustments
    }),
    createCharacterSheetPlayStateRepository: () => ({
      listResourceUsage: mocks.listResourceUsage
    }),
    createCampaignContentRepository: () => ({
      findAssignedCampaign: async () => null
    }),
    createSystemVocabularySnapshotRepository: () => ({
      findActive: mocks.findActiveVocabulary
    })
  }
})

vi.mock('./builderService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./builderService.js')>()
  return {
    ...actual,
    createCharacterBuilderChangePreview: () => ({
      predictedStatus: 'ACTIVE',
      downgradesStatus: false,
      removedAncestrySelections: [],
      removedFeatureAcquisitions: [],
      removedSpellSelections: [],
      removedResourceGrants: [],
      clearedStartingEquipmentSources: [],
      summaryLines: [],
      destructive: false
    }),
    loadCharacterBuilderContext: mocks.loadBuilderContext,
    resolveCharacterBuilder: mocks.resolveBuilder
  }
})
vi.mock('./builderReconciliation.js', () => ({
  reconcileCharacterBuilderCharacter: mocks.reconcileCharacter
}))
vi.mock('./characterActiveAuthoredSources.js', () => ({
  loadActiveCharacterCreatures: mocks.loadActiveCreatures
}))

vi.mock('./characterRuleEvaluation.js', () => ({
  evaluateCharacterRulePolicy: mocks.evaluatePolicy
}))

vi.mock('./characterRuleBinding.js', () => ({
  resolveCharacterRuleBinding: mocks.resolveRuleBinding
}))
vi.mock('./characterMechanicsCompiler.js', () => ({
  compileCharacterMechanicsProjection: mocks.compileMechanics,
  loadCurrentCharacterAuthoredVersionVector: mocks.loadVersionVector
}))

vi.mock('../account/entitlementService.js', () => ({
  withPersonalCharacterLimit: mocks.withCharacterLimit
}))
vi.mock('./campaignCharacterContent.js', () => ({
  lockCampaignCharacterContentForSave: mocks.lockCampaignContent,
  loadCampaignCharacterContentOverlay: mocks.loadCampaignContent,
  replaceCampaignCharacterContentBindings: mocks.replaceCampaignBindings
}))

const { createEmptyCharacterAuthored } = await import('./builderService.js')
const {
  createCharacterDraftForUser,
  previewCharacterSaveForUser,
  upsertCharacterBuilderForUser
} = await import('./characterApplicationService.js')

const resolution: CharacterBuilderResolution = {
  mode: 'edit',
  catalog: {
    races: [],
    classes: [],
    backgrounds: [],
    equipment: [],
    feats: [],
    spells: []
  },
  registry: {
    system: null,
    races: [],
    classes: [],
    backgrounds: [],
    equipment: [],
    features: []
  },
  sourceRegistry: {
    system: null,
    races: [],
    classes: [],
    backgrounds: [],
    equipment: [],
    features: []
  },
  summary: {
    totalLevel: 0,
    abilities: {},
    classes: []
  },
  grants: {
    features: [],
    resources: [],
    spellcasting: []
  },
  chosenGrantChoices: [],
  outstandingChoices: [],
  validations: [],
  readiness: {
    ready: true,
    blockingIssues: [],
    outstandingRequiredChoices: []
  },
  recommendedSectionId: 'REVIEW'
}

function createActiveCharacter(currentHitPoints: number): CharacterAuthored {
  const character = createEmptyCharacterAuthored({
    id: 'character-1',
    systemId: 'system-1',
    userId: 'user-1'
  })
  character.label = 'Aria'
  character.status = 'ACTIVE'
  character.state.hitpoints.current = currentHitPoints
  character.state.hitpoints.temp = 3
  return character
}

async function finalizeWithMaximum(
  currentHitPoints: number,
  effectiveMaxHitPoints: number
): Promise<CharacterAuthored> {
  const existing = createActiveCharacter(currentHitPoints)
  let persisted: CharacterAuthored | null = null
  const upsertCallIndex = mocks.upsertCharacter.mock.calls.length

  mocks.findAuthoredCharacter.mockImplementation(async () => persisted ?? existing)
  mocks.findCharacterRow.mockResolvedValue({
    id: existing.id,
    rule_pack_revision_id: 'revision-1'
  })
  mocks.upsertCharacter.mockImplementation(async (
    character: CharacterAuthored,
    options?: { afterPersist?: (db: DBLike, streamVersion: number) => Promise<void> }
  ) => {
    persisted = structuredClone(character)
    await options?.afterPersist?.({} as DBLike, 2)
  })
  mocks.evaluatePolicy.mockResolvedValue({
    binding: {
      revisionId: 'revision-1',
      checksum: 'checksum-1',
      evaluatorKind: 'ZEN',
      evaluatorVersion: '0.54.0',
      modelContractVersion: 4
    },
    output: {
      derivedStats: { maxHitPoints: { effective: effectiveMaxHitPoints } },
      senses: []
    }
  })

  await upsertCharacterBuilderForUser(
    {} as DBLike,
    {
      character: structuredClone(existing),
      mode: 'edit',
      targetStatus: 'ACTIVE'
    },
    'user-1'
  )

  expect(mocks.upsertCharacter).toHaveBeenCalledTimes(upsertCallIndex + 1)
  return mocks.upsertCharacter.mock.calls[upsertCallIndex]![0] as CharacterAuthored
}

describe('Builder hit point reconciliation', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()

    mocks.deleteDraft.mockResolvedValue(undefined)
    mocks.ensureRouteIdentity.mockResolvedValue({ publicId: 'aria' })
    mocks.findBuilderDraft.mockResolvedValue(null)
    mocks.findUpdatedAtForUpdate.mockResolvedValue('2026-07-28T00:00:00.000Z')
    mocks.listAdjustments.mockResolvedValue([])
    mocks.listResourceUsage.mockResolvedValue([])
    mocks.loadBuilderContext.mockResolvedValue({})
    mocks.reconcileCharacter.mockImplementation(async (_db: DBLike, character: CharacterAuthored) =>
      structuredClone(character)
    )
    mocks.resolveBuilder.mockResolvedValue(resolution)
    mocks.resolveRuleBinding.mockResolvedValue({
      revisionId: 'revision-1',
      checksum: 'checksum-1',
      evaluatorKind: 'ZEN',
      evaluatorVersion: '0.54.0',
      modelContractVersion: 4
    })
    mocks.evaluatePolicy.mockResolvedValue({
      binding: {
        revisionId: 'revision-1',
        checksum: 'checksum-1',
        evaluatorKind: 'ZEN',
        evaluatorVersion: '0.54.0',
        modelContractVersion: 4
      },
      output: { derivedStats: { maxHitPoints: { effective: 9 } }, senses: [] }
    })
    mocks.loadActiveCreatures.mockResolvedValue(new Map())
    mocks.lockCampaignContent.mockResolvedValue(undefined)
    mocks.lockCampaignAssignment.mockReset()
    mocks.lockCampaignAssignment.mockResolvedValue(undefined)
    mocks.loadCampaignContent.mockResolvedValue(null)
    mocks.findActiveVocabulary.mockResolvedValue({ id: 'snapshot-1' })
    mocks.loadVersionVector.mockResolvedValue([])
    mocks.requireCurrentMechanics.mockResolvedValue({ authoredVersionVector: [] })
    mocks.compileMechanics.mockReturnValue({ id: 'projection-1' })
    mocks.publishMechanics.mockResolvedValue(undefined)
    mocks.replaceCampaignBindings.mockResolvedValue(undefined)
    mocks.upsertCharacter.mockImplementation(async (
      _character: CharacterAuthored,
      options?: { afterPersist?: (db: DBLike, streamVersion: number) => Promise<void> }
    ) => {
      await options?.afterPersist?.({} as DBLike, 1)
    })
    mocks.withCharacterLimit.mockImplementation(
      async (
        _db: DBLike,
        _userId: string,
        _characterId: string,
        callback: (db: DBLike) => unknown
      ) => callback({} as DBLike)
    )
  })

  it('clamps live current hit points when a Builder change lowers the effective maximum', async () => {
    const persisted = await finalizeWithMaximum(9, 5)

    expect(mocks.withCharacterLimit).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'character-1',
      expect.any(Function)
    )
    expect(mocks.loadBuilderContext.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.withCharacterLimit.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.publishMechanics).toHaveBeenCalledWith({ id: 'projection-1' })
    expect(persisted.state.hitpoints.current).toBe(5)
    expect(persisted.state.hitpoints.temp).toBe(3)
    expect(mocks.loadBuilderContext).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'character-1' }),
      [],
      { includeEffects: true }
    )
    expect(mocks.evaluatePolicy).toHaveBeenCalledWith(
      expect.objectContaining({ existingRevisionId: 'revision-1' })
    )
    expect(mocks.resolveRuleBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        existingRevisionId: 'revision-1',
        expectedRevisionId: 'revision-1'
      })
    )
    expect(mocks.upsertCharacter).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ rulePackRevisionId: 'revision-1' })
    )
  })

  it('preserves live current hit points when the effective maximum is unchanged or higher', async () => {
    await expect(finalizeWithMaximum(9, 9)).resolves.toMatchObject({
      state: { hitpoints: { current: 9 } }
    })
    await expect(finalizeWithMaximum(9, 14)).resolves.toMatchObject({
      state: { hitpoints: { current: 9 } }
    })
  })

  it('floors a negative effective maximum at zero before clamping current hit points', async () => {
    const persisted = await finalizeWithMaximum(9, -4)

    expect(persisted.state.hitpoints.current).toBe(0)
  })

  it('locks an assigned Campaign projection before its Character row', async () => {
    mocks.lockCampaignContent.mockResolvedValue('campaign-1')

    await finalizeWithMaximum(9, 9)

    expect(mocks.lockCampaignAssignment).toHaveBeenCalledWith({
      campaignId: 'campaign-1',
      characterId: 'character-1'
    })
    expect(mocks.lockCampaignAssignment.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.findUpdatedAtForUpdate.mock.invocationCallOrder[0] as number
    )
  })

  it('treats a first-finalization candidate as an unpinned draft until its revision is committed', async () => {
    const candidate = createActiveCharacter(9)
    mocks.findAuthoredCharacter.mockResolvedValue(null)
    mocks.findCharacterRow.mockResolvedValue(null)
    mocks.evaluatePolicy.mockResolvedValue({
      binding: {
        revisionId: 'revision-1',
        checksum: 'checksum-1',
        evaluatorKind: 'ZEN',
        evaluatorVersion: '0.54.0',
        modelContractVersion: 4
      },
      output: { derivedStats: { maxHitPoints: { effective: 9 } }, senses: [] }
    })

    await upsertCharacterBuilderForUser(
      {} as DBLike,
      {
        character: candidate,
        mode: 'create',
        targetStatus: 'ACTIVE'
      },
      'user-1'
    )

    expect(mocks.reconcileCharacter).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'DRAFT' }),
      null,
      expect.anything(),
      null
    )
    expect(mocks.evaluatePolicy).toHaveBeenCalledWith(
      expect.objectContaining({ existingRevisionId: null })
    )
    expect(mocks.upsertCharacter).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ rulePackRevisionId: 'revision-1' })
    )
  })

  it('requires a reviewed authored-content preview before repinning an active Character', async () => {
    const existing = createActiveCharacter(9)
    const currentVector = [
      {
        subjectKind: 'RACE' as const,
        subjectId: 'race-elf',
        versionId: 'race-elf-v1',
        version: 1,
        checksum: 'a'.repeat(64)
      }
    ]
    const candidateVector = [
      {
        subjectKind: 'RACE' as const,
        subjectId: 'race-elf',
        versionId: 'race-elf-v2',
        version: 2,
        checksum: 'b'.repeat(64)
      }
    ]
    mocks.findAuthoredCharacter.mockResolvedValue(existing)
    mocks.findCharacterRow.mockResolvedValue({
      id: existing.id,
      status: 'ACTIVE',
      rule_pack_revision_id: 'revision-1',
      stream_version: 3
    })
    mocks.requireCurrentMechanics.mockResolvedValue({ authoredVersionVector: currentVector })
    mocks.loadVersionVector.mockResolvedValue(candidateVector)

    const preview = await previewCharacterSaveForUser(
      {} as DBLike,
      {
        character: structuredClone(existing),
        mode: 'edit',
        targetStatus: 'ACTIVE'
      },
      existing.userId
    )

    expect(preview.authoredContentUpgrade).toMatchObject({
      currentVector,
      candidateVector,
      changes: [
        expect.objectContaining({
          subjectKind: 'RACE',
          subjectId: 'race-elf',
          previous: currentVector[0],
          next: candidateVector[0]
        })
      ]
    })

    await expect(
      upsertCharacterBuilderForUser(
        {} as DBLike,
        {
          character: structuredClone(existing),
          mode: 'edit',
          targetStatus: 'ACTIVE'
        },
        existing.userId
      )
    ).rejects.toMatchObject({ name: 'CharacterAuthoredContentUpgradeRequiredError' })
    expect(mocks.upsertCharacter).not.toHaveBeenCalled()

    await expect(
      upsertCharacterBuilderForUser(
        {} as DBLike,
        {
          character: structuredClone(existing),
          mode: 'edit',
          targetStatus: 'ACTIVE',
          authoredContentUpgradePreviewChecksum:
            preview.authoredContentUpgrade?.previewChecksum
        },
        existing.userId
      )
    ).resolves.toMatchObject({ character: { id: existing.id } })
  })

  it('rejects a Builder commit before resolving when the Character belongs to another user', async () => {
    mocks.findAuthoredCharacter.mockResolvedValue(createActiveCharacter(9))
    mocks.findCharacterRow.mockResolvedValue({
      id: 'character-1',
      rule_pack_revision_id: 'revision-1'
    })

    await expect(
      upsertCharacterBuilderForUser(
        {} as DBLike,
        {
          character: createActiveCharacter(9),
          mode: 'edit',
          targetStatus: 'ACTIVE'
        },
        'user-2'
      )
    ).rejects.toMatchObject({ name: 'AuthoredContentOwnershipError' })

    expect(mocks.resolveBuilder).not.toHaveBeenCalled()
    expect(mocks.upsertCharacter).not.toHaveBeenCalled()
  })

  it("rejects another user's Character draft before resolving Builder payload", async () => {
    mocks.findAuthoredCharacter.mockResolvedValue(createActiveCharacter(9))

    await expect(
      createCharacterDraftForUser(
        {} as DBLike,
        { id: 'character-1', systemId: 'system-1' },
        'user-2'
      )
    ).rejects.toMatchObject({ name: 'AuthoredContentOwnershipError' })

    expect(mocks.resolveBuilder).not.toHaveBeenCalled()
    expect(mocks.ensureRouteIdentity).not.toHaveBeenCalled()
  })
})
