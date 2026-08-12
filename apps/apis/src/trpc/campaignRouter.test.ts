import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrpcContext } from './dbContext.js'
import { authenticatedContext } from './routerTestFixtures.js'

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
    listCampaigns: vi.fn(async () => []),
    listSentCampaignInvites: vi.fn(async () => []),
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
    listCampaignAdjustments: vi.fn(async () => [] as unknown[]),
    listCampaignEvents: vi.fn(async () => ({
      events: [],
      nextCursor: null
    })),
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
    }))
  }
})

vi.mock('@artificer-toolkit/functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/functions')>()),
  ...campaignMocks
}))

const withExplicitAuthorityDb = vi.hoisted(() => vi.fn())

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
    withExplicitAuthorityDb
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

import { appRouter } from './router.js'

describe('tRPC campaign router', () => {
  it('forwards authenticated identity to Campaign lifecycle services', async () => {
    const caller = appRouter.createCaller(authenticatedContext)

    await expect(caller.campaigns.list()).resolves.toEqual([])
    expect(campaignMocks.listCampaigns).toHaveBeenCalledWith({}, 'user-1')
    expect(withExplicitAuthorityDb).toHaveBeenCalledTimes(1)
  })

  it('lists sent invitations through the authenticated listing owner service', async () => {
    const caller = appRouter.createCaller(authenticatedContext)
    const listingPublicId = '00000000-0000-4000-8000-000000000050'

    await expect(caller.campaigns.invites.listSent({ listingPublicId })).resolves.toEqual([])
    expect(campaignMocks.listSentCampaignInvites).toHaveBeenCalledWith(
      {},
      'user-1',
      listingPublicId
    )
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
