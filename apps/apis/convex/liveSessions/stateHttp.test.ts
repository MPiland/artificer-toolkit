import { ConvexError } from 'convex/values'
import { afterEach, expect, it, vi } from 'vitest'
import { fixture } from '../../tests/fixtures/characters'
import { isConvexExecutionTimeout } from './stateHttp'

const secret = 'private-state-http-test-secret-at-least-32-bytes'

afterEach(() => {
  vi.unstubAllEnvs()
})

it('serves room inputs only with the Worker secret and redacts a refused epoch', async () => {
  const base = await fixture()
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
  const request = (headers: Record<string, string>) =>
    base.owner.caller.fetch('/live-sessions/room-inputs', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        campaignId: crypto.randomUUID(),
        epoch: crypto.randomUUID(),
        scope: { kind: 'CAMPAIGN_PLAY' }
      })
    })

  expect((await request({})).status).toBe(401)
  expect((await request({ 'x-artificer-live-session-secret': `${secret}x` })).status).toBe(401)
  const refused = await request({ 'x-artificer-live-session-secret': secret })
  expect(refused.status).toBe(409)
  expect(await refused.text()).toBe('Live Session room inputs unavailable.')
})

it('reports only a Convex execution timeout as retryable, never a stale-state or domain failure (D47)', () => {
  expect(
    isConvexExecutionTimeout(new Error('Function execution timed out (maximum duration: 1s)'))
  ).toBe(true)
  expect(isConvexExecutionTimeout(new Error('Live Session authority sequence is stale.'))).toBe(
    false
  )
  expect(isConvexExecutionTimeout(new ConvexError('Function execution timed out'))).toBe(false)
  expect(isConvexExecutionTimeout('Function execution timed out')).toBe(false)
})
