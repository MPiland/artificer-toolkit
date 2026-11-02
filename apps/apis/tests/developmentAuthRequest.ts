import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

export type AuthRequest = (
  path: string,
  body?: Record<string, unknown>,
  session?: string
) => Promise<Response>

/** Retries an auth request after a 429, waiting the server's bounded `X-Retry-After`, as the browser clients do. */
export function retryRateLimitedAuth(
  send: AuthRequest,
  wait: (milliseconds: number) => Promise<unknown> = delay
): AuthRequest {
  return async (path, body, session) => {
    for (let retry = 0; ; retry++) {
      const response = await send(path, body, session)
      if (response.status !== 429 || retry === 3) return response
      // Better Auth reports 0 for a request that lands exactly on its window boundary.
      const retrySeconds = Number(response.headers.get('X-Retry-After'))
      assert.ok(
        Number.isInteger(retrySeconds) && retrySeconds >= 0 && retrySeconds <= 10,
        "Auth rate limit requires the server's bounded retry delay."
      )
      console.log(`Auth rate limit on ${path}: waiting ${retrySeconds}s before retry ${retry + 1}.`)
      await wait(retrySeconds * 1000)
    }
  }
}
