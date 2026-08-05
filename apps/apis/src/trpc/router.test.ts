import type { DBLike } from '@artificer-toolkit/db'
import { AUTHORED_LIMITS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedTrpcContext, TrpcContext } from './dbContext.js'

const listAuthoredDomain = vi.hoisted(() =>
  vi.fn(async () => ({
    drafts: [],
    items: [],
    meta: {}
  }))
)

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

const accountProfileRepository = vi.hoisted(() => ({
  findForUser: vi.fn(
    async (): Promise<{ username: string; name: string | null; bio: string | null } | null> => ({
      username: 'morgan',
      name: 'Morgan',
      bio: 'Forge keeper.'
    })
  ),
  isUsernameTaken: vi.fn(async (username: string) => username === 'taken_name'),
  upsertForUser: vi.fn(
    async (
      _userId: string,
      profile: { username: string; name: string | null; bio: string | null }
    ) => profile
  )
}))
const getAuthUserById = vi.hoisted(() =>
  vi.fn(async () => ({
    data: {
      user: {
        app_metadata: { provider: 'email', providers: ['email'] }
      }
    },
    error: null
  }))
)
const updateAuthUserById = vi.hoisted(() =>
  vi.fn(async () => ({ data: { user: {} }, error: null }))
)

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createAccountProfileRepository: () => accountProfileRepository
}))

vi.mock('@artificer-toolkit/functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/functions')>()),
  clearRollHistoryForUser,
  discardRollForUser,
  executeDiceConfiguration,
  executeRollForUser,
  getRollHistoryForUser,
  listAuthoredDomain
}))

vi.mock('@artificer-toolkit/functions/clients', () => ({
  createSupabaseClient: () => ({
    auth: {
      admin: {
        getUserById: getAuthUserById,
        updateUserById: updateAuthUserById
      }
    }
  })
}))

vi.mock('./dbContext.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dbContext.js')>()

  return {
    ...actual,
    withDb: async <TResult>(
      _context: TrpcContext,
      callback: (db: DBLike) => Promise<TResult>
    ): Promise<TResult> => callback({} as DBLike),
    withAuthenticatedDb: async <TResult>(
      context: TrpcContext,
      callback: (db: DBLike, userId: string, auth: AuthenticatedTrpcContext) => Promise<TResult>
    ): Promise<TResult> => {
      const userId = actual.requireUserId(context)
      return callback({} as DBLike, userId, {
        isSuperAdmin: context.isSuperAdmin === true,
        userId
      })
    }
  }
})

import { appRouter } from './router.js'
import { handleTrpcFetchRequest } from './handler.js'

describe('tRPC router auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes only safe application feature flags without authentication', async () => {
    const caller = appRouter.createCaller({ userId: null })

    await expect(caller.application.featureFlags()).resolves.toEqual({
      libraryImportEnabled: expect.any(Boolean),
      publicSignUpEnabled: expect.any(Boolean)
    })
  })

  it('checks username policy and availability without exposing profile data', async () => {
    const caller = appRouter.createCaller({ userId: null })

    await expect(caller.account.usernameStatus({ username: 'open_name' })).resolves.toEqual({
      status: 'available'
    })
    await expect(caller.account.usernameStatus({ username: 'taken_name' })).resolves.toEqual({
      status: 'taken'
    })
    await expect(caller.account.usernameStatus({ username: 'admin' })).resolves.toEqual({
      status: 'not_allowed'
    })
    expect(accountProfileRepository.isUsernameTaken).toHaveBeenCalledTimes(2)
  })

  it('completes an invitation through trusted app metadata after enforcing username policy', async () => {
    const caller = appRouter.createCaller({ userId: 'user-1' })
    accountProfileRepository.findForUser.mockResolvedValueOnce(null)

    await expect(
      caller.account.completeInvitation({
        username: 'Morgan_Emberfall',
        password: 'new-password-123'
      })
    ).resolves.toEqual({ ok: true })

    expect(updateAuthUserById).toHaveBeenCalledWith('user-1', {
      password: 'new-password-123',
      app_metadata: {
        provider: 'email',
        providers: ['email'],
        pending_profile_username: 'Morgan_Emberfall'
      }
    })
  })

  it('rejects moderated invitation usernames before updating the auth user', async () => {
    const caller = appRouter.createCaller({ userId: 'user-1' })

    await expect(
      caller.account.completeInvitation({
        username: 'admin',
        password: 'new-password-123'
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: "That username isn't allowed." })

    expect(updateAuthUserById).not.toHaveBeenCalled()
  })

  it('requires server-side auth context for product data procedures', async () => {
    const caller = appRouter.createCaller({ userId: null })

    await expect(caller.systems.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(caller.account.profile()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(
      caller.account.completeInvitation({
        username: 'player_one',
        password: 'new-password-123'
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(
      caller.account.updateProfile({ username: 'player_one', name: null, bio: null })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
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

  it('executes authorized rolls and reads account-wide history', async () => {
    const caller = appRouter.createCaller({ userId: 'user-1' })
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
    const caller = appRouter.createCaller({ userId: 'user-1' })

    await expect(
      caller.rolls.executeConfiguration({ configuration: '4d6dl1r1' })
    ).resolves.toMatchObject({ id: 'ability-roll-1', evidence: { total: 15 } })
    expect(executeDiceConfiguration).toHaveBeenCalledWith({ configuration: '4d6dl1r1' })
  })

  it('reads and updates only the authenticated user profile', async () => {
    const caller = appRouter.createCaller({ userId: 'user-1' })

    await expect(caller.account.profile()).resolves.toEqual({
      username: 'morgan',
      name: 'Morgan',
      bio: 'Forge keeper.'
    })
    await expect(
      caller.account.updateProfile({
        username: '  MORGAN_EMBERFALL  ',
        name: '  Morgan Emberfall  ',
        bio: '  Builds worlds.  '
      })
    ).resolves.toEqual({
      username: 'MORGAN_EMBERFALL',
      name: 'Morgan Emberfall',
      bio: 'Builds worlds.'
    })

    expect(accountProfileRepository.findForUser).toHaveBeenCalledWith('user-1')
    expect(accountProfileRepository.upsertForUser).toHaveBeenCalledWith('user-1', {
      username: 'MORGAN_EMBERFALL',
      name: 'Morgan Emberfall',
      bio: 'Builds worlds.'
    })
  })

  it('registers the same authenticated list contract for all authored domains', async () => {
    const caller = appRouter.createCaller({ userId: 'user-1' })
    const domains = [
      'backgrounds',
      'classes',
      'creatures',
      'equipment',
      'feats',
      'races',
      'spells',
      'vehicles'
    ] as const

    for (const domain of domains) {
      await expect(caller.content[domain].list()).resolves.toEqual({
        drafts: [],
        items: [],
        meta: {}
      })
    }

    expect(listAuthoredDomain).toHaveBeenCalledTimes(domains.length)
    expect(Object.keys(appRouter._def.procedures)).not.toContain('content.spells.upsert')
  })

  it('rejects authored mutations over 1 MiB after domain validation', async () => {
    const caller = appRouter.createCaller({ userId: 'user-1' })

    await expect(
      caller.content.backgrounds.saveDraft({
        kind: 'BACKGROUND',
        id: 'background-1',
        label: 'Oversized background',
        systemId: 'system-1',
        features: Array.from({ length: AUTHORED_LIMITS.nestedCollectionItems }, (_, index) => ({
          id: `feature-${index}`,
          label: `Feature ${index}`,
          description: 'x'.repeat(AUTHORED_LIMITS.richTextVisibleCharacters),
          order: index
        }))
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('exposes structured input issues only for authored validation mutations', async () => {
    const response = await handleTrpcFetchRequest(
      new Request('http://localhost/api/trpc/content.spells.saveDraft?batch=1', {
        body: JSON.stringify({
          0: {
            kind: 'SPELL',
            id: 'spell-1',
            label: 'Test Spell',
            description: '',
            castingTime: { amount: 1, unit: 'ROUND' },
            level: 1,
            classIds: ['wizard', 7],
            magicSchoolId: 'evocation',
            systemId: 'system-1'
          }
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST'
      }),
      { userId: 'user-1' }
    )

    expect(await response.json()).toEqual([
      expect.objectContaining({
        error: expect.objectContaining({
          data: expect.objectContaining({
            validationIssues: expect.arrayContaining([
              expect.objectContaining({
                path: ['classIds', 1]
              })
            ])
          })
        })
      })
    ])
  })

  it('keeps validation details opaque for unrelated procedures', async () => {
    const response = await handleTrpcFetchRequest(
      new Request('http://localhost/api/trpc/nodeRuntime.normalizeValues?batch=1', {
        body: JSON.stringify({ 0: { mapId: 7, systemId: 'system-1', values: {} } }),
        headers: { 'content-type': 'application/json' },
        method: 'POST'
      }),
      { userId: 'user-1' }
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
