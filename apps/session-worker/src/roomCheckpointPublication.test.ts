import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  liveSessionCheckpointRequestSchema,
  type LiveSessionCheckpointInput,
  type LiveSessionCheckpointResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { LIVE_SESSION_CHECKPOINT_MAX_BYTES } from '@artificer-toolkit/schema/api/liveSessionCheckpointFence'
import { LIVE_SESSION_ROUTE_PATHS } from '@artificer-toolkit/schema/api/liveSessionRoutePaths'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { JSON_PAYLOAD_CHUNK_MAX_BYTES } from '@artificer-toolkit/shared/jsonPayloadChunks'
import { NO_CHECKPOINT_IO } from '../test/checkpointIoFixture.js'
import { roomAuthorizationResponse } from '../test/roomAuthorizationFixture.js'
import { publishRoomCheckpoint } from './roomCheckpointPublication.js'

const id = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const environment = {
  CONVEX_SITE_URL: 'http://127.0.0.1:3211',
  LIVE_SESSION_WORKER_SECRET: 'test-worker-secret'
}

function checkpoint(text = 'small'): LiveSessionCheckpointInput {
  const value = { text }
  const records: LiveSessionCheckpointInput['records'] = {
    changes: [
      {
        table: 'characterPlayStates',
        key: [id(4)],
        previousChecksum: null,
        nextChecksum: checksumCanonicalJson(value),
        delta: { set: value }
      }
    ],
    history: [],
    scenes: []
  }
  return {
    campaignId: id(1),
    epoch: id(2),
    checkpointId: id(3),
    fromSequence: 0,
    fromChecksum: '0'.repeat(64),
    sequence: 1,
    checksum: '1'.repeat(64),
    payloadChecksum: checksumCanonicalJson(records),
    records,
    knownAuthorization: null
  }
}

function response(input: LiveSessionCheckpointInput): LiveSessionCheckpointResponse {
  return {
    status: 'COMMITTED',
    authority: {
      campaignId: input.campaignId,
      epoch: input.epoch,
      phase: 'DO_ACTIVE',
      activationFingerprint: '0'.repeat(64),
      persistedSequence: input.sequence,
      persistedStateChecksum: input.checksum,
      createdAt: '2026-09-30T00:00:00.000Z',
      updatedAt: '2026-09-30T00:00:00.000Z'
    },
    adopted: { characters: [] },
    io: {
      ...NO_CHECKPOINT_IO,
      bytesRead: 100,
      bytesWritten: 50,
      documentsRead: 4,
      documentsWritten: 2
    }
  }
}

function mockRoutes(input: LiveSessionCheckpointInput) {
  const calls: { path: string; body: string }[] = []
  const expectedResponse = response(input)
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
    const path = new URL(String(url)).pathname
    if (typeof init?.body !== 'string') throw new Error('Expected JSON request body.')
    calls.push({ path, body: init.body })
    expect(new Headers(init.headers).has('authorization')).toBe(false)
    expect(new Headers(init.headers).get('x-artificer-live-session-secret')).toBe(
      environment.LIVE_SESSION_WORKER_SECRET
    )
    return Response.json(expectedResponse)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetchMock, expectedResponse }
}

afterEach(() => vi.unstubAllGlobals())

describe('room checkpoint publication', () => {
  it('publishes a small checkpoint inline and returns its response', async () => {
    const input = checkpoint()
    const { calls, expectedResponse } = mockRoutes(input)
    const result = await publishRoomCheckpoint(environment, input, 'RELOAD')

    expect(result).toEqual({
      response: expectedResponse,
      payloadBytes: new TextEncoder().encode(canonicalizeJson(input.records)).byteLength,
      requests: 1
    })
    expect(calls.map(({ path }) => path)).toEqual([LIVE_SESSION_ROUTE_PATHS.checkpoint])
    expect(liveSessionCheckpointRequestSchema.parse(JSON.parse(calls[0].body))).toEqual({
      ...input,
      reason: 'RELOAD'
    })
  })

  it('publishes a multibyte checkpoint over 240 KiB inline in one request', async () => {
    // Four-byte characters beyond one chunk, so the payload is multibyte and over 240 KiB.
    const input = checkpoint('🎲'.repeat(62_000))
    const head = {
      sceneId: id(5),
      version: 2,
      fogLayerCount: 0,
      nextFogOrdinal: 0,
      settings: {
        ambientIllumination: { value: 'BRIGHT', daylight: false, version: 0 },
        visionRevealMode: { value: 'ON_DRAG', version: 0 },
        fogMode: { value: 'OFF', version: 0 }
      },
      counts: {
        annotations: 0,
        barriers: 0,
        darknessZones: 0,
        lights: 0,
        tokens: 0,
        measurements: 0
      },
      nextOrdinals: {
        annotations: 0,
        barriers: 0,
        darknessZones: 0,
        lights: 0,
        tokens: 0,
        measurements: 0
      }
    }
    input.records.scenes.push({
      sceneId: id(5),
      definitionSaveId: id(6),
      definitionVersion: 1,
      presentationVersion: 3,
      fromVersion: 0,
      toVersion: 2,
      changes: [
        {
          table: 'sceneLiveStates',
          key: [id(5)],
          previousChecksum: null,
          nextChecksum: checksumCanonicalJson(head),
          delta: { set: head }
        }
      ]
    })
    input.payloadChecksum = checksumCanonicalJson(input.records)
    input.knownAuthorization = roomAuthorizationResponse({ members: [] }).revisions
    const { calls } = mockRoutes(input)
    const published = await publishRoomCheckpoint(environment, input, 'ADMISSION')

    const byteLength = new TextEncoder().encode(canonicalizeJson(input.records)).byteLength
    expect(byteLength).toBeGreaterThan(JSON_PAYLOAD_CHUNK_MAX_BYTES)
    expect(byteLength).toBeLessThanOrEqual(LIVE_SESSION_CHECKPOINT_MAX_BYTES)
    expect(calls.map(({ path }) => path)).toEqual([LIVE_SESSION_ROUTE_PATHS.checkpoint])
    expect(liveSessionCheckpointRequestSchema.parse(JSON.parse(calls[0].body))).toEqual({
      ...input,
      reason: 'ADMISSION'
    })
    expect(published.requests).toBe(1)
    expect(published.payloadBytes).toBe(byteLength)
  })

  it('rejects invalid contracts, checksums, and oversized records before any request', async () => {
    const input = checkpoint()
    const { fetchMock } = mockRoutes(input)
    await expect(
      publishRoomCheckpoint(environment, { ...input, sequence: -1 }, 'BACKLOG')
    ).rejects.toThrow()
    await expect(
      publishRoomCheckpoint(environment, { ...input, payloadChecksum: 'f'.repeat(64) }, 'BACKLOG')
    ).rejects.toThrow('checksum')
    await expect(
      publishRoomCheckpoint(
        environment,
        checkpoint('x'.repeat(LIVE_SESSION_CHECKPOINT_MAX_BYTES)),
        'BACKLOG'
      )
    ).rejects.toThrow('byte limit')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
