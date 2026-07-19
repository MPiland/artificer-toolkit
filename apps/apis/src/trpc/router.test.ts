import type { DBLike } from '@artificer-toolkit/db'
import { describe, expect, it, vi } from 'vitest'
import type { AuthenticatedTrpcContext, TrpcContext } from './dbContext.js'

const listAuthoredDomain = vi.hoisted(() => vi.fn(async () => ({
  drafts: [],
  items: [],
  meta: {}
})))

vi.mock('@artificer-toolkit/functions', async (importOriginal) => ({
  ...await importOriginal<typeof import('@artificer-toolkit/functions')>(),
  listAuthoredDomain
}))

vi.mock('./dbContext.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dbContext.js')>()

  return {
    ...actual,
    withAuthenticatedDb: async <TResult>(
      context: TrpcContext,
      callback: (
        db: DBLike,
        userId: string,
        auth: AuthenticatedTrpcContext
      ) => Promise<TResult>
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
  it('requires server-side auth context for product data procedures', async () => {
    const caller = appRouter.createCaller({ userId: null })

    await expect(caller.systems.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(caller.content.spells.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(caller.characters.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(caller.routeIds.resolve({ subjectKind: 'SPELL', publicId: '1' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(
      caller.nodeRuntime.resolve({ mapId: 'spell', systemId: 'system-1', values: {} })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
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
