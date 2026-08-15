import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthenticatedTrpcContext, TrpcContext } from './dbContext.js'
import { authenticatedContext } from './routerTestFixtures.js'

const mocks = vi.hoisted(() => ({
  listRulePacks: vi.fn(),
  withAuthenticatedDb: vi.fn()
}))

vi.mock('@artificer-toolkit/functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/functions')>()),
  listRulePacks: mocks.listRulePacks
}))

vi.mock('./dbContext.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dbContext.js')>()
  mocks.withAuthenticatedDb.mockImplementation(
    async <TResult>(
      context: TrpcContext,
      callback: (db: DBLike, userId: string, auth: AuthenticatedTrpcContext) => Promise<TResult>
    ): Promise<TResult> => {
      const userId = actual.requireUserId(context)
      return callback({} as DBLike, userId, {
        isSuperAdmin: context.isSuperAdmin === true,
        userId
      })
    }
  )
  return { ...actual, withAuthenticatedDb: mocks.withAuthenticatedDb }
})

const { appRouter } = await import('./router.js')

describe('tRPC rule router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listRulePacks.mockResolvedValue([])
  })

  it('rejects ordinary users before service access', async () => {
    await expect(
      appRouter.createCaller(authenticatedContext).rules.listPacks()
    ).rejects.toMatchObject({
      code: 'FORBIDDEN'
    })
    expect(mocks.withAuthenticatedDb).not.toHaveBeenCalled()
    expect(mocks.listRulePacks).not.toHaveBeenCalled()
  })

  it('allows superadmins through to the service', async () => {
    await expect(
      appRouter.createCaller({ ...authenticatedContext, isSuperAdmin: true }).rules.listPacks()
    ).resolves.toEqual([])
    expect(mocks.listRulePacks).toHaveBeenCalledWith({}, 'user-1', true)
  })
})
