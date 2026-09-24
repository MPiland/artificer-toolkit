import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  LiveSessionTransientCapture,
  LiveSessionTransientCaptureInput
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import type { LiveSessionTransientHydrationInput } from '@artificer-toolkit/schema/api/liveSessionTransientHydration'
import type {
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type {
  SceneFogAppendInput,
  SceneFogPatchInput,
  SceneFogSaveProgress,
  SceneFogCommandResult
} from '@artificer-toolkit/schema/api/sceneFog'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  createSceneDefinitionFixture,
  publishEmptyScene
} from '../../tests/fixtures/sceneDefinitions'

const secret = 'test-live-session-executor-secret-that-is-long-enough'

const setPresentation = makeFunctionReference<
  'mutation',
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
>('scenes/presentations:set')
const beginFog = makeFunctionReference<
  'mutation',
  { input: SceneFogPatchInput },
  SceneFogSaveProgress
>('scenes/fogCommands:begin')
const appendFog = makeFunctionReference<
  'mutation',
  { input: SceneFogAppendInput },
  SceneFogSaveProgress
>('scenes/fogCommands:append')
const publishFog = makeFunctionReference<'mutation', { saveId: string }, SceneFogCommandResult>(
  'scenes/fogCommands:publish'
)
const capture = makeFunctionReference<
  'query',
  LiveSessionTransientCaptureInput,
  LiveSessionTransientCapture
>('liveSessions/transientCapture:capture')

beforeEach(() => vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret))
afterEach(() => vi.unstubAllEnvs())

async function setup() {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  await base.owner.caller.mutation(setPresentation, {
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: base.campaign.id,
    sceneId,
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
  })
  const fogChunk = { data: 'AQ==', height: 1, index: 0, width: 1, x: 0, y: 0 }
  const fogInput: SceneFogPatchInput = {
    type: 'PATCH_SCENE_FOG',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    layer: { ownerUserId: base.owner.userId, width: 8, height: 8 },
    chunkManifest: [{ index: 0, checksum: checksumCanonicalJson(fogChunk) }]
  }
  const save = await base.owner.caller.mutation(beginFog, { input: fogInput })
  await base.owner.caller.mutation(appendFog, {
    input: { saveId: save.saveId, offset: 0, chunks: [fogChunk] }
  })
  await base.owner.caller.mutation(publishFog, { saveId: save.saveId })
  const authority: LiveSessionTransientHydrationInput['authority'] = {
    campaignId: base.campaign.id,
    expectedRole: 'OWNER',
    expectedUserId: base.owner.userId
  }
  const captured = await base.owner.caller.query(capture, {
    ...authority,
    observedCharacterRevisions: [],
    recipientUserIds: []
  })
  if (!captured.sceneHeader || !captured.visionFreshness)
    throw new Error('Missing transient hydration capture fence.')
  return { authority, base, captured, sceneId }
}

function request(input: unknown): RequestInit {
  return {
    body: JSON.stringify(input),
    headers: {
      Authorization: 'Bearer test-convex-identity',
      'Content-Type': 'application/json',
      'x-artificer-live-session-secret': secret
    },
    method: 'POST'
  }
}

it('hydrates bounded entities for the owner and private fog layers for the player', async () => {
  const { authority, base, captured, sceneId } = await setup()
  const header = captured.sceneHeader!
  const entities: LiveSessionTransientHydrationInput = {
    authority,
    request: {
      afterOrdinal: null,
      collection: 'tokens',
      definitionSaveId: header.definitionSaveId,
      expectedVersion: header.version,
      kind: 'ENTITIES',
      numItems: 8,
      phase: 'BASE',
      sceneId
    }
  }
  const owner = await base.owner.caller.fetch('/live-sessions/hydrate', request(entities))
  expect(owner.status).toBe(200)
  expect(await owner.json()).toMatchObject({
    kind: 'ENTITIES',
    result: { version: header.version }
  })

  const playerAuthority = {
    ...authority,
    expectedRole: 'PLAYER' as const,
    expectedUserId: base.other.userId
  }
  const fog = await base.other.caller.fetch(
    '/live-sessions/hydrate',
    request({
      authority: playerAuthority,
      request: {
        expectedVersion: header.version,
        kind: 'FOG_LAYERS',
        paginationOpts: { cursor: null, numItems: 8 },
        sceneId
      }
    } satisfies LiveSessionTransientHydrationInput)
  )
  expect(fog.status).toBe(200)
  expect(await fog.json()).toMatchObject({
    kind: 'FOG_LAYERS',
    result: {
      page: [expect.objectContaining({ ownerUserId: base.owner.userId })],
      version: header.version
    }
  })
  const chunks = await base.owner.caller.fetch(
    '/live-sessions/hydrate',
    request({
      authority,
      request: {
        expectedVersion: header.version,
        kind: 'FOG_CHUNKS',
        numItems: 8,
        offset: 0,
        ownerUserId: base.owner.userId,
        sceneId
      }
    } satisfies LiveSessionTransientHydrationInput)
  )
  expect(chunks.status).toBe(200)
  expect(await chunks.json()).toMatchObject({
    kind: 'FOG_CHUNKS',
    result: { version: header.version }
  })
})

it('hydrates a vision run page only against the captured Campaign presentation fence', async () => {
  const { authority, base, captured, sceneId } = await setup()
  const visionInput: LiveSessionTransientHydrationInput = {
    authority,
    request: {
      campaignId: authority.campaignId,
      expectedPresentationVersion: captured.presentation!.version,
      expectedSceneVersion: captured.sceneHeader!.version,
      freshness: captured.visionFreshness!,
      kind: 'VISION_RUNS',
      paginationOpts: { cursor: null, numItems: 8 },
      sceneId,
      systemId: base.campaign.gameSystemId
    }
  }
  const response = await base.owner.caller.fetch('/live-sessions/hydrate', request(visionInput))
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ kind: 'VISION_RUNS', result: { page: [] } })

  const wrongSystem = await base.owner.caller.fetch(
    '/live-sessions/hydrate',
    request({
      ...visionInput,
      request: { ...visionInput.request, systemId: crypto.randomUUID() }
    })
  )
  expect(wrongSystem.status).toBe(409)
})

it('denies hydration without both credentials and rejects stale Scene fences', async () => {
  const { authority, base, captured, sceneId } = await setup()
  const input: LiveSessionTransientHydrationInput = {
    authority,
    request: {
      afterOrdinal: null,
      collection: 'tokens',
      definitionSaveId: captured.sceneHeader!.definitionSaveId,
      expectedVersion: captured.sceneHeader!.version + 1,
      kind: 'ENTITIES',
      numItems: 8,
      phase: 'BASE',
      sceneId
    }
  }
  const stale = await base.owner.caller.fetch('/live-sessions/hydrate', request(input))
  expect(stale.status).toBe(409)

  const mismatchedCampaign = await base.owner.caller.fetch(
    '/live-sessions/hydrate',
    request({
      ...input,
      authority: { ...authority, campaignId: crypto.randomUUID() }
    })
  )
  expect(mismatchedCampaign.status).toBe(409)

  const mismatchedScene = await base.owner.caller.fetch(
    '/live-sessions/hydrate',
    request({
      ...input,
      request: { ...input.request, sceneId: crypto.randomUUID() }
    })
  )
  expect(mismatchedScene.status).toBe(409)

  const jwtOnly = await base.owner.caller.fetch('/live-sessions/hydrate', {
    body: JSON.stringify(input),
    headers: { Authorization: 'Bearer test-convex-identity', 'Content-Type': 'application/json' },
    method: 'POST'
  })
  expect(jwtOnly.status).toBe(401)

  const secretOnly = await base.t.fetch('/live-sessions/hydrate', {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json',
      'x-artificer-live-session-secret': secret
    },
    method: 'POST'
  })
  expect(secretOnly.status).toBe(401)

  const denied = await base.t.fetch('/live-sessions/hydrate', {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST'
  })
  expect(denied.status).toBe(401)
})
