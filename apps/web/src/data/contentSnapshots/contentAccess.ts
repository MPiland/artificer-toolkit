import type { ContentSnapshotAccessDto } from '@artificer-toolkit/schema/api/contentSnapshots'

// Re-issue this long before expiry, so a token never lapses during a Worker request.
const REFRESH_MARGIN_MS = 60_000

/**
 * The caller's content token for private snapshot objects, issued by `contentSnapshots.issueAccess`
 * and reused until shortly before it expires. `getToken(true)` forces a new token, for a request
 * the Worker refused because the cached token predates a newly granted scope; `clear` drops the
 * token at sign-out.
 */
export function createContentAccessCache(
  issue: () => Promise<ContentSnapshotAccessDto>,
  now: () => number = Date.now
) {
  let cached: { token: string; refreshAt: number } | null = null
  let issuing: Promise<string> | null = null
  let generation = 0

  return {
    getToken(refresh: boolean): Promise<string> {
      if (!refresh && cached && now() < cached.refreshAt) return Promise.resolve(cached.token)
      const issuedFor = generation
      issuing ??= issue()
        .then(({ expiresAt, token }) => {
          // A token issued before `clear` belongs to the previous session and is not kept.
          if (issuedFor === generation)
            cached = { token, refreshAt: Date.parse(expiresAt) - REFRESH_MARGIN_MS }
          return token
        })
        .finally(() => {
          issuing = null
        })
      return issuing
    },
    clear() {
      generation += 1
      cached = null
      issuing = null
    }
  }
}
