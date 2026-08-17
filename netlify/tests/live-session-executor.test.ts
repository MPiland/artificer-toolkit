import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(async () => ({ ok: true, operation: 'CLAIM' as const })),
  withUserContext: vi.fn(async (_db, _userId, callback) => callback({}))
}))

vi.mock('@artificer-toolkit/db', () => ({
  createDb: vi.fn(() => ({})),
  withUserContext: mocks.withUserContext
}))
vi.mock('@artificer-toolkit/functions/services', () => ({
  executeLiveSessionExecutorRequest: mocks.execute
}))

import liveSessionExecutor from '../functions/live-session-executor.mts'

const secret = 'executor-secret-that-is-at-least-32-bytes'
const input = {
  authorityId: 'durable-object-id',
  campaignId: '00000000-0000-4000-8000-000000000001',
  operation: 'CLAIM',
  sessionId: '00000000-0000-4000-8000-000000000002',
  userId: '00000000-0000-4000-8000-000000000003'
} as const

function namedError(name: string): Error {
  const error = new Error('Expected deterministic command failure.')
  error.name = name
  return error
}

function authorizedRequest(): Request {
  return new Request('https://app.test/.netlify/functions/live-session-executor', {
    body: JSON.stringify(input),
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json'
    },
    method: 'POST'
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('LIVE_SESSION_EXECUTOR_SECRET', secret)
})

describe('live-session Netlify executor', () => {
  it('rejects requests that do not carry the provider secret', async () => {
    const response = await liveSessionExecutor(
      new Request('https://app.test/.netlify/functions/live-session-executor', {
        body: JSON.stringify(input),
        headers: { 'content-type': 'application/json' },
        method: 'POST'
      })
    )

    expect(response.status).toBe(401)
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('executes a validated request under the trusted actor database context', async () => {
    const response = await liveSessionExecutor(authorizedRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, operation: 'CLAIM' })
    expect(mocks.withUserContext).toHaveBeenCalledWith({}, input.userId, expect.any(Function))
    expect(mocks.execute).toHaveBeenCalledWith({}, input)
  })

  it.each(['CharacterSheetCommandError', 'EncounterNotFoundError', 'EncounterValidationError'])(
    'returns typed invalid-request responses for %s',
    async (errorName) => {
      mocks.execute.mockRejectedValueOnce(namedError(errorName))

      const response = await liveSessionExecutor(authorizedRequest())

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: { code: 'INVALID_REQUEST', message: 'Live-session command is invalid.' }
      })
    }
  )

  it('keeps unknown executor failures retryable', async () => {
    mocks.execute.mockRejectedValueOnce(new Error('Unexpected database outage.'))

    const response = await liveSessionExecutor(authorizedRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'COMMAND_FAILED', message: 'Live-session command failed.' }
    })
  })
})
