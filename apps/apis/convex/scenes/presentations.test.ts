import { makeFunctionReference } from 'convex/server'
import { ConvexError } from 'convex/values'
import { domainRejectionErrorDataSchema } from '@artificer-toolkit/schema/api/domainRejections'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignSessionDto,
  FinishCampaignSessionInput
} from '@artificer-toolkit/schema/api/campaignSessions'
import type { LiveSessionPresentationCommitInput } from '@artificer-toolkit/schema/api/liveSessions'
import type {
  CampaignScenePresentationDto,
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { vttMapStoredAssetSchema } from '@artificer-toolkit/schema/projections/vttMapPersistence'
import { sceneStoredInitialStateSchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'

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
const get = makeFunctionReference<
  'query',
  { campaignId: string },
  CampaignScenePresentationDto | null
>('scenes/presentations:get')
const set = makeFunctionReference<
  'mutation',
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
>('scenes/presentations:set')
const setLive = makeFunctionReference<
  'action',
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
>('scenes/presentations:setLive')
const setFromRoom = makeFunctionReference<
  'mutation',
  LiveSessionPresentationCommitInput,
  SetCampaignLiveScenePresentationResultDto
>('scenes/presentations:setFromRoom')
const claim = makeFunctionReference<
  'mutation',
  { campaignId: string },
  { epoch: string; activationFingerprint: string }
>('liveSessions/authority:claim')
const activate = makeFunctionReference<
  'mutation',
  {
    campaignId: string
    epoch: string
    activationFingerprint: string
    stateChecksum: string
  },
  unknown
>('liveSessions/state:activate')

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

async function setup() {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Presentation tests',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const memberId = await base.t.run((ctx) =>
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
  return { ...base, campaign, memberId }
}

async function seedReadyMapScene(base: Awaited<ReturnType<typeof setup>>) {
  const mapId = crypto.randomUUID()
  const sceneId = crypto.randomUUID()
  const definitionId = crypto.randomUUID()
  const saveId = crypto.randomUUID()
  const commandId = crypto.randomUUID()
  const now = new Date().toISOString()
  await base.t.run(async (ctx) => {
    await ctx.db.insert(
      'mediaAssets',
      vttMapStoredAssetSchema.parse({
        id: mapId,
        ownerUserId: base.owner.userId,
        storageAssetId: mapId,
        profileClass: 'VTT_MAP',
        contentHash: null,
        upload: {
          originalFileName: 'map.png',
          declaredMimeType: 'image/png',
          declaredBytes: 1,
          idempotencyKey: crypto.randomUUID()
        },
        status: 'READY',
        rawObjectKey: null,
        uploadExpiresAt: Date.now(),
        chargedBytes: 3,
        width: 64,
        height: 64,
        variants: [
          {
            kind: 'DISPLAY',
            objectKey: 'display',
            byteSize: 1,
            width: 64,
            height: 64,
            mimeType: 'image/webp'
          },
          {
            kind: 'THUMBNAIL',
            objectKey: 'thumbnail',
            byteSize: 1,
            width: 64,
            height: 64,
            mimeType: 'image/webp'
          },
          {
            kind: 'TILE',
            row: 0,
            column: 0,
            objectKey: 'tile-0-0',
            byteSize: 1,
            width: 64,
            height: 64,
            mimeType: 'image/webp'
          }
        ],
        operation: null,
        cleanupAt: null
      })
    )
    await ctx.db.insert(
      'campaignScenes',
      sceneStoredInitialStateSchema.parse({
        id: sceneId,
        definitionId,
        definitionVersion: 1,
        definitionSaveId: saveId,
        version: 0,
        materializationCommandId: commandId,
        materializationCommandFingerprint: '0'.repeat(64),
        campaignId: base.campaign.id,
        name: 'Ready map',
        ambientIllumination: 'BRIGHT',
        daylight: false,
        fogMode: 'PER_PLAYER',
        visionRevealMode: 'ON_DRAG',
        grid: { kind: 'GRIDLESS', pixelsPerUnit: 50, unit: 'FEET' },
        map: { assetId: mapId, width: 64, height: 64, tileManifestAssetId: null },
        createdAt: now,
        updatedAt: now
      })
    )
  })
  return { mapId, sceneId }
}

function presentationInput(
  base: Awaited<ReturnType<typeof setup>>,
  sceneId: string | null = null
): SetCampaignLiveScenePresentationInputDto {
  return {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: base.campaign.id,
    sceneId
  }
}

function readPresentations(base: Awaited<ReturnType<typeof setup>>) {
  return base.t.run((ctx) =>
    ctx.db
      .query('campaignScenePresentations')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .collect()
  )
}

it('creates, replays, clears and reads one Campaign presentation without duplicating receipts', async () => {
  const base = await setup()
  const input = presentationInput(base)
  const first = await base.owner.caller.mutation(set, input)
  expect(first).toMatchObject({
    campaignId: base.campaign.id,
    sceneId: null,
    version: 0,
    replayed: false
  })
  expect(await base.owner.caller.mutation(set, input)).toEqual({ ...first, replayed: true })
  expect(await base.other.caller.query(get, { campaignId: base.campaign.id })).toEqual({
    campaignId: base.campaign.id,
    sceneId: null,
    version: 0
  })
  const second = await base.owner.caller.mutation(set, {
    ...input,
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: 0
  })
  expect(second).toMatchObject({ version: 1, replayed: false })
  await expect(
    base.owner.caller.mutation(set, { ...input, commandId: crypto.randomUUID() })
  ).rejects.toThrow('Campaign Scene presentation version is stale')
  expect(await readPresentations(base)).toHaveLength(1)
  expect(
    await base.t.run((ctx) =>
      ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', base.campaign.id))
        .collect()
    )
  ).toHaveLength(2)
})

it('fences direct writes and commits a live presentation only at the matching room state', async () => {
  const base = await setup()
  const authority = await base.owner.caller.mutation(claim, { campaignId: base.campaign.id })
  const input = presentationInput(base)
  const commit: LiveSessionPresentationCommitInput = {
    campaignId: base.campaign.id,
    actorUserId: base.owner.userId,
    epoch: authority.epoch,
    input,
    expectedSequence: 0,
    expectedStateChecksum: null
  }
  await expect(base.owner.caller.mutation(set, input)).rejects.toThrow(
    'owned by the Campaign live table'
  )
  await expect(base.other.caller.action(setLive, input)).rejects.toThrow('Campaign not found')
  await expect(
    base.t.mutation(setFromRoom, { ...commit, epoch: crypto.randomUUID() })
  ).rejects.toThrow('stale')
  await expect(
    base.t.mutation(setFromRoom, { ...commit, campaignId: crypto.randomUUID() })
  ).rejects.toThrow('Campaign mismatch')
  await expect(base.t.mutation(setFromRoom, { ...commit, expectedSequence: 1 })).rejects.toThrow(
    'state is stale'
  )
  await expect(
    base.t.mutation(setFromRoom, { ...commit, expectedStateChecksum: 'a'.repeat(64) })
  ).rejects.toThrow('state is stale')
  const first = await base.t.mutation(setFromRoom, commit)
  expect(first).toMatchObject({ campaignId: base.campaign.id, version: 0, replayed: false })

  const checksum = 'b'.repeat(64)
  await base.t.mutation(activate, {
    campaignId: base.campaign.id,
    epoch: authority.epoch,
    activationFingerprint: authority.activationFingerprint,
    stateChecksum: checksum
  })
  expect(await base.t.mutation(setFromRoom, commit)).toEqual({ ...first, replayed: true })
  const next = {
    ...commit,
    input: { ...input, commandId: crypto.randomUUID(), expectedPresentationVersion: 0 }
  }
  await expect(base.t.mutation(setFromRoom, next)).rejects.toThrow('state is stale')
  const second = await base.t.mutation(setFromRoom, { ...next, expectedStateChecksum: checksum })
  expect(second).toMatchObject({ version: 1, replayed: false })
  await expect(
    base.owner.caller.mutation(set, {
      ...input,
      commandId: crypto.randomUUID(),
      expectedPresentationVersion: 1
    })
  ).rejects.toThrow('owned by the Campaign live table')
  expect(await readPresentations(base)).toHaveLength(1)
})

it('authorizes live control before sending trusted actor and epoch', async () => {
  const base = await setup()
  const input = presentationInput(base)
  const direct = await base.owner.caller.action(setLive, input)
  expect(direct).toMatchObject({ version: 0, replayed: false })
  const authority = await base.owner.caller.mutation(claim, { campaignId: base.campaign.id })
  vi.stubEnv('LIVE_SESSION_WORKER_URL', 'https://live.example.invalid')
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', 'test-live-session-worker-secret-long-enough')
  const result = { ...direct, replayed: true }
  const request = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    Response.json(result)
  )
  vi.stubGlobal('fetch', request)
  expect(await base.owner.caller.action(setLive, input)).toEqual(result)
  expect(request).toHaveBeenCalledOnce()
  expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({
    campaignId: base.campaign.id,
    operation: {
      type: 'SET_SCENE_PRESENTATION',
      actorUserId: base.owner.userId,
      epoch: authority.epoch,
      input
    }
  })
})

it('protects the room presentation endpoint and validates its commit fence', async () => {
  const base = await setup()
  const authority = await base.owner.caller.mutation(claim, { campaignId: base.campaign.id })
  const secret = 'test-live-session-worker-secret-long-enough'
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
  const input: LiveSessionPresentationCommitInput = {
    campaignId: base.campaign.id,
    actorUserId: base.owner.userId,
    epoch: authority.epoch,
    input: presentationInput(base),
    expectedSequence: 0,
    expectedStateChecksum: null
  }
  const request = (body: unknown, suppliedSecret: string) =>
    new Request('http://localhost/live-sessions/present', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-artificer-live-session-secret': suppliedSecret
      },
      body: JSON.stringify(body)
    })
  expect((await base.t.fetch('/live-sessions/present', request(input, 'wrong'))).status).toBe(401)
  expect(
    (
      await base.t.fetch(
        '/live-sessions/present',
        request({ ...input, epoch: crypto.randomUUID() }, secret)
      )
    ).status
  ).toBe(409)
  const response = await base.t.fetch('/live-sessions/present', request(input, secret))
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ commandId: input.input.commandId, replayed: false })
})

it('refuses a player presentation write with the typed Campaign-not-found data', async () => {
  const base = await setup()
  const error: unknown = await base.other.caller.mutation(set, presentationInput(base)).then(
    () => null,
    (rejected: unknown) => rejected
  )
  if (!(error instanceof ConvexError)) throw new Error('Expected a ConvexError refusal.')
  expect(domainRejectionErrorDataSchema.parse(error.data)).toEqual({
    code: 'DOMAIN_REJECTED',
    message: 'Campaign not found.',
    reason: 'CAMPAIGN_NOT_FOUND'
  })
})

it('rejects player and archived Campaign presentation writes before replay', async () => {
  const base = await setup()
  const input = presentationInput(base)
  await expect(base.other.caller.mutation(set, input)).rejects.toThrow('Campaign not found')
  await base.t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    await ctx.db.patch(campaign!._id, { status: 'ARCHIVED' })
  })
  await expect(base.owner.caller.mutation(set, input)).rejects.toThrow('Archived')
})

it('keeps one Campaign presentation and its map across Session finish until the Scene is cleared', async () => {
  const base = await setup()
  const { mapId, sceneId } = await seedReadyMapScene(base)
  const input = presentationInput(base, sceneId)
  const first = await base.owner.caller.mutation(set, input)
  expect(first).toMatchObject({ sceneId, version: 0, replayed: false })
  expect(await base.owner.caller.mutation(set, input)).toEqual({ ...first, replayed: true })
  await expect(base.owner.caller.mutation(set, { ...input, sceneId: null })).rejects.toThrow(
    'already used'
  )
  const session = await base.owner.caller.mutation(createSession, { campaignId: base.campaign.id })
  await base.owner.caller.mutation(finishSession, {
    campaignId: base.campaign.id,
    sessionId: session.id,
    expectedVersion: session.version,
    commandId: crypto.randomUUID()
  })
  const presented = await readPresentations(base)
  expect(presented).toHaveLength(1)
  expect(presented[0]).toMatchObject({ sceneId, version: 0, activeMapAssetId: mapId })
  expect(await base.other.caller.query(get, { campaignId: base.campaign.id })).toEqual({
    campaignId: base.campaign.id,
    sceneId,
    version: 0
  })
  await base.owner.caller.mutation(set, {
    ...input,
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: 0,
    sceneId: null
  })
  expect(await readPresentations(base)).toEqual([
    expect.objectContaining({ sceneId: null, version: 1, activeMapAssetId: null })
  ])
})
