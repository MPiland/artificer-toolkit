import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrpcContext } from './dbContext.js'
import { authenticatedContext, unauthenticatedContext } from './routerTestFixtures.js'

const createNotificationSession = vi.hoisted(() => vi.fn())
const withExplicitAuthorityDb = vi.hoisted(() => vi.fn())

vi.mock('@artificer-toolkit/functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/functions')>()),
  createNotificationSession
}))

vi.mock('./dbContext.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dbContext.js')>()
  withExplicitAuthorityDb.mockImplementation(
    async <TResult>(
      context: TrpcContext,
      callback: (db: DBLike, userId: string) => Promise<TResult>
    ): Promise<TResult> => callback({} as DBLike, actual.requireUserId(context))
  )
  return { ...actual, withExplicitAuthorityDb }
})

const { notificationsRouter } = await import('./notificationsRouter.js')

describe('tRPC notifications router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NOVU_SECRET_KEY', 'secret-key')
    vi.stubEnv('NOVU_APPLICATION_IDENTIFIER', 'application-identifier')
    createNotificationSession.mockResolvedValue({
      recipientId: '00000000-0000-4000-8000-000000000001',
      subscriberHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      applicationIdentifier: 'application-identifier'
    })
  })

  it('returns only the authenticated recipient session DTO', async () => {
    await expect(notificationsRouter.createCaller(authenticatedContext).session()).resolves.toEqual(
      {
        recipientId: '00000000-0000-4000-8000-000000000001',
        subscriberHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        applicationIdentifier: 'application-identifier'
      }
    )
    expect(createNotificationSession).toHaveBeenCalledWith({}, 'user-1', {
      secretKey: 'secret-key',
      applicationIdentifier: 'application-identifier'
    })
  })

  it('rejects unauthenticated session requests before service access', async () => {
    await expect(
      notificationsRouter.createCaller(unauthenticatedContext).session()
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(createNotificationSession).not.toHaveBeenCalled()
  })
})
