import type {
  LiveSessionTransientCapture,
  LiveSessionTransientCaptureInput
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import { sceneCurrentEntityPageSchema } from '@artificer-toolkit/schema/api/sceneRecipient'
import {
  sceneFogChunksPageSchema,
  sceneFogLayersPageSchema
} from '@artificer-toolkit/schema/api/sceneFog'
import { sceneLiveStateHeaderSchema } from '@artificer-toolkit/schema/api/sceneLiveState'
import { campaignSceneStateDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneSessionCharacterVisionResultSchema,
  sceneSessionVisionBindingsPageSchema,
  sceneSessionVisionRunsPageSchema
} from '@artificer-toolkit/schema/api/sceneSessionVision'
import { afterEach, expect, it, vi } from 'vitest'

import { callLiveSessionRoute, LiveSessionRouteError } from '../src/liveSessionRoutes.js'
import { hydrateNativeTransientScene } from '../src/nativeSceneClient.js'

const environment = {
  LIVE_SESSION_WORKER_SECRET: 'test-secret-that-contains-at-least-thirty-two-bytes',
  CONVEX_SITE_URL: 'https://executor.test/command'
}
const campaignId = '00000000-0000-4000-8000-000000000101'
const userId = '00000000-0000-4000-8000-000000000103'
const sceneId = '00000000-0000-4000-8000-000000000105'
const definitionId = '00000000-0000-4000-8000-000000000106'
const saveId = '00000000-0000-4000-8000-000000000107'
const assetId = '00000000-0000-4000-8000-000000000108'
const characterOneId = '00000000-0000-4000-8000-000000000109'
const characterTwoId = '00000000-0000-4000-8000-000000000110'
const tokenOneId = '00000000-0000-4000-8000-000000000111'
const tokenTwoId = '00000000-0000-4000-8000-000000000112'

const input = {
  campaignId,
  expectedRole: 'OWNER',
  expectedUserId: userId,
  mode: 'FULL',
  observedCharacterRevisions: [],
  recipientUserIds: []
} satisfies LiveSessionTransientCaptureInput

const capture: LiveSessionTransientCapture = {
  campaignId,
  observedCharacterRevisions: [],
  origin: { membershipEpoch: '2026-09-12T00:00:00.000Z', role: 'OWNER', userId },
  presentation: null,
  recipients: [],
  sceneEncounterId: null,
  sceneMovementDecisionPending: false,
  originBoundTokenControl: [],
  sceneHeader: null,
  systemId: '00000000-0000-4000-8000-000000000104',
  visionFreshness: null
}

afterEach(() => vi.restoreAllMocks())

function header(overrides: Partial<{ fogLayerCount: number; tokens: number }> = {}) {
  return sceneLiveStateHeaderSchema.parse({
    ambientIllumination: 'DIM',
    campaignId,
    counts: { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: 0 },
    currentCounts: {
      annotations: 0,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      measurements: 0,
      tokens: overrides.tokens ?? 0
    },
    definitionId,
    definitionSaveId: saveId,
    definitionVersion: 1,
    fogLayerCount: overrides.fogLayerCount ?? 0,
    fogMode: 'PER_PLAYER',
    grid: {
      cellSize: 50,
      diagonalPolicy: 'EQUAL',
      distancePerCell: 5,
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      unit: 'FEET'
    },
    id: sceneId,
    map: { assetId, height: 100, tileManifestAssetId: null, width: 100 },
    name: 'Scene',
    version: 1,
    visionRevealMode: 'ON_DRAG'
  })
}

function sceneCapture(sceneHeader: ReturnType<typeof header>): LiveSessionTransientCapture {
  return {
    ...capture,
    presentation: { campaignId, sceneId, version: 2 },
    sceneHeader,
    visionFreshness: { campaign: null, play: null, system: null }
  }
}

function entityPage(
  collection: 'annotations' | 'barriers' | 'darknessZones' | 'lights' | 'measurements' | 'tokens',
  page: unknown[],
  next: { afterOrdinal: number | null; phase: 'APPENDED' | 'BASE' } | null = null
) {
  return sceneCurrentEntityPageSchema.parse({ collection, next, page, version: 1 })
}

function emptyHydration(kind: string) {
  if (kind === 'FOG_LAYERS')
    return sceneFogLayersPageSchema.parse({
      continueCursor: '',
      isDone: true,
      page: [],
      version: 1
    })
  if (kind === 'VISION_RUNS')
    return sceneSessionVisionRunsPageSchema.parse({ continueCursor: '', isDone: true, page: [] })
  throw new Error(`Unexpected hydration kind ${kind}.`)
}

function mockHydration(
  responder: (request: Record<string, unknown>) => unknown
): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
    const body = JSON.parse(String(options?.body)) as { request: Record<string, unknown> }
    return Response.json({ kind: body.request.kind, result: responder(body.request) })
  })
}

it('posts capture with both credentials and redirect following disabled', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(capture))

  await expect(
    callLiveSessionRoute(environment, 'access-token', 'capture', input)
  ).resolves.toEqual(capture)

  const [url, options] = fetchMock.mock.calls[0]!
  expect(String(url)).toBe('https://executor.test/live-sessions/capture')
  expect(JSON.parse(String(options?.body))).toEqual(input)
  expect(options).toMatchObject({
    headers: {
      authorization: 'Bearer access-token',
      'content-type': 'application/json',
      'x-artificer-live-session-secret': environment.LIVE_SESSION_WORKER_SECRET
    },
    method: 'POST',
    redirect: 'manual'
  })
})

it('rejects redirects without forwarding credentials to another destination', async () => {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'https://other.test/capture' } })
    )
  await expect(
    callLiveSessionRoute(environment, 'access-token', 'capture', input)
  ).rejects.toMatchObject({
    status: 302
  })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0]?.[1]?.redirect).toBe('manual')
})
it('exposes only the response status when the server returns secret-bearing text', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('secret body', { status: 409 }))

  const error = await callLiveSessionRoute(environment, 'access-token', 'capture', input).catch(
    (reason: unknown) => reason
  )

  expect(error).toBeInstanceOf(LiveSessionRouteError)
  expect(error).toMatchObject({ status: 409 })
  expect(String(error)).not.toContain('secret body')
  expect(String(error)).not.toContain(environment.LIVE_SESSION_WORKER_SECRET)
})

it('rejects malformed successful responses without exposing their contents', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ secret: 'body' }))

  const error = await callLiveSessionRoute(environment, 'access-token', 'capture', input).catch(
    (reason: unknown) => reason
  )

  expect(error).toMatchObject({ status: 200 })
  expect(String(error)).not.toContain('body')
})

it('uses a compact captured Scene without entity or fog hydration requests', async () => {
  const sceneHeader = header()
  const {
    counts: _counts,
    currentCounts: _currentCounts,
    definitionSaveId: _definitionSaveId,
    fogLayerCount: _fogLayerCount,
    ...scene
  } = sceneHeader
  const sceneSnapshot = campaignSceneStateDtoSchema.parse({
    ...scene,
    annotations: [],
    barriers: [],
    darknessZones: [],
    doorStates: {},
    fogLayers: [],
    lights: [],
    measurements: [],
    tokens: []
  })
  const fetchMock = mockHydration((request) => {
    expect(request.kind).toBe('VISION_RUNS')
    return emptyHydration(String(request.kind))
  })

  const baseOrdinals = { tokens: [], barriers: [] }
  const result = await hydrateNativeTransientScene(environment, 'access-token', {
    ...sceneCapture(sceneHeader),
    sceneSnapshot: { scene: sceneSnapshot, baseOrdinals }
  })

  expect(result.scene).toEqual(sceneSnapshot)
  expect(result.baseOrdinals).toEqual(baseOrdinals)
  expect(fetchMock).not.toHaveBeenCalled()
})

it('follows an empty BASE page into APPENDED entities and retains door state', async () => {
  const sceneHeader = header()
  sceneHeader.currentCounts.barriers = 1
  const door = {
    a: { x: 0, y: 0 },
    b: { x: 10, y: 0 },
    blocksLightWhenClosed: true,
    blocksMovementWhenClosed: true,
    id: '00000000-0000-4000-8000-000000000113',
    initialState: 'CLOSED',
    kind: 'DOOR',
    openAngleDegrees: 90
  }
  mockHydration((request) => {
    if (request.kind !== 'ENTITIES') return emptyHydration(String(request.kind))
    if (
      request.collection === 'annotations' ||
      request.collection === 'darknessZones' ||
      request.collection === 'lights' ||
      request.collection === 'measurements' ||
      request.collection === 'tokens'
    )
      return entityPage(request.collection, [])
    if (request.phase === 'BASE')
      return entityPage('barriers', [], { afterOrdinal: null, phase: 'APPENDED' })
    return entityPage('barriers', [
      { doorState: 'OPEN', ordinal: 0, value: { collection: 'barriers', entity: door } }
    ])
  })

  const result = await hydrateNativeTransientScene(
    environment,
    'access-token',
    sceneCapture(sceneHeader)
  )

  expect(result.scene?.doorStates[door.id]).toBe('OPEN')
  expect(result.scene?.barriers).toEqual([door])
  // A barrier added during play has no definition ordinal.
  expect(result.baseOrdinals.barriers).toEqual([{ barrierId: door.id, baseOrdinal: null }])
})

it('rejects entity pagination cycles and header count mismatches', async () => {
  const sceneHeader = header()
  mockHydration((request) => {
    if (request.kind !== 'ENTITIES') return emptyHydration(String(request.kind))
    if (request.collection === 'annotations')
      return entityPage('annotations', [], { afterOrdinal: null, phase: 'BASE' })
    if (
      request.collection === 'barriers' ||
      request.collection === 'darknessZones' ||
      request.collection === 'lights' ||
      request.collection === 'measurements' ||
      request.collection === 'tokens'
    )
      return entityPage(request.collection, [])
    throw new Error('Unexpected entity collection.')
  })

  await expect(
    hydrateNativeTransientScene(environment, 'access-token', sceneCapture(sceneHeader))
  ).rejects.toMatchObject({ status: 200 })
})

it('hydrates shared and private fog through independent pages', async () => {
  const sceneHeader = header({ fogLayerCount: 2 })
  const privateOwner = '00000000-0000-4000-8000-000000000114'
  mockHydration((request) => {
    if (request.kind === 'ENTITIES') {
      if (
        request.collection === 'annotations' ||
        request.collection === 'barriers' ||
        request.collection === 'darknessZones' ||
        request.collection === 'lights' ||
        request.collection === 'measurements' ||
        request.collection === 'tokens'
      )
        return entityPage(request.collection, [])
      throw new Error('Unexpected entity collection.')
    }
    if (request.kind === 'FOG_LAYERS') {
      if (request.paginationOpts === null || typeof request.paginationOpts !== 'object')
        throw new Error('Missing fog cursor.')
      const cursor = (request.paginationOpts as { cursor?: unknown }).cursor
      return sceneFogLayersPageSchema.parse(
        cursor === null
          ? {
              continueCursor: 'private',
              isDone: false,
              page: [{ chunkCount: 1, height: 1, ordinal: 0, ownerUserId: null, width: 1 }],
              version: 1
            }
          : {
              continueCursor: '',
              isDone: true,
              page: [{ chunkCount: 1, height: 1, ordinal: 1, ownerUserId: privateOwner, width: 1 }],
              version: 1
            }
      )
    }
    if (request.kind === 'FOG_CHUNKS')
      return sceneFogChunksPageSchema.parse({
        height: 1,
        isDone: true,
        nextOffset: 1,
        ownerUserId: request.ownerUserId,
        page: [{ data: 'AA==', height: 1, index: 0, width: 1, x: 0, y: 0 }],
        version: 1,
        width: 1
      })
    return emptyHydration(String(request.kind))
  })

  const result = await hydrateNativeTransientScene(
    environment,
    'access-token',
    sceneCapture(sceneHeader)
  )

  expect(result.scene?.fogLayers.map((layer) => layer.ownerUserId)).toEqual([null, privateOwner])
})

it('composes vision for two bound Characters while retaining explicit token vision', async () => {
  const sceneHeader = header({ tokens: 2 })
  const token = (id: string, label: string) => ({
    assetId: null,
    controlledByUserIds: [],
    height: 5,
    hidden: false,
    id,
    label,
    locked: false,
    position: { x: 0, y: 0 },
    rotationDegrees: 0,
    vision: null,
    width: 5
  })
  const tokens = [token(tokenOneId, 'One'), token(tokenTwoId, 'Two')]
  const encounterId = '00000000-0000-4000-8000-000000000115'
  const run = {
    campaignId,
    encounterId,
    expectedEncounterVersion: 3,
    expectedPresentationVersion: 2,
    expectedSceneVersion: 1,
    freshness: { campaign: null, play: null, system: null },
    sceneId,
    systemId: capture.systemId
  }
  const bindings = [
    {
      ...run,
      actorId: '00000000-0000-4000-8000-000000000116',
      characterId: characterOneId,
      streamVersion: 0,
      tokenId: tokenOneId
    },
    {
      ...run,
      actorId: '00000000-0000-4000-8000-000000000117',
      characterId: characterTwoId,
      streamVersion: 0,
      tokenId: tokenTwoId
    }
  ]
  mockHydration((request) => {
    if (request.kind === 'ENTITIES') {
      if (request.collection === 'tokens')
        return entityPage(
          'tokens',
          tokens.map((entity, ordinal) => ({
            doorState: null,
            ordinal,
            value: { collection: 'tokens', entity }
          }))
        )
      if (
        request.collection === 'annotations' ||
        request.collection === 'barriers' ||
        request.collection === 'darknessZones' ||
        request.collection === 'lights' ||
        request.collection === 'measurements'
      )
        return entityPage(request.collection, [])
      throw new Error('Unexpected entity collection.')
    }
    if (request.kind === 'FOG_LAYERS') return emptyHydration('FOG_LAYERS')
    if (request.kind === 'VISION_RUNS')
      return sceneSessionVisionRunsPageSchema.parse({
        continueCursor: '',
        isDone: true,
        page: [run]
      })
    if (request.kind === 'VISION_BINDINGS')
      return sceneSessionVisionBindingsPageSchema.parse({
        continueCursor: '',
        isDone: true,
        page: bindings
      })
    if (request.kind === 'VISION_CHARACTER') {
      const binding = bindings.find((candidate) => candidate.characterId === request.characterId)
      if (!binding) throw new Error('Unexpected Character vision request.')
      return sceneSessionCharacterVisionResultSchema.parse({
        binding: {
          actorId: binding.actorId,
          characterId: binding.characterId,
          encounterId: binding.encounterId,
          tokenId: binding.tokenId
        },
        characterRevision: null,
        characterVision: {
          characterId: binding.characterId,
          dimRange: { amount: 30, unit: 'FEET' }
        },
        snapshotChecksum: '0000000000000000000000000000000000000000000000000000000000000000'
      })
    }
    throw new Error('Unexpected hydration kind.')
  })

  const result = await hydrateNativeTransientScene(
    environment,
    'access-token',
    sceneCapture(sceneHeader)
  )

  expect(result.scene?.tokens.map((candidate) => candidate.vision?.dimRange)).toEqual([30, 30])
  expect(result.characterRevisions).toEqual([
    { characterId: characterOneId, revision: null },
    { characterId: characterTwoId, revision: null }
  ])
})
