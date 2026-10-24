import assert from 'node:assert/strict'

import sharp from 'sharp'
import { makeFunctionReference } from 'convex/server'
import type { ConvexHttpClient } from 'convex/browser'
import type { z } from 'zod'

import type {
  CreateVttMapUploadIntentInput,
  FinalizeVttMapUploadOutput,
  SignedVttMapDeliveryDto
} from '@artificer-toolkit/schema/api/media'
import {
  SCENE_DEFINITION_BATCH_SIZE,
  type AppendSceneDefinitionInput,
  type BeginSceneDefinitionInput,
  type SceneDefinitionSaveProgress
} from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import type { SceneDefinitionDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { mediaSinglePutUploadSchema } from '@artificer-toolkit/schema/api/mediaAssets'
import type { DevelopmentClient } from './developmentClient'

const createUpload = makeFunctionReference<
  'mutation',
  CreateVttMapUploadIntentInput,
  z.infer<typeof mediaSinglePutUploadSchema>
>('media/vttMapAssets:createUpload')
const finalize = makeFunctionReference<'action', { assetId: string }, FinalizeVttMapUploadOutput>(
  'media/vttMapActions:finalize'
)
const getDelivery = makeFunctionReference<'action', { assetId: string }, SignedVttMapDeliveryDto>(
  'media/vttMapActions:getDelivery'
)
const beginScene = makeFunctionReference<
  'mutation',
  BeginSceneDefinitionInput,
  SceneDefinitionSaveProgress
>('scenes/definitions:begin')
const appendScene = makeFunctionReference<
  'mutation',
  { input: AppendSceneDefinitionInput },
  SceneDefinitionSaveProgress
>('scenes/definitions:append')
const publishScene = makeFunctionReference<
  'mutation',
  { saveId: string },
  SceneDefinitionSaveProgress
>('scenes/definitions:publish')

type EncounterLifecycleScene = {
  sceneId: string
  liveSceneId: string
  tokenIds: [string, string, ...string[]]
}

export type EncounterLifecycleScenes = {
  assetId: string
  scenes: [EncounterLifecycleScene, EncounterLifecycleScene]
}

type EncounterLifecycleSceneOwner = DevelopmentClient & Pick<ConvexHttpClient, 'action'>

export type EncounterLifecycleSceneOptions = {
  map: { height: number; width: number }
  grid: SceneDefinitionDto['grid']
  barriers?: SceneDefinitionDto['barriers']
  fogMode?: SceneDefinitionDto['fogMode']
  tokens: [
    SceneDefinitionDto['tokens'][number],
    SceneDefinitionDto['tokens'][number],
    ...SceneDefinitionDto['tokens']
  ]
}

function tokens(): [SceneDefinitionDto['tokens'][number], SceneDefinitionDto['tokens'][number]] {
  const token = (ordinal: number): SceneDefinitionDto['tokens'][number] => ({
    id: crypto.randomUUID(),
    assetId: null,
    controlledByUserIds: [],
    height: 1,
    hidden: false,
    label: `Token ${ordinal}`,
    locked: false,
    position: { x: ordinal, y: 0 },
    rotationDegrees: 0,
    senses: [],
    vision: null,
    width: 1
  })
  return [token(0), token(1)]
}

async function createScene(
  owner: EncounterLifecycleSceneOwner,
  campaignId: string,
  assetId: string,
  name: string,
  options: EncounterLifecycleSceneOptions = {
    grid: { kind: 'GRIDLESS', pixelsPerUnit: 50, unit: 'FEET' },
    map: { width: 64, height: 64 },
    tokens: tokens()
  }
): Promise<EncounterLifecycleScene> {
  const sceneBarriers = options.barriers ?? []
  const sceneTokens = options.tokens
  const save = await owner.mutation(beginScene, {
    commandId: crypto.randomUUID(),
    sceneId: null,
    expectedVersion: null,
    settings: {
      campaignId,
      name,
      ambientIllumination: 'BRIGHT',
      daylight: false,
      fogMode: options.fogMode ?? 'PER_PLAYER',
      visionRevealMode: 'ON_DRAG',
      grid: options.grid,
      map: { assetId, ...options.map, tileManifestAssetId: null }
    },
    counts: {
      annotations: 0,
      barriers: sceneBarriers.length,
      darknessZones: 0,
      lights: 0,
      tokens: sceneTokens.length
    }
  })
  for (let offset = 0; offset < sceneBarriers.length; offset += SCENE_DEFINITION_BATCH_SIZE)
    await owner.mutation(appendScene, {
      input: {
        saveId: save.saveId,
        collection: 'barriers',
        offset,
        entities: sceneBarriers.slice(offset, offset + SCENE_DEFINITION_BATCH_SIZE)
      }
    })
  for (let offset = 0; offset < sceneTokens.length; offset += SCENE_DEFINITION_BATCH_SIZE)
    await owner.mutation(appendScene, {
      input: {
        saveId: save.saveId,
        collection: 'tokens',
        offset,
        entities: sceneTokens.slice(offset, offset + SCENE_DEFINITION_BATCH_SIZE)
      }
    })
  const published = await owner.mutation(publishScene, { saveId: save.saveId })
  assert.ok(published.status === 'PUBLISHED', 'Scene did not publish.')
  assert.ok(published.liveSceneId !== null, 'Published Scene is missing its live Scene ID.')
  return {
    sceneId: published.sceneId,
    liveSceneId: published.liveSceneId,
    tokenIds: [
      sceneTokens[0].id,
      sceneTokens[1].id,
      ...sceneTokens.slice(2).map((token) => token.id)
    ]
  }
}

async function createMap({
  owner,
  campaignId,
  dimensions = { width: 64, height: 64 }
}: {
  owner: EncounterLifecycleSceneOwner
  campaignId: string
  dimensions?: { height: number; width: number }
}): Promise<string> {
  // An account's identical upload is deduplicated to its first asset, so each map's content is unique.
  const map = await sharp({
    create: { ...dimensions, channels: 3, background: `#${crypto.randomUUID().slice(0, 6)}` }
  })
    .png()
    .toBuffer()
  const intent = await owner.mutation(createUpload, {
    profile: 'VTT_MAP',
    target: { type: 'VTT_MAP', campaignId },
    originalFileName: 'encounter-lifecycle.png',
    declaredMimeType: 'image/png',
    declaredBytes: map.byteLength,
    idempotencyKey: crypto.randomUUID()
  })
  console.log(
    'V08 map fixture: ' +
      JSON.stringify({ assetId: intent.assetId, campaignId, uploadExpiresAt: intent.expiresAt })
  )
  const upload = await fetch(intent.url, {
    method: 'PUT',
    body: new Uint8Array(map),
    headers: { 'content-type': 'image/png' }
  })
  assert.ok(upload.ok, `Map upload failed with status ${upload.status}.`)
  const finalized = await owner.action(finalize, { assetId: intent.assetId })
  assert.ok(
    finalized.assetId === intent.assetId && finalized.status === 'READY',
    'Map did not finalize as READY.'
  )
  console.log(
    'V08 map finalized: ' +
      JSON.stringify({ assetId: intent.assetId, observedAtUtc: new Date().toISOString() })
  )
  const delivery = await owner.action(getDelivery, { assetId: intent.assetId })
  assert.ok(delivery.assetId === intent.assetId, 'Map delivery asset ID did not match.')
  assert.ok(
    delivery.width === dimensions.width && delivery.height === dimensions.height,
    'Map delivery source dimensions are invalid.'
  )
  const image = await fetch(delivery.overview.url)
  assert.ok(image.ok, `Map delivery fetch failed with status ${image.status}.`)
  const metadata = await sharp(Buffer.from(await image.arrayBuffer())).metadata()
  assert.ok(
    metadata.width === delivery.overview.width && metadata.height === delivery.overview.height,
    'Map delivery overview dimensions are invalid.'
  )
  return intent.assetId
}

export async function createEncounterLifecycleScene({
  owner,
  campaignId,
  name,
  options
}: {
  owner: EncounterLifecycleSceneOwner
  campaignId: string
  name: string
  options: EncounterLifecycleSceneOptions
}): Promise<EncounterLifecycleScene & { assetId: string }> {
  const assetId = await createMap({ owner, campaignId, dimensions: options.map })
  return { ...(await createScene(owner, campaignId, assetId, name, options)), assetId }
}

export async function createEncounterLifecycleScenes({
  owner,
  campaignId
}: {
  owner: EncounterLifecycleSceneOwner
  campaignId: string
}): Promise<EncounterLifecycleScenes> {
  const assetId = await createMap({ owner, campaignId })
  return {
    assetId,
    scenes: [
      await createScene(owner, campaignId, assetId, 'Encounter lifecycle one'),
      await createScene(owner, campaignId, assetId, 'Encounter lifecycle two')
    ]
  }
}
