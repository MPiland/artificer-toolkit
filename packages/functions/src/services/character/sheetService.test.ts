import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  SCALING,
  SPELL_GRANT_ATTRIBUTE
} from '@artificer-toolkit/shared/core'
import {
  createCharacterResourceOwnerKey,
  toCharacterResourceOwnerKey,
  type CharacterResourceOwnerKey
} from '@artificer-toolkit/shared/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderResolution } from './builderService.js'
import type { CharacterRuleEvaluationResult } from './characterRuleEvaluation.js'
import type { CharacterSheetRuleContext } from './characterSheetBundleAssembly.js'
import type { CharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { CharacterSheetCommittedRuleSnapshot } from './sheetService.js'

const mocks = vi.hoisted(() => ({
  appendEvent: vi.fn(),
  advanceMechanicsProjection: vi.fn(),
  assembleSheetBundleForRuleContext: vi.fn(),
  compileMechanicsProjection: vi.fn(),
  createCommittedExtras: vi.fn(),
  createCommittedResolution: vi.fn(),
  createCommittedSpells: vi.fn(),
  extendCommittedSources: vi.fn(),
  pruneCommittedSources: vi.fn(),
  assertCommandAuthority: vi.fn(),
  findAllCreatures: vi.fn(),
  findAllVehicles: vi.fn(),
  findByCommandId: vi.fn(),
  findById: vi.fn(),
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
  findRollByIdForUser: vi.fn(),
  loadCharacterBuilderContext: vi.fn(),
  resolveCharacterBuilder: vi.fn(),
  resolveCampaignContext: vi.fn(),
  resolveActiveCharacterEquipment: vi.fn(),
  loadActiveCreatures: vi.fn(),
  loadActiveVehicles: vi.fn(),
  loadCommittedSources: vi.fn(),
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
    createCharacterEventRepository: () => ({
      append: mocks.appendEvent,
      findByCommandId: mocks.findByCommandId
    }),
    createCharacterRepository: () => ({
      findById: mocks.findById,
      findAuthoredById: mocks.findAuthoredById,
      patchLiveHitPoints: mocks.patchLiveHitPoints,
      patchSheetState: mocks.patchSheetState,
      setRulePackRevision: mocks.setRulePackRevision
    }),
    createCharacterMechanicsProjectionRepository: () => ({
      publish: mocks.publishMechanics,
      requireCurrent: mocks.findMechanics,
      requireCurrentMetadata: mocks.findMechanicsMetadata
    }),
    createCampaignCharacterMechanicsProjectionRepository: () => ({
      publish: mocks.publishCampaignMechanics,
      requireCurrent: mocks.findCampaignMechanics,
      requireCurrentMetadata: mocks.findCampaignMechanicsMetadata
    }),
    createCampaignContentRepository: () => ({
      findAssignedCampaign: async () => null
    }),
    createRollHistoryRepository: () => ({
      consumeForUser: mocks.consumeRollForUser,
      findAvailableByIdForUser: mocks.findRollByIdForUser
    }),
    createCreatureRepository: () => ({
      findById: async (id: string) =>
        ((await mocks.findAllCreatures()) as CreatureAuthored[]).find((creature) => creature.id === id) ??
        null,
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
        ((await mocks.findAllVehicles()) as Array<{ id: string }>).find((vehicle) => vehicle.id === id) ??
        null,
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

vi.mock('./characterAssemblyOrchestrator.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./characterAssemblyOrchestrator.js')>()
  return { ...actual, resolveActiveCharacterEquipment: mocks.resolveActiveCharacterEquipment }
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
  pruneCharacterCommittedSheetSourcesRoots: mocks.pruneCommittedSources
}))

vi.mock('./characterMechanicsCompiler.js', () => ({
  advanceCharacterMechanicsProjectionCommandState: mocks.advanceMechanicsProjection,
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
  return { ...actual, resolveCharacterSheetCampaignContext: mocks.resolveCampaignContext }
})

vi.mock('./characterActionEvaluation.js', () => ({
  evaluateCharacterActionStateChange: mocks.evaluateActionStateChange
}))

vi.mock('../campaign/liveSessionCommandAuthority.js', () => ({
  assertCharacterLiveSessionCommandAuthority: mocks.assertCommandAuthority
}))

vi.mock('./characterRuleEvaluation.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./characterRuleEvaluation.js')>()
  const { evaluateCharacterBuilderTestPolicy } =
    await import('./characterBuilderRuleEvaluation.testUtils.js')
  return { ...original, evaluateCharacterRulePolicy: evaluateCharacterBuilderTestPolicy }
})

const {
  executeCharacterSheetCommand,
  executeCharacterSheetCommandWithRuleEvaluation,
  executeCompactLiveCharacterHitPointCommand
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
    system_id: 'system-1',
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
      systemId: 'system-1',
      classes: [{ classId: 'class-1' }],
      features: [],
      equipmentItems: []
    },
    rulePolicyInput: evaluation.facts,
    rulePolicyOutput: evaluation.output,
    ruleRegistry: {}
  }
}

function createCreature(overrides: Partial<CreatureAuthored> = {}): CreatureAuthored {
  return {
    id: 'creature-1',
    label: 'Owl',
    userId: 'user-1',
    systemId: 'system-1',
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

describe('executeCharacterSheetCommand persistence', () => {
  beforeEach(() => {
    mocks.assertCommandAuthority.mockResolvedValue(undefined)
    mocks.appendEvent.mockReset()
    mocks.assembleSheetBundleForRuleContext.mockReset()
    mocks.findAllCreatures.mockReset()
    mocks.findAllCreatures.mockResolvedValue([])
    mocks.findAllVehicles.mockReset()
    mocks.findAllVehicles.mockResolvedValue([])
    mocks.findById.mockReset()
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
    mocks.buildSheetBundle.mockReset()
    mocks.setMovementPreference.mockReset()
    mocks.setRulePackRevision.mockReset()
    mocks.setRulePackRevision.mockResolvedValue(true)
    mocks.setResourceUsage.mockReset()
    mocks.setSpellCustomization.mockReset()
    mocks.patchSheetState.mockReset()
    mocks.patchLiveHitPoints.mockReset()
    mocks.publishMechanics.mockReset()
    mocks.compileMechanicsProjection.mockReset()
    mocks.advanceMechanicsProjection.mockReset()
    mocks.createCommittedExtras.mockReset()
    mocks.createCommittedResolution.mockReset()
    mocks.createCommittedSpells.mockReset()
    mocks.extendCommittedSources.mockReset()
    mocks.pruneCommittedSources.mockReset()
    mocks.loadCommittedSources.mockReset()
    mocks.findById.mockResolvedValue({
      id: 'character-1',
      status: 'ACTIVE',
      system_id: 'system-1',
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
      rulePolicyInput: {},
      rulePolicyOutput: {},
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
      vocabularySnapshot: { snapshotId: 'snapshot-1' }
    })
    mocks.createCommittedResolution.mockReturnValue(resolution)
    mocks.createCommittedExtras.mockReturnValue({
      creaturesById: new Map(),
      vehiclesById: new Map()
    })
    mocks.createCommittedSpells.mockReturnValue(new Map())
    mocks.extendCommittedSources.mockImplementation(
      async (params: { sources: unknown }) => params.sources
    )
    mocks.pruneCommittedSources.mockImplementation((params: { sources: unknown }) => params.sources)
    mocks.compileMechanicsProjection.mockReturnValue({})
    mocks.publishMechanics.mockResolvedValue(undefined)
    mocks.loadCharacterBuilderContext.mockResolvedValue({
      catalog: resolution.catalog,
      registry: resolution.sourceRegistry
    })
    mocks.resolveCharacterBuilder.mockResolvedValue(resolution)
    mocks.resolveActiveCharacterEquipment.mockResolvedValue([])
    mocks.loadActiveCreatures.mockImplementation(async ({
      creatureIds
    }: {
      creatureIds: readonly string[]
    }) => {
      const creatures = (await mocks.findAllCreatures()) as CreatureAuthored[]
      return new Map(
        creatures
          .filter((creature) => creatureIds.includes(creature.id))
          .map((creature) => [creature.id, creature])
      )
    })
    mocks.loadActiveVehicles.mockImplementation(async ({
      vehicleIds
    }: {
      vehicleIds: readonly string[]
    }) => {
      const vehicles = (await mocks.findAllVehicles()) as Array<{ id: string }>
      return new Map(
        vehicles
          .filter((vehicle) => vehicleIds.includes(vehicle.id))
          .map((vehicle) => [vehicle.id, vehicle])
      )
    })
    mocks.buildSheetBundle.mockImplementation(buildPolicyTestSheetBundle)
    mocks.assembleSheetBundleForRuleContext.mockImplementation(async (params: {
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
        mechanics: { projectionChecksum: 'b'.repeat(64) },
        campaignMechanics: null,
        resolution,
        characterAdjustments: await mocks.listAdjustments(params.character.id),
        movementDisplayPreference: await mocks.getMovementPreference(params.character.id)
      }
    })
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
                binding: { ...bundle.ruleEvaluation.binding, modelContractVersion: 4 }
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
    expect(mocks.buildSheetBundle.mock.calls[1]?.[0]).not.toHaveProperty(
      'committedRuleEvaluation'
    )
    expect(mocks.buildSheetBundle).toHaveBeenCalled()
    expect(mocks.compileMechanicsProjection).toHaveBeenCalledWith(
      expect.objectContaining({ characterStreamVersion: 2 })
    )
    expect(mocks.publishMechanics).toHaveBeenCalledWith({}, { requireActiveAuthoredVersions: false })
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
    expect(mocks.publishMechanics).toHaveBeenCalledWith({}, { requireActiveAuthoredVersions: false })
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
    mocks.findMechanics.mockResolvedValue({ ...mechanics, commandState: character })
    mocks.findMechanicsMetadata.mockClear()
    mocks.loadCharacterBuilderContext.mockClear()
    mocks.resolveCharacterBuilder.mockClear()

    const result = await executeCharacterSheetCommandWithRuleEvaluation({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      committedRuleSnapshot: {
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
      context: { catalog: resolution.catalog, registry: resolution.sourceRegistry },
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
    expect(timing).toMatchObject({ committedSnapshotCacheHit: true })
  })

  it('falls back to the full projection read when live-room metadata is stale', async () => {
    const character = createCharacter()
    const resolution = createResolution()
    const evaluation = await evaluateCharacterBuilderTestPolicy({
      db: db as unknown as DBLike,
      character,
      context: { catalog: resolution.catalog, registry: resolution.sourceRegistry },
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
      createCharacterRow({ rule_pack_revision_id: '00000000-0000-4000-8000-000000000201' })
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
    expect(mocks.publishMechanics).toHaveBeenCalledWith({}, { requireActiveAuthoredVersions: false })
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
      { id: '00000000-0000-4000-8000-000000000010', code: 'WALKING', label: 'Walking' }
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
      vocabularySnapshot: { snapshotId: 'snapshot-1' }
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
    mocks.extendCommittedSources.mockResolvedValue(extendedSources)
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
        extra: { kind: 'COMPANION', creatureId: creature.id, originKind: 'WORLD' }
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
    expect(mocks.publishMechanics).toHaveBeenCalledWith({}, { requireActiveAuthoredVersions: false })
  })

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
        { id: '00000000-0000-4000-8000-000000000022', label: 'Neutral', code: 'NEUTRAL' }
      ],
      creatureTypes: [{ id: '00000000-0000-4000-8000-000000000021', label: 'Beast', code: 'BEAST' }]
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
      expect.objectContaining({ family: 'COMPANION', field: 'SIZE_OVERRIDE', value: 'TINY' })
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
    let usage: Array<{ id: string; owner: CharacterResourceOwnerKey; used: number }> = []
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
      expect.objectContaining({ changedPoolId: createCharacterResourceOwnerKey(owner) })
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
      expect.objectContaining({ owner: toCharacterResourceOwnerKey(owner), used: 3 })
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
      expect.objectContaining({ owner: toCharacterResourceOwnerKey(owner), used: 2 })
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
      expect.objectContaining({ owner: toCharacterResourceOwnerKey(owner), used: 6 })
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
      expect.objectContaining({ owner: toCharacterResourceOwnerKey(owner), used: 6 })
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
      expect.objectContaining({ owner: toCharacterResourceOwnerKey(owner), used: 3 })
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
      expect.objectContaining({ owner: toCharacterResourceOwnerKey(owner), used: 1 })
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
        systemId: 'system-1',
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
    let usage: Array<{ id: string; owner: CharacterResourceOwnerKey; used: number }> = []
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
      expect.objectContaining({ changedPoolId: createCharacterResourceOwnerKey(owner) })
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
    expect(mocks.publishMechanics).toHaveBeenCalledWith({}, { requireActiveAuthoredVersions: false })
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
    character.state.creatureEquipment = { [companionInstanceId]: [{ equipmentItemId: 'item-1' }] }
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
      projectionChecksum: 'c'.repeat(64),
      rulePolicyOutput: { senses: [] }
    } as unknown as CharacterMechanicsProjection
    mocks.findById.mockResolvedValue(createCharacterRow({ stream_version: 2 }))
    mocks.findMechanics.mockResolvedValue(replayMechanics)
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
      characterVision: { characterId: 'character-1', dimRange: null },
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
      rulePolicyOutput: {
        derivedStats: { maxHitPoints: { effective: 12 } },
        senses: []
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
    mocks.findByCommandId
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
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
      characterVision: { characterId: 'character-1', dimRange: null },
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
        ruleRegistry: currentMechanics.ruleRegistry
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
      expect.objectContaining({ characterStreamVersion: 2, current: currentMechanics })
    )
    expect(mocks.publishMechanics).toHaveBeenCalledWith(nextMechanics, {
      requireActiveAuthoredVersions: false
    })
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
      ruleRegistry: nextMechanics.ruleRegistry
    })
    expect(execution.ruleSnapshot?.campaignMechanicsProjectionChecksum).toBe(
      mocks.publishCampaignMechanics.mock.calls[0]?.[0].projection.projectionChecksum
    )
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
      rulePolicyOutput: { derivedStats: { maxHitPoints: { effective: 12 } }, senses: [] }
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
