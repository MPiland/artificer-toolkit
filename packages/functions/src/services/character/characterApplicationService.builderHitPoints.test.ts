import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike } from '@artificer-toolkit/db'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderResolution } from './builderService.js'

const SYSTEM_ID = '00000000-0000-4000-8000-000000000101'
const CONDITION_ID = '00000000-0000-4000-8000-000000000102'

const mocks = vi.hoisted(() => ({
  deleteDraft: vi.fn(),
  ensureRouteIdentity: vi.fn(),
  evaluatePolicy: vi.fn(),
  findActiveVocabulary: vi.fn(),
  findBuilderDraft: vi.fn(),
  lockBuilderDraft: vi.fn(),
  findSystem: vi.fn(),
  hasRulesCatalogue: vi.fn(),
  saveBuilderDraft: vi.fn(),
  findAuthoredCharacter: vi.fn(),
  findCharacterRow: vi.fn(),
  findUpdatedAtForUpdate: vi.fn(),
  listAdjustments: vi.fn(),
  listResourceUsage: vi.fn(),
  loadBuilderContext: vi.fn(),
  loadStructuralRuleContext: vi.fn(),
  loadActiveCreatures: vi.fn(),
  reconcileCharacter: vi.fn(),
  resolvePinnedSenseDefinitions: vi.fn(),
  resolveBuilder: vi.fn(),
  resolveRuleBinding: vi.fn(),
  lockCampaignContent: vi.fn(),
  loadCampaignContent: vi.fn(),
  loadVersionVector: vi.fn(),
  lockCampaignAssignment: vi.fn(),
  requireLegacyFinalizationUpgradeSource: vi.fn(),
  requireCurrentMechanics: vi.fn(),
  publishMechanics: vi.fn(),
  compileMechanics: vi.fn(),
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
      findByCharacter: mocks.findBuilderDraft,
      lockByCharacter: mocks.lockBuilderDraft,
      save: mocks.saveBuilderDraft
    }),
    createCharacterMechanicsProjectionRepository: () => ({
      publish: mocks.publishMechanics,
      requireLegacyFinalizationUpgradeSource: mocks.requireLegacyFinalizationUpgradeSource,
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
    createCampaignRepository: () => ({
      findCampaignByCharacter: async () => null
    }),
    createSystemVocabularySnapshotRepository: () => ({
      findActive: mocks.findActiveVocabulary
    }),
    createSystemRepository: () => ({
      findById: mocks.findSystem,
      hasRulesCatalogue: mocks.hasRulesCatalogue
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
    loadCharacterStructuralRuleContext: mocks.loadStructuralRuleContext,
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
  loadCurrentCharacterAuthoredVersionVector: mocks.loadVersionVector,
  resolvePinnedCharacterSenseDefinitions: mocks.resolvePinnedSenseDefinitions
}))

vi.mock('../account/entitlementService.js', () => ({
  withPersonalCharacterLimit: mocks.withCharacterLimit
}))
vi.mock('./campaignCharacterContent.js', () => ({
  lockCampaignCharacterContentForSave: mocks.lockCampaignContent,
  loadCampaignCharacterContentOverlay: mocks.loadCampaignContent
}))

const { createEmptyCharacterAuthored } = await import('./builderService.js')
const {
  createCharacterDraftForUser,
  previewCharacterSaveForUser,
  saveCharacterBuilderDraftForUser,
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

const retainedVocabularySnapshot = {
  snapshotId: 'snapshot-1',
  systemId: SYSTEM_ID,
  snapshotVersion: 1,
  schemaVersion: 1,
  checksum: 'a'.repeat(64),
  document: { id: SYSTEM_ID, conditionTypes: [{ id: CONDITION_ID }] }
}

const retainedConditionEntry = { actionId: 'condition-action-from-snapshot-1' }

function createActiveCharacter(currentHitPoints: number): CharacterAuthored {
  const character = createEmptyCharacterAuthored({
    id: 'character-1',
    systemId: SYSTEM_ID,
    primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
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
    rule_pack_revision_id: 'revision-1',
    system_id: existing.systemId,
    primary_rules_catalogue_id: existing.primaryRulesCatalogueId
  })
  mocks.upsertCharacter.mockImplementation(
    async (
      character: CharacterAuthored,
      options?: {
        afterPersist?: (db: DBLike, streamVersion: number) => Promise<void>
      }
    ) => {
      persisted = structuredClone(character)
      await options?.afterPersist?.({} as DBLike, 2)
    }
  )
  mocks.evaluatePolicy.mockResolvedValue({
    binding: {
      revisionId: 'revision-1',
      checksum: 'checksum-1',
      evaluatorKind: 'ZEN',
      evaluatorVersion: '0.54.0',
      modelContractVersion: 4
    },
    facts: {
      spellActionFacts: [],
      spellCastCandidates: []
    },
    output: {
      derivedStats: { maxHitPoints: { effective: effectiveMaxHitPoints } },
      senses: [],
      spellCastDecisions: [],
      spellCastMechanics: []
    },
    vocabularySnapshot: retainedVocabularySnapshot,
    compiledActionEntryPoints: [retainedConditionEntry]
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
    mocks.lockBuilderDraft.mockResolvedValue(null)
    mocks.saveBuilderDraft.mockImplementation(
      async (input: {
        characterId: string
        userId: string
        systemId: string
        label: string
        mode: 'create' | 'edit'
        payload: unknown
        baseActiveUpdatedAt: string | null
      }) => ({
        id: 'draft-1',
        ...input,
        status: 'DRAFT',
        draftState: 'ACTIVE_WITH_DRAFT',
        createdAt: '2026-08-22T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z'
      })
    )
    mocks.findUpdatedAtForUpdate.mockResolvedValue('2026-07-28T00:00:00.000Z')
    mocks.listAdjustments.mockResolvedValue([])
    mocks.listResourceUsage.mockResolvedValue([])
    mocks.loadBuilderContext.mockResolvedValue({})
    mocks.loadStructuralRuleContext.mockResolvedValue({})
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
      facts: {
        spellActionFacts: [],
        spellCastCandidates: []
      },
      output: {
        derivedStats: { maxHitPoints: { effective: 9 } },
        senses: [],
        spellCastDecisions: [],
        spellCastMechanics: []
      },
      vocabularySnapshot: retainedVocabularySnapshot,
      compiledActionEntryPoints: [retainedConditionEntry]
    })
    mocks.loadActiveCreatures.mockResolvedValue(new Map())
    mocks.lockCampaignContent.mockResolvedValue(undefined)
    mocks.lockCampaignAssignment.mockReset()
    mocks.lockCampaignAssignment.mockResolvedValue(undefined)
    mocks.loadCampaignContent.mockResolvedValue(null)
    mocks.findActiveVocabulary.mockResolvedValue({ id: 'snapshot-1' })
    mocks.loadVersionVector.mockResolvedValue([])
    mocks.resolvePinnedSenseDefinitions.mockResolvedValue([])
    mocks.requireLegacyFinalizationUpgradeSource.mockResolvedValue({
      authoredVersionVector: [],
      projectionChecksum: 'c'.repeat(64)
    })
    mocks.requireCurrentMechanics.mockResolvedValue({
      authoredVersionVector: []
    })
    mocks.compileMechanics.mockReturnValue({ id: 'projection-1' })
    mocks.publishMechanics.mockResolvedValue({
      projectionChecksum: 'projection-checksum-1'
    })
    mocks.upsertCharacter.mockImplementation(
      async (
        _character: CharacterAuthored,
        options?: {
          afterPersist?: (db: DBLike, streamVersion: number) => Promise<void>
        }
      ) => {
        await options?.afterPersist?.({} as DBLike, 1)
      }
    )
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
    expect(mocks.loadStructuralRuleContext.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.withCharacterLimit.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.publishMechanics).toHaveBeenCalledWith({ id: 'projection-1' }, undefined)
    expect(persisted.state.hitpoints.current).toBe(5)
    expect(persisted.state.hitpoints.temp).toBe(3)
    expect(mocks.loadStructuralRuleContext).toHaveBeenCalledWith(
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

  it('uses the bounded structural context for preview and commit, never the Builder catalogue', async () => {
    const character = createActiveCharacter(9)
    await previewCharacterSaveForUser(
      {} as DBLike,
      { character, mode: 'edit', targetStatus: 'ACTIVE' },
      character.userId
    )
    await upsertCharacterBuilderForUser(
      {} as DBLike,
      { character, mode: 'edit', targetStatus: 'ACTIVE' },
      character.userId
    )

    expect(mocks.loadStructuralRuleContext).toHaveBeenCalled()
    expect(mocks.loadBuilderContext).not.toHaveBeenCalled()
    expect(mocks.loadVersionVector).toHaveBeenCalledTimes(1)
    expect(mocks.loadVersionVector).toHaveBeenCalledWith(
      expect.objectContaining({
        rulePolicyOutput: expect.objectContaining({
          derivedStats: { maxHitPoints: { effective: 9 } }
        })
      })
    )
  })

  it('publishes the exact retained structural vocabulary snapshot when the active pointer advances', async () => {
    mocks.findActiveVocabulary.mockResolvedValue({
      ...retainedVocabularySnapshot,
      snapshotId: 'snapshot-2',
      snapshotVersion: 2,
      checksum: 'b'.repeat(64),
      document: { id: SYSTEM_ID, conditionTypes: [] }
    })

    await finalizeWithMaximum(9, 9)

    expect(mocks.findActiveVocabulary).not.toHaveBeenCalled()
    expect(mocks.compileMechanics).toHaveBeenCalledWith(
      expect.objectContaining({
        vocabularySnapshot: retainedVocabularySnapshot,
        compiledActionEntryPoints: [retainedConditionEntry]
      })
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
      facts: {
        spellActionFacts: [],
        spellCastCandidates: []
      },
      output: {
        derivedStats: { maxHitPoints: { effective: 9 } },
        senses: [],
        spellCastDecisions: [],
        spellCastMechanics: []
      },
      vocabularySnapshot: retainedVocabularySnapshot,
      compiledActionEntryPoints: [retainedConditionEntry]
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
      stream_version: 3,
      system_id: existing.systemId,
      primary_rules_catalogue_id: existing.primaryRulesCatalogueId
    })
    mocks.requireCurrentMechanics.mockResolvedValue({
      authoredVersionVector: currentVector
    })
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
    expect(mocks.loadVersionVector).toHaveBeenCalledWith(
      expect.objectContaining({
        rulePolicyOutput: expect.objectContaining({
          derivedStats: { maxHitPoints: { effective: 9 } }
        })
      })
    )

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
    ).rejects.toMatchObject({
      name: 'CharacterAuthoredContentUpgradeRequiredError'
    })
    expect(mocks.upsertCharacter).not.toHaveBeenCalled()

    await expect(
      upsertCharacterBuilderForUser(
        {} as DBLike,
        {
          character: structuredClone(existing),
          mode: 'edit',
          targetStatus: 'ACTIVE',
          authoredContentUpgradePreviewChecksum: preview.authoredContentUpgrade?.previewChecksum
        },
        existing.userId
      )
    ).resolves.toMatchObject({ character: { id: existing.id } })
  })

  it('creates the required authored-content preview from the Builder-only pre-v2 source', async () => {
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
      stream_version: 3,
      system_id: existing.systemId,
      primary_rules_catalogue_id: existing.primaryRulesCatalogueId
    })
    mocks.requireCurrentMechanics.mockRejectedValueOnce(new Error('pre-v2 projection'))
    mocks.requireLegacyFinalizationUpgradeSource.mockResolvedValueOnce({
      authoredVersionVector: currentVector,
      projectionChecksum: 'c'.repeat(64)
    })
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
      candidateVector
    })
    expect(mocks.requireLegacyFinalizationUpgradeSource).toHaveBeenCalledWith({
      characterId: existing.id,
      expectedRuleRevisionId: 'revision-1',
      expectedStreamVersion: 3,
      expectedSystemId: existing.systemId
    })
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

  it('locks Campaign, assignment, and Character before saving an assigned Builder draft', async () => {
    const character = createActiveCharacter(8)
    mocks.findAuthoredCharacter.mockResolvedValue(character)
    mocks.lockCampaignContent.mockResolvedValue('campaign-1')

    await saveCharacterBuilderDraftForUser(
      {} as DBLike,
      character.id,
      { character, mode: 'edit', baseActiveUpdatedAt: null },
      character.userId
    )

    expect(mocks.lockCampaignContent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.lockCampaignAssignment.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.lockCampaignAssignment.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.findUpdatedAtForUpdate.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.findUpdatedAtForUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.saveBuilderDraft.mock.invocationCallOrder[0] ?? 0
    )
  })

  it("rejects another user's Character draft before resolving Builder payload", async () => {
    mocks.findAuthoredCharacter.mockResolvedValue(createActiveCharacter(9))

    await expect(
      createCharacterDraftForUser(
        {} as DBLike,
        {
          id: 'character-1',
          systemId: SYSTEM_ID,
          primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301'
        },
        'user-2'
      )
    ).rejects.toMatchObject({ name: 'AuthoredContentOwnershipError' })

    expect(mocks.resolveBuilder).not.toHaveBeenCalled()
    expect(mocks.ensureRouteIdentity).not.toHaveBeenCalled()
  })

  it('rejects a new Character draft when its System is unavailable before saving', async () => {
    mocks.findBuilderDraft.mockResolvedValue(null)
    mocks.findAuthoredCharacter.mockResolvedValue(null)
    mocks.findSystem.mockResolvedValue(null)

    await expect(
      createCharacterDraftForUser(
        {} as DBLike,
        {
          id: 'character-2',
          systemId: 'system-2',
          primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000302'
        },
        'user-1'
      )
    ).rejects.toMatchObject({ name: 'CharacterRuleBindingError' })

    expect(mocks.saveBuilderDraft).not.toHaveBeenCalled()
  })

  it('rejects a new Character draft when its primary catalogue is outside its System', async () => {
    mocks.findBuilderDraft.mockResolvedValue(null)
    mocks.findAuthoredCharacter.mockResolvedValue(null)
    mocks.findSystem.mockResolvedValue({ id: 'system-2' })
    mocks.hasRulesCatalogue.mockResolvedValue(false)

    await expect(
      createCharacterDraftForUser(
        {} as DBLike,
        {
          id: 'character-2',
          systemId: 'system-2',
          primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000302'
        },
        'user-1'
      )
    ).rejects.toMatchObject({ name: 'CharacterRuleBindingError' })

    expect(mocks.saveBuilderDraft).not.toHaveBeenCalled()
  })

  it('rejects a requested binding that differs from an existing Character', async () => {
    mocks.findAuthoredCharacter.mockResolvedValue(createActiveCharacter(9))

    await expect(
      createCharacterDraftForUser(
        {} as DBLike,
        {
          id: 'character-1',
          systemId: SYSTEM_ID,
          primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000302'
        },
        'user-1'
      )
    ).rejects.toMatchObject({ name: 'CharacterRuleBindingError' })

    expect(mocks.resolveBuilder).not.toHaveBeenCalled()
  })

  it('rejects a Builder commit when its binding differs from the existing draft', async () => {
    const draftCharacter = createActiveCharacter(9)
    draftCharacter.primaryRulesCatalogueId = '00000000-0000-4000-8000-000000000302'
    mocks.lockBuilderDraft.mockResolvedValue({
      characterId: draftCharacter.id,
      systemId: draftCharacter.systemId,
      payload: { character: draftCharacter },
      baseActiveUpdatedAt: null
    })

    await expect(
      upsertCharacterBuilderForUser(
        {} as DBLike,
        {
          character: createActiveCharacter(9),
          mode: 'create',
          targetStatus: 'ACTIVE'
        },
        'user-1'
      )
    ).rejects.toMatchObject({ name: 'CharacterRuleBindingError' })

    expect(mocks.upsertCharacter).not.toHaveBeenCalled()
  })
})
