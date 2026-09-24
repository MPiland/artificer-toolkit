import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { LiveSessionTransientCaptureInput } from '@artificer-toolkit/schema/api/liveSessionTransient'
import { createSceneDefinitionFixture } from '../../tests/fixtures/sceneDefinitions'

const secret = 'test-live-session-executor-secret-that-is-long-enough'

beforeEach(() => vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret))
afterEach(() => vi.unstubAllEnvs())

async function setup() {
  const base = await createSceneDefinitionFixture()
  const input: LiveSessionTransientCaptureInput = {
    campaignId: base.campaign.id,
    expectedRole: 'OWNER',
    expectedUserId: base.owner.userId,
    observedCharacterRevisions: [],
    recipientUserIds: [base.owner.userId, base.other.userId]
  }
  return { base, input }
}

function request(input: unknown, headers: Record<string, string>): RequestInit {
  return { body: JSON.stringify(input), headers, method: 'POST' }
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: 'Bearer test-convex-identity',
    'Content-Type': 'application/json',
    'x-artificer-live-session-secret': secret
  }
}

it('requires both the worker secret and authenticated user identity', async () => {
  const { base, input } = await setup()
  const response = await base.t.fetch('/live-sessions/capture', request(input, {}))
  expect(response.status).toBe(401)
  expect(response.headers.get('Cache-Control')).toBe('no-store')

  const jwtOnly = await base.owner.caller.fetch(
    '/live-sessions/capture',
    request(input, {
      Authorization: 'Bearer test-convex-identity',
      'Content-Type': 'application/json'
    })
  )
  expect(jwtOnly.status).toBe(401)

  const secretOnly = await base.t.fetch(
    '/live-sessions/capture',
    request(input, {
      'Content-Type': 'application/json',
      'x-artificer-live-session-secret': secret
    })
  )
  expect(secretOnly.status).toBe(401)

  const wrongSecret = await base.owner.caller.fetch(
    '/live-sessions/capture',
    request(input, { ...authHeaders(), 'x-artificer-live-session-secret': `${secret}-wrong` })
  )
  expect(wrongSecret.status).toBe(401)
})

it('returns 503 without a configured or sufficiently long worker secret', async () => {
  const { base, input } = await setup()
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', '')
  const missing = await base.owner.caller.fetch(
    '/live-sessions/capture',
    request(input, authHeaders())
  )
  expect(missing.status).toBe(503)
  expect(missing.headers.get('Cache-Control')).toBe('no-store')

  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', 'too-short')
  const short = await base.owner.caller.fetch(
    '/live-sessions/capture',
    request(input, authHeaders())
  )
  expect(short.status).toBe(503)
  expect(short.headers.get('Cache-Control')).toBe('no-store')
})

it('rejects malformed JSON before invoking the capture query', async () => {
  const { base } = await setup()
  const response = await base.owner.caller.fetch('/live-sessions/capture', {
    body: '{',
    headers: authHeaders(),
    method: 'POST'
  })
  expect(response.status).toBe(400)
  expect(await response.text()).toBe('Invalid JSON.')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
})

it('rejects valid JSON that fails the shared capture input schema', async () => {
  const { base } = await setup()
  const response = await base.owner.caller.fetch(
    '/live-sessions/capture',
    request({ invalid: true }, authHeaders())
  )
  expect(response.status).toBe(400)
  expect(await response.text()).toBe('Invalid JSON.')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
})

it('returns owner and player captures through authenticated HTTP', async () => {
  const { base, input } = await setup()
  const owner = await base.owner.caller.fetch(
    '/live-sessions/capture',
    request(input, authHeaders())
  )
  expect(owner.status).toBe(200)
  expect(await owner.json()).toMatchObject({
    campaignId: base.campaign.id,
    origin: { role: 'OWNER', userId: base.owner.userId }
  })

  const playerInput = {
    ...input,
    expectedRole: 'PLAYER' as const,
    expectedUserId: base.other.userId
  }
  const player = await base.other.caller.fetch(
    '/live-sessions/capture',
    request(playerInput, authHeaders())
  )
  expect(player.status).toBe(200)
  expect(await player.json()).toMatchObject({
    campaignId: base.campaign.id,
    origin: { role: 'PLAYER', userId: base.other.userId }
  })
})

it('returns a generic conflict for mismatched expected user or role', async () => {
  const { base, input } = await setup()
  const mismatchedUser = await base.owner.caller.fetch(
    '/live-sessions/capture',
    request({ ...input, expectedUserId: base.other.userId }, authHeaders())
  )
  expect(mismatchedUser.status).toBe(409)
  expect(await mismatchedUser.text()).toBe('Live Session capture unavailable.')

  const mismatchedRole = await base.owner.caller.fetch(
    '/live-sessions/capture',
    request({ ...input, expectedRole: 'PLAYER' as const }, authHeaders())
  )
  expect(mismatchedRole.status).toBe(409)
  expect(await mismatchedRole.text()).toBe('Live Session capture unavailable.')
})
