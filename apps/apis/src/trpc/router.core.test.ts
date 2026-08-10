import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedTrpcContext, TrpcContext } from './dbContext.js'
import { authenticatedContext, unauthenticatedContext } from './routerTestFixtures.js'
import { handleTrpcFetchRequest } from './handler.js'

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

vi.mock('@artificer-toolkit/functions/clients', () => ({
  createSupabaseClient: vi.fn()
}))

beforeEach(() => {
  vi.clearAllMocks()
})

import { appRouter } from './router.js'

describe('tRPC router core', () => {
  it('exposes only safe application feature flags without authentication', async () => {
    const caller = appRouter.createCaller(unauthenticatedContext)

    await expect(caller.application.featureFlags()).resolves.toEqual({
      libraryImportEnabled: expect.any(Boolean),
      publicSignUpEnabled: expect.any(Boolean)
    })
  })

  it('requires server-side auth context for product data procedures', async () => {
    const caller = appRouter.createCaller(unauthenticatedContext)

    await expect(caller.systems.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(caller.account.profile()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(
      caller.account.completeInvitation({
        password: 'new-password-123',
        username: 'player_one'
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(caller.account.updateProfile({ bio: null })).rejects.toMatchObject({
      code: 'UNAUTHORIZED'
    })
    await expect(caller.content.spells.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(caller.characters.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(caller.rolls.clearHistory()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(
      caller.rolls.executeConfiguration({ configuration: '4d6dl1r1' })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(caller.rolls.discard({ id: 'roll-1' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED'
    })
    await expect(caller.rolls.history()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(
      caller.characters.restPreview({
        id: 'character-1',
        input: {
          restKind: 'SHORT',
          expectedVersion: 1,
          selectedHitDice: [],
          resetMaximumHitPointModifier: false,
          healingMode: 'AUTOMATIC',
          manualHealingAccepted: false,
          selectedCompanionInstanceIds: [],
          requestRoll: false
        }
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(
      caller.routeIds.resolve({ subjectKind: 'SPELL', publicId: '1' })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(
      caller.nodeRuntime.resolve({ mapId: 'spell', systemId: 'system-1', values: {} })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('keeps validation details opaque for unrelated procedures', async () => {
    const response = await handleTrpcFetchRequest(
      new Request('http://localhost/api/trpc/nodeRuntime.normalizeValues?batch=1', {
        body: JSON.stringify({ 0: { mapId: 7, systemId: 'system-1', values: {} } }),
        headers: { 'content-type': 'application/json' },
        method: 'POST'
      }),
      authenticatedContext
    )

    expect(await response.json()).toEqual([
      expect.objectContaining({
        error: expect.objectContaining({
          data: expect.not.objectContaining({
            validationIssues: expect.anything()
          })
        })
      })
    ])
  })
})
