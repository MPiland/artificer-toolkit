import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedTrpcContext, TrpcContext } from './dbContext.js'
import { authenticatedContext } from './routerTestFixtures.js'

const executeRollForUser = vi.hoisted(() =>
  vi.fn(async (_db, input: { characterId: string; source: object }) => ({
    id: 'roll-1',
    characterId: input.characterId,
    characterLabel: 'Morgan',
    source: input.source,
    ruleset: { systemId: 'system-1', code: 'DND_5E', version: '2014' },
    normalizedExpression: '1d20 + 4',
    evidence: {
      terms: [{ count: 1, die: 20, rolls: [17], subtotal: 17 }],
      modifier: 4,
      mode: 'NORMAL',
      subtotal: 21,
      transform: { kind: 'NONE' },
      total: 21
    },
    createdAt: '2026-07-30T23:45:00.000Z'
  }))
)
const executeDiceConfiguration = vi.hoisted(() =>
  vi.fn(() => ({
    id: 'ability-roll-1',
    normalizedExpression: '4d6dl1r1',
    evidence: {
      terms: [
        {
          count: 4,
          die: 6,
          rolls: [4, 5, 2, 6],
          rollSequences: [[1, 4], [5], [2], [6]],
          subtotal: 15,
          keptRollIndexes: [0, 1, 3]
        }
      ],
      modifier: 0,
      mode: 'NORMAL',
      subtotal: 15,
      transform: { kind: 'NONE' },
      total: 15
    }
  }))
)
const getRollHistoryForUser = vi.hoisted(() => vi.fn(async () => []))
const clearRollHistoryForUser = vi.hoisted(() => vi.fn(async () => ({ ok: true as const })))
const discardRollForUser = vi.hoisted(() => vi.fn(async () => ({ ok: true as const })))

vi.mock('@artificer-toolkit/functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/functions')>()),
  clearRollHistoryForUser,
  discardRollForUser,
  executeDiceConfiguration,
  executeRollForUser,
  getRollHistoryForUser
}))

const withDb = vi.hoisted(() => vi.fn())
const withAuthenticatedDb = vi.hoisted(() => vi.fn())

vi.mock('./dbContext.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dbContext.js')>()

  withDb.mockImplementation(
    async <TResult>(
      _context: TrpcContext,
      callback: (db: DBLike) => Promise<TResult>
    ): Promise<TResult> => callback({} as DBLike)
  )
  withAuthenticatedDb.mockImplementation(
    async <TResult>(
      context: TrpcContext,
      callback: (db: DBLike, userId: string, auth: AuthenticatedTrpcContext) => Promise<TResult>
    ): Promise<TResult> => {
      const userId = actual.requireUserId(context)
      try {
        return await callback({} as DBLike, userId, {
          isSuperAdmin: context.isSuperAdmin === true,
          userId
        })
      } catch (error) {
        throw actual.toTrpcError(error)
      }
    }
  )

  return {
    ...actual,
    withDb,
    withAuthenticatedDb
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

import { appRouter } from './router.js'

describe('tRPC roll router', () => {
  it('executes authorized rolls and reads account-wide history', async () => {
    const caller = appRouter.createCaller(authenticatedContext)
    const input = {
      characterId: 'character-1',
      expression: '1d20 + 4',
      source: { kind: 'ABILITY_CHECK' as const, label: 'Strength' }
    }

    await expect(caller.rolls.execute(input)).resolves.toMatchObject({
      id: 'roll-1',
      characterId: 'character-1',
      evidence: { total: 21 }
    })
    await expect(caller.rolls.history()).resolves.toEqual([])
    await expect(caller.rolls.discard({ id: 'roll-1' })).resolves.toEqual({ ok: true })
    await expect(caller.rolls.clearHistory()).resolves.toEqual({ ok: true })
    expect(executeRollForUser).toHaveBeenCalledWith(expect.anything(), input, 'user-1')
    expect(getRollHistoryForUser).toHaveBeenCalledWith(expect.anything(), 'user-1')
    expect(discardRollForUser).toHaveBeenCalledWith(expect.anything(), 'roll-1', 'user-1')
    expect(clearRollHistoryForUser).toHaveBeenCalledWith(expect.anything(), 'user-1')
  })

  it('executes standalone dice configurations for authenticated Builder use', async () => {
    const caller = appRouter.createCaller(authenticatedContext)

    await expect(
      caller.rolls.executeConfiguration({ configuration: '4d6dl1r1' })
    ).resolves.toMatchObject({ id: 'ability-roll-1', evidence: { total: 15 } })
    expect(executeDiceConfiguration).toHaveBeenCalledWith({ configuration: '4d6dl1r1' })
  })
})
