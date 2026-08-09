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
const campaignMocks = vi.hoisted(() => {
  class CampaignAccessError extends Error {
    name = 'CampaignAccessError'
  }
  class CampaignNotFoundError extends Error {
    name = 'CampaignNotFoundError'
  }
  class CampaignConflictError extends Error {
    name = 'CampaignConflictError'
  }
  class CampaignValidationError extends Error {
    name = 'CampaignValidationError'
  }
  class EntitlementLimitError extends Error {
    name = 'EntitlementLimitError'
  }

  return {
    CampaignAccessError,
    CampaignNotFoundError,
    CampaignConflictError,
    CampaignValidationError,
    EntitlementLimitError,
    getEntitlementProjection: vi.fn(async () => ({
      tier: 'FREE',
      limits: {
        storageBytes: 262144000,
        personalCharacters: 6,
        homebrewRoots: 20,
        activeHostedCampaigns: 1,
        playerSeatsPerCampaign: 5,
        publicListings: 1,
        savedEncounters: 3,
        paidTablesEnabled: false,
        platformFeeBasisPoints: 0
      },
      usage: {
        storageBytes: 0,
        personalCharacters: 0,
        homebrewRoots: 0,
        activeHostedCampaigns: 0,
        publicListings: 0,
        savedEncounters: 0
      },
      pricing: { currency: 'USD', monthlyPriceCents: 0, annualPriceCents: 0 }
    })),
    listCampaigns: vi.fn(async () => []),
    listCampaignChatEntries: vi.fn(),
    getCampaign: vi.fn(),
    createCampaign: vi.fn(),
    sendCampaignChatEntry: vi.fn(),
    getCampaignInventory: vi.fn(),
    transferCampaignInventory: vi.fn(async () => ({
      eventId: '00000000-0000-4000-8000-000000000010'
    })),
    listCampaignContentVersions: vi.fn(async () => []),
    submitCampaignContentVersion: vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000020',
      subjectKind: 'SPELL',
      subjectId: '00000000-0000-4000-8000-000000000021',
      version: 0,
      snapshot: { id: 'snapshot-spell', kind: 'SPELL', revision: 1 },
      status: 'PENDING',
      createdAt: '2026-08-01T12:00:00.000Z',
      reviewedAt: null
    })),
    reviewCampaignContentVersion: vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000020',
      subjectKind: 'SPELL',
      subjectId: '00000000-0000-4000-8000-000000000021',
      version: 0,
      snapshot: { id: 'snapshot-spell', kind: 'SPELL', revision: 1 },
      status: 'APPROVED',
      createdAt: '2026-08-01T12:00:00.000Z',
      reviewedAt: '2026-08-01T12:01:00.000Z'
    })),
    listCampaignAdjustments: vi.fn(async () => [] as unknown[]),
    saveCampaignAdjustment: vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000030',
      campaignId: '00000000-0000-4000-8000-000000000001',
      characterId: '00000000-0000-4000-8000-000000000022',
      adjustment: {
        family: 'HIT_POINTS',
        field: 'MAXIMUM_OVERRIDE',
        value: 20
      },
      visibility: 'VISIBLE',
      version: 0,
      createdAt: '2026-08-01T12:00:00.000Z',
      updatedAt: '2026-08-01T12:00:00.000Z'
    })),
    deleteCampaignAdjustment: vi.fn(async () => {}),
    listCampaignConditions: vi.fn(async () => []),
    saveCampaignCondition: vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000040',
      campaignId: '00000000-0000-4000-8000-000000000001',
      characterId: '00000000-0000-4000-8000-000000000022',
      conditionTypeId: '00000000-0000-4000-8000-000000000041',
      visibility: 'SECRET',
      version: 0,
      createdAt: '2026-08-01T12:00:00.000Z',
      updatedAt: '2026-08-01T12:00:00.000Z'
    })),
    deleteCampaignCondition: vi.fn(async () => {}),
    listCampaignEvents: vi.fn(async () => ({
      events: [],
      nextCursor: null
    }))
  }
})

const accountProfileRepository = vi.hoisted(() => ({
  findUserIdByUsername: vi.fn(async (): Promise<string | null> => 'user-1'),
  findForUser: vi.fn(
    async (): Promise<{ username: string | null; bio: string | null } | null> => ({
      username: 'morgan',
      bio: 'Forge keeper.'
    })
  ),
  isUsernameTaken: vi.fn(async (username: string) => username === 'taken_name'),
  upsertForUser: vi.fn(
    async (_userId: string, profile: { username: string; bio: string | null }) => profile
  )
}))
const updateAuthUserById = vi.hoisted(() =>
  vi.fn(async () => ({ data: { user: {} }, error: null }))
)
const getAuthUserById = vi.hoisted(() =>
  vi.fn(async () => ({
    data: { user: { app_metadata: { provider: 'email' }, email: 'player@example.com' } },
    error: null
  }))
)
const signInWithPassword = vi.hoisted(() =>
  vi.fn(
    async (): Promise<{
      data: { session: { access_token: string; refresh_token: string } | null }
      error: { status: number } | null
    }> => ({
      data: { session: { access_token: 'access-token', refresh_token: 'refresh-token' } },
      error: null
    })
  )
)
const createSupabaseClient = vi.hoisted(() => vi.fn())
const withExplicitAuthorityDb = vi.hoisted(() => vi.fn())

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
  listAuthoredDomain,
  ...campaignMocks
}))

vi.mock('@artificer-toolkit/functions/clients', () => ({
  createSupabaseClient
}))

vi.mock('./dbContext.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dbContext.js')>()

  withExplicitAuthorityDb.mockImplementation(
    async <TResult>(
      context: TrpcContext,
      callback: (db: DBLike, userId: string) => Promise<TResult>
    ): Promise<TResult> => {
      try {
        return await callback({} as DBLike, actual.requireUserId(context))
      } catch (error) {
        throw actual.toTrpcError(error)
      }
    }
  )

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
      try {
        return await callback({} as DBLike, userId, {
          isSuperAdmin: context.isSuperAdmin === true,
          userId
        })
      } catch (error) {
        throw actual.toTrpcError(error)
      }
    },
    withExplicitAuthorityDb
  }
})

import { appRouter } from './router.js'
import { handleTrpcFetchRequest } from './handler.js'

const authenticatedContext = {
  invitationSetupPending: false,
  userId: 'user-1'
} satisfies TrpcContext
const pendingInvitationContext = {
  invitationSetupPending: true,
  userId: 'user-1'
} satisfies TrpcContext
const unauthenticatedContext = {
  clientIp: '203.0.113.10',
  invitationSetupPending: false,
  userId: null
} satisfies TrpcContext

describe('tRPC router auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createSupabaseClient.mockReturnValue({
      auth: {
        admin: {
          getUserById: getAuthUserById,
          updateUserById: updateAuthUserById
        },
        signInWithPassword
      }
    })
  })

  it('exposes only safe application feature flags without authentication', async () => {
    const caller = appRouter.createCaller(unauthenticatedContext)

    await expect(caller.application.featureFlags()).resolves.toEqual({
      libraryImportEnabled: expect.any(Boolean),
      publicSignUpEnabled: expect.any(Boolean)
    })
  })

  it('checks username policy and availability without exposing profile data', async () => {
    const caller = appRouter.createCaller(unauthenticatedContext)

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

  it('signs in by username without returning the account email', async () => {
    const caller = appRouter.createCaller(unauthenticatedContext)

    await expect(
      caller.account.signInWithUsername({ username: 'morgan', password: 'password1234' })
    ).resolves.toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' })
    expect(accountProfileRepository.findUserIdByUsername).toHaveBeenCalledWith('morgan')
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'password1234'
    })
    expect(createSupabaseClient).toHaveBeenCalledWith('203.0.113.10')
  })

  it('preserves Supabase rate-limit responses during username sign-in', async () => {
    signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { status: 429 }
    })
    const caller = appRouter.createCaller(unauthenticatedContext)

    await expect(
      caller.account.signInWithUsername({ username: 'morgan', password: 'password1234' })
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
  })

  it('does not reveal whether a username exists during sign-in', async () => {
    accountProfileRepository.findUserIdByUsername.mockResolvedValueOnce(null)
    const caller = appRouter.createCaller(unauthenticatedContext)

    await expect(
      caller.account.signInWithUsername({ username: 'unknown_user', password: 'password1234' })
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid username or password.'
    })
    expect(getAuthUserById).not.toHaveBeenCalled()
  })

  it('completes an invitation with a required username', async () => {
    const caller = appRouter.createCaller(pendingInvitationContext)

    await expect(
      caller.account.completeInvitation({
        password: 'new-password-123',
        username: 'player_one'
      })
    ).resolves.toEqual({ ok: true })

    expect(accountProfileRepository.upsertForUser).toHaveBeenCalledWith('user-1', {
      username: 'player_one',
      bio: 'Forge keeper.'
    })

    expect(updateAuthUserById).toHaveBeenCalledWith('user-1', {
      password: 'new-password-123',
      app_metadata: {
        provider: 'email',
        registration_completed: true
      }
    })
  })

  it('rejects invitation completion after account setup is complete', async () => {
    const caller = appRouter.createCaller(authenticatedContext)

    await expect(
      caller.account.completeInvitation({
        password: 'replacement-password-123',
        username: 'player_one'
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(getAuthUserById).not.toHaveBeenCalled()
    expect(updateAuthUserById).not.toHaveBeenCalled()
  })

  it('blocks product APIs until an invited user completes password setup', async () => {
    const caller = appRouter.createCaller(pendingInvitationContext)

    await expect(caller.systems.list()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      caller.account.completeInvitation({
        password: 'new-password-123',
        username: 'player_one'
      })
    ).resolves.toEqual({ ok: true })
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

  it('reads and updates only the authenticated user profile', async () => {
    const caller = appRouter.createCaller(authenticatedContext)

    await expect(caller.account.profile()).resolves.toEqual({
      username: 'morgan',
      bio: 'Forge keeper.'
    })
    await expect(
      caller.account.updateProfile({
        bio: '  Builds worlds.  '
      })
    ).resolves.toEqual({
      username: 'morgan',
      bio: 'Builds worlds.'
    })

    expect(accountProfileRepository.findForUser).toHaveBeenCalledWith('user-1')
    expect(accountProfileRepository.upsertForUser).toHaveBeenCalledWith('user-1', {
      username: 'morgan',
      bio: 'Builds worlds.'
    })
  })

  it('lets an account claim or replace its username', async () => {
    accountProfileRepository.findForUser.mockResolvedValueOnce({ username: null, bio: null })
    const caller = appRouter.createCaller(authenticatedContext)

    await expect(
      caller.account.updateProfile({ username: 'legacy_player', bio: null })
    ).resolves.toEqual({ username: 'legacy_player', bio: null })
    expect(accountProfileRepository.upsertForUser).toHaveBeenCalledWith('user-1', {
      username: 'legacy_player',
      bio: null
    })

    await expect(
      caller.account.updateProfile({ username: 'replacement_name', bio: null })
    ).resolves.toEqual({ username: 'replacement_name', bio: null })
    expect(accountProfileRepository.upsertForUser).toHaveBeenLastCalledWith('user-1', {
      username: 'replacement_name',
      bio: null
    })
  })

  it('reports a rename race as a conflict', async () => {
    const { UsernameConflictError } =
      await vi.importActual<typeof import('@artificer-toolkit/db')>('@artificer-toolkit/db')
    accountProfileRepository.upsertForUser.mockRejectedValueOnce(new UsernameConflictError())
    const caller = appRouter.createCaller(authenticatedContext)

    await expect(
      caller.account.updateProfile({ username: 'raced_name', bio: 'Forge keeper.' })
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('registers the same authenticated list contract for all authored domains', async () => {
    const caller = appRouter.createCaller(authenticatedContext)
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
    const caller = appRouter.createCaller(authenticatedContext)

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
      authenticatedContext
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

  it('forwards authenticated identity to Campaign lifecycle services', async () => {
    const caller = appRouter.createCaller(authenticatedContext)

    await expect(caller.campaigns.list()).resolves.toEqual([])
    expect(campaignMocks.listCampaigns).toHaveBeenCalledWith({}, 'user-1')
    expect(withExplicitAuthorityDb).toHaveBeenCalledTimes(1)
  })

  it.each([
    [new campaignMocks.CampaignAccessError(), 'FORBIDDEN'],
    [new campaignMocks.EntitlementLimitError('activeHostedCampaigns'), 'FORBIDDEN'],
    [new campaignMocks.CampaignNotFoundError(), 'NOT_FOUND'],
    [new campaignMocks.CampaignConflictError(), 'CONFLICT'],
    [new campaignMocks.CampaignValidationError(), 'BAD_REQUEST'],
    [new RangeError('Invalid campaign range.'), 'BAD_REQUEST'],
    [
      Object.assign(new Error('Insufficient currency.'), {
        name: 'InsufficientInventoryCurrencyError'
      }),
      'BAD_REQUEST'
    ],
    [
      Object.assign(new Error('Invalid currency amount.'), {
        name: 'InventoryCurrencyAmountRangeError'
      }),
      'BAD_REQUEST'
    ]
  ] as const)('maps Campaign domain errors to %s', async (error, code) => {
    campaignMocks.listCampaigns.mockRejectedValueOnce(error)
    const caller = appRouter.createCaller(authenticatedContext)

    await expect(caller.campaigns.list()).rejects.toMatchObject({ code })
  })

  it('returns the shared inventory transfer result', async () => {
    const caller = appRouter.createCaller(authenticatedContext)

    await expect(
      caller.campaigns.inventory.transfer({
        kind: 'CURRENCY',
        campaignId: '00000000-0000-4000-8000-000000000001',
        source: { kind: 'CAMPAIGN', campaignId: '00000000-0000-4000-8000-000000000001' },
        destination: { kind: 'CHARACTER', characterId: '00000000-0000-4000-8000-000000000002' },
        denominationId: '00000000-0000-4000-8000-000000000003',
        amount: 1,
        expectedSourceVersion: 0,
        expectedDestinationVersion: 0,
        idempotencyKey: '00000000-0000-4000-8000-000000000004'
      })
    ).resolves.toEqual({ eventId: '00000000-0000-4000-8000-000000000010' })
  })

  it('forwards Campaign content service arguments and parses content payloads', async () => {
    const caller = appRouter.createCaller(authenticatedContext)
    const listInput = { campaignId: '00000000-0000-4000-8000-000000000001' }

    await expect(caller.campaigns.content.list(listInput)).resolves.toEqual([])
    expect(campaignMocks.listCampaignContentVersions).toHaveBeenCalledWith(
      {},
      'user-1',
      listInput.campaignId
    )

    const submitInput = {
      campaignId: listInput.campaignId,
      subjectKind: 'SPELL' as const,
      subjectId: '00000000-0000-4000-8000-000000000021',
      version: 0,
      snapshot: { id: 'snapshot-spell', kind: 'SPELL', revision: 1 }
    }
    await expect(caller.campaigns.content.submit(submitInput)).resolves.toMatchObject({
      status: 'PENDING'
    })
    expect(campaignMocks.submitCampaignContentVersion).toHaveBeenCalledWith(
      {},
      'user-1',
      submitInput
    )
  })

  it('forwards GM adjustment arguments and validates GM event input', async () => {
    const caller = appRouter.createCaller(authenticatedContext)

    const adjustments = [
      {
        id: '00000000-0000-4000-8000-000000000031',
        campaignId: '00000000-0000-4000-8000-000000000001',
        characterId: '00000000-0000-4000-8000-000000000022',
        adjustment: {
          family: 'HIT_POINTS',
          field: 'MAXIMUM_OVERRIDE',
          value: 25
        },
        visibility: 'VISIBLE' as const,
        version: 0,
        createdAt: '2026-08-01T12:00:00.000Z',
        updatedAt: '2026-08-01T12:00:00.000Z'
      }
    ]
    campaignMocks.listCampaignAdjustments.mockResolvedValueOnce(adjustments)
    await expect(
      caller.campaigns.gm.adjustments.list({
        campaignId: '00000000-0000-4000-8000-000000000001',
        characterId: '00000000-0000-4000-8000-000000000022'
      })
    ).resolves.toEqual(adjustments)
    expect(campaignMocks.listCampaignAdjustments).toHaveBeenCalledWith({}, 'user-1', {
      campaignId: '00000000-0000-4000-8000-000000000001',
      characterId: '00000000-0000-4000-8000-000000000022'
    })

    await expect(
      caller.campaigns.gm.events({
        campaignId: '00000000-0000-4000-8000-000000000001',
        characterId: '00000000-0000-4000-8000-000000000022'
      })
    ).resolves.toEqual({ events: [], nextCursor: null })
    expect(campaignMocks.listCampaignEvents).toHaveBeenCalledWith({}, 'user-1', {
      campaignId: '00000000-0000-4000-8000-000000000001',
      characterId: '00000000-0000-4000-8000-000000000022',
      limit: 50
    })
  })

  it('forwards GM condition and spell-selection operations', async () => {
    const caller = appRouter.createCaller(authenticatedContext)
    const target = {
      campaignId: '00000000-0000-4000-8000-000000000001',
      characterId: '00000000-0000-4000-8000-000000000022'
    }

    await expect(caller.campaigns.gm.conditions.list(target)).resolves.toEqual([])
    expect(campaignMocks.listCampaignConditions).toHaveBeenCalledWith({}, 'user-1', target)

    const condition = {
      ...target,
      conditionTypeId: '00000000-0000-4000-8000-000000000041',
      visibility: 'SECRET' as const,
      expectedVersion: 0
    }
    await expect(caller.campaigns.gm.conditions.save(condition)).resolves.toMatchObject({
      conditionTypeId: condition.conditionTypeId,
      visibility: 'SECRET'
    })
    expect(campaignMocks.saveCampaignCondition).toHaveBeenCalledWith({}, 'user-1', condition)
  })
})
