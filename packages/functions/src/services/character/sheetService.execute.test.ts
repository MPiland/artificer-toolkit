import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  SCALING,
  SPELL_GRANT_ATTRIBUTE,
  dnd5e2014RulesSystem
} from '@artificer-toolkit/shared/core'
import {
  createCharacterResourceOwnerKey,
  toCharacterResourceOwnerKey,
  type CharacterResourceOwnerKey
} from '@artificer-toolkit/shared/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
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
    createCreatureRepository: () => ({
      findByIds: async () =>
        new Map(
          ((await mocks.findAllCreatures()) as CreatureAuthored[]).map((creature) => [
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

const { buildCharacterSheetResponse, executeCharacterSheetCommand, previewCharacterRest } =
  await import('./sheetService.js')

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

describe('executeCharacterSheetCommand', () => {
  beforeEach(() => {
    mocks.appendEvent.mockReset()
    mocks.findAllCreatures.mockReset()
    mocks.findAllCreatures.mockResolvedValue([])
    mocks.findAllVehicles.mockReset()
    mocks.findAllVehicles.mockResolvedValue([])
    mocks.findById.mockReset()
    mocks.findByCommandId.mockReset()
    mocks.findAuthoredById.mockReset()
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
    expect(response.sheet.overview.inspiration).toBe(false)
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
        requestRoll: true
      },
      random: { nextInt: () => 0 }
    })

    expect(preview).toMatchObject({
      canonicalExpression: '1d10 + 3',
      stagedHealing: 4,
      canApply: true,
      rollEvidence: {
        expression: '1d10 + 3',
        terms: [{ die: 10, count: 1, modifierPerDie: 3, rolls: [1] }],
        total: 4
      }
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
    expect(mocks.resolveCharacterBuilder).toHaveBeenCalledTimes(1)
  })

  it('rejects commands for characters owned by another user', async () => {
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
    mocks.findById.mockResolvedValue({ id: 'character-1', stream_version: 2 })
    mocks.findByCommandId.mockResolvedValue(persistedEvent)

    const response = await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command
    })

    expect(response.streamVersion).toBe(2)
    expect(response.historyEntry?.eventId).toBe(persistedEvent.eventId)
    expect(mocks.patchSheetState).toHaveBeenCalledTimes(1)
    expect(mocks.appendEvent).toHaveBeenCalledTimes(1)
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
      .mockResolvedValueOnce({ id: 'character-1', stream_version: 1 })
      .mockResolvedValue({ id: 'character-1', stream_version: 2 })
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
    mocks.findById.mockResolvedValue({ id: 'character-1', stream_version: 2 })
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
    mocks.findById.mockResolvedValue({
      id: 'character-1',
      stream_version: 2
    })

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

  it('hydrates inactive attached extras without offering them as add sources', async () => {
    const character = createCharacter()
    character.state.creatures = [
      {
        id: '00000000-0000-4000-8000-000000000112',
        creatureId: 'creature-1',
        relationshipKind: 'COMPANION',
        originKind: 'WORLD',
        isActive: true,
        currentHitPoints: 3
      }
    ]
    character.state.vehicles = [
      {
        id: '00000000-0000-4000-8000-000000000113',
        vehicleId: 'vehicle-1',
        isActive: true,
        currentHitPoints: 8
      }
    ]
    mocks.findAllCreatures.mockResolvedValue([createCreature({ status: 'DRAFT' })])
    mocks.findAllVehicles.mockResolvedValue([
      {
        id: 'vehicle-1',
        label: 'Cart',
        userId: 'user-1',
        systemId: 'system-1',
        status: 'DRAFT',
        category: 'LAND',
        features: [],
        hitPoints: 8
      }
    ])

    const sheet = await buildCharacterSheetResponse({
      db: db as unknown as DBLike,
      character,
      resolution: createResolution(),
      streamVersion: 1
    })
    expect(sheet.extras.items).toHaveLength(2)
    expect(sheet.extras.creatureOptions).toEqual([])
    expect(sheet.extras.vehicleOptions).toEqual([])
  })

  it('projects one non-walking creature speed and falls back to walking', async () => {
    const character = createCharacter()
    character.state.creatures = [
      {
        id: '00000000-0000-4000-8000-000000000114',
        creatureId: 'creature-1',
        relationshipKind: 'COMPANION',
        originKind: 'WORLD',
        isActive: true,
        currentHitPoints: 3
      }
    ]
    mocks.findAllCreatures.mockResolvedValue([
      createCreature({
        speeds: [
          { speedId: 'speed-walk', amount: 5, unit: 'FEET' },
          { speedId: 'speed-fly', amount: 60, unit: 'FEET' },
          { speedId: 'speed-climb', amount: 30, unit: 'FEET' }
        ]
      })
    ])

    const sheet = await buildCharacterSheetResponse({
      db: db as unknown as DBLike,
      character,
      resolution: createResolution(),
      streamVersion: 1
    })
    expect(sheet.extras.items[0]?.speedLabel).toBe('Flying 60 feet')
    expect(sheet.extras.creatureOptions[0]?.speedLabel).toBe('Flying 60 feet')

    mocks.findAllCreatures.mockResolvedValue([
      createCreature({
        speeds: [{ speedId: 'speed-walk', amount: 5, unit: 'FEET' }]
      })
    ])
    const walkingSheet = await buildCharacterSheetResponse({
      db: db as unknown as DBLike,
      character,
      resolution: createResolution(),
      streamVersion: 1
    })
    expect(walkingSheet.extras.items[0]?.speedLabel).toBe('5 feet')
    expect(walkingSheet.extras.creatureOptions[0]?.speedLabel).toBe('5 feet')
  })

  it('projects every companion override into the effective sheet values', async () => {
    const character = createCharacter()
    character.state.creatures = [
      {
        id: '00000000-0000-4000-8000-000000000114',
        creatureId: 'creature-1',
        relationshipKind: 'COMPANION',
        originKind: 'WORLD',
        isActive: true,
        currentHitPoints: 9
      }
    ]
    mocks.findAllCreatures.mockResolvedValue([createCreature()])
    const metadata = {
      characterId: 'character-1',
      createdBy: 'user-1',
      updatedBy: 'user-1',
      createdAt: '2026-07-27T00:00:00.000Z',
      updatedAt: '2026-07-27T00:00:00.000Z'
    }
    const sheet = await buildCharacterSheetResponse({
      db: db as unknown as DBLike,
      character,
      resolution: createResolution(),
      streamVersion: 1,
      adjustments: [
        {
          ...metadata,
          id: '00000000-0000-4000-8000-000000000115',
          family: 'COMPANION',
          companionInstanceId: '00000000-0000-4000-8000-000000000114',
          field: 'ARMOR_CLASS_OVERRIDE',
          value: 16
        },
        {
          ...metadata,
          id: '00000000-0000-4000-8000-000000000116',
          family: 'COMPANION',
          companionInstanceId: '00000000-0000-4000-8000-000000000114',
          field: 'MAXIMUM_HIT_POINTS_OVERRIDE',
          value: 5
        },
        {
          ...metadata,
          id: '00000000-0000-4000-8000-000000000117',
          family: 'COMPANION',
          companionInstanceId: '00000000-0000-4000-8000-000000000114',
          field: 'SIZE_OVERRIDE',
          value: 'TINY'
        },
        {
          ...metadata,
          id: '00000000-0000-4000-8000-000000000118',
          family: 'COMPANION',
          companionInstanceId: '00000000-0000-4000-8000-000000000114',
          field: 'ALIGNMENT_OVERRIDE',
          value: '00000000-0000-4000-8000-000000000119'
        },
        {
          ...metadata,
          id: '00000000-0000-4000-8000-000000000120',
          family: 'COMPANION',
          companionInstanceId: '00000000-0000-4000-8000-000000000114',
          field: 'CREATURE_TYPE_OVERRIDE',
          value: '00000000-0000-4000-8000-000000000121'
        }
      ]
    })
    expect(sheet.extras.items).toContainEqual(
      expect.objectContaining({
        armorClass: 16,
        size: 'TINY',
        alignmentId: '00000000-0000-4000-8000-000000000119',
        creatureTypeId: '00000000-0000-4000-8000-000000000121',
        hitPoints: expect.objectContaining({ current: 5, maximum: 5 })
      })
    )
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
              amount: 2
            }
          }
        ]
      })
    ])
    const owner = {
      kind: 'COMPANION_FEATURE' as const,
      companionInstanceId,
      featureId,
      chargeId
    }
    let usage: Array<{ id: string; owner: typeof owner; used: number }> = []
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

    mocks.findById.mockResolvedValue({ id: 'character-1', stream_version: 2 })
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
    mocks.findById.mockResolvedValue({ id: 'character-1', stream_version: 3 })
    const legacyUsed = await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'USE_RESOURCE',
        expectedVersion: 3,
        commandId: '00000000-0000-4000-8000-000000000112',
        resourceGrantId,
        amount: 2
      }
    })
    expect(mocks.setResourceUsage).toHaveBeenLastCalledWith(
      expect.objectContaining({ owner: toCharacterResourceOwnerKey(owner), used: 2 })
    )
    expect(legacyUsed.sheet.resources.items).toContainEqual(
      expect.objectContaining({ owner, used: 2 })
    )

    mocks.findById.mockResolvedValue({ id: 'character-1', stream_version: 4 })
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
      expect.objectContaining({ owner: toCharacterResourceOwnerKey(owner), used: 1 })
    )
    expect(legacyRecovered.sheet.resources.items).toContainEqual(
      expect.objectContaining({ owner, used: 1 })
    )
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
    mocks.findAllCreatures.mockResolvedValue([
      createCreature({
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
    ])
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
})
