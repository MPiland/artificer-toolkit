import { makeFunctionReference } from 'convex/server'
import { getConvexSize } from 'convex/values'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  BeginSceneDefinitionInput,
  AppendSceneDefinitionInput,
  SceneDefinitionSaveProgress,
  SceneDefinitionHeader,
  SceneDefinitionEntityPageInput,
  SceneDefinitionEntityPage,
  SceneDefinitionListInput,
  SceneDefinitionListPage
} from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import type {
  SceneLiveStateHeader,
  SceneLiveStateEntityPageInput
} from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  sceneDefinitionDtoSchema,
  type SceneDefinitionDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { vttMapStoredAssetSchema } from '@artificer-toolkit/schema/projections/vttMapPersistence'
import { createSceneDefinitionFixture } from '../../tests/fixtures/sceneDefinitions'
import { internal } from '../_generated/api'

const begin = makeFunctionReference<
  'mutation',
  BeginSceneDefinitionInput,
  SceneDefinitionSaveProgress
>('scenes/definitions:begin')
const append = makeFunctionReference<
  'mutation',
  { input: AppendSceneDefinitionInput },
  SceneDefinitionSaveProgress
>('scenes/definitions:append')
const publish = makeFunctionReference<'mutation', { saveId: string }, SceneDefinitionSaveProgress>(
  'scenes/definitions:publish'
)
const cleanup = makeFunctionReference<'mutation', { saveId: string }, null>(
  'scenes/definitions:cleanup'
)
const remove = makeFunctionReference<
  'mutation',
  { campaignId: string; sceneId: string; expectedVersion: number },
  null
>('scenes/definitions:remove')
const get = makeFunctionReference<
  'query',
  { campaignId: string; sceneId: string },
  SceneDefinitionHeader
>('scenes/definitionReads:get')
const list = makeFunctionReference<'query', SceneDefinitionListInput, SceneDefinitionListPage>(
  'scenes/definitionReads:list'
)
const entities = makeFunctionReference<
  'query',
  SceneDefinitionEntityPageInput,
  SceneDefinitionEntityPage
>('scenes/definitionReads:entities')
const liveHeader = makeFunctionReference<'query', { sceneId: string }, SceneLiveStateHeader>(
  'scenes/liveReads:header'
)
const liveEntities = makeFunctionReference<
  'query',
  SceneLiveStateEntityPageInput,
  SceneDefinitionEntityPage
>('scenes/liveReads:entities')

afterEach(() => {
  vi.useRealTimers()
})

const annotation = (text = 'Private note') => ({
  id: crypto.randomUUID(),
  position: { x: 10, y: 20 },
  text,
  visibility: 'GM_ONLY' as const
})
const darknessZone = (id = crypto.randomUUID()) => ({
  id,
  mechanicalIllumination: 'MAGICAL_DARKNESS' as const,
  mechanicalObscurement: 'HEAVY' as const,
  opacity: 1,
  polygon: {
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ]
  }
})
const readInput = (
  base: Awaited<ReturnType<typeof createSceneDefinitionFixture>>,
  save: SceneDefinitionSaveProgress
) => ({
  campaignId: base.campaign.id,
  sceneId: save.sceneId
})

it('rejects missing, foreign, unready and forged maps before creating a save', async () => {
  const base = await createSceneDefinitionFixture()
  for (const map of [
    { ...base.input.settings.map, assetId: crypto.randomUUID() },
    { ...base.input.settings.map, width: 999 },
    { ...base.input.settings.map, tileManifestAssetId: crypto.randomUUID() }
  ])
    await expect(
      base.owner.caller.mutation(begin, {
        ...base.input,
        settings: { ...base.input.settings, map }
      })
    ).rejects.toThrow('map')
  const asset = await base.t.run((ctx) =>
    ctx.db
      .query('mediaAssets')
      .withIndex('by_publicId', (q) => q.eq('id', base.input.settings.map.assetId))
      .unique()
  )
  // Another user's map the Campaign does not already use is not attachable.
  await base.t.run((ctx) => ctx.db.patch(asset!._id, { ownerUserId: base.other.userId }))
  await expect(base.owner.caller.mutation(begin, base.input)).rejects.toThrow('map')
  await base.t.run((ctx) =>
    ctx.db.patch(asset!._id, {
      ownerUserId: base.owner.userId,
      status: 'REJECTED'
    })
  )
  await expect(base.owner.caller.mutation(begin, base.input)).rejects.toThrow('map')
  expect(await base.t.run((ctx) => ctx.db.query('sceneDefinitionSaves').collect())).toEqual([])
})

it('rechecks the map at publication and canonicalizes its reference for cleanup protection', async () => {
  const base = await createSceneDefinitionFixture()
  const save = await base.owner.caller.mutation(begin, {
    ...base.input,
    settings: {
      ...base.input.settings,
      map: {
        ...base.input.settings.map,
        assetId: base.input.settings.map.assetId.toUpperCase()
      }
    }
  })
  const asset = await base.t.run((ctx) =>
    ctx.db
      .query('mediaAssets')
      .withIndex('by_publicId', (q) => q.eq('id', base.input.settings.map.assetId))
      .unique()
  )
  await base.t.run((ctx) => ctx.db.patch(asset!._id, { status: 'DELETED' }))
  await expect(base.owner.caller.mutation(publish, { saveId: save.saveId })).rejects.toThrow('map')
  expect(await base.t.run((ctx) => ctx.db.query('sceneDefinitions').collect())).toEqual([])
  expect(await base.t.run((ctx) => ctx.db.query('campaignScenes').collect())).toEqual([])
  expect(await base.t.run((ctx) => ctx.db.query('sceneDefinitionSaves').collect())).toMatchObject([
    { status: 'RECEIVING' }
  ])
  await base.t.run((ctx) => ctx.db.patch(asset!._id, { status: 'READY' }))
  await base.owner.caller.mutation(publish, { saveId: save.saveId })
  const references = await base.t.run(async (ctx) => ({
    definition: await ctx.db
      .query('sceneDefinitions')
      .withIndex('by_mapAssetId', (q) => q.eq('map.assetId', asset!.id))
      .unique(),
    liveScene: await ctx.db
      .query('campaignScenes')
      .withIndex('by_mapAssetId', (q) => q.eq('map.assetId', asset!.id))
      .unique()
  }))
  expect(references.definition?.map.assetId).toBe(asset!.id)
  expect(references.liveScene?.map.assetId).toBe(asset!.id)
  expect(
    await base.t.run(async (ctx) =>
      ctx.db
        .query('mediaAssets')
        .withIndex('by_publicId', (q) => q.eq('id', asset!.id))
        .unique()
    )
  ).toMatchObject({ hasSceneReferences: true })
})

it('starts a fresh recovery grace when an old map loses its last definition reference', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  const base = await createSceneDefinitionFixture()
  const initial = await base.owner.caller.mutation(begin, base.input)
  await base.owner.caller.mutation(publish, { saveId: initial.saveId })
  const replacementId = crypto.randomUUID()
  const replacementRow = await base.t.run(async (ctx) => {
    const asset = await ctx.db
      .query('mediaAssets')
      .withIndex('by_publicId', (q) => q.eq('id', base.input.settings.map.assetId))
      .unique()
    const { _id, _creationTime, ...value } = asset!
    return ctx.db.insert(
      'mediaAssets',
      vttMapStoredAssetSchema.parse({
        ...value,
        id: replacementId,
        cleanupAt: Date.now() - 86_400_000,
        variants: value.variants.map((variant) => ({
          ...variant,
          objectKey: `ready/${replacementId}/${variant.kind}`
        }))
      })
    )
  })
  const updated = await base.owner.caller.mutation(begin, {
    ...base.input,
    commandId: crypto.randomUUID(),
    sceneId: initial.sceneId,
    expectedVersion: 1,
    settings: {
      ...base.input.settings,
      map: { ...base.input.settings.map, assetId: replacementId }
    }
  })
  await base.owner.caller.mutation(publish, { saveId: updated.saveId })
  expect(
    await base.t.run(async (ctx) =>
      ctx.db
        .query('mediaAssets')
        .withIndex('by_publicId', (q) => q.eq('id', base.input.settings.map.assetId))
        .unique()
    )
  ).toMatchObject({ hasSceneReferences: true })
  await base.t.mutation(internal.media.assets.cleanup, {
    assetId: replacementId
  })
  expect(await base.t.run((ctx) => ctx.db.get(replacementRow))).toMatchObject({
    status: 'READY'
  })
  // Past the last commit, so the next mutation's clock is the one this test reads.
  vi.setSystemTime(Date.now() + 1_000)
  await base.owner.caller.mutation(remove, {
    ...readInput(base, initial),
    expectedVersion: 2
  })
  expect(await base.t.run((ctx) => ctx.db.get(replacementRow))).toMatchObject({
    status: 'READY',
    cleanupAt: Date.now() + 86_400_000
  })
  await base.t.mutation(internal.media.assets.cleanup, {
    assetId: replacementId
  })
  expect(await base.t.run((ctx) => ctx.db.get(replacementRow))).toMatchObject({
    status: 'READY'
  })
})

it('hides incomplete saves, rejects missing pieces, then atomically publishes one definition and initial live Scene', async () => {
  const base = await createSceneDefinitionFixture()
  const input = {
    ...base.input,
    counts: { ...base.input.counts, annotations: 1 }
  }
  const save = await base.owner.caller.mutation(begin, input)
  const note = { ...annotation(), id: 'ABCDEF01-ABCD-4ABC-8ABC-ABCDEF012345' }
  const lookup = readInput(base, save)
  const before = await base.owner.caller.query(list, {
    campaignId: base.campaign.id,
    paginationOpts: { cursor: null, numItems: 8 }
  })
  expect(before.page).toEqual([])
  await expect(base.owner.caller.query(get, lookup)).rejects.toThrow()
  await expect(base.owner.caller.mutation(publish, { saveId: save.saveId })).rejects.toThrow()
  expect(await base.t.run((ctx) => ctx.db.query('campaignScenes').collect())).toEqual([])
  await base.owner.caller.mutation(append, {
    input: {
      saveId: save.saveId,
      collection: 'annotations',
      offset: 0,
      entities: [note]
    }
  })
  await base.owner.caller.mutation(append, {
    input: {
      saveId: save.saveId,
      collection: 'annotations',
      offset: 0,
      entities: [note]
    }
  })
  await expect(base.owner.caller.query(get, lookup)).rejects.toThrow()
  const complete = await base.owner.caller.mutation(publish, {
    saveId: save.saveId
  })
  expect(complete).toMatchObject({
    status: 'PUBLISHED',
    sceneId: save.sceneId,
    version: 1,
    received: input.counts
  })
  const header = await base.owner.caller.query(get, lookup)
  const page = await base.owner.caller.query(entities, {
    ...lookup,
    saveId: save.saveId,
    collection: 'annotations',
    paginationOpts: { cursor: null, numItems: 8 }
  })
  expect(page.page[0]?.value.entity.id).toBe(note.id)
  expect(header).toMatchObject({
    ...input.settings,
    id: save.sceneId,
    saveId: save.saveId,
    version: 1
  })
  const live = await base.t.run((ctx) => ctx.db.query('campaignScenes').collect())
  expect(live).toHaveLength(1)
  expect(live[0]).toMatchObject({
    id: save.liveSceneId,
    definitionId: save.sceneId,
    definitionSaveId: save.saveId,
    definitionVersion: 1,
    version: 0
  })
})

it('replays begin, earlier batches and publication exactly; rejects changed or overlapping retries', async () => {
  const base = await createSceneDefinitionFixture()
  const input = {
    ...base.input,
    counts: { ...base.input.counts, annotations: 2 }
  }
  const save = await base.owner.caller.mutation(begin, input)
  expect(await base.owner.caller.mutation(begin, input)).toEqual(save)
  await expect(
    base.owner.caller.mutation(begin, {
      ...input,
      settings: { ...input.settings, name: 'Changed' }
    })
  ).rejects.toThrow()
  const first: AppendSceneDefinitionInput = {
    saveId: save.saveId,
    collection: 'annotations',
    offset: 0,
    entities: [annotation()]
  }
  await base.owner.caller.mutation(append, { input: first })
  await expect(
    base.owner.caller.mutation(append, {
      input: { ...first, entities: [first.entities[0]!, annotation()] }
    })
  ).rejects.toThrow()
  await base.owner.caller.mutation(append, {
    input: { ...first, offset: 1, entities: [annotation()] }
  })
  const done = await base.owner.caller.mutation(publish, {
    saveId: save.saveId
  })
  expect(await base.owner.caller.mutation(append, { input: first })).toEqual(done)
  expect(await base.owner.caller.mutation(publish, { saveId: save.saveId })).toEqual(done)
  expect(await base.owner.caller.mutation(begin, input)).toEqual(done)
  await expect(
    base.owner.caller.mutation(append, {
      input: {
        ...first,
        entities: [{ ...first.entities[0]!, text: 'Altered' }]
      }
    })
  ).rejects.toThrow()
  expect(await base.t.run((ctx) => ctx.db.query('sceneDefinitionEntities').collect())).toHaveLength(
    2
  )
  expect(await base.t.run((ctx) => ctx.db.query('campaignScenes').collect())).toHaveLength(1)
})

it('rejects duplicates across batches, invalid geometry, skipped offsets and count overflow without partial writes', async () => {
  const base = await createSceneDefinitionFixture()
  const save = await base.owner.caller.mutation(begin, {
    ...base.input,
    counts: { ...base.input.counts, annotations: 2, barriers: 1 }
  })
  const note = annotation()
  const input: AppendSceneDefinitionInput = {
    saveId: save.saveId,
    collection: 'annotations',
    offset: 0,
    entities: [note, note]
  }
  await expect(base.owner.caller.mutation(append, { input })).rejects.toThrow()
  expect(await base.t.run((ctx) => ctx.db.query('sceneDefinitionEntities').collect())).toEqual([])
  await base.owner.caller.mutation(append, {
    input: { ...input, entities: [note] }
  })
  await expect(
    base.owner.caller.mutation(append, {
      input: { ...input, offset: 1, entities: [note] }
    })
  ).rejects.toThrow()
  await expect(
    base.owner.caller.mutation(append, {
      input: { ...input, offset: 2, entities: [annotation()] }
    })
  ).rejects.toThrow()
  await expect(
    base.owner.caller.mutation(append, {
      input: { ...input, offset: 1, entities: [annotation(), annotation()] }
    })
  ).rejects.toThrow()
  await expect(
    base.owner.caller.mutation(append, {
      input: {
        saveId: save.saveId,
        collection: 'barriers',
        offset: 0,
        entities: [
          {
            id: crypto.randomUUID(),
            kind: 'WALL',
            a: { x: 0, y: 0 },
            b: { x: 0, y: 0 },
            blocksLight: true,
            blocksMovement: true
          }
        ]
      }
    })
  ).rejects.toThrow()
  expect(await base.t.run((ctx) => ctx.db.query('sceneDefinitionEntities').collect())).toHaveLength(
    1
  )
})

it('rejects player/anonymous/foreign reads and writes, and rechecks Campaign status between save stages', async () => {
  const base = await createSceneDefinitionFixture()
  await expect(base.other.caller.mutation(begin, base.input)).rejects.toThrow()
  await expect(base.t.mutation(begin, base.input)).rejects.toThrow()
  const save = await base.owner.caller.mutation(begin, base.input)
  await expect(base.other.caller.mutation(publish, { saveId: save.saveId })).rejects.toThrow()
  await base.owner.caller.mutation(publish, { saveId: save.saveId })
  await expect(base.other.caller.query(get, readInput(base, save))).rejects.toThrow()
  await expect(
    base.other.caller.query(list, {
      campaignId: base.campaign.id,
      paginationOpts: { cursor: null, numItems: 8 }
    })
  ).rejects.toThrow()
  await expect(
    base.owner.caller.query(get, {
      ...readInput(base, save),
      campaignId: crypto.randomUUID()
    })
  ).rejects.toThrow()
  const next = await base.owner.caller.mutation(begin, {
    ...base.input,
    commandId: crypto.randomUUID(),
    sceneId: save.sceneId,
    expectedVersion: 1
  })
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    await ctx.db.patch(row!._id, { status: 'ARCHIVED' })
  })
  await expect(base.owner.caller.mutation(publish, { saveId: next.saveId })).rejects.toThrow()
  expect((await base.owner.caller.query(get, readInput(base, save))).version).toBe(1)
})

it('publishes only one competing update and never changes the original live Scene snapshot', async () => {
  const base = await createSceneDefinitionFixture()
  const initial = await base.owner.caller.mutation(begin, base.input)
  await base.owner.caller.mutation(publish, { saveId: initial.saveId })
  const updateInput = {
    ...base.input,
    sceneId: initial.sceneId,
    expectedVersion: 1
  }
  const left = await base.owner.caller.mutation(begin, {
    ...updateInput,
    commandId: crypto.randomUUID(),
    settings: { ...base.input.settings, name: 'Left' }
  })
  const right = await base.owner.caller.mutation(begin, {
    ...updateInput,
    commandId: crypto.randomUUID(),
    settings: { ...base.input.settings, name: 'Right' }
  })
  const result = await Promise.allSettled(
    [left, right].map((save) => base.owner.caller.mutation(publish, { saveId: save.saveId }))
  )
  expect(result.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
  expect(result.filter((item) => item.status === 'rejected')).toHaveLength(1)
  expect((await base.owner.caller.query(get, readInput(base, initial))).version).toBe(2)
  expect(await base.t.run((ctx) => ctx.db.query('campaignScenes').collect())).toMatchObject([
    {
      name: 'Courtyard',
      definitionVersion: 1,
      definitionSaveId: initial.saveId
    }
  ])
  expect((await base.owner.caller.mutation(begin, base.input)).saveId).toBe(initial.saveId)
})

it('pins page reads to the current definition and preserves referenced snapshots during bounded cleanup', async () => {
  const base = await createSceneDefinitionFixture()
  const initial = await base.owner.caller.mutation(begin, {
    ...base.input,
    counts: { ...base.input.counts, annotations: 1 }
  })
  await base.owner.caller.mutation(append, {
    input: {
      saveId: initial.saveId,
      collection: 'annotations',
      offset: 0,
      entities: [annotation('Original')]
    }
  })
  await base.owner.caller.mutation(publish, { saveId: initial.saveId })
  const update = await base.owner.caller.mutation(begin, {
    ...base.input,
    commandId: crypto.randomUUID(),
    sceneId: initial.sceneId,
    expectedVersion: 1,
    counts: { ...base.input.counts, annotations: 1 }
  })
  await base.owner.caller.mutation(append, {
    input: {
      saveId: update.saveId,
      collection: 'annotations',
      offset: 0,
      entities: [annotation('Updated')]
    }
  })
  await base.owner.caller.mutation(publish, { saveId: update.saveId })
  await expect(
    base.owner.caller.query(entities, {
      ...readInput(base, initial),
      saveId: initial.saveId,
      collection: 'annotations',
      paginationOpts: { cursor: null, numItems: 8 }
    })
  ).rejects.toThrow()
  await base.t.mutation(cleanup, { saveId: initial.saveId })
  await base.t.mutation(cleanup, { saveId: update.saveId })
  expect(await base.t.run((ctx) => ctx.db.query('sceneDefinitionEntities').collect())).toHaveLength(
    2
  )
  await base.owner.caller.mutation(remove, {
    ...readInput(base, initial),
    expectedVersion: 2
  })
  await base.t.mutation(cleanup, { saveId: update.saveId })
  await base.t.mutation(cleanup, { saveId: initial.saveId })
  const rows = await base.t.run((ctx) => ctx.db.query('sceneDefinitionEntities').collect())
  expect(rows).toHaveLength(1)
  expect(rows[0]?.saveId).toBe(initial.saveId)
  expect(await base.t.run((ctx) => ctx.db.query('campaignScenes').collect())).toHaveLength(1)
  await expect(base.owner.caller.query(get, readInput(base, initial))).rejects.toThrow()
})

it('expires abandoned saves, cleans at most 32 rows per call, and cannot resurrect them by replay', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  const base = await createSceneDefinitionFixture()
  const input = {
    ...base.input,
    counts: { ...base.input.counts, annotations: 40 }
  }
  const save = await base.owner.caller.mutation(begin, input)
  for (let offset = 0; offset < 40; offset += 8)
    await base.owner.caller.mutation(append, {
      input: {
        saveId: save.saveId,
        collection: 'annotations',
        offset,
        entities: Array.from({ length: 8 }, () => annotation())
      }
    })
  await base.t.mutation(cleanup, { saveId: save.saveId })
  expect(await base.t.run((ctx) => ctx.db.query('sceneDefinitionEntities').collect())).toHaveLength(
    40
  )
  vi.setSystemTime(Date.now() + 24 * 60 * 60_000 + 1)
  await base.t.mutation(cleanup, { saveId: save.saveId })
  expect(await base.t.run((ctx) => ctx.db.query('sceneDefinitionEntities').collect())).toHaveLength(
    8
  )
  await base.t.mutation(cleanup, { saveId: save.saveId })
  expect(await base.t.run((ctx) => ctx.db.query('sceneDefinitionEntities').collect())).toHaveLength(
    0
  )
  // Inspect the expired save, then restore the fixture clock so replay rejection
  // exercises the save tombstone rather than expired authentication.
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('sceneDefinitionSaves')
      .withIndex('by_publicId', (q) => q.eq('id', save.saveId))
      .unique()
    expect(row).toMatchObject({ status: 'EXPIRED', entitiesRemoved: true })
  })
  vi.setSystemTime(Date.parse(base.campaign.createdAt))
  await expect(base.owner.caller.mutation(begin, input)).rejects.toThrow()
  await expect(base.owner.caller.mutation(publish, { saveId: save.saveId })).rejects.toThrow()
})

it('round-trips a valid definition larger than one Convex document through bounded entity pages', async () => {
  const base = await createSceneDefinitionFixture()
  const notes = Array.from({ length: 512 }, () => annotation('a'.repeat(2000)))
  const darknessZones = Array.from({ length: 9 }, (_, zoneIndex) => ({
    ...darknessZone(),
    polygon: {
      points: Array.from({ length: 2048 }, (_, pointIndex) => ({
        x: 100 + 50 * Math.cos((pointIndex * Math.PI * 2) / 2048),
        y: 100 + zoneIndex + 50 * Math.sin((pointIndex * Math.PI * 2) / 2048)
      }))
    }
  }))
  expect(getConvexSize(jsonValueSchema.parse(darknessZones[0]))).toBeLessThan(1024 * 1024)
  const save = await base.owner.caller.mutation(begin, {
    ...base.input,
    counts: {
      ...base.input.counts,
      annotations: notes.length,
      darknessZones: darknessZones.length
    }
  })
  for (let offset = 0; offset < notes.length; offset += 8) {
    const input: AppendSceneDefinitionInput = {
      saveId: save.saveId,
      collection: 'annotations',
      offset,
      entities: notes.slice(offset, offset + 8)
    }
    expect(getConvexSize(jsonValueSchema.parse({ input }))).toBeLessThan(1024 * 1024)
    const result = await base.owner.caller.mutation(append, { input })
    expect(getConvexSize(jsonValueSchema.parse(result))).toBeLessThan(1024 * 1024)
  }
  for (let offset = 0; offset < darknessZones.length; offset += 8) {
    const input: AppendSceneDefinitionInput = {
      saveId: save.saveId,
      collection: 'darknessZones',
      offset,
      entities: darknessZones.slice(offset, offset + 8)
    }
    expect(getConvexSize(jsonValueSchema.parse({ input }))).toBeLessThan(1024 * 1024)
    const result = await base.owner.caller.mutation(append, { input })
    expect(getConvexSize(jsonValueSchema.parse(result))).toBeLessThan(1024 * 1024)
  }
  await base.owner.caller.mutation(publish, { saveId: save.saveId })
  if (!save.liveSceneId) throw new Error('Missing live Scene')
  const live = await base.owner.caller.query(liveHeader, { sceneId: save.liveSceneId })
  expect(live).toMatchObject({
    id: save.liveSceneId,
    definitionId: save.sceneId,
    definitionVersion: 1,
    definitionSaveId: save.saveId,
    version: 0,
    counts: { annotations: notes.length, darknessZones: darknessZones.length }
  })
  const liveRecovered: SceneDefinitionDto['annotations'] = []
  let liveCursor: string | null = null
  let livePages = 0
  let liveFinished = false
  do {
    const page: SceneDefinitionEntityPage = await base.owner.caller.query(liveEntities, {
      sceneId: live.id,
      definitionSaveId: live.definitionSaveId,
      expectedVersion: live.version,
      collection: 'annotations',
      paginationOpts: { cursor: liveCursor, numItems: 8 }
    })
    expect(getConvexSize(jsonValueSchema.parse(page))).toBeLessThan(1024 * 1024)
    livePages++
    expect(livePages).toBeLessThanOrEqual(notes.length + 1)
    expect(page.page.length).toBeLessThanOrEqual(8)
    for (const row of page.page) {
      expect(row.ordinal).toBe(liveRecovered.length)
      if (row.value.collection !== 'annotations') throw new Error('Wrong collection')
      liveRecovered.push(row.value.entity)
    }
    liveCursor = page.continueCursor
    liveFinished = page.isDone
  } while (!liveFinished)
  expect(liveRecovered).toEqual(notes)
  const liveDarknessRecovered: SceneDefinitionDto['darknessZones'] = []
  let liveDarknessCursor: string | null = null
  let liveDarknessFinished = false
  while (!liveDarknessFinished) {
    const page: SceneDefinitionEntityPage = await base.owner.caller.query(liveEntities, {
      sceneId: live.id,
      definitionSaveId: live.definitionSaveId,
      expectedVersion: live.version,
      collection: 'darknessZones',
      paginationOpts: { cursor: liveDarknessCursor, numItems: 8 }
    })
    expect(getConvexSize(jsonValueSchema.parse(page))).toBeLessThan(1024 * 1024)
    expect(page.page.length).toBeLessThanOrEqual(8)
    for (const row of page.page) {
      expect(row.ordinal).toBe(liveDarknessRecovered.length)
      if (row.value.collection !== 'darknessZones') throw new Error('Wrong collection')
      liveDarknessRecovered.push(row.value.entity)
    }
    liveDarknessCursor = page.continueCursor
    liveDarknessFinished = page.isDone
    expect(page.page.length > 0 || liveDarknessFinished).toBe(true)
  }
  expect(liveDarknessRecovered).toEqual(darknessZones)
  const recovered: SceneDefinitionDto['annotations'] = []
  let cursor: string | null = null
  let finished = false
  while (!finished) {
    const page: SceneDefinitionEntityPage = await base.owner.caller.query(entities, {
      ...readInput(base, save),
      saveId: save.saveId,
      collection: 'annotations',
      paginationOpts: { cursor, numItems: 8 }
    })
    expect(getConvexSize(jsonValueSchema.parse(page))).toBeLessThan(1024 * 1024)
    expect(page.page.length).toBeLessThanOrEqual(8)
    for (const row of page.page) {
      expect(row.ordinal).toBe(recovered.length)
      if (row.value.collection !== 'annotations') throw new Error('Wrong collection')
      recovered.push(row.value.entity)
    }
    cursor = page.continueCursor
    finished = page.isDone
  }
  expect(recovered).toEqual(notes)
  const darknessRecovered: SceneDefinitionDto['darknessZones'] = []
  let darknessCursor: string | null = null
  let darknessFinished = false
  while (!darknessFinished) {
    const page: SceneDefinitionEntityPage = await base.owner.caller.query(entities, {
      ...readInput(base, save),
      saveId: save.saveId,
      collection: 'darknessZones',
      paginationOpts: { cursor: darknessCursor, numItems: 8 }
    })
    expect(getConvexSize(jsonValueSchema.parse(page))).toBeLessThan(1024 * 1024)
    expect(page.page.length).toBeLessThanOrEqual(8)
    for (const row of page.page) {
      expect(row.ordinal).toBe(darknessRecovered.length)
      if (row.value.collection !== 'darknessZones') throw new Error('Wrong collection')
      darknessRecovered.push(row.value.entity)
    }
    darknessCursor = page.continueCursor
    darknessFinished = page.isDone
    expect(page.page.length > 0 || darknessFinished).toBe(true)
  }
  expect(darknessRecovered).toEqual(darknessZones)
  const definition = sceneDefinitionDtoSchema.parse({
    ...base.input.settings,
    id: save.sceneId,
    version: 1,
    annotations: recovered,
    barriers: [],
    darknessZones: darknessRecovered,
    lights: [],
    tokens: []
  })
  expect(getConvexSize(jsonValueSchema.parse(definition))).toBeGreaterThan(1024 * 1024)
}, 60_000)

it('hydrates the immutable live Scene snapshot and enforces owner/save/version/checksum gates', async () => {
  const base = await createSceneDefinitionFixture()
  const original = annotation('Original GM annotation')
  const save = await base.owner.caller.mutation(begin, {
    ...base.input,
    counts: { ...base.input.counts, annotations: 1 }
  })
  await base.owner.caller.mutation(append, {
    input: { saveId: save.saveId, collection: 'annotations', offset: 0, entities: [original] }
  })
  await base.owner.caller.mutation(publish, { saveId: save.saveId })
  if (!save.liveSceneId) throw new Error('Missing live Scene')
  const header = await base.owner.caller.query(liveHeader, { sceneId: save.liveSceneId })
  expect(header).toMatchObject({
    definitionSaveId: save.saveId,
    version: 0,
    counts: { annotations: 1 }
  })
  const pageInput = {
    sceneId: save.liveSceneId,
    definitionSaveId: save.saveId,
    expectedVersion: 0,
    collection: 'annotations' as const,
    paginationOpts: { cursor: null, numItems: 8 }
  }
  await expect(base.owner.caller.query(liveEntities, pageInput)).resolves.toMatchObject({
    page: [{ ordinal: 0, value: { entity: original } }]
  })
  await expect(base.t.query(liveHeader, { sceneId: save.liveSceneId })).rejects.toThrow(
    'Unauthenticated'
  )
  await expect(base.t.query(liveEntities, pageInput)).rejects.toThrow('Unauthenticated')
  await expect(base.other.caller.query(liveHeader, { sceneId: save.liveSceneId })).rejects.toThrow(
    'owner'
  )
  await expect(base.other.caller.query(liveEntities, pageInput)).rejects.toThrow('owner')
  await expect(
    base.owner.caller.query(liveEntities, { ...pageInput, expectedVersion: 1 })
  ).rejects.toThrow()
  await expect(
    base.owner.caller.query(liveEntities, { ...pageInput, definitionSaveId: crypto.randomUUID() })
  ).rejects.toThrow()

  const update = await base.owner.caller.mutation(begin, {
    ...base.input,
    sceneId: save.sceneId,
    expectedVersion: 1,
    commandId: crypto.randomUUID(),
    counts: { ...base.input.counts, annotations: 1 }
  })
  const updated = annotation('Updated GM annotation')
  await base.owner.caller.mutation(append, {
    input: { saveId: update.saveId, collection: 'annotations', offset: 0, entities: [updated] }
  })
  await base.owner.caller.mutation(publish, { saveId: update.saveId })
  await base.owner.caller.mutation(remove, {
    campaignId: base.campaign.id,
    sceneId: save.sceneId,
    expectedVersion: 2
  })
  await base.t.mutation(cleanup, { saveId: save.saveId })
  await expect(
    base.owner.caller.query(liveHeader, { sceneId: save.liveSceneId })
  ).resolves.toMatchObject({
    definitionSaveId: save.saveId,
    version: 0
  })
  await expect(base.owner.caller.query(liveEntities, pageInput)).resolves.toMatchObject({
    page: [{ ordinal: 0, value: { entity: original } }]
  })
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('sceneDefinitionEntities')
      .withIndex('by_saveId_collection_ordinal', (q) =>
        q.eq('saveId', save.saveId).eq('value.collection', 'annotations').eq('ordinal', 0)
      )
      .unique()
    if (!row) throw new Error('Missing live entity')
    await ctx.db.patch(row._id, { checksum: '0'.repeat(64) })
  })
  await expect(base.owner.caller.query(liveEntities, pageInput)).rejects.toThrow()
})

it('rechecks current Campaign authority on every live Scene page across ownership transfer', async () => {
  const base = await createSceneDefinitionFixture()
  const save = await base.owner.caller.mutation(begin, base.input)
  await base.owner.caller.mutation(publish, { saveId: save.saveId })
  if (!save.liveSceneId) throw new Error('Missing live Scene')
  const headerInput = { sceneId: save.liveSceneId }
  const pageInput: SceneLiveStateEntityPageInput = {
    ...headerInput,
    definitionSaveId: save.saveId,
    expectedVersion: 0,
    collection: 'annotations',
    paginationOpts: { cursor: null, numItems: 8 }
  }
  const originalHeader = await base.owner.caller.query(liveHeader, headerInput)
  await base.t.run(async (ctx) => {
    const memberships = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', base.campaign.id))
      .collect()
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    if (!campaign) throw new Error('Missing Campaign')
    for (const membership of memberships)
      await ctx.db.patch(membership._id, {
        role: membership.userId === base.other.userId ? 'OWNER' : 'PLAYER'
      })
    await ctx.db.patch(campaign._id, { ownerUserId: base.other.userId })
  })
  await expect(base.other.caller.query(liveHeader, headerInput)).resolves.toEqual(originalHeader)
  await expect(base.other.caller.query(liveEntities, pageInput)).resolves.toMatchObject({
    page: [],
    isDone: true
  })
  await expect(base.owner.caller.query(liveHeader, headerInput)).rejects.toThrow('owner')
  await expect(base.owner.caller.query(liveEntities, pageInput)).rejects.toThrow('owner')
  await base.t.run(async (ctx) => {
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!membership) throw new Error('Missing membership')
    await ctx.db.delete(membership._id)
  })
  await expect(base.other.caller.query(liveHeader, headerInput)).rejects.toThrow(
    'Campaign not found'
  )
  await expect(base.other.caller.query(liveEntities, pageInput)).rejects.toThrow(
    'Campaign not found'
  )
})

it('rejects live Scene source identity and materialization receipt corruption', async () => {
  const base = await createSceneDefinitionFixture()
  const save = await base.owner.caller.mutation(begin, base.input)
  await base.owner.caller.mutation(publish, { saveId: save.saveId })
  if (!save.liveSceneId) throw new Error('Missing live Scene')
  const headerInput = { sceneId: save.liveSceneId }
  const pageInput: SceneLiveStateEntityPageInput = {
    ...headerInput,
    definitionSaveId: save.saveId,
    expectedVersion: 0,
    collection: 'annotations',
    paginationOpts: { cursor: null, numItems: 8 }
  }
  for (const patch of [{ liveSceneId: crypto.randomUUID() }, { commandId: crypto.randomUUID() }]) {
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('sceneDefinitionSaves')
        .withIndex('by_publicId', (q) => q.eq('id', save.saveId))
        .unique()
      if (!row) throw new Error('Missing source save')
      await ctx.db.patch(row._id, {
        liveSceneId: save.liveSceneId,
        commandId: base.input.commandId,
        ...patch
      })
    })
    await expect(base.owner.caller.query(liveHeader, headerInput)).rejects.toThrow('inconsistent')
    await expect(base.owner.caller.query(liveEntities, pageInput)).rejects.toThrow('inconsistent')
  }
})

it('rejects a Scene definition token that carries Character-derived senses, and persists and replays the batch without them', async () => {
  const base = await createSceneDefinitionFixture()
  const token = {
    id: crypto.randomUUID(),
    assetId: null,
    controlledByUserIds: [],
    height: 1,
    hidden: false,
    label: 'Sensing token',
    locked: false,
    position: { x: 100, y: 100 },
    rotationDegrees: 0,
    senses: [
      {
        channel: 'VISUAL' as const,
        illuminationAccess: 'ORDINARY_DARKNESS' as const,
        label: 'Darkvision',
        range: { rangeKind: 'DISTANCE' as const, amount: 60 },
        senseId: crypto.randomUUID()
      }
    ],
    vision: null,
    width: 1
  }
  const save = await base.owner.caller.mutation(begin, {
    ...base.input,
    counts: { ...base.input.counts, tokens: 1 }
  })
  const batch: AppendSceneDefinitionInput = {
    saveId: save.saveId,
    collection: 'tokens',
    offset: 0,
    entities: [token]
  }
  await expect(base.owner.caller.mutation(append, { input: batch })).rejects.toThrow(
    'Stored Scene tokens never carry senses.'
  )
  const stored = await base.t.run((ctx) => ctx.db.query('sceneDefinitionEntities').collect())
  expect(stored).toEqual([])
  const sightless = { ...batch, entities: [{ ...token, senses: [] }] }
  await base.owner.caller.mutation(append, { input: sightless })
  await expect(base.owner.caller.mutation(append, { input: sightless })).resolves.toMatchObject({
    received: { tokens: 1 }
  })
  await base.owner.caller.mutation(publish, { saveId: save.saveId })
  const persisted = await base.t.run((ctx) => ctx.db.query('sceneDefinitionEntities').collect())
  expect(persisted.map((row) => row.value)).toEqual([
    { collection: 'tokens', entity: { ...token, senses: [] } }
  ])
})
