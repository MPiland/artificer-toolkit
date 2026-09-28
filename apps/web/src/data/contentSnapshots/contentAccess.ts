import type { ContentSnapshotAccessDto } from '@artificer-toolkit/schema/api/contentSnapshots'

// Re-issue this long before expiry, so a token never lapses during a Worker request.
const REFRESH_MARGIN_MS = 60_000

/**
 * The caller's content token for private snapshot objects, issued by `contentSnapshots.issueAccess`
 * and reused until shortly before it expires. `refresh` forces a new token, for a request the
 * Worker refused because the cached token predates a newly granted scope.
 */
export function createContentAccessCache(
  issue: () => Promise<ContentSnapshotAccessDto>,
  now: () => number = Date.now
) {
  let cached: { token: string; refreshAt: number } | null = null
  let issuing: Promise<string> | null = null

  return function getToken(refresh: boolean): Promise<string> {
    if (!refresh && cached && now() < cached.refreshAt) return Promise.resolve(cached.token)
    issuing ??= issue()
      .then(({ expiresAt, token }) => {
        cached = { token, refreshAt: Date.parse(expiresAt) - REFRESH_MARGIN_MS }
        return token
      })
      .finally(() => {
        issuing = null
      })
    return issuing
  }
}
