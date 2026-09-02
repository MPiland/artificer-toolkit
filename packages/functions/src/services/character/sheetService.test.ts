import { createHash, randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  SCALING,
  SPELLCASTING_ATTRIBUTE,
  SPELL_GRANT_ATTRIBUTE
} from '@artificer-toolkit/shared/core'
import {
  createCharacterResourceOwnerKey,
  toCharacterResourceOwnerKey,
  type CharacterResourceOwnerKey
} from '@artificer-toolkit/shared/character'
import type {
  CharacterAuthored,
  CreatureAuthored,
  SpellAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderResolution } from './builderService.js'
import type { CharacterMechanicsCompilerInput } from './characterMechanicsCompiler.js'
import type { CharacterRuleEvaluationResult } from './characterRuleEvaluation.js'
import type { CharacterSheetRuleContext } from './characterSheetBundleAssembly.js'
import type { CharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { CharacterSheetCommittedRuleSnapshot } from './sheetService.js'

const mocks = vi.hoisted(() => ({
  deleteActiveRuleEffect: vi.fn(),
  appendEvent: vi.fn(),
  advanceMechanicsProjection: vi.fn(),
  advanceLiveMechanicsProjection: vi.fn(),
  assembleSheetBundleForRuleContext: vi.fn(),
  compileMechanicsProjection: vi.fn(),
  collectEvaluationSpellIds: vi.fn(),
  createCommittedExtras: vi.fn(),
  createCommittedResolution: vi.fn(),
  createCommittedSpells: vi.fn(),
  extendCommittedSources: vi.fn(),
  reduceCommittedSources: vi.fn(),
  lockCampaignShareUses: vi.fn(),
  lockActiveRuleEffects: vi.fn(),
  lockCurrentSourceUses: vi.fn(),
  lockCampaignMemberForContentRead: vi.fn(),
  lockCampaignAssignment: vi.fn(),
  pruneCommittedSources: vi.fn(),
  assertCommandAuthority: vi.fn(),
  findAllCreatures: vi.fn(),
  findAllVehicles: vi.fn(),
  findByCommandId: vi.fn(),
  findById: vi.fn(),
  findHitPointAdjustment: vi.fn(),
  findMechanics: vi.fn(),
  findMechanicsMetadata: vi.fn(),
  findCampaignMechanics: vi.fn(),
  findCampaignMechanicsMetadata: vi.fn(),
  publishCampaignMechanics: vi.fn(),
  findAuthoredById: vi.fn(),
  getMovementPreference: vi.fn(),
  listAdjustments: vi.fn(),
  listResourceUsage: vi.fn(),
  listSpellCustomizations: vi.fn(),
  patchSheetState: vi.fn(),
  patchLiveHitPoints: vi.fn(),
  publishMechanics: vi.fn(),
  resolveRuleBinding: vi.fn(),
  removeAdjustment: vi.fn(),
  consumeRollForUser: vi.fn(),
  evaluateActionStateChange: vi.fn(),
  evaluatePinnedRuleRevision: vi.fn(),
  findRollByIdForUser: vi.fn(),
  loadCharacterBuilderContext: vi.fn(),
  resolveCharacterBuilder: vi.fn(),
  resolveCampaignContext: vi.fn(),
  resolveLiveSessionRuleContext: vi.fn(),
  resolveActiveCharacterEquipment: vi.fn(),
  loadActiveCreatures: vi.fn(),
  loadActiveVehicles: vi.fn(),
  loadCampaignContentOverlay: vi.fn(),
  loadCommittedSources: vi.fn(),
  lockMaximumHitPointContext: vi.fn(),
  commitMaximumHitPointPolicy: vi.fn(),
  buildSheetBundle: vi.fn(),
  setMovementPreference: vi.fn(),
  setRulePackRevision: vi.fn(),
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
    withTransaction: async (db: DBLike, fn: (trx: DBLike) => Promise<unknown>) => fn(db),
    createCharacterEventRepository: () => ({
      append: mocks.appendEvent,
      findByCommandId: mocks.findByCommandId
    }),
    createActiveRuleEffectRepository: () => ({
      lockByOwner: mocks.lockActiveRuleEffects,
      deleteCas: mocks.deleteActiveRuleEffect
    }),
    createCharacterRepository: () => ({
      findById: mocks.findById,
      findAuthoredById: mocks.findAuthoredById,
      patchLiveHitPoints: mocks.patchLiveHitPoints,
      patchSheetState: mocks.patchSheetState,
      setRulePackRevision: mocks.setRulePackRevision
    }),
    createCharacterMechanicsProjectionRepository: () => ({
      advanceLiveCommandState: mocks.advanceLiveMechanicsProjection,
      publish: mocks.publishMechanics,
      requireCurrent: async (input: unknown) => {
        const projection = await mocks.findMechanics(input)
        return projection?.rulePolicyOutput
          ? projection
          : {
              ...projection,
              pinnedSenseDefinitions: projection?.pinnedSenseDefinitions ?? [],
              rulePolicyOutput: { senses: [] }
            }
      },
      requireCurrentMetadata: mocks.findMechanicsMetadata
    }),
    createLiveMaximumHitPointPolicyRepository: () => ({
      lockContext: mocks.lockMaximumHitPointContext,
      prepareAndCommit: mocks.commitMaximumHitPointPolicy
    }),
    createCampaignCharacterMechanicsProjectionRepository: () => ({
      lockAssignment: mocks.lockCampaignAssignment,
      publish: mocks.publishCampaignMechanics,
      requireCurrent: mocks.findCampaignMechanics,
      requireCurrentMetadata: mocks.findCampaignMechanicsMetadata
    }),
    createCampaignRepository: () => ({
      findCampaignByCharacter: async () => null
    }),
    createCampaignContentShareRepository: () => ({
      lockCampaignMemberForContentRead: mocks.lockCampaignMemberForContentRead
    }),
    createRollHistoryRepository: () => ({
      consumeForUser: mocks.consumeRollForUser,
      findAvailableByIdForUser: mocks.findRollByIdForUser
    }),
    createCreatureRepository: () => ({
      findById: async (id: string) =>
        ((await mocks.findAllCreatures()) as CreatureAuthored[]).find(
          (creature) => creature.id === id
        ) ?? null,
      findByIds: async () =>
        new Map(
          ((await mocks.findAllCreatures()) as CreatureAuthored[]).map((creature) => [
            creature.id,
            creature
          ])
        )
    }),
    createVehicleRepository: () => ({
      findById: async (id: string) =>
        ((await mocks.findAllVehicles()) as Array<{ id: string }>).find(
          (vehicle) => vehicle.id === id
        ) ?? null,
      findByIds: async () => {
        const vehicles = (await mocks.findAllVehicles()) as Array<{
          id: string
        }>
        return new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))
      }
    }),
    createCharacterSheetAdjustmentRepository: () => ({
      findHitPointAdjustment: mocks.findHitPointAdjustment,
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

vi.mock('./characterAssemblyOrchestrator.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./characterAssemblyOrchestrator.js')>()
  return {
    ...actual,
    resolveActiveCharacterEquipment: mocks.resolveActiveCharacterEquipment
  }
})

vi.mock('./characterActiveAuthoredSources.js', () => ({
  loadActiveCharacterCreatures: mocks.loadActiveCreatures,
  loadActiveCharacterVehicles: mocks.loadActiveVehicles
}))

vi.mock('./characterCommittedSheetSources.js', () => ({
  createCharacterCommittedSheetExtras: mocks.createCommittedExtras,
  createCharacterCommittedSheetResolution: mocks.createCommittedResolution,
  createCharacterCommittedSheetSpells: mocks.createCommittedSpells,
  extendCharacterCommittedSheetSourcesWithActiveRoots: mocks.extendCommittedSources,
  loadCharacterCommittedSheetSources: mocks.loadCommittedSources,
  lockCharacterCommittedSheetCampaignShareUses: mocks.lockCampaignShareUses,
  lockCharacterCommittedSheetCurrentSourceUses: mocks.lockCurrentSourceUses,
  pruneCharacterCommittedSheetSourcesRoots: mocks.pruneCommittedSources,
  reduceCharacterCommittedSheetSourcesToRuleOutputSpells: mocks.reduceCommittedSources
}))

vi.mock('./campaignCharacterContent.js', () => ({
  loadCampaignCharacterContentOverlay: mocks.loadCampaignContentOverlay
}))

vi.mock('./characterMechanicsCompiler.js', () => ({
  advanceCharacterMechanicsProjectionCommandState: mocks.advanceMechanicsProjection,
  carryPinnedCharacterSenseDefinitions: ({
    prior,
    senses
  }: {
    prior: readonly unknown[] | undefined
    senses: readonly { senseDefinitionId: string; range: unknown }[]
  }) =>
    (prior ?? []).flatMap((pin) => {
      if (typeof pin !== 'object' || pin === null || !('senseDefinitionId' in pin)) return []
      const sense = senses.find(
        (candidate) => candidate.senseDefinitionId === pin.senseDefinitionId
      )
      return sense ? [{ ...pin, range: sense.range }] : []
    }),
  compileCharacterMechanicsProjection: mocks.compileMechanicsProjection
}))

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

vi.mock('./characterRuleBinding.js', () => ({
  resolveCharacterRuleBinding: mocks.resolveRuleBinding
}))

vi.mock('./campaignCharacterSheet.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./campaignCharacterSheet.js')>()
  return {
    ...actual,
    resolveCharacterLiveSessionRuleContext: mocks.resolveLiveSessionRuleContext,
    resolveCharacterSheetCampaignContext: mocks.resolveCampaignContext
  }
})

vi.mock('./characterActionEvaluation.js', () => ({
  evaluateCharacterActionStateChange: mocks.evaluateActionStateChange
}))

vi.mock('../campaign/liveSessionCommandAuthority.js', () => ({
  assertCharacterLiveSessionCommandAuthority: mocks.assertCommandAuthority
}))

vi.mock('../rules/ruleRevisionRuntime.js', () => ({
  evaluatePinnedRuleRevision: mocks.evaluatePinnedRuleRevision
}))

vi.mock('./characterRuleEvaluation.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./characterRuleEvaluation.js')>()
  const { evaluateCharacterBuilderTestPolicy } =
    await import('./characterBuilderRuleEvaluation.testUtils.js')
  return {
    ...original,
    collectCharacterRuleEvaluationSpellIds: mocks.collectEvaluationSpellIds,
    evaluateCharacterRulePolicy: evaluateCharacterBuilderTestPolicy
  }
})

const {
  executeCharacterSheetCommand,
  executeCharacterSheetCommandWithRuleEvaluation,
  executeCompactLiveCharacterHitPointCommand,
  executeCompactLiveMaximumHitPointModifierCommand
} = await import('./sheetService.js')
const { checksumCharacterMechanicsProjection } = await import('@artificer-toolkit/db')
const { previewCharacterRest } = await import('./sheetRestService.js')
const { sortFingerprintValue } = await import('./sheetRestService.js')
const sheetProjection = await import('./sheetProjection.js')
const { evaluateCharacterBuilderTestPolicy } =
  await import('./characterBuilderRuleEvaluation.testUtils.js')
const { projectCharacterRulePolicyToSheetProjection } =
  await import('./characterRulePolicyAdapter.js')
const { checksumCampaignCharacterMechanicalContext } = await import('./campaignCharacterSheet.js')

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
    systemId: '00000000-0000-0000-0000-000000000001',
    primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000302',
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

function createPinnedVisionSense(rangeFeet: number) {
  const senseDefinitionId = '00000000-0000-4000-8000-000000000401'
  return {
    senseDefinitionId,
    definitionVersion: 1,
    definitionContractVersion: 1,
    definitionChecksum: '4'.repeat(64),
    document: {
      schemaVersion: 1 as const,
      kind: 'SENSE' as const,
      id: senseDefinitionId,
      gameSystemId: '00000000-0000-0000-0000-000000000001',
      capabilities: [
        {
          channel: 'VISUAL' as const,
          accessGrade: 'PRECISE' as const,
          satisfies: ['SEE' as const],
          illuminationAccess: 'ORDINARY_DARKNESS' as const,
          obscurementAccess: 'NONE' as const,
          perceivesInvisible: false,
          physicalConstraints: []
        }
      ]
    },
    range: {
      id: '00000000-0000-4000-8000-000000000402',
      amount: rangeFeet,
      unit: 'FEET' as const,
      calculation: {
        base: rangeFeet,
        effective: rangeFeet,
        contributions: [],
        override: null
      }
    }
  }
}

function sensePolicyFact(rangeFeet: number) {
  return {
    senseDefinitionId: '00000000-0000-4000-8000-000000000401',
    range: createPinnedVisionSense(rangeFeet).range
  }
}

function createCharacterRow(
  overrides: Partial<{
    id: string
    rule_pack_revision_id: string | null
    status: string
    stream_version: number
    system_id: string
    user_id: string
  }> = {}
) {
  return {
    id: 'character-1',
    rule_pack_revision_id: 'revision-1',
    status: 'ACTIVE',
    stream_version: 1,
    system_id: '00000000-0000-0000-0000-000000000001',
    user_id: 'user-1',
    ...overrides
  }
}

function fingerprintSheetCommand(command: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(sortFingerprintValue(command)))
    .digest('hex')
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

function createCommittedMechanicsPayload(evaluation: CharacterRuleEvaluationResult) {
  return {
    ruleSnapshot: {
      characterId: 'character-1',
      systemId: '00000000-0000-0000-0000-000000000001',
      classes: [{ classId: 'class-1' }],
      features: [],
      equipmentItems: []
    },
    rulePolicyInput: evaluation.facts,
    rulePolicyOutput: evaluation.output,
    initiativeActorFacts: {
      effectiveSize: null,
      checkTotals: {},
      equippedItems: []
    },
    pinnedSenseDefinitions: [],
    ruleRegistry: {},
    compiledActionEntryPoints: []
  }
}

function createCreature(overrides: Partial<CreatureAuthored> = {}): CreatureAuthored {
  return {
    id: 'creature-1',
    label: 'Owl',
    userId: 'user-1',
    systemId: '00000000-0000-0000-0000-000000000001',
    category: 'COMPANION',
    creatureTypeId: '00000000-0000-4000-8000-000000000021',
    size: 'SMALL',
    alignmentId: '00000000-0000-4000-8000-000000000022',
    abilityScores: {
      STRENGTH: 3,
      DEXTERITY: 13,
      CONSTITUTION: 10,
      INTELLIGENCE: 2,
      WISDOM: 12,
      CHARISMA: 7
    },
    armorClass: 11,
    hitPoints: 3,
    speeds: [],
    ...overrides
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
      ...params,
      committedRuleEvaluation: undefined
    }),
    ruleProjection,
    ruleEvaluation
  }
}

function configureCommittedSpellEligibility(input: {
  classId: string
  spellIds: string[]
  mode: 'KNOWN' | 'PREPARED'
}) {
  const previous = mocks.findMechanics.getMockImplementation()
  if (!previous) throw new Error('Committed mechanics mock is unavailable.')
  mocks.findMechanics.mockImplementation(async (...args) => {
    const mechanics = await previous(...args)
    return {
      ...mechanics,
      rulePolicyInput: {
        ...mechanics.rulePolicyInput,
        spellPreparationClasses: [
          {
            classId: input.classId,
            classLevel: 1,
            sources: [
              {
                sourceKind: 'CLASS',
                sourceId: input.classId,
                attributes:
                  input.mode === 'PREPARED'
                    ? [SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS]
                    : [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT],
                abilityIndex: 0,
                spellLimits: [
                  {
                    classLevel: 1,
                    preparedSpellsLimit: null,
                    spellLevels: [1]
                  }
                ],
                prepareLimit:
                  input.mode === 'PREPARED'
                    ? {
                        methodKinds: ['CLASS_LEVEL'],
                        scaling: 'FULL',
                        rounding: null,
                        perLevel: []
                      }
                    : null
              }
            ],
            learnedStatePresent: input.mode === 'KNOWN',
            learnedStateSpellIds: [],
            intentSpellIds: [],
            preparedStateSpellIds: []
          }
        ]
      },
      rulePolicyOutput: {
        ...mechanics.rulePolicyOutput,
        spellPreparation: {
          sources: [
            {
              classId: input.classId,
              sourceIds: [input.classId],
              preparedSpellLimit: input.mode === 'PREPARED' ? 10 : null,
              maxPreparableSpellLevel: input.mode === 'PREPARED' ? 1 : 0,
              availableSpellIds: input.spellIds,
              learnedSpellIds: [],
              preparedSpellIds: []
            }
          ],
          requestDecision: null
        }
      }
    }
  })
}

describe('executeCharacterSheetCommand persistence', () => {
  beforeEach(() => {
    mocks.assertCommandAuthority.mockResolvedValue(undefined)
    mocks.appendEvent.mockReset()
    mocks.deleteActiveRuleEffect.mockReset()
    mocks.lockActiveRuleEffects.mockReset()
    mocks.lockActiveRuleEffects.mockResolvedValue([])
    mocks.assembleSheetBundleForRuleContext.mockReset()
    mocks.findAllCreatures.mockReset()
    mocks.findAllCreatures.mockResolvedValue([])
    mocks.findAllVehicles.mockReset()
    mocks.findAllVehicles.mockResolvedValue([])
    mocks.findById.mockReset()
    mocks.findHitPointAdjustment.mockReset()
    mocks.findHitPointAdjustment.mockResolvedValue(null)
    mocks.findMechanics.mockReset()
    mocks.findMechanicsMetadata.mockReset()
    mocks.findCampaignMechanics.mockReset()
    mocks.findCampaignMechanicsMetadata.mockReset()
    mocks.publishCampaignMechanics.mockReset()
    mocks.findByCommandId.mockReset()
    mocks.findAuthoredById.mockReset()
    mocks.consumeRollForUser.mockReset()
    mocks.consumeRollForUser.mockResolvedValue(true)
    mocks.evaluateActionStateChange.mockReset()
    mocks.evaluateActionStateChange.mockImplementation(
      async ({ committed }: { committed: CharacterRuleEvaluationResult }) => ({
        ruleEvaluation: committed,
        zenEvaluationMs: 0
      })
    )
    mocks.evaluatePinnedRuleRevision.mockReset()
    mocks.findRollByIdForUser.mockReset()
    mocks.loadCharacterBuilderContext.mockReset()
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
    mocks.resolveLiveSessionRuleContext.mockReset()
    mocks.buildSheetBundle.mockReset()
    mocks.setMovementPreference.mockReset()
    mocks.setRulePackRevision.mockReset()
    mocks.setRulePackRevision.mockResolvedValue(true)
    mocks.setResourceUsage.mockReset()
    mocks.setSpellCustomization.mockReset()
    mocks.patchSheetState.mockReset()
    mocks.patchLiveHitPoints.mockReset()
    mocks.lockMaximumHitPointContext.mockReset()
    mocks.commitMaximumHitPointPolicy.mockReset()
    mocks.publishMechanics.mockReset()
    mocks.compileMechanicsProjection.mockReset()
    mocks.collectEvaluationSpellIds.mockReset()
    mocks.collectEvaluationSpellIds.mockReturnValue(new Set())
    mocks.advanceMechanicsProjection.mockReset()
    mocks.createCommittedExtras.mockReset()
    mocks.createCommittedResolution.mockReset()
    mocks.createCommittedSpells.mockReset()
    mocks.extendCommittedSources.mockReset()
    mocks.reduceCommittedSources.mockReset()
    mocks.lockCampaignShareUses.mockReset()
    mocks.lockCampaignShareUses.mockResolvedValue(undefined)
    mocks.lockCurrentSourceUses.mockReset()
    mocks.lockCurrentSourceUses.mockResolvedValue(undefined)
    mocks.lockCampaignMemberForContentRead.mockReset()
    mocks.lockCampaignMemberForContentRead.mockResolvedValue({
      campaignExists: true,
      memberActive: true
    })
    mocks.lockCampaignAssignment.mockReset()
    mocks.lockCampaignAssignment.mockResolvedValue(undefined)
    mocks.pruneCommittedSources.mockReset()
    mocks.loadCommittedSources.mockReset()
    mocks.loadCampaignContentOverlay.mockReset()
    mocks.loadCampaignContentOverlay.mockResolvedValue(null)
    mocks.findById.mockResolvedValue({
      id: 'character-1',
      status: 'ACTIVE',
      system_id: '00000000-0000-0000-0000-000000000001',
      stream_version: 1,
      rule_pack_revision_id: 'revision-1',
      user_id: 'user-1'
    })
    mocks.findByCommandId.mockResolvedValue(null)
    mocks.resolveCampaignContext.mockImplementation(
      async (_db: unknown, character: Pick<CharacterAuthored, 'id' | 'userId'>, userId: string) => {
        if (character.userId !== userId) {
          const error = new Error(`Character "${character.id}" is not available to this user.`)
          error.name = 'AuthoredContentOwnershipError'
          throw error
        }
        return {
          viewer: 'CHARACTER_OWNER' as const,
          campaignId: null,
          campaignStatus: null,
          contentMaturity: null,
          attunementSlotOverride: null,
          adjustments: [],
          secretAdjustmentIds: new Set(),
          conditions: []
        }
      }
    )
    mocks.findAuthoredById.mockResolvedValue(createCharacter())
    const resolution = createResolution()
    const mechanics = {
      characterId: 'character-1',
      authoredVersionVector: [],
      ruleRevisionId: 'revision-1',
      ruleRevisionChecksum: 'a'.repeat(64),
      evaluatorVersion: '0.54.0',
      modelContractVersion: 5,
      rulePolicyInput: {
        spellActionFacts: [],
        spellCastCandidates: [],
        spellPreparationClasses: []
      },
      rulePolicyOutput: {
        spellCastDecisions: [],
        spellCastMechanics: [],
        spellPreparation: { sources: [] }
      },
      ruleRegistry: {},
      ruleSnapshot: { characterId: 'character-1' }
    }
    const committedMechanics = {
      ...mechanics,
      commandState: createCharacter(),
      projectionChecksum: 'b'.repeat(64),
      characterStreamVersion: 1,
      systemVocabularySnapshotId: 'snapshot-1',
      systemVocabularySnapshotVersion: 1,
      systemVocabularySnapshotChecksum: 'c'.repeat(64)
    }
    mocks.findMechanics.mockImplementation(async () => ({
      ...committedMechanics,
      commandState: await mocks.findAuthoredById()
    }))
    mocks.findMechanicsMetadata.mockResolvedValue(committedMechanics)
    mocks.loadCommittedSources.mockResolvedValue({
      mechanics,
      recordsByRoot: new Map(),
      vocabularySnapshot: { snapshotId: 'snapshot-1', document: { abilities: [] } }
    })
    mocks.createCommittedResolution.mockReturnValue(resolution)
    mocks.createCommittedExtras.mockReturnValue({
      creaturesById: new Map(),
      vehiclesById: new Map()
    })
    mocks.createCommittedSpells.mockReturnValue(new Map())
    mocks.extendCommittedSources.mockImplementation(async (params: { sources: unknown }) => ({
      sources: params.sources,
      campaignShareUses: [],
      currentSourceUses: []
    }))
    mocks.reduceCommittedSources.mockImplementation(
      (params: { sources: unknown }) => params.sources
    )
    mocks.pruneCommittedSources.mockImplementation((params: { sources: unknown }) => params.sources)
    mocks.compileMechanicsProjection.mockReturnValue({
      pinnedSenseDefinitions: [],
      rulePolicyOutput: { senses: [] }
    })
    mocks.publishMechanics.mockResolvedValue(undefined)
    mocks.loadCharacterBuilderContext.mockResolvedValue({
      catalog: resolution.catalog,
      registry: resolution.sourceRegistry
    })
    mocks.resolveCharacterBuilder.mockResolvedValue(resolution)
    mocks.resolveActiveCharacterEquipment.mockResolvedValue([])
    mocks.loadActiveCreatures.mockImplementation(
      async ({ creatureIds }: { creatureIds: readonly string[] }) => {
        const creatures = (await mocks.findAllCreatures()) as CreatureAuthored[]
        return new Map(
          creatures
            .filter((creature) => creatureIds.includes(creature.id))
            .map((creature) => [creature.id, creature])
        )
      }
    )
    mocks.loadActiveVehicles.mockImplementation(
      async ({ vehicleIds }: { vehicleIds: readonly string[] }) => {
        const vehicles = (await mocks.findAllVehicles()) as Array<{
          id: string
        }>
        return new Map(
          vehicles
            .filter((vehicle) => vehicleIds.includes(vehicle.id))
            .map((vehicle) => [vehicle.id, vehicle])
        )
      }
    )
    mocks.buildSheetBundle.mockImplementation(buildPolicyTestSheetBundle)
    mocks.assembleSheetBundleForRuleContext.mockImplementation(
      async (params: {
        character: CharacterAuthored
        row: { stream_version: number }
        revisionId: string
        ruleContext: CharacterSheetRuleContext
      }) => {
        const resolution = mocks.createCommittedResolution()
        const context = {
          catalog: resolution.catalog,
          registry: resolution.sourceRegistry
        }
        const bundle = await mocks.buildSheetBundle({
          db,
          character: params.character,
          resolution,
          streamVersion: params.row.stream_version,
          adjustments: params.ruleContext.adjustments,
          movementDisplayPreference: await mocks.getMovementPreference(params.character.id),
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
            projectionChecksum: 'b'.repeat(64),
            pinnedSenseDefinitions: [],
            rulePolicyOutput: { senses: [] }
          },
          campaignMechanics: null,
          resolution,
          characterAdjustments: await mocks.listAdjustments(params.character.id),
          movementDisplayPreference: await mocks.getMovementPreference(params.character.id)
        }
      }
    )
    mocks.patchSheetState.mockImplementation(async (_characterId, _patches, options) => {
      await options.afterPersist?.(db, 2)
      return 2
    })
    mocks.resolveRuleBinding.mockImplementation(async ({ existingRevisionId }) => ({
      revisionId: existingRevisionId ?? '00000000-0000-4000-8000-000000000202',
      checksum: existingRevisionId ? 'current-checksum' : 'target-checksum',
      evaluatorKind: 'ZEN',
      evaluatorVersion: '0.54.0',
      modelContractVersion: 5
    }))
  })

  it('persists clearing inspiration as an explicit false patch', async () => {
    const character = createCharacter()
    character.state.inspiration = true
    mocks.findAuthoredById.mockResolvedValue(character)

    const response = await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'SET_INSPIRATION',
        commandId: '00000000-0000-4000-8000-000000000098',
        expectedVersion: 1,
        inspired: false
      }
    })

    expect(mocks.patchSheetState).toHaveBeenCalledWith(
      'character-1',
      [{ kind: 'INSPIRATION', value: false }],
      expect.objectContaining({ expectedStreamVersion: 1 })
    )
    expect(response.sheet.meta.streamVersion).toBe(response.streamVersion)
    expect(response.sheet.overview.inspiration).toBe(false)
  })

  it.each([30, 90])(
    'returns the prepared Campaign-effective %i-foot vision with its matching projection checksum',
    async (campaignRange) => {
      const character = createCharacter()
      character.state.inspiration = true
      const policyResolution = createResolution()
      const evaluation = await evaluateCharacterBuilderTestPolicy({
        db: db as unknown as DBLike,
        character,
        context: {
          catalog: policyResolution.catalog,
          registry: policyResolution.sourceRegistry
        },
        existingRevisionId: 'revision-1',
        expectedRevisionId: 'revision-1',
        adjustments: [],
        movementDisplayPreference: { mode: 'AUTO' },
        resourceUsage: [],
        attunementSlotOverride: 2
      })
      const basePolicyOutput = {
        ...evaluation.output,
        senses: [sensePolicyFact(60)]
      }
      const campaignPolicyOutput = {
        ...evaluation.output,
        senses: [sensePolicyFact(campaignRange)]
      }
      const currentMechanics = {
        characterId: character.id,
        characterStreamVersion: 1,
        commandLaneChecksum: '6'.repeat(64),
        commandState: character,
        projectionChecksum: '7'.repeat(64),
        authoredVersionVector: [],
        systemVocabularySnapshotId: 'snapshot-1',
        systemVocabularySnapshotVersion: 1,
        systemVocabularySnapshotChecksum: '8'.repeat(64),
        ruleRevisionId: 'revision-1',
        ruleRevisionChecksum: '9'.repeat(64),
        evaluatorVersion: '0.54.0',
        modelContractVersion: 5,
        ruleSnapshot: {
          characterId: character.id,
          systemId: character.systemId,
          classes: [],
          features: [],
          equipmentItems: []
        },
        rulePolicyInput: evaluation.facts,
        rulePolicyOutput: basePolicyOutput,
        pinnedSenseDefinitions: [createPinnedVisionSense(60)],
        ruleRegistry: {},
        compiledActionEntryPoints: []
      } as unknown as CharacterMechanicsProjection
      const nextMechanics = {
        ...currentMechanics,
        characterStreamVersion: 2,
        commandState: {
          ...character,
          state: { ...character.state, inspiration: false }
        },
        projectionChecksum: 'a'.repeat(64)
      } as CharacterMechanicsProjection
      const campaignId = '00000000-0000-4000-8000-000000000320'
      const campaignContext = {
        viewer: 'CHARACTER_OWNER' as const,
        campaignId,
        campaignStatus: 'ACTIVE' as const,
        contentMaturity: null,
        attunementSlotOverride: 2,
        adjustments: [],
        secretAdjustmentIds: new Set<string>(),
        conditions: []
      }
      const mechanicalContextChecksum = checksumCampaignCharacterMechanicalContext({
        adjustments: [],
        attunementSlotOverride: 2
      })
      mocks.findAuthoredById.mockResolvedValue(character)
      mocks.findMechanics.mockResolvedValue(currentMechanics)
      mocks.compileMechanicsProjection.mockReturnValue(nextMechanics)
      mocks.resolveCampaignContext.mockResolvedValue(campaignContext)
      mocks.resolveLiveSessionRuleContext.mockResolvedValue({
        adjustments: [],
        attunementSlotOverride: 2
      })
      mocks.findCampaignMechanics.mockResolvedValue({
        campaignId,
        characterId: character.id,
        characterStreamVersion: 1,
        baseMechanicsProjectionChecksum: currentMechanics.projectionChecksum,
        mechanicalContextChecksum,
        manualMaximumModifierOwner: null,
        projectionChecksum: 'b'.repeat(64),
        projectionSchemaVersion: 3,
        kind: 'MATERIALIZED',
        rulePolicyInput: evaluation.facts,
        rulePolicyOutput: campaignPolicyOutput
      })

      const execution = await executeCharacterSheetCommandWithRuleEvaluation({
        db: db as unknown as DBLike,
        characterId: character.id,
        userId: character.userId,
        command: {
          type: 'SET_INSPIRATION',
          commandId:
            campaignRange === 30
              ? '00000000-0000-4000-8000-000000000321'
              : '00000000-0000-4000-8000-000000000322',
          expectedVersion: 1,
          inspired: false
        }
      })

      expect(execution.ruleSnapshot.effectiveSceneVision).toEqual({
        characterId: character.id,
        dimRange: { amount: campaignRange, unit: 'FEET' }
      })
      expect(execution.ruleSnapshot.campaignMechanicsProjectionChecksum).toBe(
        mocks.publishCampaignMechanics.mock.calls[0]?.[0].projection.projectionChecksum
      )
      expect(mocks.assembleSheetBundleForRuleContext).not.toHaveBeenCalled()
    }
  )

  it('updates spell-slot availability through the bounded Character action lane', async () => {
    mocks.buildSheetBundle.mockImplementation(async (params) => {
      const bundle = await buildPolicyTestSheetBundle(params)
      return {
        ...bundle,
        sheet: {
          ...bundle.sheet,
          spells: {
            ...bundle.sheet.spells,
            slots: [
              {
                slotKey: 'STANDARD:1',
                label: 'Level 1',
                level: 1,
                used: 0,
                max: 2,
                remaining: 2
              }
            ]
          }
        }
      }
    })

    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'USE_SPELL_SLOT',
        commandId: '00000000-0000-4000-8000-000000000097',
        expectedVersion: 1,
        slotKey: 'STANDARD:1'
      }
    })

    expect(mocks.patchSheetState).toHaveBeenCalledWith(
      'character-1',
      [{ kind: 'SPELL_SLOTS', value: [{ slotKey: 'STANDARD:1', used: 1 }] }],
      expect.objectContaining({ expectedStreamVersion: 1 })
    )
    expect(mocks.evaluateActionStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        changedSpellSlotKey: 'STANDARD:1',
        spellSlotUsage: [{ slotKey: 'STANDARD:1', used: 1 }]
      })
    )
  })

  it('falls back to the pinned full policy for pre-v5 spell play-state revisions', async () => {
    let buildCount = 0
    mocks.buildSheetBundle.mockImplementation(async (params) => {
      const bundle = await buildPolicyTestSheetBundle(params)
      buildCount += 1
      return {
        ...bundle,
        ruleEvaluation:
          buildCount === 1
            ? {
                ...bundle.ruleEvaluation,
                binding: {
                  ...bundle.ruleEvaluation.binding,
                  modelContractVersion: 4
                }
              }
            : bundle.ruleEvaluation,
        sheet: {
          ...bundle.sheet,
          spells: {
            ...bundle.sheet.spells,
            slots: [
              {
                slotKey: 'STANDARD:1',
                label: 'Level 1',
                level: 1,
                used: 0,
                max: 2,
                remaining: 2
              }
            ]
          }
        }
      }
    })

    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'USE_SPELL_SLOT',
        commandId: '00000000-0000-4000-8000-000000000096',
        expectedVersion: 1,
        slotKey: 'STANDARD:1'
      }
    })

    expect(mocks.evaluateActionStateChange).not.toHaveBeenCalled()
    expect(mocks.buildSheetBundle).toHaveBeenCalledTimes(2)
    expect(mocks.buildSheetBundle.mock.calls[1]?.[0]).not.toHaveProperty('committedRuleEvaluation')
    expect(mocks.buildSheetBundle).toHaveBeenCalled()
    expect(mocks.compileMechanicsProjection).toHaveBeenCalledWith(
      expect.objectContaining({ characterStreamVersion: 2 })
    )
    expect(mocks.publishMechanics).toHaveBeenCalledWith(
      expect.objectContaining({ pinnedSenseDefinitions: [] })
    )
  })

  it('rejects spending through an unavailable action before persisting usage', async () => {
    mocks.buildSheetBundle.mockImplementation(
      async (params: Parameters<typeof sheetProjection.buildCharacterSheetResponse>[0]) => {
        const bundle = await buildPolicyTestSheetBundle(params)
        return {
          ...bundle,
          sheet: {
            ...bundle.sheet,
            actions: {
              items: [
                {
                  id: 'action-wand-burst',
                  label: 'Wand Burst',
                  kind: 'ACTION' as const,
                  availability: {
                    status: 'UNAVAILABLE' as const,
                    reasonCode: 'SOURCE_NOT_ATTUNED' as const
                  },
                  resourceGrantId: 'resource-wand-burst',
                  resourceCost: 1
                }
              ]
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
          type: 'USE_RESOURCE',
          actionId: 'action-wand-burst',
          commandId: '00000000-0000-4000-8000-000000000199',
          expectedVersion: 1,
          resourceGrantId: 'resource-wand-burst'
        }
      })
    ).rejects.toThrow('Action "Wand Burst" is unavailable: Source Not Attuned.')
    expect(mocks.patchSheetState).not.toHaveBeenCalled()
    expect(mocks.setResourceUsage).not.toHaveBeenCalled()
  })

  it('clamps current HP when a maximum modifier adjustment lowers the effective maximum', async () => {
    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: '00000000-0000-4000-8000-000000000101',
        expectedVersion: 1,
        adjustment: {
          id: '00000000-0000-4000-8000-000000000102',
          family: 'HIT_POINTS',
          field: 'MAXIMUM_MODIFIER',
          value: -6
        }
      }
    })

    expect(mocks.patchSheetState).toHaveBeenCalledWith(
      'character-1',
      [
        {
          kind: 'HITPOINTS',
          value: expect.objectContaining({ current: 4 })
        }
      ],
      expect.objectContaining({ expectedStreamVersion: 1 })
    )
    expect(mocks.upsertAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({
        family: 'HIT_POINTS',
        field: 'MAXIMUM_MODIFIER',
        value: -6
      })
    )
    expect(mocks.buildSheetBundle).toHaveBeenCalledTimes(3)
    expect(mocks.compileMechanicsProjection).toHaveBeenCalledWith(
      expect.objectContaining({ characterStreamVersion: 2 })
    )
  })

  it.each([
    {
      label: 'removing',
      command: {
        type: 'REMOVE_SHEET_ADJUSTMENT' as const,
        commandId: '00000000-0000-4000-8000-000000000103',
        expectedVersion: 1,
        adjustmentId: '00000000-0000-4000-8000-000000000104',
        target: { kind: 'HIT_POINTS' as const },
        family: 'HIT_POINTS' as const
      }
    },
    {
      label: 'resetting',
      command: {
        type: 'RESET_SHEET_PANEL_ADJUSTMENTS' as const,
        commandId: '00000000-0000-4000-8000-000000000105',
        expectedVersion: 1,
        target: { kind: 'HIT_POINTS' as const }
      }
    }
  ])('clamps current HP when $label a positive maximum modifier', async ({ command }) => {
    const character = createCharacter()
    character.state.hitpoints.current = 15
    mocks.findAuthoredById.mockResolvedValue(character)
    mocks.listAdjustments.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000104',
        characterId: 'character-1',
        family: 'HIT_POINTS',
        field: 'MAXIMUM_MODIFIER',
        value: 5,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: '00000000-0000-4000-8000-000000000106',
        characterId: 'character-1',
        family: 'HIT_POINTS',
        field: 'MAXIMUM_OVERRIDE',
        value: 10,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ])

    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command
    })

    expect(mocks.patchSheetState).toHaveBeenCalledWith(
      'character-1',
      [
        {
          kind: 'HITPOINTS',
          value: expect.objectContaining({ current: 10 })
        }
      ],
      expect.objectContaining({ expectedStreamVersion: 1 })
    )
    expect(mocks.removeAdjustment).toHaveBeenCalledWith({
      characterId: 'character-1',
      adjustmentId: '00000000-0000-4000-8000-000000000104',
      family: 'HIT_POINTS'
    })
    expect(mocks.removeAdjustment).toHaveBeenCalledTimes(1)
  })

  it('persists sheet commands with expected version and appends history in the same write callback', async () => {
    const response = await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 3,
        expectedVersion: 1,
        commandId: '00000000-0000-4000-8000-000000000001'
      }
    })

    expect(mocks.patchSheetState).toHaveBeenCalledWith(
      'character-1',
      [
        {
          kind: 'HITPOINTS',
          value: expect.objectContaining({ current: 7 })
        }
      ],
      expect.objectContaining({
        expectedStreamVersion: 1,
        afterPersist: expect.any(Function)
      })
    )
    expect(mocks.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CHARACTER_SHEET_COMMAND_APPLIED',
        characterId: 'character-1',
        actorId: 'user-1',
        commandId: '00000000-0000-4000-8000-000000000001',
        commandType: 'ADJUST_HIT_POINTS',
        commandFingerprint: expect.any(String),
        summary: '3 damage applied'
      })
    )
    expect(response.streamVersion).toBe(2)
    expect(response.historyEntry).toMatchObject({
      eventType: 'CHARACTER_SHEET_COMMAND_APPLIED',
      summary: '3 damage applied'
    })
    expect(mocks.findAuthoredById).toHaveBeenCalledTimes(1)
    expect(mocks.loadCharacterBuilderContext).not.toHaveBeenCalled()
    expect(mocks.resolveCharacterBuilder).not.toHaveBeenCalled()
    expect(mocks.findMechanics).toHaveBeenCalledWith({
      characterId: 'character-1',
      expectedRuleRevisionId: 'revision-1',
      expectedStreamVersion: 1
    })
    expect(mocks.compileMechanicsProjection).toHaveBeenCalledWith(
      expect.objectContaining({ characterStreamVersion: 2 })
    )
    expect(mocks.publishMechanics).toHaveBeenCalledWith(
      expect.objectContaining({ pinnedSenseDefinitions: [] })
    )
    expect(mocks.buildSheetBundle).toHaveBeenLastCalledWith(expect.any(Object))
  })

  it('uses the persisted committed mechanics for play-state-only commands', async () => {
    const character = createCharacter()
    const resolution = createResolution()
    const context = {
      catalog: resolution.catalog,
      registry: resolution.sourceRegistry
    }
    const committedRuleEvaluation = await evaluateCharacterBuilderTestPolicy({
      db: db as unknown as DBLike,
      character,
      context,
      existingRevisionId: 'revision-1',
      expectedRevisionId: 'revision-1',
      adjustments: [],
      movementDisplayPreference: { mode: 'AUTO' },
      resourceUsage: []
    })
    const mechanics = await mocks.findMechanicsMetadata()
    mocks.findMechanics.mockReset()
    mocks.findMechanics.mockResolvedValue({
      ...mechanics,
      commandState: character
    })
    mocks.findMechanicsMetadata.mockClear()
    mocks.loadCharacterBuilderContext.mockClear()
    mocks.resolveCharacterBuilder.mockClear()

    const result = await executeCharacterSheetCommandWithRuleEvaluation({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      committedRuleSnapshot: {
        effectiveSceneVision: { characterId: 'character-1', dimRange: null },
        mechanicsProjectionChecksum: 'b'.repeat(64),
        mechanicsCommandLaneChecksum: 'c'.repeat(64),
        mechanicsPayload: createCommittedMechanicsPayload(committedRuleEvaluation),
        campaignMechanicalContextChecksum: null,
        campaignMechanicsProjectionChecksum: null,
        streamVersion: 1,
        evaluation: committedRuleEvaluation,
        resolution
      },
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 1,
        expectedVersion: 1,
        commandId: '00000000-0000-4000-8000-000000000105'
      }
    })

    expect(mocks.loadCharacterBuilderContext).not.toHaveBeenCalled()
    expect(mocks.resolveCharacterBuilder).not.toHaveBeenCalled()
    expect(mocks.findAuthoredById).not.toHaveBeenCalled()
    expect(mocks.findMechanics).toHaveBeenCalledWith({
      characterId: 'character-1',
      expectedRuleRevisionId: 'revision-1',
      expectedStreamVersion: 1
    })
    expect(mocks.findMechanicsMetadata).not.toHaveBeenCalled()
    expect(mocks.loadCommittedSources).not.toHaveBeenCalled()
    expect(mocks.createCommittedResolution).not.toHaveBeenCalled()
    expect(mocks.buildSheetBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        committedRuleEvaluation: expect.any(Object),
        ruleEvaluation: expect.objectContaining({ context })
      })
    )
    expect(result.ruleSnapshot).toMatchObject({
      streamVersion: 2,
      resolution
    })
  })

  it('uses a checksum-verified live-room snapshot without loading the full mechanics projection', async () => {
    const character = createCharacter()
    const resolution = createResolution()
    const evaluation = await evaluateCharacterBuilderTestPolicy({
      db: db as unknown as DBLike,
      character,
      context: {
        catalog: resolution.catalog,
        registry: resolution.sourceRegistry
      },
      existingRevisionId: 'revision-1',
      expectedRevisionId: 'revision-1',
      adjustments: [],
      movementDisplayPreference: { mode: 'AUTO' },
      resourceUsage: []
    })
    const metadata = await mocks.findMechanicsMetadata()
    const mechanicsPayload = createCommittedMechanicsPayload(evaluation)
    const durableMetadata = {
      ...metadata,
      commandState: character,
      commandStateChecksum: 'a'.repeat(64),
      commandLaneChecksum: 'c'.repeat(64),
      projectionSchemaVersion: 1,
      projectionChecksum: '0'.repeat(64)
    }
    const mechanicsProjectionChecksum = checksumCharacterMechanicsProjection({
      ...durableMetadata,
      ...mechanicsPayload
    })
    mocks.findMechanicsMetadata.mockResolvedValue({
      ...durableMetadata,
      projectionChecksum: mechanicsProjectionChecksum
    })
    mocks.findMechanics.mockClear()
    mocks.findMechanicsMetadata.mockClear()
    mocks.compileMechanicsProjection.mockImplementation((input) => ({
      ...metadata,
      commandState: character,
      commandStateChecksum: 'a'.repeat(64),
      commandLaneChecksum: 'c'.repeat(64),
      projectionSchemaVersion: 1,
      rulePolicyInput: input.rulePolicyInput,
      rulePolicyOutput: input.rulePolicyOutput,
      ruleRegistry: input.ruleRegistry,
      ruleSnapshot: input.ruleSnapshot,
      projectionChecksum: mechanicsProjectionChecksum
    }))
    let timing: { committedSnapshotCacheHit: boolean } | undefined

    await executeCharacterSheetCommandWithRuleEvaluation({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      onTiming: (value) => {
        timing = value
      },
      liveSessionAuthority: { sessionId: 'session-1', authorityId: 'room-1' },
      committedRuleSnapshot: {
        effectiveSceneVision: { characterId: 'character-1', dimRange: null },
        mechanicsProjectionChecksum,
        mechanicsCommandLaneChecksum: 'c'.repeat(64),
        mechanicsPayload,
        campaignMechanicalContextChecksum: null,
        campaignMechanicsProjectionChecksum: null,
        streamVersion: 1,
        evaluation,
        resolution
      },
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 1,
        expectedVersion: 1,
        commandId: '00000000-0000-4000-8000-000000000107'
      }
    })

    expect(mocks.findMechanicsMetadata).toHaveBeenCalledWith({
      characterId: 'character-1',
      expectedProjectionChecksum: mechanicsProjectionChecksum,
      expectedCommandLaneChecksum: 'c'.repeat(64),
      expectedRuleRevisionId: 'revision-1',
      expectedStreamVersion: 1
    })
    expect(mocks.findMechanics).not.toHaveBeenCalled()
    expect(mocks.publishMechanics).toHaveBeenCalledWith(expect.any(Object), {
      onTiming: expect.any(Function)
    })
    expect(timing).toMatchObject({ committedSnapshotCacheHit: true })
  })

  it('falls back to the full projection read when live-room metadata is stale', async () => {
    const character = createCharacter()
    const resolution = createResolution()
    const evaluation = await evaluateCharacterBuilderTestPolicy({
      db: db as unknown as DBLike,
      character,
      context: {
        catalog: resolution.catalog,
        registry: resolution.sourceRegistry
      },
      existingRevisionId: 'revision-1',
      expectedRevisionId: 'revision-1',
      adjustments: [],
      movementDisplayPreference: { mode: 'AUTO' },
      resourceUsage: []
    })
    mocks.findMechanicsMetadata.mockResolvedValue({
      ...(await mocks.findMechanicsMetadata()),
      commandState: character,
      commandStateChecksum: 'a'.repeat(64),
      commandLaneChecksum: 'c'.repeat(64),
      projectionSchemaVersion: 1,
      projectionChecksum: 'b'.repeat(64)
    })
    mocks.findMechanicsMetadata.mockRejectedValueOnce(new Error('stale room snapshot'))
    await executeCharacterSheetCommandWithRuleEvaluation({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      liveSessionAuthority: { sessionId: 'session-1', authorityId: 'room-1' },
      committedRuleSnapshot: {
        effectiveSceneVision: { characterId: 'character-1', dimRange: null },
        mechanicsProjectionChecksum: 'b'.repeat(64),
        mechanicsCommandLaneChecksum: 'c'.repeat(64),
        mechanicsPayload: createCommittedMechanicsPayload(evaluation),
        campaignMechanicalContextChecksum: null,
        campaignMechanicsProjectionChecksum: null,
        streamVersion: 1,
        evaluation,
        resolution
      },
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 1,
        expectedVersion: 1,
        commandId: '00000000-0000-4000-8000-000000000108'
      }
    })
    expect(mocks.findMechanics).toHaveBeenCalled()
  })

  it('re-evaluates when the persisted Campaign mechanics context differs from the room snapshot', async () => {
    const character = createCharacter()
    const resolution = createResolution()
    const context = {
      catalog: resolution.catalog,
      registry: resolution.sourceRegistry
    }
    const committedRuleEvaluation = await evaluateCharacterBuilderTestPolicy({
      db: db as unknown as DBLike,
      character,
      context,
      existingRevisionId: 'revision-1',
      expectedRevisionId: 'revision-1',
      adjustments: [],
      movementDisplayPreference: { mode: 'AUTO' },
      resourceUsage: []
    })
    const metadata = await mocks.findMechanicsMetadata()
    mocks.findMechanicsMetadata.mockClear()
    mocks.findMechanicsMetadata.mockResolvedValue({
      ...metadata
    })
    mocks.loadCommittedSources.mockClear()

    await executeCharacterSheetCommandWithRuleEvaluation({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      committedRuleSnapshot: {
        effectiveSceneVision: { characterId: 'character-1', dimRange: null },
        mechanicsProjectionChecksum: 'b'.repeat(64),
        mechanicsCommandLaneChecksum: 'c'.repeat(64),
        mechanicsPayload: createCommittedMechanicsPayload(committedRuleEvaluation),
        campaignMechanicalContextChecksum: null,
        campaignMechanicsProjectionChecksum: null,
        streamVersion: 1,
        evaluation: committedRuleEvaluation,
        resolution
      },
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 1,
        expectedVersion: 1,
        commandId: '00000000-0000-4000-8000-000000000106'
      }
    })

    expect(mocks.loadCommittedSources).not.toHaveBeenCalled()
    expect(mocks.compileMechanicsProjection).toHaveBeenCalled()
  })

  it('rechecks and repins an explicit active rule upgrade in the versioned command transaction', async () => {
    mocks.findById.mockResolvedValue(
      createCharacterRow({
        rule_pack_revision_id: '00000000-0000-4000-8000-000000000201'
      })
    )

    const response = await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'UPGRADE_RULE_PACK',
        revisionId: '00000000-0000-4000-8000-000000000202',
        expectedVersion: 1,
        commandId: '00000000-0000-4000-8000-000000000203'
      }
    })

    expect(mocks.resolveRuleBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        existingRevisionId: null,
        expectedRevisionId: '00000000-0000-4000-8000-000000000202'
      })
    )
    expect(mocks.setRulePackRevision).toHaveBeenCalledWith(
      'character-1',
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000202'
    )
    expect(mocks.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        commandType: 'UPGRADE_RULE_PACK',
        summary: 'Character rules upgraded'
      })
    )
    expect(mocks.loadCharacterBuilderContext).not.toHaveBeenCalled()
    expect(mocks.resolveCharacterBuilder).not.toHaveBeenCalled()
    expect(mocks.compileMechanicsProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleBinding: expect.objectContaining({
          revisionId: '00000000-0000-4000-8000-000000000202'
        })
      })
    )
    expect(response.streamVersion).toBe(2)
  })

  it('rejects commands for characters owned by another user', async () => {
    mocks.findById.mockResolvedValue(createCharacterRow({ user_id: 'other-user' }))
    mocks.findAuthoredById.mockResolvedValue(createCharacter({ userId: 'other-user' }))

    await expect(
      executeCharacterSheetCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command: {
          type: 'ADJUST_HIT_POINTS',
          mode: 'DAMAGE',
          amount: 1,
          expectedVersion: 1,
          commandId: '00000000-0000-4000-8000-000000000002'
        }
      })
    ).rejects.toMatchObject({ name: 'AuthoredContentOwnershipError' })
    expect(mocks.patchSheetState).not.toHaveBeenCalled()
  })

  it('returns the current sheet without writing when a command id was already applied', async () => {
    const command = {
      type: 'ADJUST_HIT_POINTS' as const,
      mode: 'DAMAGE' as const,
      amount: 3,
      expectedVersion: 1,
      commandId: '00000000-0000-4000-8000-000000000001'
    }
    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command
    })
    const persistedEvent = mocks.appendEvent.mock.calls[0]?.[0]
    expect(persistedEvent).toBeDefined()
    mocks.findById.mockResolvedValue(createCharacterRow({ stream_version: 2 }))
    mocks.findByCommandId.mockResolvedValue(persistedEvent)

    const execution = await executeCharacterSheetCommandWithRuleEvaluation({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command
    })

    expect(execution.replayed).toBe(true)
    expect(execution.response.streamVersion).toBe(2)
    expect(execution.response.historyEntry?.eventId).toBe(persistedEvent.eventId)
    expect(mocks.patchSheetState).toHaveBeenCalledTimes(1)
    expect(mocks.appendEvent).toHaveBeenCalledTimes(1)
    expect(mocks.assembleSheetBundleForRuleContext).toHaveBeenCalledWith(
      expect.objectContaining({
        character: expect.objectContaining({ id: 'character-1' }),
        row: expect.objectContaining({ stream_version: 2 }),
        revisionId: 'revision-1'
      })
    )
  })

  it('converges a lock-time concurrent duplicate on the stored command event', async () => {
    const command = {
      type: 'ADJUST_HIT_POINTS' as const,
      mode: 'DAMAGE' as const,
      amount: 3,
      expectedVersion: 1,
      commandId: '00000000-0000-4000-8000-000000000138'
    }
    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command
    })
    const persistedEvent = mocks.appendEvent.mock.calls[0]?.[0]
    expect(persistedEvent).toBeDefined()

    mocks.patchSheetState.mockReset()
    mocks.patchSheetState.mockRejectedValueOnce(
      new MockConcurrencyError('character-1', command.expectedVersion)
    )
    mocks.findById
      .mockReset()
      .mockResolvedValueOnce(createCharacterRow())
      .mockResolvedValue(createCharacterRow({ stream_version: 2 }))
    mocks.findByCommandId
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(persistedEvent)
      .mockResolvedValue(persistedEvent)

    const response = await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command
    })

    expect(mocks.patchSheetState).toHaveBeenCalledTimes(1)
    expect(response.streamVersion).toBe(2)
    expect(response.historyEntry?.eventId).toBe(persistedEvent.eventId)
  })

  it('rejects reusing a command id with different input', async () => {
    const commandId = '00000000-0000-4000-8000-000000000001'
    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 3,
        expectedVersion: 1,
        commandId
      }
    })
    const persistedEvent = mocks.appendEvent.mock.calls[0]?.[0]
    expect(persistedEvent).toBeDefined()
    mocks.findById.mockResolvedValue(createCharacterRow({ stream_version: 2 }))
    mocks.findByCommandId.mockResolvedValue(persistedEvent)

    await expect(
      executeCharacterSheetCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command: {
          type: 'ADJUST_HIT_POINTS',
          mode: 'DAMAGE',
          amount: 4,
          expectedVersion: 1,
          commandId
        }
      })
    ).rejects.toThrow('already used with different input')
    expect(mocks.patchSheetState).toHaveBeenCalledTimes(1)
    expect(mocks.appendEvent).toHaveBeenCalledTimes(1)
  })

  it('rejects stale expected versions before writing state or history', async () => {
    mocks.findById.mockResolvedValue(createCharacterRow({ stream_version: 2 }))

    await expect(
      executeCharacterSheetCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command: {
          type: 'ADJUST_HIT_POINTS',
          mode: 'DAMAGE',
          amount: 1,
          expectedVersion: 1,
          commandId: '00000000-0000-4000-8000-000000000003'
        }
      })
    ).rejects.toMatchObject({ name: 'ConcurrencyError' })
    expect(mocks.patchSheetState).not.toHaveBeenCalled()
    expect(mocks.appendEvent).not.toHaveBeenCalled()
  })

  it('rejects sheet commands against unfinalized draft characters', async () => {
    mocks.findById.mockResolvedValue(createCharacterRow({ status: 'DRAFT' }))
    mocks.findAuthoredById.mockResolvedValue(createCharacter({ status: 'DRAFT' }))

    await expect(
      executeCharacterSheetCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command: {
          type: 'ADJUST_HIT_POINTS',
          mode: 'DAMAGE',
          amount: 1,
          expectedVersion: 1,
          commandId: '00000000-0000-4000-8000-000000000004'
        }
      })
    ).rejects.toMatchObject({ name: 'CharacterSheetCommandError' })
    expect(mocks.patchSheetState).not.toHaveBeenCalled()
  })

  it('persists a typed ability adjustment and history in the character transaction', async () => {
    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        expectedVersion: 1,
        commandId: '00000000-0000-4000-8000-000000000005',
        adjustment: {
          id: '00000000-0000-4000-8000-000000000006',
          family: 'ABILITY',
          ability: 'STRENGTH',
          field: 'OTHER_MODIFIER',
          value: 2,
          sourceNote: 'Downtime training'
        }
      }
    })

    expect(mocks.patchSheetState).toHaveBeenCalledWith(
      'character-1',
      [],
      expect.objectContaining({ expectedStreamVersion: 1 })
    )
    expect(mocks.upsertAdjustment).toHaveBeenCalledWith({
      id: '00000000-0000-4000-8000-000000000006',
      characterId: 'character-1',
      actorId: 'user-1',
      family: 'ABILITY',
      ability: 'STRENGTH',
      field: 'OTHER_MODIFIER',
      value: 2,
      sourceNote: 'Downtime training'
    })
    expect(mocks.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        commandType: 'UPSERT_SHEET_ADJUSTMENT',
        summary: 'Character sheet adjustment updated'
      })
    )
    expect(mocks.loadCharacterBuilderContext).not.toHaveBeenCalled()
    expect(mocks.resolveCharacterBuilder).not.toHaveBeenCalled()
    expect(mocks.compileMechanicsProjection).toHaveBeenCalledWith(
      expect.objectContaining({ characterStreamVersion: 2 })
    )
    expect(mocks.publishMechanics).toHaveBeenCalledWith(
      expect.objectContaining({ pinnedSenseDefinitions: [] })
    )
  })

  it('resets only adjustments owned by the requested panel target', async () => {
    mocks.listAdjustments.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000007',
        characterId: 'character-1',
        family: 'ABILITY',
        ability: 'STRENGTH',
        field: 'OTHER_MODIFIER',
        value: 2,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: '2026-07-24T00:00:00.000Z',
        updatedAt: '2026-07-24T00:00:00.000Z'
      },
      {
        id: '00000000-0000-4000-8000-000000000008',
        characterId: 'character-1',
        family: 'ABILITY',
        ability: 'DEXTERITY',
        field: 'OTHER_MODIFIER',
        value: 1,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: '2026-07-24T00:00:00.000Z',
        updatedAt: '2026-07-24T00:00:00.000Z'
      }
    ])

    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'RESET_SHEET_PANEL_ADJUSTMENTS',
        expectedVersion: 1,
        commandId: '00000000-0000-4000-8000-000000000009',
        target: { kind: 'ABILITY', ability: 'STRENGTH' }
      }
    })

    expect(mocks.removeAdjustment).toHaveBeenCalledTimes(1)
    expect(mocks.removeAdjustment).toHaveBeenCalledWith({
      characterId: 'character-1',
      adjustmentId: '00000000-0000-4000-8000-000000000007',
      family: 'ABILITY'
    })
  })

  it('persists movement display preferences through the versioned command path', async () => {
    const resolution = createResolution()
    resolution.registry.system!.speeds = [
      {
        id: '00000000-0000-4000-8000-000000000010',
        code: 'WALKING',
        label: 'Walking'
      }
    ]
    mocks.createCommittedResolution.mockReturnValue(resolution)
    mocks.resolveCharacterBuilder.mockResolvedValue(resolution)

    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'SET_MOVEMENT_DISPLAY_PREFERENCE',
        expectedVersion: 1,
        commandId: '00000000-0000-4000-8000-000000000011',
        preference: {
          mode: 'EXPLICIT',
          speedId: '00000000-0000-4000-8000-000000000010'
        }
      }
    })

    expect(mocks.setMovementPreference).toHaveBeenCalledWith({
      characterId: 'character-1',
      actorId: 'user-1',
      preference: {
        mode: 'EXPLICIT',
        speedId: '00000000-0000-4000-8000-000000000010'
      }
    })
    expect(mocks.buildSheetBundle).toHaveBeenCalledTimes(2)
    expect(mocks.buildSheetBundle.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        movementDisplayPreference: {
          mode: 'EXPLICIT',
          speedId: '00000000-0000-4000-8000-000000000010'
        }
      })
    )
    expect(mocks.compileMechanicsProjection).toHaveBeenCalledWith(
      expect.objectContaining({ characterStreamVersion: 2 })
    )
  })

  it('replaces and clears customization fields for only the targeted spell source', async () => {
    const character = createCharacter()
    character.intent.spellSelections = [
      {
        id: 'feature-spell-target',
        source: { kind: 'FEATURE', featureId: 'feature-1' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      },
      {
        id: 'feature-spell-other',
        source: { kind: 'FEATURE', featureId: 'feature-2' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1']
      }
    ]
    const resolution = createResolution()
    resolution.catalog.spells = [
      {
        id: 'spell-1',
        label: 'Shield',
        description: '',
        castingTime: { amount: 1, unit: 'ROUND' },
        level: 1,
        classIds: [],
        magicSchoolId: 'ABJURATION'
      }
    ]
    mocks.findAuthoredById.mockResolvedValue(character)
    mocks.loadCharacterBuilderContext.mockResolvedValue({
      catalog: resolution.catalog,
      registry: resolution.sourceRegistry
    })
    mocks.createCommittedResolution.mockReturnValue(resolution)
    mocks.createCommittedSpells.mockReturnValue(
      new Map([['spell-1', resolution.catalog.spells[0]!]])
    )
    mocks.resolveCharacterBuilder.mockResolvedValue(resolution)
    mocks.listSpellCustomizations.mockResolvedValue([
      {
        id: 'custom-target',
        characterId: 'character-1',
        source: {
          spellId: 'spell-1',
          sourceKind: 'FEATURE',
          sourceInstanceId: 'FEATURE:feature-spell-target'
        },
        customName: 'Old Shield',
        notes: 'Remove this note',
        displayAsAttack: true,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: '2026-07-25T00:00:00.000Z',
        updatedAt: '2026-07-25T00:00:00.000Z'
      },
      {
        id: 'custom-other',
        characterId: 'character-1',
        source: {
          spellId: 'spell-1',
          sourceKind: 'FEATURE',
          sourceInstanceId: 'FEATURE:feature-spell-other'
        },
        customName: 'Other Shield',
        displayAsAttack: false,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: '2026-07-25T00:00:00.000Z',
        updatedAt: '2026-07-25T00:00:00.000Z'
      }
    ])

    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'UPDATE_SPELL_SOURCE_CUSTOMIZATION',
        expectedVersion: 1,
        commandId: '00000000-0000-4000-8000-000000000012',
        source: {
          spellId: 'spell-1',
          sourceKind: 'FEATURE',
          sourceInstanceId: 'FEATURE:feature-spell-target'
        },
        customName: 'Arcane Shield',
        notes: null,
        displayAsAttack: false
      }
    })

    expect(mocks.setSpellCustomization).toHaveBeenCalledTimes(1)
    expect(mocks.setSpellCustomization).toHaveBeenCalledWith({
      id: 'custom-target',
      characterId: 'character-1',
      actorId: 'user-1',
      source: {
        spellId: 'spell-1',
        sourceKind: 'FEATURE',
        sourceInstanceId: 'FEATURE:feature-spell-target'
      },
      customName: 'Arcane Shield',
      notes: undefined,
      displayAsAttack: false
    })
  })

  it('rejects adding an unauthorized creature source', async () => {
    await expect(
      executeCharacterSheetCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command: {
          type: 'ADD_SHEET_EXTRA',
          expectedVersion: 1,
          commandId: '00000000-0000-4000-8000-000000000101',
          extra: {
            kind: 'COMPANION',
            creatureId: '00000000-0000-4000-8000-000000000102',
            originKind: 'WORLD'
          }
        }
      })
    ).rejects.toThrow('is not available for this character')
  })

  it('extends and publishes the exact version vector when adding a companion', async () => {
    const creature = createCreature()
    const mechanics = {
      characterId: 'character-1',
      authoredVersionVector: [],
      ruleRevisionId: 'revision-1',
      ruleRevisionChecksum: 'a'.repeat(64),
      evaluatorVersion: '0.54.0',
      modelContractVersion: 5,
      rulePolicyInput: {},
      rulePolicyOutput: {},
      ruleRegistry: {},
      ruleSnapshot: { characterId: 'character-1' }
    }
    const sources = {
      mechanics,
      recordsByRoot: new Map(),
      vocabularySnapshot: { snapshotId: 'snapshot-1', document: { abilities: [] } }
    }
    const extendedSources = {
      ...sources,
      mechanics: {
        ...mechanics,
        authoredVersionVector: [
          {
            subjectKind: 'CREATURE',
            subjectId: creature.id,
            versionId: 'creature-version-1',
            version: 1,
            checksum: 'b'.repeat(64)
          }
        ]
      }
    }
    mocks.loadCommittedSources.mockResolvedValue(sources)
    mocks.extendCommittedSources.mockResolvedValue({
      sources: extendedSources,
      campaignShareUses: [],
      currentSourceUses: []
    })
    mocks.createCommittedExtras.mockReturnValue({
      creaturesById: new Map([[creature.id, creature]]),
      vehiclesById: new Map()
    })

    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'ADD_SHEET_EXTRA',
        expectedVersion: 1,
        commandId: '00000000-0000-4000-8000-000000000195',
        extra: {
          kind: 'COMPANION',
          creatureId: creature.id,
          originKind: 'WORLD'
        }
      }
    })

    expect(mocks.extendCommittedSources).toHaveBeenCalledWith(
      expect.objectContaining({
        roots: [{ subjectKind: 'CREATURE', subjectId: creature.id }]
      })
    )
    expect(mocks.compileMechanicsProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        authoredVersionVector: extendedSources.mechanics.authoredVersionVector,
        characterStreamVersion: 2
      })
    )
    expect(mocks.publishMechanics).toHaveBeenCalledWith(
      expect.objectContaining({ pinnedSenseDefinitions: [] })
    )
  })

  it('admits exact SET_* Spell sources, locks Campaign authority first, and reduces the next vector', async () => {
    const spellId = 'campaign-spell-1'
    const fixedSpellId = 'fixed-spell-1'
    const availableOnlySpellId = 'available-only-spell-1'
    const spellDocumentsById = new Map<string, SpellAuthored>([
      [
        spellId,
        {
          kind: 'SPELL',
          id: spellId,
          label: 'Campaign spell',
          description: '',
          castingTime: { unit: 'ROUND', amount: 1 },
          level: 1,
          classIds: ['class-1'],
          magicSchoolId: 'evocation',
          systemId: '00000000-0000-0000-0000-000000000001',
          userId: 'campaign-owner'
        }
      ],
      [
        fixedSpellId,
        {
          kind: 'SPELL',
          id: fixedSpellId,
          label: 'Fixed spell',
          description: '',
          castingTime: { unit: 'ROUND', amount: 1 },
          level: 1,
          classIds: ['class-1'],
          magicSchoolId: 'evocation',
          systemId: '00000000-0000-0000-0000-000000000001',
          userId: 'user-1'
        }
      ],
      [
        availableOnlySpellId,
        {
          kind: 'SPELL',
          id: availableOnlySpellId,
          label: 'Available only spell',
          description: '',
          castingTime: { unit: 'ROUND', amount: 1 },
          level: 1,
          classIds: ['class-1'],
          magicSchoolId: 'evocation',
          systemId: '00000000-0000-0000-0000-000000000001',
          userId: 'user-1'
        }
      ]
    ])
    const backgroundVectorEntry = {
      subjectKind: 'BACKGROUND' as const,
      subjectId: 'background-1',
      versionId: 'background-version-1',
      version: 1,
      checksum: 'd'.repeat(64)
    }
    const mechanics = {
      characterId: 'character-1',
      authoredVersionVector: [backgroundVectorEntry],
      ruleRevisionId: 'revision-1',
      ruleRevisionChecksum: 'a'.repeat(64),
      evaluatorVersion: '0.54.0',
      modelContractVersion: 5,
      rulePolicyInput: {},
      rulePolicyOutput: {},
      ruleRegistry: {},
      ruleSnapshot: { characterId: 'character-1' }
    }
    const sources = {
      mechanics,
      recordsByRoot: new Map(),
      vocabularySnapshot: { snapshotId: 'snapshot-1', document: { abilities: [] } }
    }
    const extendedSources = {
      ...sources,
      mechanics: {
        ...mechanics,
        authoredVersionVector: [
          backgroundVectorEntry,
          {
            subjectKind: 'SPELL' as const,
            subjectId: spellId,
            versionId: 'campaign-spell-version-1',
            version: 1,
            checksum: 'b'.repeat(64)
          }
        ]
      }
    }
    const campaignShareUse = {
      campaignId: 'campaign-1',
      subjectKind: 'SPELL' as const,
      subjectId: spellId,
      sharedBy: 'campaign-owner',
      expectedAuthoredVersionId: 'campaign-spell-version-1',
      expectedAuthoredVersion: 1,
      expectedAuthoredChecksum: 'b'.repeat(64)
    }
    const exactEvaluationSources = {
      ...extendedSources,
      mechanics: {
        ...extendedSources.mechanics,
        authoredVersionVector: [
          ...extendedSources.mechanics.authoredVersionVector,
          {
            subjectKind: 'SPELL' as const,
            subjectId: fixedSpellId,
            versionId: 'fixed-spell-version-1',
            version: 1,
            checksum: 'c'.repeat(64)
          }
        ]
      }
    }
    const reducedSources = {
      ...exactEvaluationSources,
      mechanics: {
        ...exactEvaluationSources.mechanics,
        authoredVersionVector: [
          backgroundVectorEntry,
          extendedSources.mechanics.authoredVersionVector[1]!,
          exactEvaluationSources.mechanics.authoredVersionVector[2]!
        ]
      }
    }
    const reducedSpellDocumentsById = new Map(
      [...spellDocumentsById].filter(([id]) => id !== availableOnlySpellId)
    )
    const extendedResolution = createResolution()
    extendedResolution.catalog.spells = [
      {
        id: spellId,
        label: 'Campaign spell',
        description: '',
        castingTime: { unit: 'ROUND', amount: 1 },
        level: 1,
        classIds: ['class-1'],
        magicSchoolId: 'evocation'
      }
    ]
    mocks.loadCommittedSources.mockResolvedValue(sources)
    mocks.collectEvaluationSpellIds.mockReturnValue(new Set([fixedSpellId]))
    mocks.extendCommittedSources.mockImplementation(
      async (params: { roots: readonly { subjectId: string }[] }) => ({
        sources: params.roots.some((root) => root.subjectId === fixedSpellId)
          ? exactEvaluationSources
          : extendedSources,
        campaignShareUses: params.roots.some((root) => root.subjectId === spellId)
          ? [campaignShareUse]
          : [],
        currentSourceUses: params.roots.flatMap((root) =>
          exactEvaluationSources.mechanics.authoredVersionVector.filter(
            (entry) => entry.subjectKind === 'SPELL' && entry.subjectId === root.subjectId
          )
        )
      })
    )
    mocks.reduceCommittedSources.mockImplementation(() => reducedSources)
    mocks.loadCampaignContentOverlay.mockResolvedValue({
      campaignId: 'campaign-1',
      latest: new Map(),
      sharesByRoot: new Map(),
      userId: 'user-1'
    })
    mocks.createCommittedResolution.mockReturnValue(extendedResolution)
    mocks.createCommittedSpells.mockImplementation((sources) =>
      sources === reducedSources ? reducedSpellDocumentsById : spellDocumentsById
    )
    mocks.compileMechanicsProjection.mockImplementation(
      (input: CharacterMechanicsCompilerInput) => ({
        ...mechanics,
        authoredVersionVector: input.authoredVersionVector,
        evaluatorVersion: input.ruleBinding.evaluatorVersion,
        modelContractVersion: input.ruleBinding.modelContractVersion,
        rulePolicyInput: input.rulePolicyInput,
        rulePolicyOutput: input.rulePolicyOutput,
        ruleRegistry: input.ruleRegistry,
        ruleRevisionChecksum: input.ruleBinding.checksum,
        ruleRevisionId: input.ruleBinding.revisionId,
        ruleSnapshot: input.ruleSnapshot
      })
    )
    mocks.buildSheetBundle.mockImplementation(
      async (params: Parameters<typeof sheetProjection.buildCharacterSheetResponse>[0]) => {
        const bundle = await buildPolicyTestSheetBundle(params)
        const classSpells = params.character.state.classes?.find(
          (entry) => entry.classId === 'class-1'
        )?.spells
        return {
          ...bundle,
          ruleEvaluation: {
            ...bundle.ruleEvaluation,
            facts: {
              ...bundle.ruleEvaluation.facts,
              spellPreparationClasses: [
                {
                  classId: 'class-1',
                  sources: [
                    {
                      sourceId: 'class-1',
                      attributes: ['PREPARES_SPELLS'],
                      prepareLimit: {},
                      spellLimits: []
                    }
                  ]
                }
              ]
            },
            output: {
              ...bundle.ruleEvaluation.output,
              spellPreparation: {
                ...bundle.ruleEvaluation.output.spellPreparation,
                sources: [
                  {
                    classId: 'class-1',
                    availableSpellIds: [spellId],
                    learnedSpellIds: classSpells?.learned ?? [],
                    maxPreparableSpellLevel: 1,
                    preparedSpellIds: classSpells?.prepared ?? [],
                    preparedSpellLimit: 1,
                    sourceIds: ['class-1']
                  }
                ]
              }
            }
          },
          sheet: {
            ...bundle.sheet,
            spells: {
              ...bundle.sheet.spells,
              spells: [...(params.pinnedSpellsById?.values() ?? [])].map((spell) => ({
                id: spell.id,
                label: spell.label,
                level: 1,
                prepared: false,
                known: false,
                sources: [
                  {
                    source: {
                      spellId: spell.id,
                      sourceKind: 'CLASS',
                      sourceInstanceId: 'CLASS:class-1'
                    },
                    classId: 'class-1',
                    label: 'Class',
                    canPrepare: true,
                    prepared: false
                  }
                ]
              })),
              preparationSources: [{ classId: 'class-1', label: 'Class', preparedSpellIds: [] }]
            }
          }
        }
      }
    )
    mocks.resolveCampaignContext.mockResolvedValue({
      viewer: 'CHARACTER_OWNER',
      campaignId: 'campaign-1',
      campaignStatus: 'ACTIVE',
      contentMaturity: null,
      attunementSlotOverride: null,
      adjustments: [],
      secretAdjustmentIds: new Set(),
      conditions: []
    })
    mocks.patchSheetState.mockImplementation(async (_characterId, _patches, options) => {
      await options.beforeCharacterLock?.(db)
      await options.afterCharacterLock?.(db)
      return 2
    })

    for (const command of [
      {
        type: 'SET_PREPARED_SPELLS' as const,
        spellIds: [spellId],
        commandId: '00000000-0000-4000-8000-000000000196'
      },
      {
        type: 'SET_KNOWN_SPELLS' as const,
        spellIds: [spellId],
        commandId: '00000000-0000-4000-8000-000000000197'
      },
      {
        type: 'SET_PREPARED_SPELLS' as const,
        spellIds: [],
        commandId: '00000000-0000-4000-8000-000000000198'
      }
    ]) {
      configureCommittedSpellEligibility({
        classId: 'class-1',
        spellIds: [spellId],
        mode: command.type === 'SET_PREPARED_SPELLS' ? 'PREPARED' : 'KNOWN'
      })
      await executeCharacterSheetCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command: { ...command, classId: 'class-1', expectedVersion: 1 }
      })
    }

    expect(mocks.extendCommittedSources).toHaveBeenCalledTimes(5)
    expect(mocks.extendCommittedSources).toHaveBeenCalledWith(
      expect.objectContaining({
        roots: [{ subjectKind: 'SPELL', subjectId: fixedSpellId }]
      })
    )
    expect(mocks.lockCampaignShareUses).toHaveBeenCalledTimes(2)
    expect(mocks.lockCampaignShareUses.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.lockCampaignMemberForContentRead.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.lockCampaignMemberForContentRead.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.lockCampaignAssignment.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.lockCampaignAssignment.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.lockCurrentSourceUses.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.reduceCommittedSources).toHaveBeenCalledTimes(3)
    expect(mocks.compileMechanicsProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        authoredVersionVector: reducedSources.mechanics.authoredVersionVector,
        characterStreamVersion: 2
      })
    )
    expect(reducedSources.mechanics.authoredVersionVector).toContainEqual(backgroundVectorEntry)

    mocks.lockCampaignShareUses.mockRejectedValueOnce(new Error('Campaign share revoked.'))
    mocks.publishMechanics.mockClear()
    mocks.appendEvent.mockClear()
    await expect(
      executeCharacterSheetCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command: {
          type: 'SET_PREPARED_SPELLS',
          classId: 'class-1',
          spellIds: [spellId],
          expectedVersion: 1,
          commandId: '00000000-0000-4000-8000-000000000199'
        }
      })
    ).rejects.toThrow('Campaign share revoked')
    expect(mocks.publishMechanics).not.toHaveBeenCalled()
    expect(mocks.appendEvent).not.toHaveBeenCalled()

    mocks.lockCampaignShareUses.mockResolvedValue(undefined)
    mocks.extendCommittedSources.mockResolvedValue({
      sources: extendedSources,
      campaignShareUses: [],
      currentSourceUses: []
    })
    mocks.resolveCampaignContext.mockResolvedValue({
      viewer: 'CHARACTER_OWNER',
      campaignId: null,
      campaignStatus: null,
      contentMaturity: null,
      attunementSlotOverride: null,
      adjustments: [],
      secretAdjustmentIds: new Set(),
      conditions: []
    })
    mocks.appendEvent.mockRejectedValueOnce(new Error('late Character event failure'))
    mocks.patchSheetState.mockImplementationOnce(async (_characterId, _patches, options) => {
      await options.afterPersist?.(db, 2)
      return 2
    })
    await expect(
      executeCharacterSheetCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command: {
          type: 'SET_PREPARED_SPELLS',
          classId: 'class-1',
          spellIds: [spellId],
          expectedVersion: 1,
          commandId: '00000000-0000-4000-8000-000000000200'
        }
      })
    ).rejects.toThrow('late Character event failure')
    expect(mocks.publishMechanics).toHaveBeenCalled()
    expect(mocks.appendEvent).toHaveBeenCalled()
  })

  it('rejects a preparation-ineligible Spell before exact source hydration', async () => {
    configureCommittedSpellEligibility({
      classId: 'class-1',
      spellIds: ['eligible-spell'],
      mode: 'PREPARED'
    })

    await expect(
      executeCharacterSheetCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command: {
          type: 'SET_PREPARED_SPELLS',
          classId: 'class-1',
          spellIds: ['ineligible-spell'],
          expectedVersion: 1,
          commandId: '00000000-0000-4000-8000-000000000201'
        }
      })
    ).rejects.toThrow('Spell "ineligible-spell" is not available')

    expect(mocks.extendCommittedSources).not.toHaveBeenCalled()
    expect(mocks.patchSheetState).not.toHaveBeenCalled()
  })

  it.each(['SET_KNOWN_SPELLS', 'SET_PREPARED_SPELLS'] as const)(
    'returns the post-reduction committed Sheet for %s',
    async (commandType) => {
      const selectedSpellId = `${commandType.toLowerCase()}-selected`
      const availableOnlySpellId = `${commandType.toLowerCase()}-available-only`
      configureCommittedSpellEligibility({
        classId: 'class-1',
        spellIds: [selectedSpellId, availableOnlySpellId],
        mode: commandType === 'SET_PREPARED_SPELLS' ? 'PREPARED' : 'KNOWN'
      })
      const backgroundVectorEntry = {
        subjectKind: 'BACKGROUND' as const,
        subjectId: 'background-1',
        versionId: 'background-version-1',
        version: 1,
        checksum: 'd'.repeat(64)
      }
      const selectedSpellVectorEntry = {
        subjectKind: 'SPELL' as const,
        subjectId: selectedSpellId,
        versionId: `${selectedSpellId}-version-1`,
        version: 1,
        checksum: 'e'.repeat(64)
      }
      const availableOnlyVectorEntry = {
        subjectKind: 'SPELL' as const,
        subjectId: availableOnlySpellId,
        versionId: `${availableOnlySpellId}-version-1`,
        version: 1,
        checksum: 'f'.repeat(64)
      }
      const spell = (id: string, label: string): SpellAuthored => ({
        kind: 'SPELL',
        id,
        label,
        description: '',
        castingTime: { unit: 'ROUND', amount: 1 },
        level: 1,
        classIds: ['class-1'],
        magicSchoolId: 'evocation',
        systemId: '00000000-0000-0000-0000-000000000001',
        userId: 'user-1'
      })
      const fullSpellDocuments = new Map<string, SpellAuthored>([
        [selectedSpellId, spell(selectedSpellId, 'Selected spell')],
        [availableOnlySpellId, spell(availableOnlySpellId, 'Available-only spell')]
      ])
      const reducedSpellDocuments = new Map<string, SpellAuthored>([
        [selectedSpellId, fullSpellDocuments.get(selectedSpellId)!]
      ])
      const mechanics = {
        characterId: 'character-1',
        authoredVersionVector: [backgroundVectorEntry],
        ruleRevisionId: 'revision-1',
        ruleRevisionChecksum: 'a'.repeat(64),
        evaluatorVersion: '0.54.0',
        modelContractVersion: 5,
        rulePolicyInput: {},
        rulePolicyOutput: {},
        ruleRegistry: {},
        ruleSnapshot: { characterId: 'character-1' }
      }
      const baseSources = {
        mechanics,
        recordsByRoot: new Map(),
        vocabularySnapshot: { snapshotId: 'snapshot-1', document: { abilities: [] } }
      }
      const fullSources = {
        ...baseSources,
        mechanics: {
          ...mechanics,
          authoredVersionVector: [
            backgroundVectorEntry,
            selectedSpellVectorEntry,
            availableOnlyVectorEntry
          ]
        }
      }
      const reducedSources = {
        ...fullSources,
        mechanics: {
          ...fullSources.mechanics,
          authoredVersionVector: [backgroundVectorEntry, selectedSpellVectorEntry]
        }
      }
      const resolution = createResolution()
      resolution.catalog.spells = [...fullSpellDocuments.values()].map((document) => ({
        id: document.id,
        label: document.label,
        description: document.description,
        castingTime: document.castingTime,
        level: document.level,
        classIds: document.classIds,
        magicSchoolId: document.magicSchoolId
      }))

      mocks.loadCommittedSources.mockResolvedValue(baseSources)
      mocks.extendCommittedSources.mockResolvedValue({
        sources: fullSources,
        campaignShareUses: [],
        currentSourceUses: []
      })
      mocks.reduceCommittedSources.mockReturnValue(reducedSources)
      mocks.createCommittedResolution.mockReturnValue(resolution)
      mocks.createCommittedSpells.mockImplementation((sources) =>
        sources === reducedSources ? reducedSpellDocuments : fullSpellDocuments
      )
      mocks.compileMechanicsProjection.mockImplementation(
        (input: CharacterMechanicsCompilerInput) => ({
          ...mechanics,
          authoredVersionVector: input.authoredVersionVector,
          evaluatorVersion: input.ruleBinding.evaluatorVersion,
          modelContractVersion: input.ruleBinding.modelContractVersion,
          rulePolicyInput: input.rulePolicyInput,
          rulePolicyOutput: input.rulePolicyOutput,
          ruleRegistry: input.ruleRegistry,
          ruleRevisionChecksum: input.ruleBinding.checksum,
          ruleRevisionId: input.ruleBinding.revisionId,
          ruleSnapshot: input.ruleSnapshot
        })
      )
      let persistedReloadSheet:
        | Awaited<ReturnType<typeof buildPolicyTestSheetBundle>>['sheet']
        | undefined
      mocks.buildSheetBundle.mockImplementation(
        async (params: Parameters<typeof sheetProjection.buildCharacterSheetResponse>[0]) => {
          const bundle = await buildPolicyTestSheetBundle(params)
          const sheet = {
            ...bundle.sheet,
            spells: {
              ...bundle.sheet.spells,
              spells: [...(params.pinnedSpellsById?.values() ?? [])].map((document) => ({
                id: document.id,
                label: document.label,
                level: document.level,
                known: document.id === selectedSpellId,
                prepared: commandType === 'SET_PREPARED_SPELLS',
                sources: [
                  {
                    source: {
                      spellId: document.id,
                      sourceKind: 'CLASS' as const,
                      sourceInstanceId: 'CLASS:class-1'
                    },
                    classId: 'class-1',
                    label: 'Class',
                    canPrepare: true,
                    prepared: commandType === 'SET_PREPARED_SPELLS'
                  }
                ]
              })),
              preparationSources: [{ classId: 'class-1', label: 'Class', preparedSpellIds: [] }]
            }
          }
          if (params.pinnedSpellsById === reducedSpellDocuments) {
            persistedReloadSheet = {
              ...sheet,
              meta: { ...sheet.meta, campaignId: null }
            }
          }
          return {
            ...bundle,
            ruleEvaluation: {
              ...bundle.ruleEvaluation,
              facts: {
                ...bundle.ruleEvaluation.facts,
                spellPreparationClasses: [
                  {
                    classId: 'class-1',
                    sources: [
                      {
                        sourceId: 'class-1',
                        attributes: ['PREPARES_SPELLS'],
                        prepareLimit: {},
                        spellLimits: []
                      }
                    ]
                  }
                ]
              },
              output: {
                ...bundle.ruleEvaluation.output,
                spellPreparation: {
                  ...bundle.ruleEvaluation.output.spellPreparation,
                  sources: [
                    {
                      classId: 'class-1',
                      availableSpellIds: [selectedSpellId, availableOnlySpellId],
                      learnedSpellIds: [],
                      maxPreparableSpellLevel: 1,
                      preparedSpellIds: [],
                      preparedSpellLimit: 1,
                      sourceIds: ['class-1']
                    }
                  ]
                }
              }
            },
            sheet
          }
        }
      )

      const response = await executeCharacterSheetCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command: {
          type: commandType,
          classId: 'class-1',
          spellIds: [selectedSpellId],
          expectedVersion: 1,
          commandId: randomUUID()
        }
      })

      expect(response.streamVersion).toBe(2)
      if (!persistedReloadSheet) throw new Error('The reduced persisted Sheet was not rebuilt.')
      expect(response.sheet).toEqual(persistedReloadSheet)
      expect(response.sheet.spells.spells.map(({ id }) => id)).toEqual([selectedSpellId])
      expect(response.sheet.spells.spells.map(({ id }) => id)).not.toContain(availableOnlySpellId)
      expect(mocks.compileMechanicsProjection).toHaveBeenCalledWith(
        expect.objectContaining({
          authoredVersionVector: reducedSources.mechanics.authoredVersionVector,
          characterStreamVersion: 2,
          ruleBinding: expect.objectContaining({ revisionId: 'revision-1' })
        })
      )
      expect(reducedSources.mechanics.authoredVersionVector).toContainEqual(backgroundVectorEntry)
    }
  )

  it('accepts owned companion adjustments and rejects invalid targets and registry values', async () => {
    const character = createCharacter()
    character.state.creatures = [
      {
        id: '00000000-0000-4000-8000-000000000103',
        creatureId: 'creature-1',
        relationshipKind: 'COMPANION',
        originKind: 'WORLD',
        isActive: true,
        currentHitPoints: 3
      }
    ]
    const resolution = createResolution()
    resolution.registry.system = {
      ...resolution.registry.system!,
      alignments: [
        {
          id: '00000000-0000-4000-8000-000000000022',
          label: 'Neutral',
          code: 'NEUTRAL'
        }
      ],
      creatureTypes: [
        {
          id: '00000000-0000-4000-8000-000000000021',
          label: 'Beast',
          code: 'BEAST'
        }
      ]
    }
    mocks.findAuthoredById.mockResolvedValue(character)
    mocks.resolveCharacterBuilder.mockResolvedValue(resolution)
    mocks.findAllCreatures.mockResolvedValue([createCreature()])

    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        expectedVersion: 1,
        commandId: '00000000-0000-4000-8000-000000000104',
        adjustment: {
          family: 'COMPANION',
          companionInstanceId: '00000000-0000-4000-8000-000000000103',
          field: 'SIZE_OVERRIDE',
          value: 'TINY'
        }
      }
    })
    expect(mocks.upsertAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({
        family: 'COMPANION',
        field: 'SIZE_OVERRIDE',
        value: 'TINY'
      })
    )

    for (const adjustment of [
      {
        companionInstanceId: '00000000-0000-4000-8000-000000000105',
        field: 'SIZE_OVERRIDE' as const,
        value: 'TINY'
      },
      {
        companionInstanceId: '00000000-0000-4000-8000-000000000103',
        field: 'ALIGNMENT_OVERRIDE' as const,
        value: '00000000-0000-4000-8000-000000000106'
      }
    ] as const) {
      await expect(
        executeCharacterSheetCommand({
          db: db as unknown as DBLike,
          characterId: 'character-1',
          userId: 'user-1',
          command: {
            type: 'UPSERT_SHEET_ADJUSTMENT',
            expectedVersion: 1,
            commandId: crypto.randomUUID(),
            adjustment: { family: 'COMPANION', ...adjustment }
          }
        })
      ).rejects.toThrow()
    }
  })

  it('persists owner-based and legacy companion resource commands', async () => {
    const companionInstanceId = '00000000-0000-4000-8000-000000000107'
    const featureId = '00000000-0000-4000-8000-000000000108'
    const chargeId = '00000000-0000-4000-8000-000000000109'
    const character = createCharacter()
    character.state.creatures = [
      {
        id: companionInstanceId,
        creatureId: 'creature-1',
        relationshipKind: 'COMPANION',
        originKind: 'WORLD',
        isActive: true,
        currentHitPoints: 3
      }
    ]
    mocks.findAuthoredById.mockResolvedValue(character)
    const creature = createCreature({
      features: [
        {
          id: featureId,
          label: 'Keen Senses',
          description: 'Focus your senses.',
          order: 1,
          charges: {
            id: chargeId,
            resetKind: 'MANUAL',
            limitKind: 'FIXED_AMOUNT',
            scalingKind: 'NONE',
            amount: 3
          }
        }
      ]
    })
    mocks.findAllCreatures.mockResolvedValue([creature])
    mocks.createCommittedExtras.mockReturnValue({
      creaturesById: new Map([[creature.id, creature]]),
      vehiclesById: new Map()
    })
    const owner = {
      kind: 'COMPANION_FEATURE' as const,
      companionInstanceId,
      featureId,
      chargeId
    }
    let usage: Array<{
      id: string
      owner: CharacterResourceOwnerKey
      used: number
    }> = []
    mocks.listResourceUsage.mockImplementation(async () => usage)
    mocks.setResourceUsage.mockImplementation(async (input) => {
      usage = input.used === 0 ? [] : [{ id: input.id, owner: input.owner, used: input.used }]
    })

    const used = await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'USE_SHEET_RESOURCE',
        expectedVersion: 1,
        commandId: '00000000-0000-4000-8000-000000000110',
        owner
      }
    })
    expect(mocks.setResourceUsage).toHaveBeenLastCalledWith(
      expect.objectContaining({ owner, used: 1 })
    )
    expect(used.sheet.resources.items).toContainEqual(expect.objectContaining({ owner, used: 1 }))
    expect(mocks.loadCharacterBuilderContext).not.toHaveBeenCalled()
    expect(mocks.evaluateActionStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        changedPoolId: createCharacterResourceOwnerKey(owner)
      })
    )

    mocks.findById.mockResolvedValue(createCharacterRow({ stream_version: 2 }))
    const recovered = await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'RECOVER_SHEET_RESOURCE',
        expectedVersion: 2,
        commandId: '00000000-0000-4000-8000-000000000111',
        owner,
        trigger: 'MANUAL'
      }
    })
    expect(mocks.setResourceUsage).toHaveBeenLastCalledWith(
      expect.objectContaining({ owner, used: 0 })
    )
    expect(recovered.sheet.resources.items).toContainEqual(
      expect.objectContaining({ owner, used: 0 })
    )

    const resourceGrantId = createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(owner))
    mocks.findById.mockResolvedValue(createCharacterRow({ stream_version: 3 }))
    const legacyUsed = await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'USE_RESOURCE',
        expectedVersion: 3,
        commandId: '00000000-0000-4000-8000-000000000112',
        resourceGrantId,
        amount: 3
      }
    })
    expect(mocks.setResourceUsage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        owner: toCharacterResourceOwnerKey(owner),
        used: 3
      })
    )
    expect(legacyUsed.sheet.resources.items).toContainEqual(
      expect.objectContaining({ owner, used: 3 })
    )

    const patchCount = mocks.patchSheetState.mock.calls.length
    const eventCount = mocks.appendEvent.mock.calls.length
    mocks.findById.mockResolvedValue(createCharacterRow({ stream_version: 4 }))
    await expect(
      executeCharacterSheetCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command: {
          type: 'USE_SHEET_RESOURCE',
          expectedVersion: 4,
          commandId: '00000000-0000-4000-8000-000000000116',
          owner
        }
      })
    ).rejects.toThrow('only has 0 uses remaining')
    expect(mocks.patchSheetState).toHaveBeenCalledTimes(patchCount)
    expect(mocks.setResourceUsage).toHaveBeenCalledTimes(3)
    expect(mocks.appendEvent).toHaveBeenCalledTimes(eventCount)

    mocks.findById.mockResolvedValue(createCharacterRow({ stream_version: 4 }))
    await expect(
      executeCharacterSheetCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command: {
          type: 'USE_RESOURCE',
          expectedVersion: 4,
          commandId: '00000000-0000-4000-8000-000000000114',
          resourceGrantId,
          amount: 1
        }
      })
    ).rejects.toThrow('only has 0 uses remaining')
    expect(mocks.setResourceUsage).toHaveBeenCalledTimes(3)

    const legacyRecovered = await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'RESTORE_RESOURCE',
        expectedVersion: 4,
        commandId: '00000000-0000-4000-8000-000000000113',
        resourceGrantId
      }
    })
    expect(mocks.setResourceUsage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        owner: toCharacterResourceOwnerKey(owner),
        used: 2
      })
    )
    expect(legacyRecovered.sheet.resources.items).toContainEqual(
      expect.objectContaining({ owner, used: 2 })
    )

    usage = [
      {
        id: 'raw-overcap-usage',
        owner: toCharacterResourceOwnerKey(owner),
        used: 7
      }
    ]
    mocks.findById.mockResolvedValue(createCharacterRow({ stream_version: 4 }))
    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'RESTORE_RESOURCE',
        expectedVersion: 4,
        commandId: '00000000-0000-4000-8000-000000000115',
        resourceGrantId,
        amount: 1
      }
    })
    expect(mocks.setResourceUsage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        owner: toCharacterResourceOwnerKey(owner),
        used: 6
      })
    )

    usage = [
      {
        id: 'raw-overcap-usage',
        owner: toCharacterResourceOwnerKey(owner),
        used: 7
      }
    ]
    mocks.findAllCreatures.mockResolvedValue([
      createCreature({
        features: [
          {
            id: featureId,
            label: 'Keen Senses',
            description: 'Focus your senses.',
            order: 1,
            charges: {
              id: chargeId,
              resetKind: 'MANUAL',
              limitKind: 'FIXED_AMOUNT',
              scalingKind: 'NONE',
              amount: 10
            }
          }
        ]
      })
    ])
    await expect(
      executeCharacterSheetCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command: {
          type: 'USE_SHEET_RESOURCE',
          expectedVersion: 4,
          commandId: '00000000-0000-4000-8000-000000000117',
          owner
        }
      })
    ).rejects.toThrow('only has 0 uses remaining')
    expect(mocks.setResourceUsage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        owner: toCharacterResourceOwnerKey(owner),
        used: 6
      })
    )

    const buildCharacterSheetResponse = sheetProjection.buildCharacterSheetResponse
    const projectionSpy = vi
      .spyOn(sheetProjection, 'buildCharacterSheetResponse')
      .mockImplementation(async (params) => {
        const sheet = await buildCharacterSheetResponse(params)
        return {
          ...sheet,
          resources: {
            ...sheet.resources,
            items: sheet.resources.items.map((resource) =>
              createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(resource.owner)) ===
              resourceGrantId
                ? { ...resource, used: 2, remaining: 1 }
                : resource
            )
          }
        }
      })
    usage = []
    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'USE_RESOURCE',
        expectedVersion: 4,
        commandId: '00000000-0000-4000-8000-000000000118',
        resourceGrantId
      }
    })
    expect(mocks.setResourceUsage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        owner: toCharacterResourceOwnerKey(owner),
        used: 3
      })
    )

    usage = []
    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'RESTORE_RESOURCE',
        expectedVersion: 4,
        commandId: '00000000-0000-4000-8000-000000000119',
        resourceGrantId
      }
    })
    expect(mocks.setResourceUsage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        owner: toCharacterResourceOwnerKey(owner),
        used: 1
      })
    )
    projectionSpy.mockRestore()
  })

  it('persists charged spell casts by their spell-source owner', async () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'wizard', classLevel: 1 }]
    character.intent.spellSelections = []
    character.state.classes = []
    mocks.findAuthoredById.mockResolvedValue(character)

    const limitedFeature = {
      id: 'limited-feature',
      label: 'Limited Magic',
      description: '',
      availableAtLevel: 1,
      order: 0,
      grants: {
        spells: [
          {
            id: 'limited-grant',
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: ['spell-3'],
            attributes: [SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            charges: {
              id: 'limited-charge',
              resetKind: 'LONG_REST',
              limitKind: 'FIXED_AMOUNT',
              scalingKind: 'NONE',
              amount: 1
            },
            order: 0
          }
        ]
      }
    } satisfies CharacterBuilderResolution['registry']['features'][number]
    const resolution = createResolution()
    resolution.registry.features = [limitedFeature]
    resolution.registry.classes = [
      {
        id: 'wizard',
        label: 'Wizard',
        category: 'BASE',
        features: [limitedFeature],
        spellcasting: {
          spellLimits: [],
          attributes: [],
          maxSpellLevel: 9,
          charges: {
            id: 'wizard-spellcasting-charge',
            resetKind: 'LONG_REST',
            limitKind: 'FIXED_AMOUNT',
            scalingKind: 'NONE',
            amount: 1
          }
        },
        startingGold: {
          multiplier: 1,
          currencyId: 'gp',
          dieConfig: '1d4'
        },
        startingEquipment: {
          id: 'wizard-starting-equipment',
          sets: []
        },
        hitpoint: {
          ability: 'CONSTITUTION',
          dieConfig: '1d8'
        },
        multiclass: {
          id: 'wizard-multiclass',
          requirementGroups: { groups: [] }
        },
        systemId: '00000000-0000-0000-0000-000000000001',
        userId: 'user-1'
      }
    ]
    resolution.grants.features = [
      {
        id: limitedFeature.id,
        label: limitedFeature.label,
        sourceLabel: 'Wizard',
        source: { kind: 'CLASS', classId: 'wizard', classLevel: 1 }
      }
    ]
    resolution.catalog.spells = [
      {
        id: 'spell-3',
        label: 'Shield',
        description: '',
        castingTime: { unit: 'ROUND', amount: 1 },
        level: 1,
        classIds: ['wizard'],
        magicSchoolId: 'ABJURATION'
      }
    ]
    resolution.sourceRegistry.classes = resolution.registry.classes
    resolution.sourceRegistry.features = resolution.registry.features
    mocks.createCommittedResolution.mockReturnValue(resolution)
    mocks.createCommittedSpells.mockReturnValue(
      new Map([['spell-3', resolution.catalog.spells[0]!]])
    )
    mocks.loadCharacterBuilderContext.mockResolvedValue({
      catalog: resolution.catalog,
      registry: resolution.sourceRegistry
    })
    mocks.resolveCharacterBuilder.mockResolvedValue(resolution)

    const sourceInstanceId = 'CLASS:wizard:wizard:limited-feature:limited-grant'
    const resourceGrantId = `${sourceInstanceId}:spell-3`
    const owner = {
      kind: 'SPELL_SOURCE' as const,
      resourceGrantId,
      spellId: 'spell-3',
      sourceKind: 'FEATURE' as const,
      sourceInstanceId
    }
    let usage: Array<{
      id: string
      owner: CharacterResourceOwnerKey
      used: number
    }> = []
    mocks.listResourceUsage.mockImplementation(async () => usage)
    mocks.setResourceUsage.mockImplementation(async (input) => {
      usage = [{ id: input.id, owner: input.owner, used: input.used }]
    })

    const response = await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'CAST_SPELL',
        commandId: '00000000-0000-4000-8000-000000000114',
        expectedVersion: 1,
        spellId: 'spell-3',
        sourceId: resourceGrantId
      }
    })

    expect(mocks.setResourceUsage).toHaveBeenLastCalledWith(
      expect.objectContaining({ owner, used: 1 })
    )
    expect(mocks.evaluateActionStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        changedPoolId: createCharacterResourceOwnerKey(owner)
      })
    )
    expect(response.sheet.resources.items).toContainEqual(
      expect.objectContaining({
        owner: {
          kind: 'SPELL_SOURCE',
          resourceGrantId,
          source: {
            spellId: owner.spellId,
            sourceKind: owner.sourceKind,
            sourceInstanceId: owner.sourceInstanceId
          }
        },
        used: 1,
        remaining: 0
      })
    )
  })

  it('recovers only explicitly selected companion resources during a rest', async () => {
    const selectedCompanionId = '00000000-0000-4000-8000-000000000131'
    const unselectedCompanionId = '00000000-0000-4000-8000-000000000132'
    const featureId = '00000000-0000-4000-8000-000000000133'
    const chargeId = '00000000-0000-4000-8000-000000000134'
    const character = createCharacter()
    character.state.creatures = [selectedCompanionId, unselectedCompanionId].map((id) => ({
      id,
      creatureId: 'creature-1',
      relationshipKind: 'COMPANION' as const,
      originKind: 'WORLD' as const,
      isActive: true,
      currentHitPoints: 3
    }))
    mocks.findAuthoredById.mockResolvedValue(character)
    const companion = createCreature({
      features: [
        {
          id: featureId,
          label: 'Companion Focus',
          description: 'Regain focus after a short rest.',
          order: 1,
          charges: {
            id: chargeId,
            resetKind: 'SHORT_REST',
            limitKind: 'FIXED_AMOUNT',
            scalingKind: 'NONE',
            amount: 1
          }
        }
      ]
    })
    mocks.findAllCreatures.mockResolvedValue([companion])
    mocks.createCommittedExtras.mockReturnValue({
      creaturesById: new Map([[companion.id, companion]]),
      vehiclesById: new Map()
    })
    const selectedOwner = {
      kind: 'COMPANION_FEATURE' as const,
      companionInstanceId: selectedCompanionId,
      featureId,
      chargeId
    }
    const unselectedOwner = {
      ...selectedOwner,
      companionInstanceId: unselectedCompanionId
    }
    mocks.listResourceUsage.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000135',
        owner: selectedOwner,
        used: 1
      },
      {
        id: '00000000-0000-4000-8000-000000000136',
        owner: unselectedOwner,
        used: 1
      }
    ])

    const preview = await previewCharacterRest({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      input: {
        restKind: 'SHORT',
        expectedVersion: 1,
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: [selectedCompanionId],
        requestRoll: false
      }
    })
    expect(preview.canApply).toBe(true)
    mocks.loadCharacterBuilderContext.mockClear()
    mocks.resolveCharacterBuilder.mockClear()
    mocks.compileMechanicsProjection.mockClear()
    mocks.publishMechanics.mockClear()

    const response = await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'COMPLETE_REST',
        commandId: '00000000-0000-4000-8000-000000000137',
        expectedVersion: 1,
        restKind: 'SHORT',
        previewFingerprint: preview.previewFingerprint,
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: [selectedCompanionId]
      }
    })

    expect(mocks.setResourceUsage).toHaveBeenCalledTimes(1)
    expect(mocks.setResourceUsage).toHaveBeenCalledWith(
      expect.objectContaining({ owner: selectedOwner, used: 0 })
    )
    expect(mocks.setResourceUsage).not.toHaveBeenCalledWith(
      expect.objectContaining({ owner: unselectedOwner })
    )
    expect(mocks.loadCharacterBuilderContext).not.toHaveBeenCalled()
    expect(mocks.resolveCharacterBuilder).not.toHaveBeenCalled()
    expect(mocks.compileMechanicsProjection).toHaveBeenCalledWith(
      expect.objectContaining({ characterStreamVersion: 2 })
    )
    expect(mocks.publishMechanics).toHaveBeenCalledWith(
      expect.objectContaining({ pinnedSenseDefinitions: [] })
    )
    expect(response.result).toMatchObject({
      type: 'COMPLETE_REST',
      rest: {
        companionRecoveries: [
          expect.objectContaining({
            companionInstanceId: selectedCompanionId,
            recoveredResourceIds: [expect.any(String)]
          })
        ]
      }
    })
  })

  it('removes companion adjustments, resource usage, and equipment assignments', async () => {
    const companionInstanceId = '00000000-0000-4000-8000-000000000122'
    const character = createCharacter()
    character.state.creatures = [
      {
        id: companionInstanceId,
        creatureId: 'creature-1',
        relationshipKind: 'COMPANION',
        originKind: 'WORLD',
        isActive: true,
        currentHitPoints: 3
      }
    ]
    character.state.creatureEquipment = {
      [companionInstanceId]: [{ equipmentItemId: 'item-1' }]
    }
    mocks.findAuthoredById.mockResolvedValue(character)
    mocks.findAllCreatures.mockResolvedValue([createCreature()])
    mocks.listAdjustments.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000123',
        characterId: 'character-1',
        actorId: 'user-1',
        createdAt: '2026-07-27T00:00:00.000Z',
        updatedAt: '2026-07-27T00:00:00.000Z',
        family: 'COMPANION',
        companionInstanceId,
        field: 'ARMOR_CLASS_OVERRIDE',
        value: 14
      }
    ])
    const owner = {
      kind: 'COMPANION_FEATURE' as const,
      companionInstanceId,
      featureId: '00000000-0000-4000-8000-000000000124',
      chargeId: '00000000-0000-4000-8000-000000000125'
    }
    mocks.listResourceUsage.mockResolvedValue([
      { id: 'usage-1', characterId: 'character-1', owner, used: 1 }
    ])

    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'REMOVE_SHEET_EXTRA',
        expectedVersion: 1,
        commandId: '00000000-0000-4000-8000-000000000126',
        extra: { kind: 'COMPANION', extraId: companionInstanceId }
      }
    })
    expect(mocks.pruneCommittedSources).toHaveBeenCalledWith(
      expect.objectContaining({
        roots: [{ subjectKind: 'CREATURE', subjectId: 'creature-1' }]
      })
    )
    expect(mocks.removeAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({
        adjustmentId: '00000000-0000-4000-8000-000000000123',
        family: 'COMPANION'
      })
    )
    expect(mocks.setResourceUsage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'usage-1', owner, used: 0 })
    )
    expect(mocks.patchSheetState).toHaveBeenCalledWith(
      'character-1',
      expect.arrayContaining([expect.objectContaining({ kind: 'EXTRAS', creatureEquipment: {} })]),
      expect.any(Object)
    )
  })

  it('requires current room authority before returning a compact hit-point replay', async () => {
    const command = {
      amount: 3,
      commandId: '00000000-0000-4000-8000-000000000303',
      expectedVersion: 1,
      mode: 'DAMAGE' as const,
      type: 'ADJUST_HIT_POINTS' as const
    }
    const replayMechanics = {
      characterId: 'character-1',
      characterStreamVersion: 2,
      commandState: createCharacter(),
      pinnedSenseDefinitions: [createPinnedVisionSense(60)],
      projectionChecksum: 'c'.repeat(64),
      rulePolicyOutput: { senses: [sensePolicyFact(60)] }
    } as unknown as CharacterMechanicsProjection
    mocks.findById.mockResolvedValue(createCharacterRow({ stream_version: 2 }))
    mocks.findMechanics.mockResolvedValue(replayMechanics)
    mocks.resolveCampaignContext.mockResolvedValue({
      viewer: 'CHARACTER_OWNER',
      campaignId: 'campaign-1',
      campaignStatus: 'ACTIVE',
      contentMaturity: null,
      attunementSlotOverride: null,
      adjustments: [],
      secretAdjustmentIds: new Set(),
      conditions: []
    })
    mocks.findCampaignMechanics.mockResolvedValue({
      kind: 'MATERIALIZED',
      projectionChecksum: 'd'.repeat(64),
      rulePolicyOutput: { senses: [sensePolicyFact(30)] }
    })
    mocks.findByCommandId.mockResolvedValue({
      type: 'CHARACTER_SHEET_COMMAND_APPLIED',
      commandType: command.type,
      commandFingerprint: fingerprintSheetCommand(command),
      committedStreamVersion: 2
    })
    const liveSessionAuthority = {
      authorityId: 'room-authority',
      sessionId: '00000000-0000-4000-8000-000000000304'
    }

    await expect(
      executeCompactLiveCharacterHitPointCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command,
        liveSessionAuthority
      })
    ).resolves.toEqual({
      characterVision: {
        characterId: 'character-1',
        dimRange: { amount: 30, unit: 'FEET' }
      },
      replayed: true,
      version: 2
    })

    expect(mocks.assertCommandAuthority).toHaveBeenCalledWith(
      db,
      'character-1',
      liveSessionAuthority
    )
    expect(mocks.patchLiveHitPoints).not.toHaveBeenCalled()
  })

  it('converges a concurrent compact hit-point duplicate on its durable receipt', async () => {
    const command = {
      amount: 3,
      commandId: '00000000-0000-4000-8000-000000000305',
      expectedVersion: 1,
      mode: 'DAMAGE' as const,
      type: 'ADJUST_HIT_POINTS' as const
    }
    const currentMechanics = {
      characterId: 'character-1',
      characterStreamVersion: 1,
      commandState: createCharacter({
        state: {
          equipment: { inventory: [], equipped: [], attuned: [] },
          currency: [],
          hitpoints: { current: 10, hitDice: [] }
        }
      }),
      projectionChecksum: 'd'.repeat(64),
      pinnedSenseDefinitions: [createPinnedVisionSense(60)],
      rulePolicyOutput: {
        derivedStats: { maxHitPoints: { effective: 12 } },
        senses: [sensePolicyFact(60)]
      }
    } as unknown as CharacterMechanicsProjection
    const replayMechanics = {
      ...currentMechanics,
      characterStreamVersion: 2,
      projectionChecksum: 'e'.repeat(64)
    } as CharacterMechanicsProjection
    mocks.findById
      .mockResolvedValueOnce(createCharacterRow({ stream_version: 1 }))
      .mockResolvedValue(createCharacterRow({ stream_version: 2 }))
    mocks.findMechanics.mockImplementation(
      async ({ expectedStreamVersion }: { expectedStreamVersion?: number }) =>
        expectedStreamVersion === 1 ? currentMechanics : replayMechanics
    )
    mocks.advanceMechanicsProjection.mockReturnValue(replayMechanics)
    mocks.findByCommandId.mockResolvedValueOnce(null).mockResolvedValue({
      type: 'CHARACTER_SHEET_COMMAND_APPLIED',
      commandType: command.type,
      commandFingerprint: fingerprintSheetCommand(command),
      committedStreamVersion: 2
    })
    mocks.patchLiveHitPoints.mockRejectedValueOnce(new MockConcurrencyError('character-1', 1))

    await expect(
      executeCompactLiveCharacterHitPointCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command,
        liveSessionAuthority: {
          authorityId: 'room-authority',
          sessionId: '00000000-0000-4000-8000-000000000306'
        }
      })
    ).resolves.toEqual({
      characterVision: {
        characterId: 'character-1',
        dimRange: { amount: 60, unit: 'FEET' }
      },
      replayed: true,
      version: 2
    })

    expect(mocks.patchLiveHitPoints).toHaveBeenCalledTimes(1)
  })

  it('commits a compact hit-point adjustment without Sheet reconstruction', async () => {
    const commandState = createCharacter()
    commandState.state.hitpoints = { current: 10, temp: 2, hitDice: [] }
    const currentMechanics = {
      characterId: 'character-1',
      characterStreamVersion: 1,
      commandState,
      projectionChecksum: 'a'.repeat(64),
      rulePolicyOutput: {
        derivedStats: { maxHitPoints: { effective: 12 } },
        senses: []
      }
    } as unknown as CharacterMechanicsProjection
    const currentRuleSnapshot = {
      characterId: 'character-1',
      revision: 'current'
    } as unknown as CharacterMechanicsProjection['ruleSnapshot']
    const nextRuleSnapshot = {
      characterId: 'character-1',
      revision: 'next'
    } as unknown as CharacterMechanicsProjection['ruleSnapshot']
    const currentRulePolicyInput = {
      current: 'facts'
    } as unknown as CharacterMechanicsProjection['rulePolicyInput']
    const nextRulePolicyInput = {
      next: 'facts'
    } as unknown as CharacterMechanicsProjection['rulePolicyInput']
    const currentRuleRegistry = {
      current: 'registry'
    } as unknown as CharacterMechanicsProjection['ruleRegistry']
    const nextRuleRegistry = {
      next: 'registry'
    } as unknown as CharacterMechanicsProjection['ruleRegistry']
    currentMechanics.commandLaneChecksum = 'd'.repeat(64)
    currentMechanics.ruleSnapshot = currentRuleSnapshot
    currentMechanics.rulePolicyInput = currentRulePolicyInput
    currentMechanics.ruleRegistry = currentRuleRegistry
    const nextMechanics = {
      ...currentMechanics,
      characterStreamVersion: 2,
      commandLaneChecksum: 'e'.repeat(64),
      ruleSnapshot: nextRuleSnapshot,
      rulePolicyInput: nextRulePolicyInput,
      rulePolicyOutput: {
        derivedStats: { maxHitPoints: { effective: 12 } },
        senses: []
      },
      ruleRegistry: nextRuleRegistry,
      commandState: {
        ...commandState,
        state: {
          ...commandState.state,
          hitpoints: { ...commandState.state.hitpoints, current: 9, temp: 0 }
        }
      },
      projectionChecksum: 'b'.repeat(64)
    } as unknown as CharacterMechanicsProjection
    const priorEvaluation = {
      binding: { revisionId: 'revision-1' },
      snapshot: { characterId: 'character-1' }
    } as unknown as CharacterRuleEvaluationResult
    const priorResolution = createResolution()
    const campaignMechanicalContextChecksum = checksumCampaignCharacterMechanicalContext({
      adjustments: [],
      attunementSlotOverride: 2
    })
    const currentCampaignMechanics = {
      campaignId: 'campaign-1',
      characterId: 'character-1',
      characterStreamVersion: 1,
      kind: 'BASE_REFERENCE',
      manualMaximumModifierOwner: null,
      mechanicalContextChecksum: campaignMechanicalContextChecksum,
      projectionChecksum: 'f'.repeat(64),
      rulePolicyInput: currentMechanics.rulePolicyInput,
      rulePolicyOutput: currentMechanics.rulePolicyOutput
    }
    mocks.resolveCampaignContext.mockResolvedValue({
      viewer: 'CHARACTER_OWNER',
      campaignId: 'campaign-1',
      campaignStatus: 'ACTIVE',
      contentMaturity: null,
      attunementSlotOverride: 2,
      adjustments: [],
      secretAdjustmentIds: new Set(),
      conditions: []
    })
    mocks.findCampaignMechanics.mockResolvedValue(currentCampaignMechanics)
    const committedRuleSnapshot = {
      campaignMechanicalContextChecksum,
      campaignMechanicsProjectionChecksum: currentCampaignMechanics.projectionChecksum,
      mechanicsCommandLaneChecksum: 'd'.repeat(64),
      mechanicsPayload: {
        ruleSnapshot: currentMechanics.ruleSnapshot,
        rulePolicyInput: currentMechanics.rulePolicyInput,
        rulePolicyOutput: currentMechanics.rulePolicyOutput,
        ruleRegistry: currentMechanics.ruleRegistry,
        compiledActionEntryPoints: currentMechanics.compiledActionEntryPoints
      },
      mechanicsProjectionChecksum: currentMechanics.projectionChecksum,
      streamVersion: 1,
      evaluation: priorEvaluation,
      resolution: priorResolution
    } as CharacterSheetCommittedRuleSnapshot
    mocks.findMechanics.mockResolvedValue(currentMechanics)
    mocks.advanceMechanicsProjection.mockReturnValue(nextMechanics)
    mocks.patchLiveHitPoints.mockImplementation(async (_characterId, input) => {
      await input.afterPersist?.(db as unknown as DBLike, 2)
      return 2
    })

    const execution = await executeCompactLiveCharacterHitPointCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        amount: 3,
        commandId: '00000000-0000-4000-8000-000000000301',
        expectedVersion: 1,
        mode: 'DAMAGE',
        type: 'ADJUST_HIT_POINTS'
      },
      liveSessionAuthority: {
        authorityId: 'room-authority',
        sessionId: '00000000-0000-4000-8000-000000000302'
      },
      committedRuleSnapshot
    })

    expect(mocks.patchLiveHitPoints).toHaveBeenCalledWith(
      'character-1',
      expect.objectContaining({
        expected: { current: 10, temp: 2 },
        expectedStreamVersion: 1,
        next: { current: 9, temp: 0 }
      })
    )
    expect(mocks.advanceMechanicsProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        characterStreamVersion: 2,
        current: currentMechanics
      })
    )
    expect(mocks.publishMechanics).toHaveBeenCalledWith(nextMechanics)
    expect(mocks.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        commandType: 'ADJUST_HIT_POINTS',
        committedStreamVersion: 2
      })
    )
    expect(mocks.buildSheetBundle).not.toHaveBeenCalled()
    expect(mocks.assembleSheetBundleForRuleContext).not.toHaveBeenCalled()
    expect(execution).toMatchObject({
      characterVision: { characterId: 'character-1', dimRange: null },
      replayed: false,
      version: 2,
      ruleSnapshot: {
        mechanicsProjectionChecksum: nextMechanics.projectionChecksum,
        mechanicsCommandLaneChecksum: nextMechanics.commandLaneChecksum,
        campaignMechanicalContextChecksum,
        campaignMechanicsProjectionChecksum: expect.any(String),
        streamVersion: 2,
        evaluation: priorEvaluation,
        resolution: priorResolution
      }
    })
    expect(execution.ruleSnapshot?.mechanicsPayload).toEqual({
      ruleSnapshot: nextMechanics.ruleSnapshot,
      rulePolicyInput: nextMechanics.rulePolicyInput,
      rulePolicyOutput: nextMechanics.rulePolicyOutput,
      ruleRegistry: nextMechanics.ruleRegistry,
      compiledActionEntryPoints: nextMechanics.compiledActionEntryPoints
    })
    expect(execution.ruleSnapshot?.campaignMechanicsProjectionChecksum).toBe(
      mocks.publishCampaignMechanics.mock.calls[0]?.[0].projection.projectionChecksum
    )
  })

  it('commits a compact maximum-hit-point modifier from the mechanics projection', async () => {
    const character = createCharacter()
    character.state.hitpoints = { current: 10, hitDice: [] }
    const resolution = createResolution()
    const evaluation = await evaluateCharacterBuilderTestPolicy({
      db: db as unknown as DBLike,
      character,
      context: {
        catalog: resolution.catalog,
        registry: resolution.sourceRegistry
      },
      existingRevisionId: 'revision-1',
      expectedRevisionId: 'revision-1',
      adjustments: [],
      movementDisplayPreference: { mode: 'AUTO' },
      resourceUsage: [],
      attunementSlotOverride: null
    })
    const basePolicyOutput = {
      ...evaluation.output,
      senses: [sensePolicyFact(60)]
    }
    const campaignPolicyOutput = {
      ...evaluation.output,
      senses: [sensePolicyFact(30)]
    }
    const currentMechanics = {
      characterId: character.id,
      characterStreamVersion: 1,
      commandLaneChecksum: 'd'.repeat(64),
      commandState: character,
      projectionChecksum: 'b'.repeat(64),
      authoredVersionVector: [],
      systemVocabularySnapshotId: 'snapshot-1',
      systemVocabularySnapshotVersion: 1,
      systemVocabularySnapshotChecksum: 'c'.repeat(64),
      ruleRevisionId: 'revision-1',
      ruleRevisionChecksum: 'a'.repeat(64),
      evaluatorVersion: '0.54.0',
      modelContractVersion: 5,
      ruleSnapshot: {
        characterId: character.id,
        systemId: character.systemId,
        classes: [{ classId: 'class-1' }],
        features: [],
        equipmentItems: []
      },
      rulePolicyInput: evaluation.facts,
      rulePolicyOutput: basePolicyOutput,
      pinnedSenseDefinitions: [createPinnedVisionSense(60)],
      ruleRegistry: {}
    } as unknown as CharacterMechanicsProjection
    const nextMechanics = {
      ...currentMechanics,
      characterStreamVersion: 2,
      projectionChecksum: 'e'.repeat(64)
    } as CharacterMechanicsProjection
    mocks.findMechanics.mockResolvedValue(currentMechanics)
    mocks.compileMechanicsProjection.mockReturnValue(nextMechanics)
    mocks.evaluatePinnedRuleRevision
      .mockResolvedValueOnce({
        checksum: currentMechanics.ruleRevisionChecksum,
        evaluatorKind: 'ZEN',
        evaluatorVersion: currentMechanics.evaluatorVersion,
        modelContractVersion: currentMechanics.modelContractVersion,
        result: basePolicyOutput,
        revisionId: currentMechanics.ruleRevisionId
      })
      .mockResolvedValueOnce({
        checksum: currentMechanics.ruleRevisionChecksum,
        evaluatorKind: 'ZEN',
        evaluatorVersion: currentMechanics.evaluatorVersion,
        modelContractVersion: currentMechanics.modelContractVersion,
        result: campaignPolicyOutput,
        revisionId: currentMechanics.ruleRevisionId
      })
    const campaignId = '00000000-0000-4000-8000-000000000311'
    mocks.lockMaximumHitPointContext.mockResolvedValue({
      campaignId,
      character: {
        id: character.id,
        ruleRevisionId: currentMechanics.ruleRevisionId,
        streamVersion: 1,
        userId: character.userId
      },
      existingAdjustment: null,
      hitPoints: {
        current: currentMechanics.commandState.state.hitpoints.current,
        temp: currentMechanics.commandState.state.hitpoints.temp ?? null
      },
      mechanics: currentMechanics,
      overlay: {
        campaignId,
        characterId: character.id,
        characterStreamVersion: 1,
        baseMechanicsProjectionChecksum: currentMechanics.projectionChecksum,
        mechanicalContextChecksum: 'f'.repeat(64),
        manualMaximumModifierOwner: null,
        projectionChecksum: '9'.repeat(64),
        projectionSchemaVersion: 3,
        kind: 'MATERIALIZED',
        rulePolicyInput: evaluation.facts,
        rulePolicyOutput: campaignPolicyOutput
      },
      priorEvent: null
    })
    mocks.commitMaximumHitPointPolicy.mockResolvedValue(2)

    const execution = await executeCompactLiveMaximumHitPointModifierCommand({
      db: db as unknown as DBLike,
      campaignId,
      characterId: character.id,
      userId: character.userId,
      command: {
        adjustment: {
          family: 'HIT_POINTS',
          field: 'MAXIMUM_MODIFIER',
          value: 3
        },
        commandId: '00000000-0000-4000-8000-000000000309',
        expectedVersion: 1,
        type: 'UPSERT_SHEET_ADJUSTMENT'
      },
      liveSessionAuthority: {
        authorityId: 'room-authority',
        sessionId: '00000000-0000-4000-8000-000000000310'
      }
    })

    expect(mocks.evaluatePinnedRuleRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedFacts: expect.objectContaining({
          hitPointFacts: expect.objectContaining({
            manualMaximumModifier: expect.objectContaining({ value: 3 })
          })
        }),
        expected: expect.objectContaining({ revisionId: 'revision-1' })
      })
    )
    expect(mocks.commitMaximumHitPointPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        nextAdjustment: expect.objectContaining({ value: 3 }),
        nextBasePolicy: expect.objectContaining({
          rulePolicyInput: expect.objectContaining({
            hitPointFacts: expect.objectContaining({
              manualMaximumModifier: expect.objectContaining({ value: 3 })
            })
          })
        }),
        nextCampaignPolicy: expect.objectContaining({
          rulePolicyOutput: campaignPolicyOutput
        }),
        nextManualMaximumModifierOwner: 'CHARACTER'
      })
    )
    expect(mocks.publishMechanics).not.toHaveBeenCalled()
    expect(mocks.buildSheetBundle).not.toHaveBeenCalled()
    expect(mocks.assembleSheetBundleForRuleContext).not.toHaveBeenCalled()
    expect(execution).toMatchObject({
      characterVision: {
        characterId: character.id,
        dimRange: { amount: 30, unit: 'FEET' }
      },
      replayed: false,
      version: 2
    })
  })

  it('returns Campaign-effective vision for a compact maximum-hit-point replay', async () => {
    const character = createCharacter()
    const command = {
      adjustment: {
        family: 'HIT_POINTS' as const,
        field: 'MAXIMUM_MODIFIER' as const,
        value: 3
      },
      commandId: '00000000-0000-4000-8000-000000000313',
      expectedVersion: 1,
      type: 'UPSERT_SHEET_ADJUSTMENT' as const
    }
    mocks.lockMaximumHitPointContext.mockResolvedValue({
      campaignId: '00000000-0000-4000-8000-000000000311',
      character: {
        id: character.id,
        ruleRevisionId: 'revision-1',
        streamVersion: 2,
        userId: character.userId
      },
      existingAdjustment: null,
      hitPoints: { current: 10, temp: null },
      mechanics: {
        characterId: character.id,
        pinnedSenseDefinitions: [createPinnedVisionSense(60)],
        rulePolicyOutput: { senses: [sensePolicyFact(60)] }
      },
      overlay: {
        kind: 'MATERIALIZED',
        rulePolicyOutput: { senses: [sensePolicyFact(30)] }
      },
      priorEvent: {
        type: 'CHARACTER_SHEET_COMMAND_APPLIED',
        commandType: command.type,
        commandFingerprint: fingerprintSheetCommand(command),
        committedStreamVersion: 2
      }
    })

    await expect(
      executeCompactLiveMaximumHitPointModifierCommand({
        db: db as unknown as DBLike,
        campaignId: '00000000-0000-4000-8000-000000000311',
        characterId: character.id,
        userId: character.userId,
        command,
        liveSessionAuthority: {
          authorityId: 'room-authority',
          sessionId: '00000000-0000-4000-8000-000000000312'
        }
      })
    ).resolves.toEqual({
      characterVision: {
        characterId: character.id,
        dimRange: { amount: 30, unit: 'FEET' }
      },
      replayed: true,
      version: 2
    })
    expect(mocks.evaluatePinnedRuleRevision).not.toHaveBeenCalled()
    expect(mocks.commitMaximumHitPointPolicy).not.toHaveBeenCalled()
  })

  it('does not refresh a compact hit-point snapshot with a mismatched durable identity', async () => {
    const currentMechanics = {
      characterId: 'character-1',
      characterStreamVersion: 1,
      commandLaneChecksum: 'd'.repeat(64),
      commandState: createCharacter({
        state: {
          equipment: { inventory: [], equipped: [], attuned: [] },
          currency: [],
          hitpoints: { current: 10, hitDice: [] }
        }
      }),
      projectionChecksum: 'a'.repeat(64),
      rulePolicyOutput: {
        derivedStats: { maxHitPoints: { effective: 12 } },
        senses: []
      }
    } as unknown as CharacterMechanicsProjection
    const nextMechanics = {
      ...currentMechanics,
      characterStreamVersion: 2,
      projectionChecksum: 'b'.repeat(64)
    } as CharacterMechanicsProjection
    mocks.findMechanics.mockResolvedValue(currentMechanics)
    mocks.advanceMechanicsProjection.mockReturnValue(nextMechanics)
    mocks.patchLiveHitPoints.mockImplementation(async (_characterId, input) => {
      await input.afterPersist?.(db as unknown as DBLike, 2)
      return 2
    })

    const execution = await executeCompactLiveCharacterHitPointCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        amount: 1,
        commandId: '00000000-0000-4000-8000-000000000307',
        expectedVersion: 1,
        mode: 'HEAL',
        type: 'ADJUST_HIT_POINTS'
      },
      committedRuleSnapshot: {
        effectiveSceneVision: { characterId: 'character-1', dimRange: null },
        campaignMechanicalContextChecksum: null,
        campaignMechanicsProjectionChecksum: null,
        mechanicsCommandLaneChecksum: currentMechanics.commandLaneChecksum,
        mechanicsPayload: {} as CharacterSheetCommittedRuleSnapshot['mechanicsPayload'],
        mechanicsProjectionChecksum: 'f'.repeat(64),
        streamVersion: 1,
        evaluation: {
          binding: { revisionId: 'revision-1' },
          snapshot: { characterId: 'character-1' }
        } as unknown as CharacterRuleEvaluationResult,
        resolution: createResolution()
      },
      liveSessionAuthority: {
        authorityId: 'room-authority',
        sessionId: '00000000-0000-4000-8000-000000000308'
      }
    })

    expect(execution.ruleSnapshot).toBeUndefined()
    expect(mocks.findMechanics).toHaveBeenCalledWith(
      expect.objectContaining({ expectedStreamVersion: 1 })
    )
    expect(mocks.buildSheetBundle).not.toHaveBeenCalled()
  })
})
