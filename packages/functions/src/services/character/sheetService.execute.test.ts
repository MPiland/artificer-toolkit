import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderResolution } from './builderService.js'

const mocks = vi.hoisted(() => ({
  appendEvent: vi.fn(),
  findById: vi.fn(),
  findAuthoredById: vi.fn(),
  resolveCharacterBuilder: vi.fn(),
  upsertAuthored: vi.fn()
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
      append: mocks.appendEvent
    }),
    createCharacterRepository: () => ({
      findById: mocks.findById,
      findAuthoredById: mocks.findAuthoredById,
      upsertAuthored: mocks.upsertAuthored
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

const db = {
  selectFrom: () => ({
    select: () => ({
      where: () => ({
        orderBy: () => ({
          execute: async () => [{ id: 'condition-1', label: 'Poisoned' }]
        })
      })
    })
  })
}

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
        levels: [{ level: 1, value: 10 }]
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
    registry: {
      system: {
        currencies: [{ id: 'currency-1', label: 'Gold' }]
      } as CharacterBuilderResolution['registry']['system'],
      races: [],
      classes: [],
      backgrounds: [],
      equipment: [],
      spells: [],
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
    mocks.findAuthoredById.mockReset()
    mocks.resolveCharacterBuilder.mockReset()
    mocks.upsertAuthored.mockReset()
    mocks.findById.mockResolvedValue({
      id: 'character-1',
      stream_version: 1
    })
    mocks.findAuthoredById.mockResolvedValue(createCharacter())
    mocks.resolveCharacterBuilder.mockResolvedValue(createResolution())
    mocks.upsertAuthored.mockImplementation(async (_character, options) => {
      await options.afterPersist?.(db, 2)
      return 2
    })
  })

  it('persists sheet commands with expected version and appends history in the same write callback', async () => {
    const { executeCharacterSheetCommand } = await import('./sheetService.js')

    const response = await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 3,
        expectedVersion: 1,
        commandId: 'command-1'
      }
    })

    expect(mocks.upsertAuthored).toHaveBeenCalledWith(expect.objectContaining({
      id: 'character-1',
      state: expect.objectContaining({
        hitpoints: expect.objectContaining({ current: 7 })
      })
    }), expect.objectContaining({
      expectedStreamVersion: 1,
      incrementStreamVersion: true,
      afterPersist: expect.any(Function)
    }))
    expect(mocks.appendEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'CHARACTER_SHEET_COMMAND_APPLIED',
      characterId: 'character-1',
      actorId: 'user-1',
      commandId: 'command-1',
      commandType: 'ADJUST_HIT_POINTS',
      summary: '3 damage applied'
    }))
    expect(response.streamVersion).toBe(2)
    expect(response.historyEntry).toMatchObject({
      eventType: 'CHARACTER_SHEET_COMMAND_APPLIED',
      summary: '3 damage applied'
    })
  })

  it('rejects commands for characters owned by another user', async () => {
    mocks.findAuthoredById.mockResolvedValue(createCharacter({ userId: 'other-user' }))
    const { executeCharacterSheetCommand } = await import('./sheetService.js')

    await expect(executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 1,
        expectedVersion: 1
      }
    })).rejects.toMatchObject({ name: 'AuthoredContentOwnershipError' })
    expect(mocks.upsertAuthored).not.toHaveBeenCalled()
  })

  it('rejects stale expected versions before writing state or history', async () => {
    mocks.findById.mockResolvedValue({
      id: 'character-1',
      stream_version: 2
    })
    const { executeCharacterSheetCommand } = await import('./sheetService.js')

    await expect(executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 1,
        expectedVersion: 1
      }
    })).rejects.toMatchObject({ name: 'ConcurrencyError' })
    expect(mocks.upsertAuthored).not.toHaveBeenCalled()
    expect(mocks.appendEvent).not.toHaveBeenCalled()
  })

  it('rejects sheet commands against unfinalized draft characters', async () => {
    mocks.findAuthoredById.mockResolvedValue(createCharacter({ status: 'DRAFT' }))
    const { executeCharacterSheetCommand } = await import('./sheetService.js')

    await expect(executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 1,
        expectedVersion: 1
      }
    })).rejects.toMatchObject({ name: 'CharacterSheetCommandError' })
    expect(mocks.upsertAuthored).not.toHaveBeenCalled()
  })
})
