import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  SceneFogChunksPage,
  SceneFogChunksPageInput,
  SceneFogLayersPage,
  SceneFogLayersPageInput
} from '@artificer-toolkit/schema/api/sceneFog'
import type {
  SceneRecipientHeader,
  SceneRecipientHeaderInput
} from '@artificer-toolkit/schema/api/sceneRecipient'
import { seedFogLayer } from '../../tests/fixtures/liveSceneFog'
import { liveSceneHead } from '../../tests/fixtures/liveSceneToken'
import {
  createSceneDefinitionFixture,
  presentFixtureScene,
  publishEmptyScene
} from '../../tests/fixtures/sceneDefinitions'

const header = makeFunctionReference<'query', SceneRecipientHeaderInput, SceneRecipientHeader>(
  'scenes/recipientReads:header'
)
const layers = makeFunctionReference<'query', SceneFogLayersPageInput, SceneFogLayersPage>(
  'scenes/fogReads:layers'
)
const chunks = makeFunctionReference<'query', SceneFogChunksPageInput, SceneFogChunksPage>(
  'scenes/fogReads:chunks'
)

it('D87 a player reads a Scene and its fog only once it is the presented Scene; the GM always reads', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  await base.t.run((ctx) =>
    ctx.db.insert('sceneLiveStates', liveSceneHead(sceneId, { version: 2, fogLayers: 1 }))
  )
  const shared = await seedFogLayer(base, {
    sceneId,
    actorUserId: base.owner.userId,
    ownerUserId: null
  })
  const headerInput = { sceneId, includeSnapshot: false }
  const layerInput = {
    sceneId,
    expectedVersion: 2,
    paginationOpts: { cursor: null, numItems: 8 }
  }
  const chunkInput = { sceneId, ownerUserId: null, expectedVersion: 2, offset: 0, numItems: 8 }
  const unavailable = 'Live Scene is unavailable.'

  const readAs = (caller: typeof base.owner.caller) =>
    Promise.all([
      caller.query(header, headerInput),
      caller.query(layers, layerInput),
      caller.query(chunks, chunkInput)
    ])

  // Not presented: the GM reads everything, a player reads nothing.
  await expect(readAs(base.owner.caller)).resolves.toHaveLength(3)
  for (const read of [
    () => base.other.caller.query(header, headerInput),
    () => base.other.caller.query(layers, layerInput),
    () => base.other.caller.query(chunks, chunkInput)
  ])
    await expect(read()).rejects.toThrow(unavailable)

  // Presented: both read it.
  await presentFixtureScene(base, sceneId)
  await expect(readAs(base.owner.caller)).resolves.toHaveLength(3)
  const [, , playerChunks] = await readAs(base.other.caller)
  expect(playerChunks.page).toEqual([shared.chunk])

  // Presenting another Scene withdraws this one from players but not from the GM.
  const second = await publishEmptyScene({
    ...base,
    input: { ...base.input, commandId: crypto.randomUUID() }
  })
  await base.t.run(async (ctx) => {
    const presentation = await ctx.db.query('campaignScenePresentations').unique()
    if (!presentation) throw new Error('Missing presentation.')
    await ctx.db.patch(presentation._id, { sceneId: second.sceneId })
  })
  await expect(base.other.caller.query(header, headerInput)).rejects.toThrow(unavailable)
  await expect(base.owner.caller.query(header, headerInput)).resolves.toBeDefined()
}, 30000)
