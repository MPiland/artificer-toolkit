import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrpcContext } from './dbContext.js'
import { authenticatedContext, unauthenticatedContext } from './routerTestFixtures.js'

const mocks = vi.hoisted(() => ({
  getNotificationFeed: vi.fn(),
  getNotificationPreferences: vi.fn(),
  markAllNotificationsSeen: vi.fn(),
  markNotificationRead: vi.fn(),
  updateNotificationPreferences: vi.fn(),
  withExplicitAuthorityDb: vi.fn()
}))

vi.mock('@artificer-toolkit/functions', () => mocks)
vi.mock('./dbContext.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dbContext.js')>()
  mocks.withExplicitAuthorityDb.mockImplementation(
    async <TResult>(
      context: TrpcContext,
      callback: (db: DBLike, userId: string) => Promise<TResult>
    ): Promise<TResult> => callback({} as DBLike, actual.requireUserId(context))
  )
  return { ...actual, withExplicitAuthorityDb: mocks.withExplicitAuthorityDb }
})

const { notificationsRouter } = await import('./notificationsRouter.js')

const feed = { items: [], unseenCount: 0 }
const preferences = {
  campaign: { email: true, inApp: true },
  social: { email: true, inApp: true }
}

describe('tRPC notifications router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getNotificationFeed.mockResolvedValue(feed)
    mocks.getNotificationPreferences.mockResolvedValue(preferences)
    mocks.updateNotificationPreferences.mockResolvedValue(preferences)
  })

  it('uses the authenticated user for feed and preference reads', async () => {
    await expect(notificationsRouter.createCaller(authenticatedContext).feed()).resolves.toEqual(
      feed
    )
    await expect(
      notificationsRouter.createCaller(authenticatedContext).preferences()
    ).resolves.toEqual(preferences)
    expect(mocks.getNotificationFeed).toHaveBeenCalledWith({}, 'user-1')
    expect(mocks.getNotificationPreferences).toHaveBeenCalledWith({}, 'user-1')
  })

  it('marks only the authenticated user feed items', async () => {
    const caller = notificationsRouter.createCaller(authenticatedContext)
    await expect(caller.markAllSeen()).resolves.toEqual({ ok: true })
    await expect(caller.markRead({ id: '00000000-0000-4000-8000-000000000001' })).resolves.toEqual({
      ok: true
    })
    expect(mocks.markAllNotificationsSeen).toHaveBeenCalledWith({}, 'user-1')
    expect(mocks.markNotificationRead).toHaveBeenCalledWith(
      {},
      'user-1',
      '00000000-0000-4000-8000-000000000001'
    )
  })

  it('updates one category for the authenticated user', async () => {
    await expect(
      notificationsRouter.createCaller(authenticatedContext).updatePreferences({
        category: 'SOCIAL',
        email: false,
        inApp: true
      })
    ).resolves.toEqual(preferences)
    expect(mocks.updateNotificationPreferences).toHaveBeenCalledWith({}, 'user-1', {
      category: 'SOCIAL',
      email: false,
      inApp: true
    })
  })

  it('rejects unauthenticated notification requests before service access', async () => {
    await expect(
      notificationsRouter.createCaller(unauthenticatedContext).feed()
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED'
    })
    expect(mocks.getNotificationFeed).not.toHaveBeenCalled()
  })
})
