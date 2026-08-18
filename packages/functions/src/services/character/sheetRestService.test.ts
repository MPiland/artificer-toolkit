import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderResolution } from './builderService.js'
import type { CharacterSheetRuleContext } from './characterSheetBundleAssembly.js'

const mocks = vi.hoisted(() => ({
  appendEvent: vi.fn(),
  assembleSheetBundleForRuleContext: vi.fn(),
  createCommittedSheetExtras: vi.fn(),
  createCommittedSheetResolution: vi.fn(),
  createCommittedSheetSpells: vi.fn(),
  findAllCreatures: vi.fn(),
  findAllVehicles: vi.fn(),
  findByCommandId: vi.fn(),
  findById: vi.fn(),
  findAuthoredById: vi.fn(),
  getMovementPreference: vi.fn(),
  listAdjustments: vi.fn(),
  listResourceUsage: vi.fn(),
  listSpellCustomizations: vi.fn(),
  loadCommittedSheetSources: vi.fn(),
  patchSheetState: vi.fn(),
  publishMechanics: vi.fn(),
  requireCurrentMechanics: vi.fn(),
  removeAdjustment: vi.fn(),
  consumeRollForUser: vi.fn(),
  findRollByIdForUser: vi.fn(),
  loadCharacterBuilderContext: vi.fn(),
  resolveCharacterBuilder: vi.fn(),
  buildSheetBundle: vi.fn(),
  compileMechanicsProjection: vi.fn(),
  setMovementPreference: vi.fn(),
  setResourceUsage: vi.fn(),
  setSpellCustomization: vi.fn(),
  upsertAdjustment: vi.fn()
}))

class MockConcurrencyError extends Error {
  constructor(characterId: string, expected: number) {
    super(`Character "${characterId}" stream_version conflict: expected ${expected}.`)
    this.name = 'ConcurrencyError'
  }
}

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    ConcurrencyError: MockConcurrencyError,
    createCharacterEventRepository: () => ({
      append: mocks.appendEvent,
      findByCommandId: mocks.findByCommandId
    }),
    createCharacterRepository: () => ({
      findById: mocks.findById,
      findAuthoredById: mocks.findAuthoredById,
      patchSheetState: mocks.patchSheetState
    }),
    createCharacterMechanicsProjectionRepository: () => ({
      publish: mocks.publishMechanics,
      requireCurrent: mocks.requireCurrentMechanics
    }),
    createLiveSessionCommandLeaseRepository: () => ({
      lockForCharacter: async () => []
    }),
    createCampaignContentRepository: () => ({
      findAssignedCampaign: async () => null
    }),
    createRollHistoryRepository: () => ({
      consumeForUser: mocks.consumeRollForUser,
      findAvailableByIdForUser: mocks.findRollByIdForUser
    }),
    createCreatureRepository: () => ({
      findByIds: async () =>
        new Map(
          ((await mocks.findAllCreatures()) as Array<{ id: string }>).map((creature) => [
            creature.id,
            creature
          ])
        )
    }),
    createVehicleRepository: () => ({
      findByIds: async () => {
        const vehicles = (await mocks.findAllVehicles()) as Array<{ id: string }>
        return new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))
      }
    }),
    createCharacterSheetAdjustmentRepository: () => ({
      getMovementPreference: mocks.getMovementPreference,
      listByCharacter: mocks.listAdjustments,
      remove: mocks.removeAdjustment,
      setMovementPreference: mocks.setMovementPreference,
      upsert: mocks.upsertAdjustment
    }),
    createCharacterSheetPlayStateRepository: () => ({
      listResourceUsage: mocks.listResourceUsage,
      listSpellCustomizations: mocks.listSpellCustomizations,
      setResourceUsage: mocks.setResourceUsage,
      setSpellCustomization: mocks.setSpellCustomization
    })
  }
})

vi.mock('./builderService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./builderService.js')>()
  return {
    ...actual,
    loadCharacterBuilderContext: mocks.loadCharacterBuilderContext,
    resolveCharacterBuilder: mocks.resolveCharacterBuilder
  }
})

vi.mock('./sheetProjection.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sheetProjection.js')>()
  return {
    ...actual,
    buildCharacterSheetBundle: mocks.buildSheetBundle
  }
})

vi.mock('./characterSheetBundleAssembly.js', () => ({
  assembleCharacterSheetBundleForRuleContext: mocks.assembleSheetBundleForRuleContext
}))

vi.mock('./characterCommittedSheetSources.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./characterCommittedSheetSources.js')>()
  return {
    ...actual,
    createCharacterCommittedSheetExtras: mocks.createCommittedSheetExtras,
    createCharacterCommittedSheetResolution: mocks.createCommittedSheetResolution,
    createCharacterCommittedSheetSpells: mocks.createCommittedSheetSpells,
    loadCharacterCommittedSheetSources: mocks.loadCommittedSheetSources
  }
})

vi.mock('./characterMechanicsCompiler.js', () => ({
  compileCharacterMechanicsProjection: mocks.compileMechanicsProjection
}))

vi.mock('./characterRuleEvaluation.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./characterRuleEvaluation.js')>()
  const { evaluateCharacterBuilderTestPolicy } =
    await import('./characterBuilderRuleEvaluation.testUtils.js')
  return { ...original, evaluateCharacterRulePolicy: evaluateCharacterBuilderTestPolicy }
})

const { executeCharacterSheetCommand } = await import('./sheetService.js')
const { previewCharacterRest } = await import('./sheetRestService.js')
const sheetProjection = await import('./sheetProjection.js')
const { evaluateCharacterBuilderTestPolicy } =
  await import('./characterBuilderRuleEvaluation.testUtils.js')
const { projectCharacterRulePolicyToSheetProjection } = await import('./characterRulePolicyAdapter.js')

const emptyQuery = {
  select: () => emptyQuery,
  selectAll: () => emptyQuery,
  innerJoin: () => emptyQuery,
  leftJoin: () => emptyQuery,
  where: () => emptyQuery,
  orderBy: () => emptyQuery,
  execute: async () => []
}

const db = { selectFrom: () => emptyQuery }

function createCharacter(overrides: Partial<CharacterAuthored> = {}): CharacterAuthored {
  return {
    id: 'character-1',
    label: 'Aria',
    status: 'ACTIVE',
    profile: {},
    systemId: 'system-1',
    userId: 'user-1',
    intent: {
      advancement: { method: 'MILESTONE' },
      race: { raceId: 'race-1' },
      background: { backgroundId: 'background-1' },
      classes: [{ classId: 'class-1', classLevel: 1 }],
      abilities: {
        method: 'STANDARD_ARRAY',
        assignments: [{ ability: 'DEXTERITY', option: '14' }]
      },
      hitpoints: {
        method: 'FIXED',
        levels: [{ level: 1, classId: 'class-1', classLevel: 1, value: 10 }]
      },
      featureAcquisitions: []
    },
    state: {
      equipment: {
        inventory: [],
        equipped: [],
        attuned: []
      },
      currency: [],
      hitpoints: {
        current: 10,
        hitDice: []
      }
    },
    ...overrides
  }
}

function createResolution(): CharacterBuilderResolution {
  return {
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
      system: {
        rulesetCode: 'dnd5e',
        rulesetVersion: '2014',
        currencies: [{ id: 'currency-1', label: 'Gold' }],
        speeds: [
          { id: 'speed-walk', code: 'WALK', label: 'Walking Speed' },
          { id: 'speed-fly', code: 'FLY', label: 'Flying Speed' },
          { id: 'speed-climb', code: 'CLIMB', label: 'Climbing Speed' }
        ]
      } as CharacterBuilderResolution['registry']['system'],
      races: [],
      classes: [],
      backgrounds: [],
      equipment: [],
      features: []
    },
    sourceRegistry: {
      system: {
        rulesetCode: 'dnd5e',
        rulesetVersion: '2014',
        currencies: [{ id: 'currency-1', label: 'Gold' }],
        speeds: [
          { id: 'speed-walk', code: 'WALK', label: 'Walking Speed' },
          { id: 'speed-fly', code: 'FLY', label: 'Flying Speed' },
          { id: 'speed-climb', code: 'CLIMB', label: 'Climbing Speed' }
        ]
      } as CharacterBuilderResolution['registry']['system'],
      races: [],
      classes: [],
      backgrounds: [],
      equipment: [],
      features: []
    },
    summary: {
      totalLevel: 1,
      abilities: { DEXTERITY: 14 },
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
}

async function buildPolicyTestSheetBundle(
  params: Parameters<typeof sheetProjection.buildCharacterSheetResponse>[0]
) {
  const ruleEvaluation = await evaluateCharacterBuilderTestPolicy({
    db: params.db,
    character: params.character,
    context: params.ruleEvaluation.context,
    existingRevisionId: params.ruleEvaluation.revisionId,
    expectedRevisionId: params.ruleEvaluation.revisionId,
    adjustments: params.adjustments,
    movementDisplayPreference: params.movementDisplayPreference,
    resourceUsage: params.resourceUsage,
    attunementSlotOverride: params.ruleEvaluation.attunementSlotOverride
  })
  const ruleProjection = projectCharacterRulePolicyToSheetProjection(ruleEvaluation)
  return {
    sheet: await sheetProjection.buildCharacterSheetResponse({
      ...params
    }),
    ruleProjection,
    ruleEvaluation
  }
}

describe('character sheet rest policy', () => {
  beforeEach(() => {
    mocks.appendEvent.mockReset()
    mocks.assembleSheetBundleForRuleContext.mockReset()
    mocks.findAllCreatures.mockReset()
    mocks.findAllCreatures.mockResolvedValue([])
    mocks.findAllVehicles.mockReset()
    mocks.findAllVehicles.mockResolvedValue([])
    mocks.findById.mockReset()
    mocks.findByCommandId.mockReset()
    mocks.findAuthoredById.mockReset()
    mocks.consumeRollForUser.mockReset()
    mocks.consumeRollForUser.mockResolvedValue(true)
    mocks.findRollByIdForUser.mockReset()
    mocks.loadCharacterBuilderContext.mockReset()
    mocks.loadCommittedSheetSources.mockReset()
    mocks.getMovementPreference.mockReset()
    mocks.getMovementPreference.mockResolvedValue({ mode: 'AUTO' })
    mocks.listAdjustments.mockReset()
    mocks.listAdjustments.mockResolvedValue([])
    mocks.listResourceUsage.mockReset()
    mocks.listResourceUsage.mockResolvedValue([])
    mocks.listSpellCustomizations.mockReset()
    mocks.listSpellCustomizations.mockResolvedValue([])
    mocks.removeAdjustment.mockReset()
    mocks.upsertAdjustment.mockReset()
    mocks.resolveCharacterBuilder.mockReset()
    mocks.buildSheetBundle.mockReset()
    mocks.compileMechanicsProjection.mockReset()
    mocks.setMovementPreference.mockReset()
    mocks.setResourceUsage.mockReset()
    mocks.setSpellCustomization.mockReset()
    mocks.patchSheetState.mockReset()
    mocks.publishMechanics.mockReset()
    mocks.requireCurrentMechanics.mockReset()
    mocks.findById.mockResolvedValue({
      id: 'character-1',
      status: 'ACTIVE',
      stream_version: 1,
      rule_pack_revision_id: 'revision-1',
      user_id: 'user-1'
    })
    mocks.findByCommandId.mockResolvedValue(null)
    mocks.findAuthoredById.mockResolvedValue(createCharacter())
    const resolution = createResolution()
    mocks.createCommittedSheetExtras.mockReturnValue({
      creaturesById: new Map(),
      vehiclesById: new Map()
    })
    mocks.createCommittedSheetResolution.mockReturnValue(resolution)
    mocks.createCommittedSheetSpells.mockReturnValue(new Map())
    mocks.loadCommittedSheetSources.mockResolvedValue({
      mechanics: { authoredVersionVector: [] },
      vocabularySnapshot: {
        checksum: 'a'.repeat(64),
        snapshotId: 'vocabulary-snapshot-1',
        snapshotVersion: 1
      }
    })
    mocks.requireCurrentMechanics.mockImplementation(async () => ({
      authoredVersionVector: [],
      characterId: 'character-1',
      characterStreamVersion: 1,
      commandLaneChecksum: 'b'.repeat(64),
      commandState: await mocks.findAuthoredById(),
      evaluatorVersion: 'test-evaluator',
      modelContractVersion: 1,
      projectionChecksum: 'c'.repeat(64),
      rulePolicyInput: {},
      rulePolicyOutput: {},
      ruleRegistry: {},
      ruleRevisionChecksum: 'd'.repeat(64),
      ruleRevisionId: 'revision-1',
      ruleSnapshot: {},
      systemVocabularySnapshotChecksum: 'a'.repeat(64),
      systemVocabularySnapshotId: 'vocabulary-snapshot-1',
      systemVocabularySnapshotVersion: 1
    }))
    mocks.compileMechanicsProjection.mockImplementation((input: {
      characterId: string
      characterCommandState: CharacterAuthored
      characterStreamVersion: number
    }) => ({
      characterId: input.characterId,
      characterStreamVersion: input.characterStreamVersion,
      commandLaneChecksum: 'b'.repeat(64),
      commandState: input.characterCommandState,
      projectionChecksum: 'c'.repeat(64)
    }))
    mocks.loadCharacterBuilderContext.mockResolvedValue({
      catalog: resolution.catalog,
      registry: resolution.sourceRegistry
    })
    mocks.resolveCharacterBuilder.mockResolvedValue(resolution)
    mocks.buildSheetBundle.mockImplementation(buildPolicyTestSheetBundle)
    mocks.assembleSheetBundleForRuleContext.mockImplementation(async (params: {
      db: DBLike
      character: CharacterAuthored
      row: { stream_version: number }
      revisionId: string
      ruleContext: CharacterSheetRuleContext
      excludeCharacterAdjustmentIds?: readonly string[]
    }) => {
      const context = await mocks.loadCharacterBuilderContext(params.db, params.character, [], {
        includeEffects: true
      })
      const resolution = await mocks.resolveCharacterBuilder(
        params.db,
        params.character,
        'edit',
        context,
        null,
        params.revisionId
      )
      const characterAdjustments = (await mocks.listAdjustments(params.character.id)).filter(
        (adjustment: { id: string }) =>
          !new Set(params.excludeCharacterAdjustmentIds).has(adjustment.id)
      )
      const movementDisplayPreference = await mocks.getMovementPreference(params.character.id)
      const bundle = await mocks.buildSheetBundle({
        db: params.db,
        character: params.character,
        resolution,
        streamVersion: params.row.stream_version,
        adjustments: characterAdjustments,
        movementDisplayPreference,
        resourceUsage: await mocks.listResourceUsage(params.character.id),
        spellCustomizations: await mocks.listSpellCustomizations(params.character.id),
        additionalConditions: params.ruleContext.additionalConditions,
        ruleEvaluation: {
          context,
          revisionId: params.revisionId,
          attunementSlotOverride: params.ruleContext.attunementSlotOverride
        }
      })
      return {
        bundle,
        mechanics: {
          commandLaneChecksum: 'b'.repeat(64),
          projectionChecksum: 'c'.repeat(64)
        },
        resolution,
        characterAdjustments,
        movementDisplayPreference
      }
    })
    mocks.patchSheetState.mockImplementation(async (_characterId, _patches, options) => {
      await options.afterPersist?.(db, 2)
      return 2
    })
  })

  it('previews and atomically completes a short rest with exact backend roll evidence', async () => {
    const character = createCharacter()
    character.state.hitpoints = {
      current: 4,
      temp: 3,
      hitDice: [{ die: 10, total: 1, used: 0 }]
    }
    character.intent.abilities = {
      method: 'MANUAL_ROLLED',
      state: { assignments: [{ ability: 'CONSTITUTION', score: 16 }] }
    }
    const resolution = createResolution()
    mocks.findAuthoredById.mockResolvedValue(character)
    mocks.resolveCharacterBuilder.mockResolvedValue(resolution)
    const rollId = '00000000-0000-4000-8000-000000000097'
    const rollEvidence = {
      expression: '1d10 + 3',
      terms: [{ die: 10, count: 1, modifierPerDie: 3, rolls: [1] }],
      total: 4
    }
    mocks.findRollByIdForUser.mockResolvedValue({
      id: rollId,
      characterId: 'character-1',
      source: { kind: 'HIT_DIE', label: 'Short rest hit dice' },
      normalizedExpression: '1d10 + 3',
      evidence: {
        terms: [{ count: 1, die: 10, rolls: [1], subtotal: 1 }],
        modifier: 3,
        mode: 'NORMAL',
        subtotal: 4,
        transform: { kind: 'NONE' },
        total: 4
      }
    })

    const preview = await previewCharacterRest({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      input: {
        restKind: 'SHORT',
        expectedVersion: 1,
        selectedHitDice: [{ die: 10, count: 1 }],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: [],
        rollId,
        rollEvidence,
        requestRoll: false
      }
    })

    expect(preview).toMatchObject({
      canonicalExpression: '1d10 + 3',
      stagedHealing: 4,
      canApply: true,
      rollEvidence
    })

    const response = await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'COMPLETE_REST',
        commandId: '00000000-0000-4000-8000-000000000099',
        expectedVersion: 1,
        restKind: 'SHORT',
        previewFingerprint: preview.previewFingerprint,
        selectedHitDice: [{ die: 10, count: 1 }],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: [],
        rollId,
        rollEvidence: preview.rollEvidence
      }
    })

    expect(mocks.patchSheetState).toHaveBeenCalledWith(
      'character-1',
      [
        {
          kind: 'HITPOINTS',
          value: expect.objectContaining({
            current: 8,
            temp: 3,
            hitDice: [{ die: 10, total: 1, used: 1 }]
          })
        }
      ],
      expect.objectContaining({ expectedStreamVersion: 1 })
    )
    expect(mocks.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        commandType: 'COMPLETE_REST',
        result: {
          type: 'COMPLETE_REST',
          rest: expect.objectContaining({
            restKind: 'SHORT',
            rollEvidence: preview.rollEvidence
          })
        }
      })
    )
    expect(mocks.consumeRollForUser).toHaveBeenCalledWith(rollId, 'user-1')
    expect(response.result).toEqual(
      expect.objectContaining({
        type: 'COMPLETE_REST',
        rest: expect.objectContaining({ rollEvidence: preview.rollEvidence })
      })
    )
  })

  it('routes an ordinary rest preview through the committed Sheet assembly', async () => {
    const character = createCharacter()

    await expect(
      previewCharacterRest({
        db: db as unknown as DBLike,
        characterId: character.id,
        userId: character.userId,
        input: {
          restKind: 'LONG',
          expectedVersion: 1,
          selectedHitDice: [],
          resetMaximumHitPointModifier: false,
          healingMode: 'AUTOMATIC',
          manualHealingAccepted: false,
          selectedCompanionInstanceIds: [],
          requestRoll: false
        }
      })
    ).resolves.toMatchObject({ streamVersion: 1 })

    expect(mocks.assembleSheetBundleForRuleContext).toHaveBeenCalledWith(
      expect.objectContaining({
        character: expect.objectContaining({ id: character.id }),
        row: expect.objectContaining({ stream_version: 1 }),
        revisionId: 'revision-1'
      })
    )
  })

  it('rejects a rest preview when the resolved rules policy changes before completion', async () => {
    const character = createCharacter()
    character.state.hitpoints = {
      current: 4,
      hitDice: [{ die: 10, total: 2, used: 2 }]
    }
    character.state.exhaustion = { level: 2 }
    mocks.findAuthoredById.mockResolvedValue(character)

    const preview = await previewCharacterRest({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      input: {
        restKind: 'LONG',
        expectedVersion: 1,
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: [],
        requestRoll: false
      }
    })

    mocks.buildSheetBundle.mockImplementation(
      async (params: Parameters<typeof sheetProjection.buildCharacterSheetResponse>[0]) => {
        const bundle = await buildPolicyTestSheetBundle(params)
        return {
          ...bundle,
          ruleEvaluation: {
            output: {
              rest: {
                ...bundle.ruleEvaluation.output.rest,
                hitDiceRecoveredAfterLongRest: 0
              }
            }
          }
        }
      }
    )

    await expect(
      executeCharacterSheetCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command: {
          type: 'COMPLETE_REST',
          commandId: '00000000-0000-4000-8000-000000000139',
          expectedVersion: 1,
          restKind: 'LONG',
          previewFingerprint: preview.previewFingerprint,
          selectedHitDice: [],
          resetMaximumHitPointModifier: false,
          healingMode: 'AUTOMATIC',
          manualHealingAccepted: false,
          selectedCompanionInstanceIds: []
        }
      })
    ).rejects.toBeInstanceOf(MockConcurrencyError)
    expect(mocks.patchSheetState).not.toHaveBeenCalled()
    expect(mocks.appendEvent).not.toHaveBeenCalled()
  })
})
