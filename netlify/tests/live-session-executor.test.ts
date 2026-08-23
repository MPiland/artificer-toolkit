import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execute: vi.fn<() => Promise<unknown>>(),
  withUserContext: vi.fn(async (_db, _userId, callback) => callback({}))
}))

vi.mock('@artificer-toolkit/db', () => ({
  createDb: vi.fn(() => ({})),
  withUserContext: mocks.withUserContext
}))
vi.mock('@artificer-toolkit/functions/services', () => ({
  classifyLiveSessionCommandError: (error: unknown) => {
    const name = error instanceof Error ? error.name : ''
    if (
      name === 'CharacterSheetCommandError' ||
      name === 'EncounterNotFoundError' ||
      name === 'EncounterValidationError'
    ) {
      return 'INVALID_COMMAND'
    }
    if (name === 'CampaignAccessError' || name === 'LiveSessionAuthorityError') {
      return 'UNAUTHORIZED'
    }
    if (
      name === 'ConcurrencyError' ||
      name === 'EncounterConflictError' ||
      name === 'LiveSessionCommandAuthorityError'
    ) {
      return 'STALE_VERSION'
    }
    return 'COMMAND_FAILED'
  },
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

function authorizedRequest(body: unknown = input): Request {
  return new Request('https://app.test/.netlify/functions/live-session-executor', {
    body: JSON.stringify(body),
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
  mocks.execute.mockResolvedValue({ ok: true, operation: 'CLAIM' })
})

afterEach(() => vi.restoreAllMocks())

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

  it('measures a successful command through transaction completion', async () => {
    const commandInput = {
      ...input,
      command: {
        aggregateKind: 'SCENE',
        command: {
          commandId: '00000000-0000-4000-8000-000000000010',
          encounterId: '00000000-0000-4000-8000-000000000011',
          expectedSceneVersion: 0,
          path: [
            { x: 20, y: 20 },
            { x: 25, y: 20 }
          ],
          sceneId: '00000000-0000-4000-8000-000000000012',
          tokenId: '00000000-0000-4000-8000-000000000013',
          type: 'MOVE_SCENE_TOKEN'
        }
      },
      operation: 'COMMAND',
      sceneVisionContext: { characterVisions: [], encounterCharacterBindings: [] }
    }
    const commandResponse = {
      execution: {
        aggregateId: commandInput.command.command.sceneId,
        aggregateKind: 'SCENE',
        commandId: commandInput.command.command.commandId,
        hostTiming: { category: 'SCENE_ONLY', durationMs: 1 },
        replayed: false,
        response: null,
        version: 1
      },
      operation: 'COMMAND'
    }
    let releaseTransaction!: () => void
    const transactionReleased = new Promise<void>((resolve) => {
      releaseTransaction = resolve
    })
    mocks.execute.mockResolvedValueOnce(commandResponse)
    mocks.withUserContext.mockImplementationOnce(async (_db, _userId, callback) => {
      const result = await callback({})
      await transactionReleased
      return result
    })
    vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(170)

    const responsePromise = liveSessionExecutor(authorizedRequest(commandInput))
    await Promise.resolve()
    releaseTransaction()
    const response = await responsePromise

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      execution: { hostTiming: { category: 'SCENE_ONLY', durationMs: 70 } },
      operation: 'COMMAND'
    })
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

  it('keeps unknown executor failures retryable and correlates server-only detail', async () => {
    const error = Object.assign(new Error('Unexpected database outage.'), {
      code: 'EMAXCONNSESSION'
    })
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.execute.mockRejectedValueOnce(error)

    const response = await liveSessionExecutor(authorizedRequest())

    expect(response.status).toBe(500)
    const body = (await response.json()) as { error: { code: string; message: string } }
    expect(body).toEqual({
      error: {
        code: 'COMMAND_FAILED',
        message: expect.stringMatching(/^Live-session command failed\. Reference [0-9a-f-]{36}\.$/)
      }
    })
    expect(body.error.message).not.toContain(error.message)
    const errorId = body.error.message.match(/Reference ([0-9a-f-]{36})\./)?.[1]
    expect(errorId).toBeDefined()
    expect(errorLog).toHaveBeenCalledWith(
      '[live-session-executor-unexpected]',
      expect.objectContaining({
        databaseCode: error.code,
        errorId,
        errorMessage: error.message,
        errorName: error.name,
        stack: expect.stringContaining('Unexpected database outage.')
      })
    )
  })
})
