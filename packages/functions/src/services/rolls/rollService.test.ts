import { beforeEach, describe, expect, it, vi } from 'vitest'

const rollRepository = vi.hoisted(() => ({
  clearForUser: vi.fn(async () => undefined),
  discardForUser: vi.fn(async () => undefined),
  findCharacterContext: vi.fn(),
  insertAndTrim: vi.fn(async (_userId: string, record: unknown) => record),
  listForUser: vi.fn(async () => [])
}))
const characterSheetService = vi.hoisted(() => ({ getCharacterSheetForUser: vi.fn() }))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createRollHistoryRepository: () => rollRepository
}))
vi.mock('../character/characterApplicationService.js', () => characterSheetService)

import type { DBLike } from '@artificer-toolkit/db'
import {
  clearRollHistoryForUser,
  discardRollForUser,
  executeDiceConfiguration,
  executeRollForUser,
  getRollHistoryForUser,
  RollCharacterAccessError
} from './rollService.js'

describe('roll service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rollRepository.findCharacterContext.mockResolvedValue({
      characterId: 'character-1',
      characterLabel: 'Morgan',
      systemId: 'system-1',
      rulesetCode: 'DND_5E',
      rulesetVersion: '2014'
    })
    characterSheetService.getCharacterSheetForUser.mockResolvedValue({
      overview: {
        abilities: [],
        savingThrows: [],
        skills: [],
        initiative: 2,
        initiativeRollMode: 'NORMAL',
        hitDice: []
      },
      actions: {
        items: [
          {
            id: 'shortsword',
            label: 'Shortsword',
            kind: 'ATTACK',
            rollable: true,
            mechanic: {
              effectId: 'shortsword-effect',
              trigger: 'MELEE_WEAPON_ATTACK',
              attackBonus: 2,
              attackRollMode: 'ADVANTAGE',
              outcomes: [
                {
                  kind: 'DAMAGE',
                  pathCode: 'HIT',
                  expression: '2d6 + 3',
                  damageTypeId: 'slashing',
                  damageTypeLabel: 'Slashing'
                }
              ]
            }
          }
        ]
      },
      spells: { attackBonus: null, activeGroups: [] }
    })
  })

  it('executes a standalone dice configuration without character persistence', () => {
    const values = [0, 4, 1, 5, 3]
    const result = executeDiceConfiguration(
      { configuration: '4d6dl1r1' },
      {
        createId: () => 'ability-roll-1',
        random: { nextInt: () => values.shift() ?? 0 }
      }
    )

    expect(result).toMatchObject({
      id: 'ability-roll-1',
      normalizedExpression: '4d6dl1r1',
      evidence: {
        terms: [
          {
            rolls: [4, 5, 2, 6],
            rollSequences: [[1, 4], [5], [2], [6]],
            keptRollIndexes: [0, 1, 3]
          }
        ],
        total: 15
      }
    })
    expect(rollRepository.insertAndTrim).not.toHaveBeenCalled()
  })

  it('authorizes, evaluates with injected randomness, and persists the exact record', async () => {
    const result = await executeRollForUser(
      {} as DBLike,
      {
        characterId: 'character-1',
        expression: '2d6 + 3 + 1d4 + 1',
        source: { kind: 'MANUAL', label: 'Manual roll' }
      },
      'user-1',
      {
        random: { nextInt: (max: number) => max - 1 },
        createId: () => 'roll-1',
        now: () => '2026-07-30T23:45:00.000Z'
      }
    )

    expect(result).toMatchObject({
      id: 'roll-1',
      characterId: 'character-1',
      characterLabel: 'Morgan',
      ruleset: { systemId: 'system-1', code: 'DND_5E', version: '2014' },
      normalizedExpression: '2d6 + 3 + 1d4 + 1',
      evidence: {
        terms: [{ modifier: 3 }, { modifier: 1 }],
        modifier: 4,
        subtotal: 20,
        total: 20
      }
    })
    expect(rollRepository.findCharacterContext).toHaveBeenCalledWith('character-1', 'user-1')
    expect(rollRepository.insertAndTrim).toHaveBeenCalledWith('user-1', result)
  })

  it('does not roll or persist an unauthorized character', async () => {
    rollRepository.findCharacterContext.mockResolvedValue(null)
    const random = vi.fn()

    await expect(
      executeRollForUser(
        {} as DBLike,
        {
          characterId: 'character-2',
          expression: '1d20',
          source: { kind: 'MANUAL', label: 'Manual roll' }
        },
        'user-1',
        { random: { nextInt: random } }
      )
    ).rejects.toBeInstanceOf(RollCharacterAccessError)
    expect(random).not.toHaveBeenCalled()
    expect(rollRepository.insertAndTrim).not.toHaveBeenCalled()
  })

  it('persists both d20 results and the kept advantage result', async () => {
    const values = [4, 17]
    const result = await executeRollForUser(
      {} as DBLike,
      {
        characterId: 'character-1',
        expression: '1d20 + 2',
        rollMode: 'ADVANTAGE',
        source: { kind: 'ATTACK', label: 'Shortsword attack' }
      },
      'user-1',
      { random: { nextInt: () => values.shift() ?? 0 } }
    )

    expect(result.evidence).toMatchObject({
      mode: 'ADVANTAGE',
      terms: [{ rolls: [5, 18], keptRollIndex: 1, subtotal: 18 }],
      total: 20
    })
  })

  it('rejects structured expressions that are not projected by the current sheet', async () => {
    await expect(
      executeRollForUser(
        {} as DBLike,
        {
          characterId: 'character-1',
          expression: '20d20 + 999',
          source: { kind: 'DAMAGE', label: 'Shortsword damage' }
        },
        'user-1'
      )
    ).rejects.toThrow('not available on the current character sheet')
    expect(rollRepository.insertAndTrim).not.toHaveBeenCalled()
  })

  it('returns account-wide history', async () => {
    await expect(getRollHistoryForUser({} as DBLike, 'user-1')).resolves.toEqual([])
    expect(rollRepository.listForUser).toHaveBeenCalledWith('user-1')
  })

  it('discards only the current account pending roll', async () => {
    await expect(discardRollForUser({} as DBLike, 'roll-1', 'user-1')).resolves.toEqual({
      ok: true
    })
    expect(rollRepository.discardForUser).toHaveBeenCalledWith('roll-1', 'user-1')
  })

  it('clears only the current account history', async () => {
    await expect(clearRollHistoryForUser({} as DBLike, 'user-1')).resolves.toEqual({ ok: true })
    expect(rollRepository.clearForUser).toHaveBeenCalledWith('user-1')
  })
})
