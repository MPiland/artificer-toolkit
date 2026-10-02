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
import { sceneStoredFogLayerSchema } from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { seedFogLayer } from '../../tests/fixtures/liveSceneFog'
import { liveSceneHead } from '../../tests/fixtures/liveSceneToken'
import {
  createSceneDefinitionFixture,
  publishEmptyScene
} from '../../tests/fixtures/sceneDefinitions'

const layers = makeFunctionReference<'query', SceneFogLayersPageInput, SceneFogLayersPage>(
  'scenes/fogReads:layers'
)
const chunks = makeFunctionReference<'query', SceneFogChunksPageInput, SceneFogChunksPage>(
  'scenes/fogReads:chunks'
)
const transientLayers = makeFunctionReference<'query', SceneFogLayersPageInput, SceneFogLayersPage>(
  'scenes/transientFogReads:layers'
)
const transientChunks = makeFunctionReference<'query', SceneFogChunksPageInput, SceneFogChunksPage>(
  'scenes/transientFogReads:chunks'
)
const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)

it('keeps private layers owner-only, while active players read shared and own layers', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  await base.t.run((ctx) =>
    ctx.db.insert('sceneLiveStates', liveSceneHead(sceneId, { version: 2, fogLayers: 2 }))
  )
  const shared = await seedFogLayer(base, {
    sceneId,
    actorUserId: base.owner.userId,
    ownerUserId: null,
    data: 'AA=='
  })
  const own = await seedFogLayer(base, {
    sceneId,
    actorUserId: base.owner.userId,
    ownerUserId: base.other.userId,
    ordinal: 1
  })
  const page = (ownerUserId: string | null) => ({
    sceneId,
    ownerUserId,
    expectedVersion: 2,
    offset: 0,
    numItems: 8
  })
  await expect(base.other.caller.query(chunks, page(null))).resolves.toMatchObject({
    page: [shared.chunk]
  })
  await expect(base.other.caller.query(chunks, page(base.other.userId))).resolves.toMatchObject({
    page: [own.chunk]
  })
  await expect(base.other.caller.query(chunks, page(base.owner.userId))).rejects.toThrow(
    'unavailable'
  )
  await base.t.run(async (ctx) => {
    const layer = await ctx.db
      .query('sceneFogLayers')
      .withIndex('by_sceneId_ownerUserId', (q) => q.eq('sceneId', sceneId).eq('ownerUserId', null))
      .unique()
    if (!layer) throw new Error('Missing shared fog layer.')
    const { _creationTime, _id, checksum: _checksum, ...content } = layer
    const referenced = layer.chunks.map((reference) => ({
      ...reference,
      saveId: own.saveId,
      checksum: checksumCanonicalJson(own.chunk)
    }))
    await ctx.db.replace(
      layer._id,
      sceneStoredFogLayerSchema.parse({
        ...content,
        chunks: referenced,
        checksum: checksumCanonicalJson({ ...content, chunks: referenced })
      })
    )
  })
  await expect(base.owner.caller.query(chunks, page(null))).rejects.toThrow('inconsistent')
  await base.t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    if (!campaign) throw new Error('Missing Campaign.')
    await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
  })
  await expect(
    base.other.caller.query(layers, {
      sceneId,
      expectedVersion: 2,
      paginationOpts: { cursor: null, numItems: 8 }
    })
  ).resolves.toMatchObject({ page: expect.any(Array) })
  await base.t.run(async (ctx) => {
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!membership) throw new Error('Missing player membership.')
    await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
  })
  await expect(
    base.other.caller.query(layers, {
      sceneId,
      expectedVersion: null,
      paginationOpts: { cursor: null, numItems: 8 }
    })
  ).rejects.toThrow('Campaign not found')
})

it('hydrates all member fog only through the internal transient reader', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  await base.t.run((ctx) =>
    ctx.db.insert('sceneLiveStates', liveSceneHead(sceneId, { version: 3, fogLayers: 3 }))
  )
  const seed = (ownerUserId: string | null, ordinal: number, data: string) =>
    seedFogLayer(base, { sceneId, actorUserId: base.owner.userId, ownerUserId, ordinal, data })
  const sharedChunk = (await seed(null, 0, 'AA==')).chunk
  const ownChunk = (await seed(base.other.userId, 1, 'AQ==')).chunk
  const otherChunk = (await seed(base.owner.userId, 2, 'Ag==')).chunk
  const layersInput = {
    sceneId,
    expectedVersion: 3,
    paginationOpts: { cursor: null, numItems: 8 }
  }
  const ownChunksInput = {
    sceneId,
    ownerUserId: base.other.userId,
    expectedVersion: 3,
    offset: 0,
    numItems: 8
  }
  const sharedChunksInput = { ...ownChunksInput, ownerUserId: null }
  const otherChunksInput = { ...ownChunksInput, ownerUserId: base.owner.userId }

  await expect(base.other.caller.query(layers, layersInput)).resolves.toMatchObject({
    page: [{ ownerUserId: null }, { ownerUserId: base.other.userId }]
  })
  await expect(base.other.caller.query(chunks, ownChunksInput)).resolves.toMatchObject({
    page: [ownChunk]
  })
  await expect(base.other.caller.query(chunks, sharedChunksInput)).resolves.toMatchObject({
    page: [sharedChunk]
  })
  await expect(base.other.caller.query(chunks, otherChunksInput)).rejects.toThrow('unavailable')

  const internalLayers = await base.other.caller.query(transientLayers, layersInput)
  expect(internalLayers.page).toHaveLength(3)
  expect(internalLayers.page.map((layer) => layer.ownerUserId)).toEqual(
    expect.arrayContaining([null, base.other.userId, base.owner.userId])
  )
  await expect(base.other.caller.query(transientChunks, ownChunksInput)).resolves.toMatchObject({
    page: [ownChunk]
  })
  await expect(base.other.caller.query(transientChunks, otherChunksInput)).resolves.toMatchObject({
    page: [otherChunk]
  })
  await expect(
    base.other.caller.query(transientChunks, { ...otherChunksInput, expectedVersion: 2 })
  ).rejects.toThrow('snapshot changed')
  await expect(base.t.query(transientLayers, layersInput)).rejects.toThrow()
  await expect(
    base.t.withIdentity({ subject: crypto.randomUUID() }).query(transientLayers, layersInput)
  ).rejects.toThrow()
  const foreignCampaign = await base.other.caller.mutation(createCampaign, {
    name: 'Foreign fog Campaign',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: base.campaign.gameSystemId,
    primaryRulesCatalogueId: base.campaign.primaryRulesCatalogueId
  })
  const moveScene = (campaignId: string) =>
    base.t.run(async (ctx) => {
      const scene = await ctx.db
        .query('campaignScenes')
        .withIndex('by_publicId', (q) => q.eq('id', sceneId))
        .unique()
      if (!scene) throw new Error('Missing Scene.')
      await ctx.db.patch(scene._id, { campaignId })
    })
  await moveScene(foreignCampaign.id)
  await expect(base.owner.caller.query(transientLayers, layersInput)).rejects.toThrow(
    'Campaign not found'
  )
  await moveScene(base.campaign.id)
  await base.t.run(async (ctx) => {
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!membership) throw new Error('Missing player membership.')
    await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
  })
  await expect(base.other.caller.query(transientLayers, layersInput)).rejects.toThrow()
})
