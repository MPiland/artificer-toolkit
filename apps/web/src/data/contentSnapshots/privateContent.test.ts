import { describe, expect, it, vi } from 'vitest'
import { createContentAccessCache } from './contentAccess'
import { CONTENT_SNAPSHOT_CACHE_NAME } from './contentSnapshotStore'
import { clearPrivateContentSnapshots, holdPrivateContentSnapshots } from './privateContent'

describe('private content snapshots at sign-out', () => {
  it('drops held tokens and workers and deletes the snapshot cache', async () => {
    const issue = vi
      .fn()
      .mockResolvedValueOnce({ token: 'first user', expiresAt: '2099-01-01T00:00:00.000Z' })
      .mockResolvedValueOnce({ token: 'second user', expiresAt: '2099-01-01T00:00:00.000Z' })
    const access = createContentAccessCache(issue)
    const release = holdPrivateContentSnapshots(access.clear)
    const terminateWorker = vi.fn()
    const releaseWorker = holdPrivateContentSnapshots(terminateWorker)
    const cacheStorage = { delete: vi.fn(async () => true) }
    await expect(access.getToken(false)).resolves.toBe('first user')

    await clearPrivateContentSnapshots(cacheStorage)

    expect(cacheStorage.delete).toHaveBeenCalledWith(CONTENT_SNAPSHOT_CACHE_NAME)
    expect(terminateWorker).toHaveBeenCalledTimes(1)
    await expect(access.getToken(false)).resolves.toBe('second user')

    release()
    releaseWorker()
    await clearPrivateContentSnapshots(cacheStorage)
    expect(terminateWorker).toHaveBeenCalledTimes(1)
  })
})
