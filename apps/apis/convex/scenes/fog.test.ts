import { makeFunctionReference } from 'convex/server'
import { getConvexSize } from 'convex/values'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignSessionDto,
  FinishCampaignSessionInput
} from '@artificer-toolkit/schema/api/campaignSessions'
import type {
  SceneRecipientHeader,
  SceneRecipientHeaderInput,
  SceneRecipientPage,
  SceneRecipientPageInput
} from '@artificer-toolkit/schema/api/sceneRecipient'
import type {
  SceneFogAppendInput,
  SceneFogChunksPage,
  SceneFogCommandChunksPage,
  SceneFogCommandResult,
  SceneFogCommandChunksInput,
  SceneFogChunksPageInput,
  SceneFogLayersPage,
  SceneFogLayersPageInput,
  SceneFogPatchInput,
  SceneFogSaveProgress
} from '@artificer-toolkit/schema/api/sceneFog'
import type {
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto,
  SceneCommandResultDto,
  SceneGeometryCommandInputDto,
  SceneLiveCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type { SceneGeometryCommandResult } from '@artificer-toolkit/schema/api/sceneGeometry'
import { sceneStoredFogLayerSchema } from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import { sceneStoredLiveStateSchema } from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  createSceneDefinitionFixture,
  publishEmptyScene
} from '../../tests/fixtures/sceneDefinitions'
import { withSceneVisionTracking } from '../lib/mutations'

const begin = makeFunctionReference<
  'mutation',
  { input: SceneFogPatchInput },
  SceneFogSaveProgress
>('scenes/fogCommands:begin')
const append = makeFunctionReference<
  'mutation',
  { input: SceneFogAppendInput },
  SceneFogSaveProgress
>('scenes/fogCommands:append')
const publish = makeFunctionReference<'mutation', { saveId: string }, SceneFogCommandResult>(
  'scenes/fogCommands:publish'
)
const cleanup = makeFunctionReference<'mutation', { saveId: string }, null>(
  'scenes/fogCommands:cleanup'
)
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
const commandChunks = makeFunctionReference<
  'query',
  SceneFogCommandChunksInput,
  SceneFogCommandChunksPage
>('scenes/fogReads:commandChunks')
const execute = makeFunctionReference<
  'mutation',
  { input: SceneLiveCommandInputDto },
  SceneCommandResultDto
>('scenes/commands:execute')
const recipient = makeFunctionReference<'action', SceneRecipientPageInput, SceneRecipientPage>(
  'scenes/recipientActions:entities'
)
const executeGeometry = makeFunctionReference<
  'action',
  { input: SceneGeometryCommandInputDto },
  SceneGeometryCommandResult
>('scenes/geometryActions:execute')
const recipientHeader = makeFunctionReference<
  'query',
  SceneRecipientHeaderInput,
  SceneRecipientHeader
>('scenes/recipientReads:header')
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

afterEach(() => vi.useRealTimers())

function fogChunk(index: number, data = 'AA==', x = 0, y = 0, width = 1, height = 1) {
  return { data, height, index, width, x, y }
}

function fogToken() {
  return {
    assetId: null,
    controlledByUserIds: [],
    height: 1,
    hidden: false,
    id: crypto.randomUUID(),
    label: 'Token',
    locked: false,
    position: { x: 10, y: 10 },
    rotationDegrees: 0,
    vision: null,
    width: 1
  }
}

function recipientInput(
  sceneId: string,
  expectedVersion: number,
  collection: SceneRecipientPageInput['collection'],
  expectedRecipientRevision: string
): SceneRecipientPageInput {
  return {
    sceneId,
    expectedVersion,
    expectedRecipientRevision,
    collection,
    afterEntityId: null,
    numItems: 8
  }
}

function patch(
  sceneId: string,
  expectedSceneVersion: number,
  chunks: ReturnType<typeof fogChunk>[],
  ownerUserId: string | null = null,
  commandId = crypto.randomUUID(),
  width = 8,
  height = 8
): SceneFogPatchInput {
  return {
    type: 'PATCH_SCENE_FOG',
    sceneId,
    commandId,
    expectedSceneVersion,
    layer: { ownerUserId, width, height },
    chunkManifest: chunks.map((chunk) => ({
      index: chunk.index,
      checksum: checksumCanonicalJson(chunk)
    }))
  }
}

async function upload(
  base: Awaited<ReturnType<typeof createSceneDefinitionFixture>>,
  input: SceneFogPatchInput,
  chunksToUpload: ReturnType<typeof fogChunk>[]
) {
  const save = await base.owner.caller.mutation(begin, { input })
  for (let offset = 0; offset < chunksToUpload.length; offset += 8)
    await base.owner.caller.mutation(append, {
      input: { saveId: save.saveId, offset, chunks: chunksToUpload.slice(offset, offset + 8) }
    })
  return save
}

async function stored(base: Awaited<ReturnType<typeof createSceneDefinitionFixture>>) {
  return base.t.run(async (ctx) => ({
    saves: await ctx.db.query('sceneFogSaves').collect(),
    chunks: await ctx.db.query('sceneFogChunks').collect(),
    layers: await ctx.db.query('sceneFogLayers').collect(),
    head: await ctx.db.query('sceneLiveStates').collect(),
    receipts: await ctx.db.query('sceneLiveCommands').collect()
  }))
}

async function presentedSession(
  base: Awaited<ReturnType<typeof createSceneDefinitionFixture>>,
  sceneId: string
) {
  const session = await base.owner.caller.mutation(createSession, { campaignId: base.campaign.id })
  const presentation = await base.owner.caller.mutation(setPresentation, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    sceneId,
    sessionId: session.id
  })
  return {
    session,
    context: {
      expectedPresentationVersion: presentation.version,
      expectedSessionVersion: session.version,
      sessionId: session.id
    }
  }
}

it('rejects Session-scoped fog append and publish after the Session closes atomically', async () => {
  const appendBase = await createSceneDefinitionFixture()
  const { sceneId: appendSceneId } = await publishEmptyScene(appendBase)
  const appendContext = await presentedSession(appendBase, appendSceneId)
  const appendChunks = [fogChunk(0)]
  const appendInput = { ...patch(appendSceneId, 0, appendChunks), session: appendContext.context }
  const appendSave = await appendBase.owner.caller.mutation(begin, { input: appendInput })
  const appendBefore = await stored(appendBase)
  await appendBase.owner.caller.mutation(finishSession, {
    campaignId: appendBase.campaign.id,
    sessionId: appendContext.session.id,
    expectedVersion: appendContext.session.version,
    commandId: crypto.randomUUID()
  })
  await expect(
    appendBase.owner.caller.mutation(append, {
      input: { saveId: appendSave.saveId, offset: 0, chunks: appendChunks }
    })
  ).rejects.toThrow('Session is not current and open')
  expect(await stored(appendBase)).toEqual(appendBefore)

  const publishBase = await createSceneDefinitionFixture()
  const { sceneId: publishSceneId } = await publishEmptyScene(publishBase)
  const publishContext = await presentedSession(publishBase, publishSceneId)
  const publishChunks = [fogChunk(0)]
  const publishInput = {
    ...patch(publishSceneId, 0, publishChunks),
    session: publishContext.context
  }
  const publishSave = await upload(publishBase, publishInput, publishChunks)
  const publishBefore = await stored(publishBase)
  await publishBase.owner.caller.mutation(finishSession, {
    campaignId: publishBase.campaign.id,
    sessionId: publishContext.session.id,
    expectedVersion: publishContext.session.version,
    commandId: crypto.randomUUID()
  })
  await expect(
    publishBase.owner.caller.mutation(publish, { saveId: publishSave.saveId })
  ).rejects.toThrow('Session is not current and open')
  expect(await stored(publishBase)).toEqual(publishBefore)
})

it('rejects Session-scoped fog append and publish after the presentation changes atomically', async () => {
  const appendBase = await createSceneDefinitionFixture()
  const { sceneId: appendSceneId } = await publishEmptyScene(appendBase)
  const appendContext = await presentedSession(appendBase, appendSceneId)
  const appendChunks = [fogChunk(0)]
  const appendInput = { ...patch(appendSceneId, 0, appendChunks), session: appendContext.context }
  const appendSave = await appendBase.owner.caller.mutation(begin, { input: appendInput })
  const appendBefore = await stored(appendBase)
  await appendBase.owner.caller.mutation(setPresentation, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: appendContext.context.expectedPresentationVersion,
    sceneId: appendSceneId,
    sessionId: appendContext.session.id
  })
  await expect(
    appendBase.owner.caller.mutation(append, {
      input: { saveId: appendSave.saveId, offset: 0, chunks: appendChunks }
    })
  ).rejects.toThrow('presentation is stale')
  expect(await stored(appendBase)).toEqual(appendBefore)

  const publishBase = await createSceneDefinitionFixture()
  const { sceneId: publishSceneId } = await publishEmptyScene(publishBase)
  const publishContext = await presentedSession(publishBase, publishSceneId)
  const publishChunks = [fogChunk(0)]
  const publishInput = {
    ...patch(publishSceneId, 0, publishChunks),
    session: publishContext.context
  }
  const publishSave = await upload(publishBase, publishInput, publishChunks)
  const publishBefore = await stored(publishBase)
  await publishBase.owner.caller.mutation(setPresentation, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: publishContext.context.expectedPresentationVersion,
    sceneId: publishSceneId,
    sessionId: publishContext.session.id
  })
  await expect(
    publishBase.owner.caller.mutation(publish, { saveId: publishSave.saveId })
  ).rejects.toThrow('presentation is stale')
  expect(await stored(publishBase)).toEqual(publishBefore)
})

it('replays a published Session-scoped fog save after version advances in the same open presentation', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  const context = await presentedSession(base, sceneId)
  const chunks = [fogChunk(0)]
  const input = { ...patch(sceneId, 0, chunks), session: context.context }
  const save = await upload(base, input, chunks)
  const first = await base.owner.caller.mutation(publish, { saveId: save.saveId })

  await base.t.run(async (ctx) => {
    const session = await ctx.db
      .query('campaignSessions')
      .withIndex('by_publicId', (q) => q.eq('id', context.session.id))
      .unique()
    if (!session) throw new Error('Missing Session.')
    await ctx.db.patch(session._id, { version: session.version + 1 })
  })
  await base.owner.caller.mutation(setPresentation, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: context.context.expectedPresentationVersion,
    sceneId,
    sessionId: context.session.id
  })

  await expect(base.owner.caller.mutation(begin, { input })).resolves.toMatchObject({
    saveId: save.saveId,
    status: 'PUBLISHED',
    receivedChunks: chunks.length
  })
  await expect(
    base.owner.caller.mutation(append, { input: { saveId: save.saveId, offset: 0, chunks } })
  ).resolves.toMatchObject({
    saveId: save.saveId,
    status: 'PUBLISHED',
    receivedChunks: chunks.length
  })
  await expect(base.owner.caller.mutation(publish, { saveId: save.saveId })).resolves.toEqual({
    ...first,
    replayed: true
  })
})

it('rejects receiving-save retries after only the current open Session version advances', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  const context = await presentedSession(base, sceneId)
  const chunks = [fogChunk(0)]
  const input = { ...patch(sceneId, 0, chunks), session: context.context }
  const save = await base.owner.caller.mutation(begin, { input })
  const before = await stored(base)

  await base.t.run(async (ctx) => {
    const session = await ctx.db
      .query('campaignSessions')
      .withIndex('by_publicId', (q) => q.eq('id', context.session.id))
      .unique()
    if (!session) throw new Error('Missing Session.')
    await ctx.db.patch(session._id, { version: session.version + 1 })
  })

  await expect(base.owner.caller.mutation(begin, { input })).rejects.toThrow(
    'Session is not current and open'
  )
  await expect(
    base.owner.caller.mutation(append, { input: { saveId: save.saveId, offset: 0, chunks } })
  ).rejects.toThrow('Session is not current and open')
  await expect(base.owner.caller.mutation(publish, { saveId: save.saveId })).rejects.toThrow(
    'Session is not current and open'
  )
  expect(await stored(base)).toEqual(before)
})

it('rejects a fog save started with a wrong Session without writing state', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  const presented = await presentedSession(base, sceneId)
  const wrongSession = await base.owner.caller.mutation(createSession, {
    campaignId: base.campaign.id
  })
  const input = {
    ...patch(sceneId, 0, [fogChunk(0)]),
    session: {
      sessionId: wrongSession.id,
      expectedSessionVersion: wrongSession.version,
      expectedPresentationVersion: presented.context.expectedPresentationVersion
    }
  }
  const before = await stored(base)
  await expect(base.owner.caller.mutation(begin, { input })).rejects.toThrow(
    'presentation is stale'
  )
  expect(await stored(base)).toEqual(before)
})

it('publishes ordered fog references, retains historical chunks, and makes no pre-publish layer visible', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  const firstChunks = [fogChunk(7), fogChunk(2), fogChunk(4)]
  const firstInput = patch(sceneId, 0, firstChunks)
  const firstSave = await upload(base, firstInput, firstChunks)
  expect(
    await base.owner.caller.query(layers, {
      sceneId,
      expectedVersion: 0,
      paginationOpts: { cursor: null, numItems: 8 }
    })
  ).toMatchObject({ page: [] })
  await expect(base.owner.caller.mutation(begin, { input: firstInput })).resolves.toEqual({
    ...firstSave,
    receivedChunks: firstChunks.length
  })
  await expect(
    base.owner.caller.mutation(append, {
      input: { saveId: firstSave.saveId, offset: 0, chunks: firstChunks }
    })
  ).resolves.toEqual(expect.objectContaining({ receivedChunks: 3 }))
  const first = await base.owner.caller.mutation(publish, { saveId: firstSave.saveId })
  await expect(base.owner.caller.mutation(publish, { saveId: firstSave.saveId })).resolves.toEqual({
    ...first,
    replayed: true
  })
  await expect(
    base.owner.caller.query(chunks, {
      sceneId,
      ownerUserId: null,
      expectedVersion: first.version,
      offset: 0,
      numItems: 8
    })
  ).resolves.toMatchObject({ page: firstChunks })
  const replacement = fogChunk(4, 'AQ==')
  const secondChunks = [replacement, fogChunk(1)]
  const secondInput = patch(sceneId, first.version, secondChunks)
  const secondSave = await upload(base, secondInput, secondChunks)
  const second = await base.owner.caller.mutation(publish, { saveId: secondSave.saveId })
  const current = await base.owner.caller.query(chunks, {
    sceneId,
    ownerUserId: null,
    expectedVersion: second.version,
    offset: 0,
    numItems: 8
  })
  expect(current.page.map((chunk) => chunk.index)).toEqual([1, 2, 4, 7])
  expect(current.page.find((chunk) => chunk.index === 4)).toEqual(replacement)
  const historical = await base.owner.caller.query(commandChunks, {
    sceneId,
    commandId: firstInput.commandId,
    offset: 0,
    numItems: 8
  })
  expect(historical.page).toEqual(firstChunks)
  await expect(
    base.owner.caller.query(chunks, {
      sceneId,
      ownerUserId: null,
      expectedVersion: first.version,
      offset: 0,
      numItems: 8
    })
  ).rejects.toThrow('snapshot changed')
  await base.t.mutation(cleanup, { saveId: firstSave.saveId })
  expect((await stored(base)).chunks).toHaveLength(5)
})

it('rejects malformed or incomplete batches atomically and expires uploads without resurrection', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  const values = Array.from({ length: 9 }, (_, index) => fogChunk(index))
  const input = patch(sceneId, 0, values)
  const before = await stored(base)
  await expect(
    base.owner.caller.mutation(begin, { input: patch(sceneId, 0, [fogChunk(0), fogChunk(0)]) })
  ).rejects.toThrow('unique')
  expect(await stored(base)).toEqual(before)
  const boundsSave = await base.owner.caller.mutation(begin, {
    input: patch(sceneId, 0, [fogChunk(0, 'AA==', 8)])
  })
  const beforeBounds = await stored(base)
  await expect(
    base.owner.caller.mutation(append, {
      input: { saveId: boundsSave.saveId, offset: 0, chunks: [fogChunk(0, 'AA==', 8)] }
    })
  ).rejects.toThrow('within')
  expect(await stored(base)).toEqual(beforeBounds)
  const save = await base.owner.caller.mutation(begin, { input })
  await expect(
    base.owner.caller.mutation(append, {
      input: { saveId: save.saveId, offset: 1, chunks: [values[1]!] }
    })
  ).rejects.toThrow('offset')
  await expect(
    base.owner.caller.mutation(append, {
      input: { saveId: save.saveId, offset: 0, chunks: [fogChunk(0, 'AQ==')] }
    })
  ).rejects.toThrow('manifest')
  await expect(base.owner.caller.mutation(publish, { saveId: save.saveId })).rejects.toThrow(
    'incomplete'
  )
  expect((await stored(base)).chunks).toEqual([])
  await base.owner.caller.mutation(append, {
    input: { saveId: save.saveId, offset: 0, chunks: values.slice(0, 8) }
  })
  await expect(
    base.owner.caller.mutation(append, {
      input: { saveId: save.saveId, offset: 7, chunks: values.slice(7, 9) }
    })
  ).rejects.toThrow('replay')
  await base.owner.caller.mutation(append, {
    input: { saveId: save.saveId, offset: 8, chunks: values.slice(8) }
  })
  vi.setSystemTime(Date.now() + 24 * 60 * 60_000 + 1)
  await base.t.mutation(cleanup, { saveId: save.saveId })
  expect((await stored(base)).chunks).toHaveLength(1)
  await base.t.mutation(cleanup, { saveId: save.saveId })
  expect((await stored(base)).chunks).toEqual([])
  // Check the retained expiry marker with a current login after the cleanup time jump.
  vi.useRealTimers()
  await expect(base.owner.caller.mutation(begin, { input })).rejects.toThrow('expired')
})

it('keeps private layers and command history owner-only, while active players read shared and own layers', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  const sharedChunk = fogChunk(0)
  const privateChunk = fogChunk(0, 'AQ==')
  const sharedInput = patch(sceneId, 0, [sharedChunk])
  const shared = await upload(base, sharedInput, [sharedChunk])
  await base.owner.caller.mutation(publish, { saveId: shared.saveId })
  const privateInput = patch(sceneId, 1, [privateChunk], base.other.userId)
  const privateSave = await upload(base, privateInput, [privateChunk])
  await base.owner.caller.mutation(publish, { saveId: privateSave.saveId })
  await expect(
    base.other.caller.query(chunks, {
      sceneId,
      ownerUserId: null,
      expectedVersion: 2,
      offset: 0,
      numItems: 8
    })
  ).resolves.toMatchObject({ page: [sharedChunk] })
  await expect(
    base.other.caller.query(chunks, {
      sceneId,
      ownerUserId: base.other.userId,
      expectedVersion: 2,
      offset: 0,
      numItems: 8
    })
  ).resolves.toMatchObject({ page: [privateChunk] })
  await expect(
    base.other.caller.query(chunks, {
      sceneId,
      ownerUserId: base.owner.userId,
      expectedVersion: 2,
      offset: 0,
      numItems: 8
    })
  ).rejects.toThrow('unavailable')
  await expect(
    base.other.caller.query(commandChunks, {
      sceneId,
      commandId: sharedInput.commandId,
      offset: 0,
      numItems: 8
    })
  ).rejects.toThrow('owner')
  await base.t.run(async (ctx) => {
    const layer = await ctx.db
      .query('sceneFogLayers')
      .withIndex('by_sceneId_ownerUserId', (q) => q.eq('sceneId', sceneId).eq('ownerUserId', null))
      .unique()
    if (!layer) throw new Error('Missing shared fog layer.')
    const { _creationTime, _id, checksum: _checksum, ...content } = layer
    const chunks = layer.chunks.map((reference) => ({
      ...reference,
      saveId: privateSave.saveId,
      checksum: checksumCanonicalJson(privateChunk)
    }))
    await ctx.db.replace(
      layer._id,
      sceneStoredFogLayerSchema.parse({
        ...content,
        chunks,
        checksum: checksumCanonicalJson({ ...content, chunks })
      })
    )
  })
  await expect(
    base.owner.caller.query(chunks, {
      sceneId,
      ownerUserId: null,
      expectedVersion: 2,
      offset: 0,
      numItems: 8
    })
  ).rejects.toThrow('inconsistent')
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
  await expect(
    base.owner.caller.mutation(begin, { input: patch(sceneId, 2, [fogChunk(2)]) })
  ).rejects.toThrow('Archived')
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
  const sharedChunk = fogChunk(0)
  const ownChunk = fogChunk(0, 'AQ==')
  const otherChunk = fogChunk(0, 'Ag==')
  const sharedSave = await upload(base, patch(sceneId, 0, [sharedChunk]), [sharedChunk])
  await base.owner.caller.mutation(publish, { saveId: sharedSave.saveId })
  const ownSave = await upload(base, patch(sceneId, 1, [ownChunk], base.other.userId), [ownChunk])
  await base.owner.caller.mutation(publish, { saveId: ownSave.saveId })
  const otherSave = await upload(base, patch(sceneId, 2, [otherChunk], base.owner.userId), [
    otherChunk
  ])
  const published = await base.owner.caller.mutation(publish, { saveId: otherSave.saveId })
  const layersInput = {
    sceneId,
    expectedVersion: published.version,
    paginationOpts: { cursor: null, numItems: 8 }
  }
  const ownChunksInput = {
    sceneId,
    ownerUserId: base.other.userId,
    expectedVersion: published.version,
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
  await base.t.run(async (ctx) => {
    const scene = await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', sceneId))
      .unique()
    if (!scene) throw new Error('Missing foreign Scene.')
    await ctx.db.patch(scene._id, { campaignId: foreignCampaign.id })
  })
  await expect(base.owner.caller.query(transientLayers, layersInput)).rejects.toThrow(
    'Campaign not found'
  )
  await base.t.run(async (ctx) => {
    const scene = await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', sceneId))
      .unique()
    if (!scene) throw new Error('Missing Scene.')
    await ctx.db.patch(scene._id, { campaignId: base.campaign.id })
  })
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

it('projects native entities through shared and recipient fog with fenced access', async () => {
  const base = await createSceneDefinitionFixture()
  const { save: definitionSave, sceneId } = await publishEmptyScene(base)
  const gmOnly = {
    id: crypto.randomUUID(),
    position: { x: 10, y: 10 },
    text: 'GM only',
    visibility: 'GM_ONLY' as const
  }
  const sharedNote = {
    id: crypto.randomUUID(),
    position: { x: 10, y: 10 },
    text: 'Shared note',
    visibility: 'TABLE' as const
  }
  const sharedToken = { ...fogToken(), label: 'Shared token', position: { x: 10, y: 10 } }
  const foreignToken = { ...fogToken(), label: 'Foreign fog token', position: { x: 500, y: 10 } }
  const ownToken = { ...fogToken(), label: 'Own fog token', position: { x: 900, y: 10 } }
  const hiddenToken = {
    ...fogToken(),
    hidden: true,
    label: 'Hidden token',
    position: { x: 10, y: 10 }
  }
  const doorId = crypto.randomUUID()
  const commands: (SceneLiveCommandInputDto | SceneGeometryCommandInputDto)[] = [
    {
      type: 'UPSERT_SCENE_ANNOTATION',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      annotation: gmOnly
    },
    {
      type: 'UPSERT_SCENE_ANNOTATION',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 1,
      annotation: sharedNote
    },
    {
      type: 'UPSERT_SCENE_TOKEN',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 2,
      token: sharedToken
    },
    {
      type: 'UPSERT_SCENE_TOKEN',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 3,
      token: foreignToken
    },
    {
      type: 'UPSERT_SCENE_TOKEN',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 4,
      token: ownToken
    },
    {
      type: 'UPSERT_SCENE_TOKEN',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 5,
      token: hiddenToken
    },
    {
      type: 'UPSERT_SCENE_BARRIER',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 6,
      barrier: {
        id: doorId,
        kind: 'DOOR',
        a: { x: 0, y: 0 },
        b: { x: 20, y: 20 },
        blocksLightWhenClosed: true,
        blocksMovementWhenClosed: true,
        initialState: 'CLOSED',
        openAngleDegrees: 90
      }
    },
    {
      type: 'UPSERT_SCENE_LIGHT',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 7,
      light: {
        id: crypto.randomUUID(),
        kind: 'POINT',
        position: { x: 10, y: 10 },
        brightRadius: 100,
        dimRadius: 200,
        color: '#ffffff',
        intensity: 1
      }
    },
    {
      type: 'UPSERT_SCENE_DARKNESS',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 8,
      zone: {
        id: crypto.randomUUID(),
        mechanicalIllumination: 'MAGICAL_DARKNESS',
        mechanicalObscurement: 'HEAVY',
        opacity: 1,
        polygon: {
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 20 },
            { x: 0, y: 20 }
          ]
        }
      }
    },
    {
      type: 'UPSERT_SCENE_MEASUREMENT',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 9,
      measurement: {
        id: crypto.randomUUID(),
        createdByUserId: base.owner.userId,
        label: 'Distance',
        path: [
          { x: 0, y: 0 },
          { x: 50, y: 0 }
        ]
      }
    }
  ]
  for (const input of commands) {
    if (input.type === 'UPSERT_SCENE_TOKEN' || input.type === 'UPSERT_SCENE_BARRIER')
      await base.owner.caller.action(executeGeometry, { input })
    else if (
      input.type === 'UPSERT_SCENE_ANNOTATION' ||
      input.type === 'UPSERT_SCENE_LIGHT' ||
      input.type === 'UPSERT_SCENE_DARKNESS' ||
      input.type === 'UPSERT_SCENE_MEASUREMENT'
    )
      await base.owner.caller.mutation(execute, { input })
    else throw new Error('Unexpected fixture command.')
  }
  const initialRecipientHeader = await base.other.caller.query(recipientHeader, { sceneId })
  const initialOwnerHeader = await base.owner.caller.query(recipientHeader, { sceneId })
  expect(initialRecipientHeader.snapshot?.annotations).toEqual([])
  expect(initialRecipientHeader.snapshot?.barriers).toEqual([])
  expect(initialRecipientHeader.snapshot?.darknessZones).toEqual([])
  expect(initialRecipientHeader.snapshot?.lights).toEqual([])
  expect(initialRecipientHeader.snapshot?.tokens).toEqual([])
  expect(initialRecipientHeader.snapshot?.measurements).toHaveLength(1)
  expect(initialRecipientHeader.snapshot?.doorStates).toEqual({})
  expect(initialOwnerHeader.snapshot?.annotations.map(({ text }) => text)).toEqual([
    'GM only',
    'Shared note'
  ])
  expect(initialOwnerHeader.snapshot?.tokens.map(({ label }) => label)).toEqual([
    'Shared token',
    'Foreign fog token',
    'Own fog token',
    'Hidden token'
  ])
  expect(initialOwnerHeader.snapshot?.barriers).toHaveLength(1)
  expect(initialOwnerHeader.snapshot?.doorStates).toEqual({ [doorId]: 'CLOSED' })
  expect(
    await base.owner.caller.query(recipientHeader, { sceneId, includeSnapshot: false })
  ).toEqual({ ...initialOwnerHeader, snapshot: null })
  expect(
    await base.other.caller.query(recipientHeader, { sceneId, includeSnapshot: false })
  ).toEqual({ ...initialRecipientHeader, snapshot: null })
  expect(
    await base.owner.caller.query(recipientHeader, { sceneId, includeSnapshot: true })
  ).toEqual(initialOwnerHeader)
  await expect(base.t.query(recipientHeader, { sceneId, includeSnapshot: false })).rejects.toThrow(
    'Unauthenticated'
  )
  await base.t.run(async (ctx) => {
    const save = await ctx.db
      .query('sceneDefinitionSaves')
      .withIndex('by_publicId', (q) => q.eq('id', definitionSave.saveId))
      .unique()
    if (!save) throw new Error('Missing Scene definition save.')
    const counts = { ...save.counts, annotations: 17 }
    await ctx.db.patch(save._id, { counts, received: counts })
  })
  expect((await base.owner.caller.query(recipientHeader, { sceneId })).snapshot).toBeNull()
  await base.t.run(async (ctx) => {
    const save = await ctx.db
      .query('sceneDefinitionSaves')
      .withIndex('by_publicId', (q) => q.eq('id', definitionSave.saveId))
      .unique()
    if (!save) throw new Error('Missing Scene definition save.')
    const counts = { ...save.counts, annotations: 0 }
    await ctx.db.patch(save._id, { counts, received: counts })
  })
  const emptyView = await base.other.caller.action(
    recipient,
    recipientInput(sceneId, commands.length, 'tokens', initialRecipientHeader.recipientRevision)
  )
  expect(emptyView).toEqual({
    version: commands.length,
    collection: 'tokens',
    page: [],
    next: null,
    recipientRevision: initialRecipientHeader.recipientRevision
  })
  for (const collection of ['barriers', 'lights', 'darknessZones'] as const)
    await expect(
      base.other.caller.action(
        recipient,
        recipientInput(
          sceneId,
          commands.length,
          collection,
          initialRecipientHeader.recipientRevision
        )
      )
    ).resolves.toMatchObject({ page: [], next: null })

  const shared = fogChunk(0, 'AQAAAA==', 0, 0, 32, 1)
  const foreign = fogChunk(0, 'AAABAA==', 0, 0, 32, 1)
  const own = fogChunk(0, 'AAAAEA==', 0, 0, 32, 1)
  const publishLayer = async (
    version: number,
    ownerUserId: string | null,
    chunk: ReturnType<typeof fogChunk>
  ) => {
    const input = patch(sceneId, version, [chunk], ownerUserId, crypto.randomUUID(), 32, 1)
    const save = await upload(base, input, [chunk])
    return base.owner.caller.mutation(publish, { saveId: save.saveId })
  }
  const sharedResult = await publishLayer(commands.length, null, shared)
  const foreignResult = await publishLayer(sharedResult.version, base.owner.userId, foreign)
  let version = foreignResult.version
  for (const ownerUserId of Array.from({ length: 6 }, () => crypto.randomUUID())) {
    const result = await publishLayer(version, ownerUserId, foreign)
    version = result.version
  }
  const final = await publishLayer(version, base.other.userId, own)

  const publicHeader = await base.other.caller.query(recipientHeader, { sceneId })
  const ownerHeader = await base.owner.caller.query(recipientHeader, { sceneId })
  expect(publicHeader.snapshot).toBeNull()
  expect(ownerHeader.snapshot).toBeNull()
  for (const key of ['counts', 'currentCounts', 'fogLayerCount', 'definitionSaveId'])
    expect(publicHeader).not.toHaveProperty(key)
  expect(publicHeader.recipientRevision).toMatch(/^[a-f0-9]{64}$/)
  const ownerFirstLayers = await base.owner.caller.query(layers, {
    sceneId,
    expectedVersion: final.version,
    paginationOpts: { cursor: null, numItems: 8 }
  })
  expect(ownerFirstLayers).not.toMatchObject({ pageStatus: 'SplitRequired' })
  expect(ownerFirstLayers.page).toHaveLength(8)
  expect(ownerFirstLayers.isDone).toBe(false)
  const ownerSecondLayers = await base.owner.caller.query(layers, {
    sceneId,
    expectedVersion: final.version,
    paginationOpts: { cursor: ownerFirstLayers.continueCursor, numItems: 8 }
  })
  expect(ownerSecondLayers).not.toMatchObject({ pageStatus: 'SplitRequired' })
  expect(ownerSecondLayers).toMatchObject({ isDone: true })
  expect(ownerSecondLayers.page).toHaveLength(1)
  const annotations = recipientInput(
    sceneId,
    final.version,
    'annotations',
    publicHeader.recipientRevision
  )
  const tokens = recipientInput(sceneId, final.version, 'tokens', publicHeader.recipientRevision)
  const ownerTokens = recipientInput(
    sceneId,
    final.version,
    'tokens',
    ownerHeader.recipientRevision
  )
  for (const collection of ['barriers', 'lights', 'darknessZones', 'measurements'] as const) {
    const ownerPage = await base.owner.caller.action(
      recipient,
      recipientInput(sceneId, final.version, collection, ownerHeader.recipientRevision)
    )
    const memberPage = await base.other.caller.action(
      recipient,
      recipientInput(sceneId, final.version, collection, publicHeader.recipientRevision)
    )
    expect(ownerPage.recipientRevision).toBe(ownerHeader.recipientRevision)
    expect(memberPage.recipientRevision).toBe(publicHeader.recipientRevision)
    expect(memberPage.page).toEqual(ownerPage.page)
    expect(memberPage.page).toHaveLength(1)
    if (collection === 'barriers') expect(memberPage.page[0]!.doorState).toBe('CLOSED')
  }
  await expect(base.other.caller.action(recipient, annotations)).resolves.toMatchObject({
    page: [{ value: { entity: { id: sharedNote.id } } }]
  })
  await expect(base.other.caller.action(recipient, tokens)).resolves.toMatchObject({
    page: [
      { value: { entity: { id: sharedToken.id } } },
      { value: { entity: { id: ownToken.id } } }
    ]
  })
  await expect(
    base.owner.caller.action(
      recipient,
      recipientInput(sceneId, final.version, 'annotations', ownerHeader.recipientRevision)
    )
  ).resolves.toMatchObject({
    page: [{ value: { entity: { id: gmOnly.id } } }, { value: { entity: { id: sharedNote.id } } }]
  })
  const gmTokens = await base.owner.caller.action(recipient, ownerTokens)
  expect(gmTokens.page.map(({ value }) => value.entity.id)).toEqual([
    sharedToken.id,
    foreignToken.id,
    ownToken.id,
    hiddenToken.id
  ])
  const firstPage = await base.other.caller.action(recipient, { ...tokens, numItems: 1 })
  expect(firstPage.next).toBe(sharedToken.id)
  expect(firstPage.page.map(({ value }) => value.entity.id)).toEqual([sharedToken.id])
  await base.t.run(async (rawCtx) => {
    const ctx = withSceneVisionTracking(rawCtx)
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!membership) throw new Error('Missing player membership.')
    await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
    await ctx.db.patch(membership._id, { status: 'ACTIVE', leftAt: null })
  })
  await expect(
    base.other.caller.action(recipient, { ...tokens, numItems: 1, afterEntityId: firstPage.next })
  ).rejects.toThrow('authority changed before hydration began')
  const refreshedHeader = await base.other.caller.query(recipientHeader, { sceneId })
  expect(refreshedHeader.version).toBe(final.version)
  expect(refreshedHeader.recipientRevision).not.toBe(publicHeader.recipientRevision)
  const secondPage = await base.other.caller.action(recipient, {
    ...tokens,
    numItems: 1,
    afterEntityId: firstPage.next,
    expectedRecipientRevision: refreshedHeader.recipientRevision
  })
  expect(secondPage.recipientRevision).toBe(refreshedHeader.recipientRevision)
  expect(secondPage.next).toBeNull()
  expect(secondPage.page.map(({ value }) => value.entity.id)).toEqual([ownToken.id])
  expect(firstPage.page[0]).not.toHaveProperty('ordinal')
  await expect(
    base.other.caller.action(recipient, {
      ...tokens,
      afterEntityId: hiddenToken.id,
      expectedRecipientRevision: refreshedHeader.recipientRevision
    })
  ).rejects.toThrow('continuation is unavailable')
  await expect(
    base.other.caller.action(recipient, {
      ...tokens,
      expectedRecipientRevision: refreshedHeader.recipientRevision,
      expectedVersion: final.version - 1
    })
  ).rejects.toThrow('snapshot changed')
  await expect(base.t.query(recipientHeader, { sceneId })).rejects.toThrow()
  await expect(
    base.t.withIdentity({ subject: crypto.randomUUID() }).query(recipientHeader, { sceneId })
  ).rejects.toThrow()
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
  await expect(base.other.caller.query(recipientHeader, { sceneId })).rejects.toThrow()
  await expect(
    base.other.caller.action(recipient, {
      ...tokens,
      expectedRecipientRevision: refreshedHeader.recipientRevision
    })
  ).rejects.toThrow()
})

it('rejects 257 chunks at the schema boundary and a 102nd layer without publishing side effects', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  const tooManyChunks = Array.from({ length: 257 }, (_, index) => fogChunk(index))
  await expect(
    base.owner.caller.mutation(begin, { input: patch(sceneId, 0, tooManyChunks) })
  ).rejects.toThrow()
  await base.t.run(async (ctx) => {
    for (let ordinal = 0; ordinal < 101; ordinal++) {
      const content = {
        sceneId,
        ownerUserId: crypto.randomUUID(),
        width: 8,
        height: 8,
        ordinal,
        version: 1,
        chunks: []
      }
      await ctx.db.insert(
        'sceneFogLayers',
        sceneStoredFogLayerSchema.parse({ ...content, checksum: checksumCanonicalJson(content) })
      )
    }
    await ctx.db.insert(
      'sceneLiveStates',
      sceneStoredLiveStateSchema.parse({
        sceneId,
        version: 1,
        fogLayerCount: 101,
        nextFogOrdinal: 101,
        settings: {
          ambientIllumination: { value: base.input.settings.ambientIllumination, version: 0 },
          visionRevealMode: { value: base.input.settings.visionRevealMode, version: 0 }
        },
        counts: { ...base.input.counts, measurements: 0 },
        nextOrdinals: { ...base.input.counts, measurements: 0 }
      })
    )
  })
  const input = patch(sceneId, 1, [fogChunk(0)])
  const save = await upload(base, input, [fogChunk(0)])
  const before = await stored(base)
  await expect(base.owner.caller.mutation(publish, { saveId: save.saveId })).rejects.toThrow(
    'too many'
  )
  expect(await stored(base)).toEqual(before)
})

it('rejects stale same-layer publication but rebases unrelated Scene edits and command ID collisions', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  const old = patch(sceneId, 0, [fogChunk(0)])
  const oldSave = await upload(base, old, [fogChunk(0)])
  const newer = patch(sceneId, 0, [fogChunk(1)])
  const newerSave = await upload(base, newer, [fogChunk(1)])
  await base.owner.caller.mutation(publish, { saveId: newerSave.saveId })
  await expect(base.owner.caller.mutation(publish, { saveId: oldSave.saveId })).rejects.toThrow(
    'changed'
  )
  const unrelated = patch(sceneId, 1, [fogChunk(2)])
  const unrelatedSave = await upload(base, unrelated, [fogChunk(2)])
  await base.owner.caller.mutation(execute, {
    input: {
      type: 'SET_SCENE_AMBIENT_ILLUMINATION',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 1,
      illumination: 'DIM'
    }
  })
  const beforeRollback = await stored(base)
  await expect(
    base.owner.caller.run(async (ctx) => {
      await ctx.runMutation(publish, { saveId: unrelatedSave.saveId })
      throw new Error('Injected fog publish rollback')
    })
  ).rejects.toThrow('Injected fog publish rollback')
  expect(await stored(base)).toEqual(beforeRollback)
  await expect(
    base.owner.caller.mutation(publish, { saveId: unrelatedSave.saveId })
  ).resolves.toMatchObject({ version: 3 })
  const collisionId = crypto.randomUUID()
  await base.owner.caller.mutation(execute, {
    input: {
      type: 'SET_SCENE_AMBIENT_ILLUMINATION',
      sceneId,
      commandId: collisionId,
      expectedSceneVersion: 3,
      illumination: 'DIM'
    }
  })
  await expect(
    base.owner.caller.mutation(begin, {
      input: patch(sceneId, 4, [fogChunk(3)], null, collisionId)
    })
  ).rejects.toThrow('already used')
})

it('streams a 256-chunk layer above one MiB through bounded documents and reconstructs it exactly', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  const data = Buffer.alloc(32_768).toString('base64')
  const values = Array.from({ length: 256 }, (_, index) => fogChunk(index, data, 0, 0, 512, 512))
  const input = patch(sceneId, 0, values, null, crypto.randomUUID(), 512, 512)
  expect(getConvexSize(input)).toBeLessThan(1024 * 1024)
  expect(
    getConvexSize({ ownerUserId: null, width: 512, height: 512, chunks: values })
  ).toBeGreaterThan(1024 * 1024)
  const save = await base.owner.caller.mutation(begin, { input })
  for (let offset = 0; offset < values.length; offset += 8) {
    const batch = values.slice(offset, offset + 8)
    expect(getConvexSize({ input: { saveId: save.saveId, offset, chunks: batch } })).toBeLessThan(
      1024 * 1024
    )
    await base.owner.caller.mutation(append, {
      input: { saveId: save.saveId, offset, chunks: batch }
    })
  }
  const result = await base.owner.caller.mutation(publish, { saveId: save.saveId })
  const recovered: ReturnType<typeof fogChunk>[] = []
  const historical: ReturnType<typeof fogChunk>[] = []
  for (let offset = 0; offset < values.length; offset += 8) {
    const page = await base.owner.caller.query(chunks, {
      sceneId,
      ownerUserId: null,
      expectedVersion: result.version,
      offset,
      numItems: 8
    })
    expect(getConvexSize({ ...page, page: page.page.map((chunk) => ({ ...chunk })) })).toBeLessThan(
      1024 * 1024
    )
    recovered.push(...page.page)
    const history = await base.owner.caller.query(commandChunks, {
      sceneId,
      commandId: input.commandId,
      offset,
      numItems: 8
    })
    expect(
      getConvexSize({ ...history, page: history.page.map((chunk) => ({ ...chunk })) })
    ).toBeLessThan(1024 * 1024)
    historical.push(...history.page)
  }
  expect(recovered).toEqual(values)
  expect(historical).toEqual(values)
  const noted = await base.owner.caller.mutation(execute, {
    input: {
      type: 'UPSERT_SCENE_ANNOTATION',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: result.version,
      annotation: {
        id: crypto.randomUUID(),
        visibility: 'TABLE',
        text: 'Behind full-size fog',
        position: { x: 10, y: 10 }
      }
    }
  })
  const currentRecipientHeader = await base.other.caller.query(recipientHeader, { sceneId })
  await expect(
    base.other.caller.action(
      recipient,
      recipientInput(
        sceneId,
        noted.version,
        'annotations',
        currentRecipientHeader.recipientRevision
      )
    )
  ).resolves.toMatchObject({ page: [], next: null })
  for (const row of (await stored(base)).chunks)
    expect(getConvexSize({ ...row, chunk: { ...row.chunk } })).toBeLessThan(1024 * 1024)
  const extraChunk = fogChunk(256)
  const overflow = await upload(
    base,
    patch(sceneId, noted.version, [extraChunk], null, crypto.randomUUID(), 512, 512),
    [extraChunk]
  )
  const beforeOverflow = await stored(base)
  await expect(base.owner.caller.mutation(publish, { saveId: overflow.saveId })).rejects.toThrow(
    'too many chunks'
  )
  expect(await stored(base)).toEqual(beforeOverflow)
}, 60_000)
