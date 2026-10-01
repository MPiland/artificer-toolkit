import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  liveSessionCheckpointInputSchema,
  type LiveSessionCheckpointInput,
  type LiveSessionCheckpointResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { LIVE_SESSION_CHECKPOINT_MAX_BYTES } from '@artificer-toolkit/schema/api/liveSessionCheckpointFence'
import {
  liveSessionCheckpointCommitInputSchema,
  liveSessionCheckpointPartInputSchema,
  liveSessionCheckpointStageInputSchema
} from '@artificer-toolkit/schema/api/liveSessionCheckpointStaging'
import { LIVE_SESSION_ROUTE_PATHS } from '@artificer-toolkit/schema/api/liveSessionRoutePaths'
import { decodeBase64 } from '@artificer-toolkit/shared/base64'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  decodeUtf8PayloadChunks,
  JSON_PAYLOAD_CHUNK_MAX_BYTES
} from '@artificer-toolkit/shared/jsonPayloadChunks'
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
    authorization: roomAuthorizationResponse({ members: [] })
  }
}

function mockRoutes(
  input: LiveSessionCheckpointInput,
  options: { replayed?: boolean; failPart?: number } = {}
) {
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
    if (path === LIVE_SESSION_ROUTE_PATHS.checkpointPart) {
      const part = liveSessionCheckpointPartInputSchema.parse(JSON.parse(init.body))
      if (part.index === options.failPart) throw new Error('Interrupted upload.')
    }
    return Response.json(
      path === LIVE_SESSION_ROUTE_PATHS.checkpoint ||
        path === LIVE_SESSION_ROUTE_PATHS.checkpointCommit
        ? expectedResponse
        : { status: options.replayed ? 'REPLAYED' : 'STAGED' }
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetchMock, expectedResponse }
}

afterEach(() => vi.unstubAllGlobals())

describe('room checkpoint publication', () => {
  it('publishes a small checkpoint inline and returns current authorization', async () => {
    const input = checkpoint()
    const { calls, expectedResponse } = mockRoutes(input)
    const result = await publishRoomCheckpoint(environment, input)

    expect(result).toEqual(expectedResponse)
    expect(calls.map(({ path }) => path)).toEqual([LIVE_SESSION_ROUTE_PATHS.checkpoint])
    expect(liveSessionCheckpointInputSchema.parse(JSON.parse(calls[0].body))).toEqual(input)
  })

  it('stages canonical UTF-8 records in order, then commits the same fence and authorization', async () => {
    const input = checkpoint('🎲'.repeat(JSON_PAYLOAD_CHUNK_MAX_BYTES / 2))
    const head = {
      sceneId: id(5),
      version: 2,
      fogLayerCount: 0,
      nextFogOrdinal: 0,
      settings: {
        ambientIllumination: { value: 'BRIGHT', version: 0 },
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
    input.knownAuthorization = response(input).authorization.revisions
    const { calls } = mockRoutes(input)
    await publishRoomCheckpoint(environment, input)

    const { records, knownAuthorization, ...frame } = input
    const recordsJson = canonicalizeJson(records)
    const byteLength = new TextEncoder().encode(recordsJson).byteLength
    const partCount = Math.ceil(byteLength / JSON_PAYLOAD_CHUNK_MAX_BYTES)
    expect(calls.map(({ path }) => path)).toEqual([
      LIVE_SESSION_ROUTE_PATHS.checkpointStage,
      ...Array.from({ length: partCount }, () => LIVE_SESSION_ROUTE_PATHS.checkpointPart),
      LIVE_SESSION_ROUTE_PATHS.checkpointCommit
    ])
    expect(liveSessionCheckpointStageInputSchema.parse(JSON.parse(calls[0].body))).toEqual({
      ...frame,
      byteLength,
      partCount
    })
    const parts = calls
      .slice(1, -1)
      .map(({ body }) => liveSessionCheckpointPartInputSchema.parse(JSON.parse(body)))
    expect(parts.map(({ index }) => index)).toEqual(Array.from({ length: partCount }, (_, i) => i))
    const reconstructed = decodeUtf8PayloadChunks(
      parts.map(({ data }) => decodeBase64(data).slice().buffer),
      byteLength
    )
    expect(reconstructed).toBe(recordsJson)
    expect(checksumCanonicalJson(JSON.parse(reconstructed))).toBe(input.payloadChecksum)
    expect(liveSessionCheckpointCommitInputSchema.parse(JSON.parse(calls.at(-1)!.body))).toEqual({
      ...frame,
      knownAuthorization
    })
  })

  it('skips uploads on a replayed begin and still fetches the commit response', async () => {
    const input = checkpoint('x'.repeat(JSON_PAYLOAD_CHUNK_MAX_BYTES))
    const { calls, expectedResponse } = mockRoutes(input, { replayed: true })
    expect(await publishRoomCheckpoint(environment, input)).toEqual(expectedResponse)
    expect(calls.map(({ path }) => path)).toEqual([
      LIVE_SESSION_ROUTE_PATHS.checkpointStage,
      LIVE_SESSION_ROUTE_PATHS.checkpointCommit
    ])
  })

  it('retries an interrupted upload with identical metadata and part bytes', async () => {
    const input = checkpoint('x'.repeat(JSON_PAYLOAD_CHUNK_MAX_BYTES * 2))
    const interrupted = mockRoutes(input, { failPart: 1 })
    await expect(publishRoomCheckpoint(environment, input)).rejects.toThrow()
    expect(interrupted.calls.map(({ path }) => path)).toEqual([
      LIVE_SESSION_ROUTE_PATHS.checkpointStage,
      LIVE_SESSION_ROUTE_PATHS.checkpointPart,
      LIVE_SESSION_ROUTE_PATHS.checkpointPart
    ])
    const retry = mockRoutes(input)
    await publishRoomCheckpoint(environment, input)
    expect(retry.calls.slice(0, interrupted.calls.length)).toEqual(interrupted.calls)
  })

  it('rejects invalid contracts, checksums, and oversized records before any request', async () => {
    const input = checkpoint()
    const { fetchMock } = mockRoutes(input)
    await expect(publishRoomCheckpoint(environment, { ...input, sequence: -1 })).rejects.toThrow()
    await expect(
      publishRoomCheckpoint(environment, {
        ...input,
        payloadChecksum: 'f'.repeat(64)
      })
    ).rejects.toThrow('checksum')
    await expect(
      publishRoomCheckpoint(environment, checkpoint('x'.repeat(LIVE_SESSION_CHECKPOINT_MAX_BYTES)))
    ).rejects.toThrow('byte limit')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
