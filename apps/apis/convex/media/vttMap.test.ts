// @vitest-environment node
import sharp from 'sharp'
import { makeFunctionReference } from 'convex/server'
import { register } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  CreateVttMapUploadIntentInput,
  FinalizeVttMapUploadOutput,
  SignedVttMapDeliveryDto
} from '@artificer-toolkit/schema/api/media'
import type {
  CampaignSessionDto,
  FinishCampaignSessionInput
} from '@artificer-toolkit/schema/api/campaignSessions'
import type {
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type { z } from 'zod'
import type { mediaSinglePutUploadSchema } from '@artificer-toolkit/schema/api/mediaAssets'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  BeginSceneDefinitionInput,
  SceneDefinitionSaveProgress
} from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import type {
  VttMapProcessClaim,
  VttMapStoredVariant
} from '@artificer-toolkit/schema/projections/vttMapPersistence'
import { fixture } from '../../tests/fixtures/characters'
import { startLocalR2 } from '../../tests/localR2'
import { components, internal } from '../_generated/api'
import { processVttMapClaim } from './vttMapProcessing'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createSession = makeFunctionReference<'mutation', { campaignId: string }, CampaignSessionDto>(
  'campaigns/sessions:create'
)
const finishSession = makeFunctionReference<
  'mutation',
  FinishCampaignSessionInput,
  CampaignSessionDto
>('campaigns/sessionFinish:finish')
const setPresentation = makeFunctionReference<
  'mutation',
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
>('scenes/presentations:set')
const getDelivery = makeFunctionReference<'action', { assetId: string }, SignedVttMapDeliveryDto>(
  'media/vttMapActions:getDelivery'
)
const createUpload = makeFunctionReference<
  'mutation',
  CreateVttMapUploadIntentInput,
  z.infer<typeof mediaSinglePutUploadSchema>
>('media/vttMapAssets:createUpload')
const finalize = makeFunctionReference<'action', { assetId: string }, FinalizeVttMapUploadOutput>(
  'media/vttMapActions:finalize'
)
const beginScene = makeFunctionReference<
  'mutation',
  BeginSceneDefinitionInput,
  SceneDefinitionSaveProgress
>('scenes/definitions:begin')
const publishScene = makeFunctionReference<
  'mutation',
  { saveId: string },
  SceneDefinitionSaveProgress
>('scenes/definitions:publish')
const beginFinalize = makeFunctionReference<'mutation', { assetId: string }, VttMapProcessClaim>(
  'media/vttMapAssets:beginFinalize'
)
const finishFinalize = makeFunctionReference<
  'mutation',
  {
    assetId: string
    operationId: string
    width: number
    height: number
    variants: VttMapStoredVariant[]
    contentHash: string
  },
  FinalizeVttMapUploadOutput
>('media/vttMapAssets:finishFinalize')

let server: Awaited<ReturnType<typeof startLocalR2>>
beforeEach(async () => {
  server = await startLocalR2()
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.stubEnv('MEDIA_STORAGE_MODE', 'local')
  vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3221')
  vi.stubEnv('LOCAL_R2_ENDPOINT', server.endpoint)
})
afterEach(async () => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  await server.close()
})

async function setup() {
  const base = await fixture()
  register(base.t)
  registerRetrier(base.t, 'r2/actionRetrier')
  await base.t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.updateMany, {
      input: { model: 'session', update: { expiresAt: Date.now() + 3 * 86_400_000 } },
      paginationOpts: { cursor: null, numItems: 10 }
    })
  )
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Native map upload',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const membershipId = await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  return { ...base, campaign, membershipId }
}

async function uploadMap(
  base: Awaited<ReturnType<typeof setup>>,
  body: Buffer,
  idempotencyKey = crypto.randomUUID()
) {
  const intent = await base.owner.caller.mutation(createUpload, {
    profile: 'VTT_MAP',
    target: { type: 'VTT_MAP', campaignId: base.campaign.id },
    originalFileName: 'map.png',
    declaredMimeType: 'image/png',
    declaredBytes: body.byteLength,
    idempotencyKey
  })
  expect(
    await fetch(intent.url, {
      method: 'PUT',
      body: new Uint8Array(body),
      headers: { 'content-type': 'image/png' }
    })
  ).toMatchObject({ status: 200 })
  return intent
}

async function mapPng(width = 64, height = 64) {
  return sharp({
    create: { width, height, channels: 3, background: '#3a6b44' }
  })
    .png()
    .toBuffer()
}

async function readAsset(base: Awaited<ReturnType<typeof setup>>, assetId: string) {
  return base.t.run((ctx) =>
    ctx.db
      .query('mediaAssets')
      .withIndex('by_publicId', (q) => q.eq('id', assetId))
      .unique()
  )
}

it('signs a bounded map PUT, finalizes the claimed display, thumbnail and tiles, then replays once', async () => {
  const base = await setup()
  const body = await sharp({
    create: { width: 1025, height: 1025, channels: 3, background: '#3a6b44' }
  })
    .png()
    .toBuffer()
  const input: CreateVttMapUploadIntentInput = {
    profile: 'VTT_MAP',
    target: { type: 'VTT_MAP', campaignId: base.campaign.id },
    originalFileName: 'forest.png',
    declaredMimeType: 'image/png',
    declaredBytes: body.byteLength,
    idempotencyKey: crypto.randomUUID()
  }
  const intent = await base.owner.caller.mutation(createUpload, input)
  expect(new URL(intent.url).searchParams.get('X-Amz-SignedHeaders')?.split(';')).toEqual(
    expect.arrayContaining(['content-length', 'content-type'])
  )
  expect(
    await fetch(intent.url, {
      method: 'PUT',
      body: new Uint8Array(body),
      headers: { 'content-type': 'image/png' }
    })
  ).toMatchObject({ status: 200 })
  const result = await base.owner.caller.action(finalize, {
    assetId: intent.assetId
  })
  expect(result).toEqual({ assetId: intent.assetId, status: 'READY' })
  const asset = await base.t.run((ctx) =>
    ctx.db
      .query('mediaAssets')
      .withIndex('by_publicId', (q) => q.eq('id', intent.assetId))
      .unique()
  )
  expect(asset).toMatchObject({ status: 'READY', width: 1025, height: 1025 })
  expect(asset?.variants).toHaveLength(6)
  expect(asset?.variants.filter((variant) => variant.kind === 'TILE')).toHaveLength(4)
  expect(await base.owner.caller.action(finalize, { assetId: intent.assetId })).toEqual(result)
  expect(
    [...server.objects.keys()].filter((key) => key.startsWith(`ready/${intent.assetId}/`))
  ).toHaveLength(6)
}, 20_000)

it('requires the active Campaign owner and retains a ready map while a published Scene references it', async () => {
  const base = await setup()
  const body = await sharp({
    create: { width: 64, height: 64, channels: 3, background: '#3a6b44' }
  })
    .png()
    .toBuffer()
  const request: CreateVttMapUploadIntentInput = {
    profile: 'VTT_MAP',
    target: { type: 'VTT_MAP', campaignId: base.campaign.id },
    originalFileName: 'grid.png',
    declaredMimeType: 'image/png',
    declaredBytes: body.byteLength,
    idempotencyKey: crypto.randomUUID()
  }
  await expect(base.other.caller.mutation(createUpload, request)).rejects.toThrow(
    'Campaign not found'
  )
  const intent = await base.owner.caller.mutation(createUpload, request)
  await fetch(intent.url, {
    method: 'PUT',
    body: new Uint8Array(body),
    headers: { 'content-type': 'image/png' }
  })
  await base.owner.caller.action(finalize, { assetId: intent.assetId })
  const sceneInput: BeginSceneDefinitionInput = {
    commandId: crypto.randomUUID(),
    sceneId: null,
    expectedVersion: null,
    settings: {
      campaignId: base.campaign.id,
      name: 'Map reference',
      ambientIllumination: 'BRIGHT',
      daylight: false,
      fogMode: 'PER_PLAYER',
      visionRevealMode: 'ON_DRAG',
      grid: { kind: 'GRIDLESS', pixelsPerUnit: 50, unit: 'FEET' },
      map: {
        assetId: intent.assetId,
        width: 64,
        height: 64,
        tileManifestAssetId: null
      }
    },
    counts: {
      annotations: 0,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      tokens: 0
    }
  }
  const save = await base.owner.caller.mutation(beginScene, sceneInput)
  await base.owner.caller.mutation(publishScene, { saveId: save.saveId })
  const lookup = { assetId: intent.assetId }
  expect(await base.owner.caller.action(getDelivery, lookup)).toMatchObject({
    assetId: intent.assetId,
    width: 64,
    height: 64
  })
  await expect(base.other.caller.action(getDelivery, lookup)).rejects.toThrow('unavailable')
  const presentation: SetCampaignLiveScenePresentationInputDto = {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    campaignId: base.campaign.id,
    sceneId: save.liveSceneId,
    expectedPresentationVersion: null
  }
  await base.owner.caller.mutation(setPresentation, presentation)
  const delivery = await base.other.caller.action(getDelivery, lookup)
  expect(Date.parse(delivery.expiresAt) - Date.now()).toBe(300_000)
  expect(delivery.tiles).toHaveLength(1)
  for (const image of [delivery.overview, ...delivery.tiles]) {
    expect(new URL(image.url).searchParams.get('X-Amz-Expires')).toBe('300')
    const response = await fetch(image.url)
    expect(response.status).toBe(200)
    expect(await sharp(Buffer.from(await response.arrayBuffer())).metadata()).toMatchObject({
      format: 'webp',
      width: 64,
      height: 64
    })
    expect(image).not.toHaveProperty('objectKey')
  }
  await base.t.run((ctx) => ctx.db.delete(base.membershipId))
  await expect(base.other.caller.action(getDelivery, lookup)).rejects.toThrow()
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: base.campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: base.campaign.createdAt,
      joinedAt: base.campaign.createdAt,
      leftAt: null
    })
  )
  const session = await base.owner.caller.mutation(createSession, { campaignId: base.campaign.id })
  await base.owner.caller.mutation(finishSession, {
    campaignId: base.campaign.id,
    sessionId: session.id,
    expectedVersion: session.version,
    commandId: crypto.randomUUID()
  })
  expect(await base.other.caller.action(getDelivery, lookup)).toMatchObject({
    assetId: intent.assetId
  })
  await base.owner.caller.mutation(setPresentation, {
    ...presentation,
    commandId: crypto.randomUUID(),
    sceneId: null,
    expectedPresentationVersion: 0
  })
  await expect(base.other.caller.action(getDelivery, lookup)).rejects.toThrow('unavailable')
  expect(await base.owner.caller.action(getDelivery, lookup)).toMatchObject({
    assetId: intent.assetId
  })
  const asset = await base.t.run((ctx) =>
    ctx.db
      .query('mediaAssets')
      .withIndex('by_publicId', (q) => q.eq('id', intent.assetId))
      .unique()
  )
  vi.setSystemTime(asset!.cleanupAt!)
  await base.t.mutation(internal.media.assets.cleanup, {
    assetId: intent.assetId
  })
  expect(
    await base.t.run((ctx) =>
      ctx.db
        .query('mediaAssets')
        .withIndex('by_publicId', (q) => q.eq('id', intent.assetId))
        .unique()
    )
  ).toMatchObject({ status: 'READY' })
}, 20_000)

it('rejects invalid bytes, keeps its 66-key fence, and retires the complete failed claim', async () => {
  const base = await setup()
  const intent = await uploadMap(base, Buffer.from('not an image'))
  expect(await base.owner.caller.action(finalize, { assetId: intent.assetId })).toEqual({
    assetId: intent.assetId,
    status: 'REJECTED'
  })
  const rejected = await readAsset(base, intent.assetId)
  expect(rejected).toMatchObject({
    status: 'REJECTED',
    operation: { outputs: expect.any(Array) }
  })
  expect(rejected?.operation?.outputs).toHaveLength(66)
  // Simulate late provider completion for every key in the retired operation.
  for (const output of rejected!.operation!.outputs)
    server.objects.set(output.objectKey, {
      body: Buffer.from('retired map output'),
      contentType: 'image/webp',
      modified: new Date()
    })
  expect(server.objects.size).toBe(67)
  vi.setSystemTime(rejected!.operation!.expiresAt)
  await base.t.mutation(internal.media.assets.expireOperation, {
    assetId: intent.assetId,
    operationId: rejected!.operation!.id
  })
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)
  expect(server.objects.size).toBe(0)
  expect(await readAsset(base, intent.assetId)).toMatchObject({
    status: 'DELETED',
    chargedBytes: 0
  })
}, 20_000)

it('fences a partial provider write, deletes its old output, and retries the same raw map', async () => {
  const base = await setup()
  const intent = await uploadMap(base, await mapPng(1025, 1025))
  const claim = await base.owner.caller.mutation(beginFinalize, {
    assetId: intent.assetId
  })
  if (claim.kind !== 'PROCESS') throw new Error('Expected map processing claim.')
  const rejectedKey = claim.operation.outputs[2]!.objectKey
  server.faults.rejectPutKey = rejectedKey
  await expect(base.owner.caller.action(finalize, { assetId: intent.assetId })).rejects.toThrow(
    'still running'
  )
  // Drive the claimed action directly to prove a real earlier write cannot escape its fence.
  await expect(
    base.owner.caller.action((ctx) => processVttMapClaim(ctx, claim.asset, claim.operation))
  ).rejects.toThrow()
  expect(server.objects.has(claim.operation.outputs[0]!.objectKey)).toBe(true)
  await base.t.mutation(internal.media.assets.failSave, {
    assetId: intent.assetId,
    operationId: claim.operation.id
  })
  vi.setSystemTime(claim.operation.expiresAt)
  await base.t.mutation(internal.media.assets.expireOperation, {
    assetId: intent.assetId,
    operationId: claim.operation.id
  })
  server.faults.rejectPutKey = null
  expect(await base.owner.caller.action(finalize, { assetId: intent.assetId })).toMatchObject({
    status: 'READY'
  })
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)
  expect([...server.objects.keys()].some((key) => key.includes(`/${claim.operation.id}/`))).toBe(
    false
  )
}, 20_000)

it('denies foreign finalization and rolls quota rejection back to the reservation', async () => {
  const base = await setup()
  const intent = await uploadMap(base, await mapPng())
  await expect(base.other.caller.action(finalize, { assetId: intent.assetId })).rejects.toThrow(
    'unavailable'
  )
  const claim = await base.owner.caller.mutation(beginFinalize, {
    assetId: intent.assetId
  })
  if (claim.kind !== 'PROCESS') throw new Error('Expected map processing claim.')
  const processed = await base.owner.caller.action((ctx) =>
    processVttMapClaim(ctx, claim.asset, claim.operation)
  )
  await base.t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
      .unique()
    await ctx.db.patch(profile!._id, {
      mediaBytes: ENTITLEMENT_LIMITS.FREE.storageBytes
    })
  })
  expect(
    await base.owner.caller.mutation(finishFinalize, {
      assetId: intent.assetId,
      operationId: claim.operation.id,
      ...processed,
      variants: processed.variants.map((variant, index) => ({
        ...variant,
        byteSize: index === 0 ? 26 * 1024 * 1024 : variant.byteSize
      }))
    })
  ).toEqual({ assetId: intent.assetId, status: 'REJECTED' })
  expect(await readAsset(base, intent.assetId)).toMatchObject({
    status: 'REJECTED',
    chargedBytes: 25 * 1024 * 1024,
    operation: claim.operation
  })
}, 20_000)

it('rejects forged tile coverage and edge dimensions without changing the processing claim', async () => {
  const base = await setup()
  const intent = await uploadMap(base, await mapPng())
  const claim = await base.owner.caller.mutation(beginFinalize, {
    assetId: intent.assetId
  })
  if (claim.kind !== 'PROCESS') throw new Error('Expected map processing claim.')
  const variants: VttMapStoredVariant[] = [
    {
      kind: 'DISPLAY',
      objectKey: claim.operation.outputs[0]!.objectKey,
      byteSize: 1,
      width: 64,
      height: 64,
      mimeType: 'image/webp'
    },
    {
      kind: 'THUMBNAIL',
      objectKey: claim.operation.outputs[1]!.objectKey,
      byteSize: 1,
      width: 64,
      height: 64,
      mimeType: 'image/webp'
    },
    {
      kind: 'TILE',
      row: 0,
      column: 0,
      objectKey: claim.operation.outputs[2]!.objectKey,
      byteSize: 1,
      width: 63,
      height: 64,
      mimeType: 'image/webp'
    }
  ]
  await expect(
    base.owner.caller.mutation(finishFinalize, {
      assetId: intent.assetId,
      operationId: claim.operation.id,
      width: 64,
      height: 64,
      variants,
      contentHash: 'a'.repeat(64)
    })
  ).rejects.toThrow('output mismatch')
  expect(await readAsset(base, intent.assetId)).toMatchObject({
    status: 'PROCESSING',
    operation: claim.operation,
    variants: []
  })
})

it('releases ready map bytes only after both published definition and initial live Scene references are gone', async () => {
  const base = await setup()
  const intent = await uploadMap(base, await mapPng())
  await base.owner.caller.action(finalize, { assetId: intent.assetId })
  const save = await base.owner.caller.mutation(beginScene, {
    commandId: crypto.randomUUID(),
    sceneId: null,
    expectedVersion: null,
    settings: {
      campaignId: base.campaign.id,
      name: 'Retained map',
      ambientIllumination: 'BRIGHT',
      daylight: false,
      fogMode: 'PER_PLAYER',
      visionRevealMode: 'ON_DRAG',
      grid: { kind: 'GRIDLESS', pixelsPerUnit: 50, unit: 'FEET' },
      map: {
        assetId: intent.assetId,
        width: 64,
        height: 64,
        tileManifestAssetId: null
      }
    },
    counts: {
      annotations: 0,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      tokens: 0
    }
  })
  await base.owner.caller.mutation(publishScene, { saveId: save.saveId })
  const ready = await readAsset(base, intent.assetId)
  const profile = await base.t.run((ctx) =>
    ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
      .unique()
  )
  vi.setSystemTime(ready!.cleanupAt!)
  await base.t.mutation(internal.media.assets.cleanup, {
    assetId: intent.assetId
  })
  expect((await readAsset(base, intent.assetId))?.status).toBe('READY')
  await base.t.run(async (ctx) => {
    const definition = await ctx.db
      .query('sceneDefinitions')
      .withIndex('by_mapAssetId', (q) => q.eq('map.assetId', intent.assetId))
      .unique()
    await ctx.db.delete(definition!._id)
  })
  await base.t.mutation(internal.media.assets.cleanup, {
    assetId: intent.assetId
  })
  expect((await readAsset(base, intent.assetId))?.status).toBe('READY')
  await base.t.run(async (ctx) => {
    const scene = await ctx.db
      .query('campaignScenes')
      .withIndex('by_mapAssetId', (q) => q.eq('map.assetId', intent.assetId))
      .unique()
    await ctx.db.delete(scene!._id)
  })
  // Past the last commit, so the next mutation's clock is the one this test reads.
  vi.setSystemTime(Date.now() + 1_000)
  await base.t.mutation(internal.media.assets.cleanup, {
    assetId: intent.assetId
  })
  // The last detached reference starts a fresh recovery grace period.
  const graced = await readAsset(base, intent.assetId)
  expect(graced).toMatchObject({ status: 'READY', cleanupAt: Date.now() + 24 * 60 * 60_000 })
  vi.setSystemTime(graced!.cleanupAt!)
  await base.t.mutation(internal.media.assets.cleanup, {
    assetId: intent.assetId
  })
  expect((await readAsset(base, intent.assetId))?.status).toBe('DELETED')
  expect(
    (
      await base.t.run((ctx) =>
        ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique()
      )
    )?.mediaBytes
  ).toBe((profile?.mediaBytes ?? 0) - ready!.chargedBytes)
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)
  expect(server.objects.size).toBe(0)
})

it('keeps Scene-referenced map bytes through stale account purge after its profile is removed', async () => {
  const base = await setup()
  const intent = await uploadMap(base, await mapPng())
  await base.owner.caller.action(finalize, { assetId: intent.assetId })
  const save = await base.owner.caller.mutation(beginScene, {
    commandId: crypto.randomUUID(),
    sceneId: null,
    expectedVersion: null,
    settings: {
      campaignId: base.campaign.id,
      name: 'Purge protected map',
      ambientIllumination: 'BRIGHT',
      daylight: false,
      fogMode: 'PER_PLAYER',
      visionRevealMode: 'ON_DRAG',
      grid: { kind: 'GRIDLESS', pixelsPerUnit: 50, unit: 'FEET' },
      map: {
        assetId: intent.assetId,
        width: 64,
        height: 64,
        tileManifestAssetId: null
      }
    },
    counts: {
      annotations: 0,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      tokens: 0
    }
  })
  await base.owner.caller.mutation(publishScene, { saveId: save.saveId })
  await base.t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
      .unique()
    await ctx.db.delete(profile!._id)
  })
  await expect(
    base.t.mutation(internal.media.assets.purgeAccount, {
      userId: base.owner.userId
    })
  ).rejects.toThrow('restricted by retained Scene maps')
  expect((await readAsset(base, intent.assetId))?.status).toBe('READY')
  expect([...server.objects.keys()].some((key) => key.startsWith(`ready/${intent.assetId}/`))).toBe(
    true
  )
})
