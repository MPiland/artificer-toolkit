import { vi } from 'vitest'
import type { MutationCtx } from '../../convex/_generated/server'

export function workerEnvironment(secret: string) {
  return { CONVEX_SITE_URL: 'https://convex.example.test', LIVE_SESSION_WORKER_SECRET: secret }
}

/** Routes the Worker's Convex site requests by pathname, typically into a convex-test caller. */
export function stubLiveSessionFetch(
  route: (pathname: string, init?: RequestInit) => Promise<Response> | Response
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL | Request, init?: RequestInit) =>
      route(new URL(url instanceof Request ? url.url : url.toString()).pathname, init)
    )
  )
}

export function insertActiveLiveAuthority(
  ctx: MutationCtx,
  {
    campaignId,
    sessionId,
    epoch,
    createdAt
  }: { campaignId: string; sessionId: string; epoch: string; createdAt: string }
) {
  return ctx.db.insert('campaignLiveAuthorities', {
    campaignId,
    sessionId,
    epoch,
    phase: 'DO_ACTIVE',
    activationFingerprint: '0'.repeat(64),
    persistedSequence: 0,
    persistedStateChecksum: '0'.repeat(64),
    createdAt,
    updatedAt: createdAt
  })
}
