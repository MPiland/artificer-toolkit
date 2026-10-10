import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  LiveSessionRoomSceneCapture,
  LiveSessionRoomSceneCaptureInput,
  LiveSessionTransientCapture,
  LiveSessionTransientCaptureInput
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import type { CampaignSessionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { liveSceneHead } from '../../tests/fixtures/liveSceneToken'
import { insertActiveLiveAuthority } from '../../tests/fixtures/localRoomWorker'
import {
  createSceneDefinitionFixture,
  publishEmptyScene
} from '../../tests/fixtures/sceneDefinitions'

const capture = makeFunctionReference<
  'query',
  LiveSessionTransientCaptureInput,
  LiveSessionTransientCapture
>('liveSessions/transientCapture:capture')
const roomScene = makeFunctionReference<
  'query',
  LiveSessionRoomSceneCaptureInput,
  LiveSessionRoomSceneCapture
>('liveSessions/transientCapture:roomScene')
const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createSession = makeFunctionReference<'mutation', { campaignId: string }, CampaignSessionDto>(
  'campaigns/sessions:create'
)
const setPresentation = makeFunctionReference<
  'mutation',
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
>('scenes/presentations:set')

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
  const input: LiveSessionTransientCaptureInput = {
    campaignId: base.campaign.id,
    expectedRole: 'OWNER',
    expectedUserId: base.owner.userId
  }
  return { base, input, sceneId }
}

/** The Scene setup with the Campaign's live authority held by a room at a fresh `DO_ACTIVE` epoch. */
async function setupRoom() {
  const { base, sceneId } = await setup()
  const epoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch,
      createdAt: new Date().toISOString()
    })
  )
  const input: LiveSessionRoomSceneCaptureInput = {
    campaignId: base.campaign.id,
    epoch,
    observedCharacterRevisions: []
  }
  return { base, input, sceneId }
}

/** A Run of the Campaign bound to `sceneId`; capture reads only the Run's status and its binding. */
async function bindRun(
  base: Awaited<ReturnType<typeof setup>>['base'],
  sceneId: string,
  status: 'ACTIVE' | 'PREPARED'
) {
  const encounterId = crypto.randomUUID()
  const now = new Date().toISOString()
  await base.t.run(async (ctx) => {
    await ctx.db.insert('encounterRuns', {
      id: encounterId,
      campaignId: base.campaign.id,
      gameSystemId: base.campaign.gameSystemId,
      status,
      version: 0,
      stateJson: '{}',
      stateChecksum: 'a'.repeat(64),
      createCommandId: crypto.randomUUID(),
      createCommandFingerprint: 'a'.repeat(64),
      concentrationCasterCharacterIds: [],
      createdAt: now,
      updatedAt: now
    })
    await ctx.db.insert('encounterSceneBindings', {
      encounterId,
      campaignId: base.campaign.id,
      sceneId,
      commandId: crypto.randomUUID(),
      commandFingerprint: 'a'.repeat(64),
      createdAt: now
    })
  })
  return encounterId
}

/** Leaves the live Scene at version 1 with a DIM ambient setting, as a room checkpoint would. */
async function dimLiveScene(base: Awaited<ReturnType<typeof setup>>['base'], sceneId: string) {
  await base.t.run(async (ctx) => {
    const live = await ctx.db
      .query('sceneLiveStates')
      .withIndex('by_sceneId', (q) => q.eq('sceneId', sceneId))
      .unique()
    if (live) await ctx.db.delete(live._id)
    await ctx.db.insert(
      'sceneLiveStates',
      liveSceneHead(sceneId, { version: 1, ambientIllumination: 'DIM' })
    )
  })
}

it('captures the admitting member, the presentation and its ACTIVE bound Encounter', async () => {
  const { base, input, sceneId } = await setup()
  await expect(base.owner.caller.query(capture, input)).resolves.toMatchObject({
    campaignId: base.campaign.id,
    origin: { role: 'OWNER', userId: base.owner.userId },
    presentation: { campaignId: base.campaign.id, sceneId, version: 0 },
    sceneEncounterId: null,
    sceneHeader: { id: sceneId, version: 0 }
  })
  const encounterId = await bindRun(base, sceneId, 'ACTIVE')
  await expect(base.owner.caller.query(capture, input)).resolves.toMatchObject({
    sceneEncounterId: encounterId
  })
  // A PREPARED Run bound later is the newest binding but is not being played.
  await bindRun(base, sceneId, 'PREPARED')
  await expect(base.owner.caller.query(capture, input)).resolves.toMatchObject({
    sceneEncounterId: encounterId
  })
}, 30_000)

it('captures a successfully admitted PLAYER origin and rejects anonymous or mismatched socket binding', async () => {
  const { base, input } = await setup()
  const playerInput = {
    ...input,
    expectedRole: 'PLAYER' as const,
    expectedUserId: base.other.userId
  }
  await expect(base.other.caller.query(capture, playerInput)).resolves.toMatchObject({
    origin: { role: 'PLAYER', userId: base.other.userId }
  })
  await expect(base.t.query(capture, input)).rejects.toThrow('Unauthenticated')
  await expect(
    base.owner.caller.query(capture, {
      ...input,
      expectedUserId: base.other.userId
    })
  ).rejects.toThrow('identity')
  await expect(
    base.owner.caller.query(capture, { ...input, expectedRole: 'PLAYER' })
  ).rejects.toThrow('identity')
})

it('rejects archived and cross-Campaign captures, and ignores finished Campaign Sessions', async () => {
  const archived = await setup()
  await archived.base.t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', archived.base.campaign.id))
      .unique()
    if (!campaign) throw new Error('Missing Campaign.')
    await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
  })
  await expect(archived.base.owner.caller.query(capture, archived.input)).rejects.toThrow(
    'Archived'
  )

  const finished = await setup()
  const finishedSession = await finished.base.owner.caller.mutation(createSession, {
    campaignId: finished.base.campaign.id
  })
  await finished.base.t.run(async (ctx) => {
    const session = await ctx.db
      .query('campaignSessions')
      .withIndex('by_publicId', (q) => q.eq('id', finishedSession.id))
      .unique()
    if (!session) throw new Error('Missing Session.')
    await ctx.db.patch(session._id, {
      finishedAt: new Date().toISOString(),
      status: 'FINISHED'
    })
  })
  await expect(finished.base.owner.caller.query(capture, finished.input)).resolves.toMatchObject({
    campaignId: finished.base.campaign.id
  })

  const foreign = await setup()
  const foreignCampaign = await foreign.base.other.caller.mutation(createCampaign, {
    name: 'Foreign Campaign',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: foreign.base.campaign.gameSystemId,
    primaryRulesCatalogueId: foreign.base.campaign.primaryRulesCatalogueId
  })
  await expect(
    foreign.base.owner.caller.query(capture, {
      ...foreign.input,
      campaignId: foreignCampaign.id
    })
  ).rejects.toThrow('Campaign not found')
})

it('captures the presentation after the GM clears the presented Scene', async () => {
  const { base, input } = await setup()
  await base.owner.caller.mutation(setPresentation, {
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: 0,
    campaignId: base.campaign.id,
    sceneId: null,
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
  })
  await expect(base.owner.caller.query(capture, input)).resolves.toMatchObject({
    presentation: { campaignId: base.campaign.id, sceneId: null, version: 1 },
    sceneEncounterId: null,
    sceneHeader: null
  })
})

describe('room Scene capture', () => {
  it('serves the room by its DO_ACTIVE epoch with no member identity, and returns the Scene, its Encounter and vision freshness', async () => {
    const { base, input, sceneId } = await setupRoom()
    await expect(base.t.query(roomScene, input)).resolves.toMatchObject({
      campaignId: base.campaign.id,
      systemId: base.campaign.gameSystemId,
      observedCharacterRevisions: [],
      presentation: { campaignId: base.campaign.id, sceneId, version: 0 },
      sceneEncounterId: null,
      sceneHeader: { id: sceneId, version: 0 },
      visionFreshness: expect.any(Object)
    })
    await bindRun(base, sceneId, 'PREPARED')
    await expect(base.t.query(roomScene, input)).resolves.toMatchObject({
      sceneEncounterId: null
    })
    const encounterId = await bindRun(base, sceneId, 'ACTIVE')
    await expect(base.t.query(roomScene, input)).resolves.toMatchObject({
      sceneEncounterId: encounterId
    })
  }, 30_000)

  it('captures a changed Scene header and a cleared presentation without vision freshness', async () => {
    const { base, input, sceneId } = await setupRoom()
    await dimLiveScene(base, sceneId)
    await expect(base.t.query(roomScene, input)).resolves.toMatchObject({
      sceneHeader: { ambientIllumination: 'DIM', id: sceneId, version: 1 }
    })
    // While the room holds the Campaign, only it changes the presentation; model its commit.
    await base.t.run(async (ctx) => {
      const presentation = await ctx.db
        .query('campaignScenePresentations')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
        .unique()
      if (!presentation) throw new Error('Missing presentation.')
      await ctx.db.patch(presentation._id, { sceneId: null, version: 1 })
    })
    await expect(base.t.query(roomScene, input)).resolves.toMatchObject({
      presentation: { campaignId: base.campaign.id, sceneId: null, version: 1 },
      sceneEncounterId: null,
      sceneHeader: null,
      visionFreshness: null
    })
  })

  it('rejects a stale or inactive epoch, an archived Campaign and another Campaign', async () => {
    const { base, input } = await setupRoom()
    await expect(base.t.query(roomScene, { ...input, epoch: crypto.randomUUID() })).rejects.toThrow(
      'stale'
    )
    await expect(
      base.t.query(roomScene, { ...input, campaignId: crypto.randomUUID() })
    ).rejects.toThrow()
    await base.t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      if (!campaign) throw new Error('Missing Campaign.')
      await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
    })
    await expect(base.t.query(roomScene, input)).rejects.toThrow('Archived')
    await base.t.run(async (ctx) => {
      const authority = await ctx.db.query('campaignLiveAuthorities').first()
      if (authority) await ctx.db.patch(authority._id, { phase: 'DRAINING' })
    })
    await expect(base.t.query(roomScene, input)).rejects.toThrow('not active')
  })

  it('rejects Character revisions the Scene vision no longer matches, and stale System vision', async () => {
    const { base, input } = await setupRoom()
    const characterId = crypto.randomUUID()
    await base.t.run((ctx) =>
      ctx.db.insert('sceneVisionRevisions', {
        id: characterId,
        revision: crypto.randomUUID(),
        scope: 'CHARACTER'
      })
    )
    await expect(
      base.t.query(roomScene, {
        ...input,
        observedCharacterRevisions: [{ characterId, revision: crypto.randomUUID() }]
      })
    ).rejects.toThrow('Character changed')

    await base.t.run(async (ctx) => {
      await ctx.db.insert('sceneVisionRevisions', {
        id: base.campaign.gameSystemId,
        revision: crypto.randomUUID(),
        scope: 'SYSTEM'
      })
      await ctx.db.insert('sceneVisionRevisions', {
        id: base.campaign.gameSystemId,
        revision: crypto.randomUUID(),
        scope: 'SYSTEM'
      })
    })
    await expect(base.t.query(roomScene, input)).rejects.toThrow()
  })
})
