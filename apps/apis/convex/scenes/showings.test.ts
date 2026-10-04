import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  SceneFogChunksPage,
  SceneFogChunksPageInput,
  SceneFogLayersPage,
  SceneFogLayersPageInput
} from '@artificer-toolkit/schema/api/sceneFog'
import type {
  SceneCurrentEntityPage,
  SceneCurrentEntityPageInput,
  SceneRecipientCapture,
  SceneRecipientHeader,
  SceneRecipientHeaderInput
} from '@artificer-toolkit/schema/api/sceneRecipient'
import type {
  CampaignSceneShowingDto,
  CampaignSceneShowingInput,
  ShowCampaignSceneInput
} from '@artificer-toolkit/schema/api/vttScenes'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { seedFogLayer } from '../../tests/fixtures/liveSceneFog'
import { liveSceneHead } from '../../tests/fixtures/liveSceneToken'
import {
  createSceneDefinitionFixture,
  presentFixtureScene,
  publishEmptyScene
} from '../../tests/fixtures/sceneDefinitions'

const show = makeFunctionReference<'mutation', ShowCampaignSceneInput, null>('scenes/showings:show')
const stop = makeFunctionReference<'mutation', CampaignSceneShowingInput, null>(
  'scenes/showings:stop'
)
const current = makeFunctionReference<
  'query',
  CampaignSceneShowingInput,
  CampaignSceneShowingDto | null
>('scenes/showings:current')
const header = makeFunctionReference<'query', SceneRecipientHeaderInput, SceneRecipientHeader>(
  'scenes/recipientReads:header'
)
const capture = makeFunctionReference<
  'query',
  { sceneId: string; expectedVersion: number },
  SceneRecipientCapture
>('scenes/recipientReads:capture')
const currentEntities = makeFunctionReference<
  'query',
  SceneCurrentEntityPageInput,
  SceneCurrentEntityPage
>('scenes/recipientReads:currentEntities')
const layers = makeFunctionReference<'query', SceneFogLayersPageInput, SceneFogLayersPage>(
  'scenes/fogReads:layers'
)
const chunks = makeFunctionReference<'query', SceneFogChunksPageInput, SceneFogChunksPage>(
  'scenes/fogReads:chunks'
)
const readDelivery = makeFunctionReference<'query', { assetId: string }, { id: string }>(
  'media/vttMapAssets:readDelivery'
)
const removeDefinition = makeFunctionReference<
  'mutation',
  { campaignId: string; sceneId: string; expectedVersion: number },
  null
>('scenes/definitions:remove')
const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)

const unavailable = 'Live Scene is unavailable.'

async function setup() {
  const base = await createSceneDefinitionFixture()
  const publish = () =>
    publishEmptyScene({ ...base, input: { ...base.input, commandId: crypto.randomUUID() } })
  const presented = await publish()
  const shown = await publish()
  await presentFixtureScene(base, presented.sceneId)
  await base.t.run((ctx) =>
    ctx.db.insert('sceneLiveStates', liveSceneHead(shown.sceneId, { version: 2, fogLayers: 1 }))
  )
  const fog = await seedFogLayer(base, {
    sceneId: shown.sceneId,
    actorUserId: base.owner.userId,
    ownerUserId: null
  })
  return { base, presented, shown, fog, publish }
}

type Setup = Awaited<ReturnType<typeof setup>>
const showings = (base: Setup['base']) =>
  base.t.run((ctx) => ctx.db.query('campaignSceneShowings').collect())

function playerReads({ base, shown }: Pick<Setup, 'base' | 'shown'>) {
  const player = base.other.caller
  const sceneId = shown.sceneId
  return {
    header: () => player.query(header, { sceneId, includeSnapshot: true }),
    layers: () =>
      player.query(layers, {
        sceneId,
        expectedVersion: 2,
        paginationOpts: { cursor: null, numItems: 8 }
      }),
    chunks: () =>
      player.query(chunks, {
        sceneId,
        ownerUserId: null,
        expectedVersion: 2,
        offset: 0,
        numItems: 8
      }),
    map: () => player.query(readDelivery, { assetId: base.input.settings.map.assetId }),
    capture: () => player.query(capture, { sceneId, expectedVersion: 2 }),
    entities: () =>
      player.query(currentEntities, {
        sceneId,
        definitionSaveId: shown.save.saveId,
        expectedVersion: 2,
        collection: 'tokens',
        phase: 'BASE',
        afterOrdinal: null,
        numItems: 8
      })
  }
}

it('D87 a shown Scene gives players its header, map and fog but never its entities, and stopping ends it', async () => {
  const state = await setup()
  const { base, presented, shown, fog, publish } = state
  const campaignId = base.campaign.id
  const reads = playerReads(state)

  // Neither presented nor shown: a player reads none of it and sees no showing.
  await expect(reads.header()).rejects.toThrow(unavailable)
  await expect(reads.layers()).rejects.toThrow(unavailable)
  await expect(reads.chunks()).rejects.toThrow(unavailable)
  await expect(reads.map()).rejects.toThrow()
  await expect(base.other.caller.query(current, { campaignId })).resolves.toBeNull()

  await base.owner.caller.mutation(show, { campaignId, sceneId: shown.sceneId })

  // Shown: header (without a snapshot), fog and map are readable.
  await expect(reads.header()).resolves.toMatchObject({ id: shown.sceneId, snapshot: null })
  const playerLayers = await reads.layers()
  expect(playerLayers.page).toHaveLength(1)
  expect((await reads.chunks()).page).toEqual([fog.chunk])
  await expect(reads.map()).resolves.toMatchObject({ id: base.input.settings.map.assetId })
  // Entities and the recipient capture stay behind the presented-Scene gate.
  await expect(reads.capture()).rejects.toThrow(unavailable)
  await expect(reads.entities()).rejects.toThrow(unavailable)
  // The presented Scene is untouched and the showing is visible to members only as a small DTO.
  const presentation = await base.t.run((ctx) =>
    ctx.db.query('campaignScenePresentations').unique()
  )
  expect(presentation).toMatchObject({ sceneId: presented.sceneId, version: 0 })
  await expect(base.other.caller.query(current, { campaignId })).resolves.toEqual({
    sceneId: shown.sceneId,
    sceneName: 'Courtyard',
    shownAt: expect.any(String)
  })

  // Showing another Scene moves the showing and its access.
  const next = await publish()
  await base.owner.caller.mutation(show, { campaignId, sceneId: next.sceneId })
  expect(await showings(base)).toHaveLength(1)
  await expect(reads.header()).rejects.toThrow(unavailable)
  await expect(
    base.other.caller.query(header, { sceneId: next.sceneId, includeSnapshot: false })
  ).resolves.toMatchObject({ id: next.sceneId })

  // Stopping ends access and is idempotent.
  await base.owner.caller.mutation(stop, { campaignId })
  await base.owner.caller.mutation(stop, { campaignId })
  await expect(
    base.other.caller.query(header, { sceneId: next.sceneId, includeSnapshot: false })
  ).rejects.toThrow(unavailable)
  await expect(base.other.caller.query(current, { campaignId })).resolves.toBeNull()
  await expect(reads.map()).rejects.toThrow()
}, 60000)

it('D87 deleting a shown Scene ends the showing and the access', async () => {
  const state = await setup()
  const { base, shown } = state
  const reads = playerReads(state)
  await base.owner.caller.mutation(show, { campaignId: base.campaign.id, sceneId: shown.sceneId })
  await expect(reads.header()).resolves.toMatchObject({ id: shown.sceneId })

  const definitionId = await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', shown.sceneId))
      .unique()
    return row!.definitionId
  })
  await base.owner.caller.mutation(removeDefinition, {
    campaignId: base.campaign.id,
    sceneId: definitionId,
    expectedVersion: 1
  })

  expect(await showings(base)).toEqual([])
  await expect(reads.header()).rejects.toThrow(unavailable)
  await expect(reads.map()).rejects.toThrow()
}, 60000)

it('D87 only the owner shows or stops, and the presented Scene cannot be shown', async () => {
  const { base, presented, shown } = await setup()
  const campaignId = base.campaign.id

  await expect(
    base.other.caller.mutation(show, { campaignId, sceneId: shown.sceneId })
  ).rejects.toThrow('Campaign not found.')
  await expect(base.other.caller.mutation(stop, { campaignId })).rejects.toThrow(
    'Campaign not found.'
  )
  await expect(
    base.owner.caller.mutation(show, { campaignId, sceneId: presented.sceneId })
  ).rejects.toThrow('already in front of players')
  await expect(
    base.owner.caller.mutation(show, { campaignId, sceneId: crypto.randomUUID() })
  ).rejects.toThrow('Campaign live Scene was not found.')
  expect(await showings(base)).toEqual([])

  // A non-member (the GM of this Campaign) cannot read another Campaign's showing.
  const unrelated = await base.other.caller.mutation(createCampaign, {
    name: 'Not shared',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await expect(base.owner.caller.query(current, { campaignId: unrelated.id })).rejects.toThrow(
    'Campaign not found.'
  )
}, 60000)
