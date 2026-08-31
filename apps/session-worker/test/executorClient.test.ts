import type { LiveSessionExecutorRequestDto } from '@artificer-toolkit/schema/api/liveSessions'
import { afterEach, expect, it, vi } from 'vitest'

import { callLiveSessionExecutor, LiveSessionExecutorRequestError } from '../src/executorClient.js'

const environment = {
  LIVE_SESSION_EXECUTOR_SECRET: 'test-secret-that-contains-at-least-thirty-two-bytes',
  LIVE_SESSION_EXECUTOR_URL: 'https://executor.test/command'
}

const commandRequest = {
  authorityId: 'test-authority',
  campaignId: '00000000-0000-4000-8000-000000000101',
  command: {
    aggregateKind: 'SCENE',
    command: {
      commandId: '00000000-0000-4000-8000-000000000110',
      correlationId: null,
      expectedEncounterVersion: 1,
      expectedSceneVersion: 0,
      movementKind: 'VOLUNTARY',
      path: [
        { x: 20, y: 20 },
        { x: 25, y: 20 }
      ],
      sceneId: '00000000-0000-4000-8000-000000000106',
      tokenId: '00000000-0000-4000-8000-000000000108',
      type: 'MOVE_SCENE_TOKEN'
    }
  },
  operation: 'COMMAND',
  sceneVisionContext: { characterVisions: [], encounterCharacterBindings: [] },
  sessionId: '00000000-0000-4000-8000-000000000102',
  userId: '00000000-0000-4000-8000-000000000103'
} satisfies LiveSessionExecutorRequestDto

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('keeps one authoritative command request alive beyond the short control timeout', async () => {
  vi.useFakeTimers()
  let aborted = false
  let fetchCalls = 0
  vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
    fetchCalls += 1
    const signal = init?.signal
    if (!signal) throw new Error('Expected an executor timeout signal.')
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          aborted = true
          reject(signal.reason)
        },
        { once: true }
      )
    })
  })

  const outcome = callLiveSessionExecutor(environment, commandRequest).catch(
    (error: unknown) => error
  )
  await vi.advanceTimersByTimeAsync(10_001)
  expect(aborted).toBe(false)
  expect(fetchCalls).toBe(1)

  await vi.advanceTimersByTimeAsync(44_999)
  const error = await outcome
  expect(aborted).toBe(true)
  expect(error).toBeInstanceOf(LiveSessionExecutorRequestError)
  expect(error).toMatchObject({ retryable: true })
  expect(fetchCalls).toBe(1)
})

it('clears a completed executor timeout so the room can hibernate immediately', async () => {
  vi.useFakeTimers()
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ ok: true, operation: 'CLAIM' }))

  await callLiveSessionExecutor(environment, {
    authorityId: commandRequest.authorityId,
    campaignId: commandRequest.campaignId,
    operation: 'CLAIM',
    sessionId: commandRequest.sessionId,
    userId: commandRequest.userId
  })

  expect(vi.getTimerCount()).toBe(0)
})

it('accepts a compact Character command result without a presentation response', async () => {
  const characterId = '00000000-0000-4000-8000-000000000104'
  const commandId = '00000000-0000-4000-8000-000000000110'
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      execution: {
        aggregateId: characterId,
        aggregateKind: 'CHARACTER',
        characterVision: { characterId, dimRange: null },
        changedAggregates: [{ aggregateId: characterId, aggregateKind: 'CHARACTER', version: 1 }],
        commandId,
        hostTiming: { category: 'RULE_BOUND', durationMs: 12 },
        replayed: false,
        response: null,
        version: 1
      },
      operation: 'COMMAND'
    })
  )

  await expect(callLiveSessionExecutor(environment, commandRequest)).resolves.toMatchObject({
    execution: { aggregateKind: 'CHARACTER', response: null },
    operation: 'COMMAND'
  })
})
