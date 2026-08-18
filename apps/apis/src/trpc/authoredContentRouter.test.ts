import type { DBLike } from '@artificer-toolkit/db'
import { AUTHORED_LIMITS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedTrpcContext, TrpcContext } from './dbContext.js'
import { authenticatedContext } from './routerTestFixtures.js'
import { handleTrpcFetchRequest } from './handler.js'

const listAuthoredDomain = vi.hoisted(() =>
  vi.fn(
    async (): Promise<{
      drafts: unknown
      items: unknown[]
      meta: unknown
      page: unknown
      summary: unknown
    }> => ({
      drafts: [],
      items: [],
      meta: {},
      page: { nextCursor: null, previousCursor: null, totalCount: 0 },
      summary: { activeCount: 0, masterCount: 0, ownedCount: 0 }
    })
  )
)

vi.mock('@artificer-toolkit/functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/functions')>()),
  listAuthoredDomain
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

describe('tRPC authored content router', () => {
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
      await expect(caller.content[domain].list({})).resolves.toEqual({
        drafts: [],
        items: [],
        meta: {},
        page: { nextCursor: null, previousCursor: null, totalCount: 0 },
        summary: { activeCount: 0, masterCount: 0, ownedCount: 0 }
      })
    }

    expect(listAuthoredDomain).toHaveBeenCalledTimes(domains.length)
    expect(Object.keys(appRouter._def.procedures)).not.toContain('content.spells.upsert')
  })

  it('maps invalid declared authored output to an internal error', async () => {
    listAuthoredDomain.mockResolvedValueOnce({
      drafts: 'invalid',
      items: [],
      meta: {},
      page: { nextCursor: null, previousCursor: null, totalCount: 0 },
      summary: { activeCount: 0, masterCount: 0, ownedCount: 0 }
    })
    const caller = appRouter.createCaller(authenticatedContext)

    await expect(caller.content.backgrounds.list({})).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR'
    })
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
})
