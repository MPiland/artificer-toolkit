import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import { dnd5e2014RulesSystem } from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderResolution } from './builderService.js'

const mocks = vi.hoisted(() => ({
  appendEvent: vi.fn(),
  findAllCreatures: vi.fn(),
  findAllVehicles: vi.fn(),
  findByCommandId: vi.fn(),
  findById: vi.fn(),
  findAuthoredById: vi.fn(),
  getMovementPreference: vi.fn(),
  listAdjustments: vi.fn(),
  listResourceUsage: vi.fn(),
  listSpellCustomizations: vi.fn(),
  patchSheetState: vi.fn(),
  removeAdjustment: vi.fn(),
  consumeRollForUser: vi.fn(),
  findRollByIdForUser: vi.fn(),
  resolveCharacterBuilder: vi.fn(),
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
    getCharacterSheetExtraCatalogQuery: async () => ({
      creatures: await mocks.findAllCreatures(),
      vehicles: await mocks.findAllVehicles()
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
    resolveCharacterBuilder: mocks.resolveCharacterBuilder
  }
})

const { executeCharacterSheetCommand } = await import('./sheetService.js')
const { previewCharacterRest } = await import('./sheetRestService.js')

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

describe('character sheet rest policy', () => {
  beforeEach(() => {
    mocks.appendEvent.mockReset()
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
    mocks.setMovementPreference.mockReset()
    mocks.setResourceUsage.mockReset()
    mocks.setSpellCustomization.mockReset()
    mocks.patchSheetState.mockReset()
    mocks.findById.mockResolvedValue({
      id: 'character-1',
      stream_version: 1
    })
    mocks.findByCommandId.mockResolvedValue(null)
    mocks.findAuthoredById.mockResolvedValue(createCharacter())
    mocks.resolveCharacterBuilder.mockResolvedValue(createResolution())
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
    const resolution = createResolution()
    resolution.summary.abilities.CONSTITUTION = 16
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

    const changedPolicy = vi
      .spyOn(dnd5e2014RulesSystem.rest, 'hitDiceRecoveredAfterLongRest')
      .mockReturnValue(0)
    try {
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
    } finally {
      changedPolicy.mockRestore()
    }
  })
})
