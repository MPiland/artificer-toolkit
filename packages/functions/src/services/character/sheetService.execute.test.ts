import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderResolution } from './builderService.js'

const mocks = vi.hoisted(() => ({
  appendEvent: vi.fn(),
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
        currencies: [{ id: 'currency-1', label: 'Gold' }]
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

describe('executeCharacterSheetCommand', () => {
  beforeEach(() => {
    mocks.appendEvent.mockReset()
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
})
