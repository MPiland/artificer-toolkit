import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  AppendSceneDefinitionInput,
  BeginSceneDefinitionInput,
  SceneDefinitionSaveProgress
} from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import type {
  SceneGeometryPage,
  SceneGeometryPageInput
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { SceneToken, SceneBarrier } from '@artificer-toolkit/shared/vtt/scene'
import {
  sceneStoredLiveEntitySchema,
  sceneStoredLiveStateSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { createSceneDefinitionFixture } from '../../tests/fixtures/sceneDefinitions'
import { entities as registeredEntities } from './geometryReads'

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
const geometryEntities = makeFunctionReference<'query', SceneGeometryPageInput, SceneGeometryPage>(
  'scenes/geometryReads:entities'
)

const token = (id: string = crypto.randomUUID()): SceneToken => ({
  assetId: null,
  controlledByUserIds: [],
  height: 1,
  hidden: false,
  id,
  label: 'Token',
  locked: false,
  position: { x: 10, y: 20 },
  rotationDegrees: 0,
  vision: null,
  width: 1
})

const door = (id: string = crypto.randomUUID()) => ({
  a: { x: 0, y: 0 },
  b: { x: 10, y: 0 },
  blocksLightWhenClosed: true,
  blocksMovementWhenClosed: true,
  id,
  initialState: 'CLOSED' as const,
  kind: 'DOOR' as const,
  openAngleDegrees: 90
})

type PublishedGeometry = Awaited<ReturnType<typeof publishedTokens>>
type StoredLiveEntity = ReturnType<typeof sceneStoredLiveEntitySchema.parse>
type StoredLiveHead = ReturnType<typeof sceneStoredLiveStateSchema.parse>

function input(
  published: PublishedGeometry,
  collection: 'tokens' | 'barriers',
  phase: 'BASE' | 'APPENDED',
  expectedVersion = 0,
  afterOrdinal: number | null = null,
  numItems = 8
): SceneGeometryPageInput {
  return {
    sceneId: published.sceneId,
    definitionSaveId: published.save.saveId,
    expectedVersion,
    collection,
    phase,
    afterOrdinal,
    numItems
  }
}

function storedEntity(value: Omit<StoredLiveEntity, 'checksum'>): StoredLiveEntity {
  return sceneStoredLiveEntitySchema.parse({ ...value, checksum: checksumCanonicalJson(value) })
}

async function seedCurrent(
  base: Awaited<ReturnType<typeof createSceneDefinitionFixture>>,
  published: PublishedGeometry,
  collection: 'tokens' | 'barriers',
  currentCount: number,
  nextOrdinal: number,
  rows: Array<StoredLiveEntity>
) {
  await base.t.run(async (ctx) => {
    const counts: StoredLiveHead['counts'] = {
      ...published.counts,
      measurements: 0,
      [collection]: currentCount
    }
    const nextOrdinals: StoredLiveHead['nextOrdinals'] = {
      ...published.counts,
      measurements: 0,
      [collection]: nextOrdinal
    }
    const head: StoredLiveHead = {
      sceneId: published.sceneId,
      version: 1,
      fogLayerCount: 0,
      nextFogOrdinal: 0,
      settings: {
        ambientIllumination: { value: base.input.settings.ambientIllumination, version: 0 },
        visionRevealMode: { value: base.input.settings.visionRevealMode, version: 0 }
      },
      counts,
      nextOrdinals
    }
    await ctx.db.insert('sceneLiveStates', sceneStoredLiveStateSchema.parse(head))
    for (const row of rows) await ctx.db.insert('sceneLiveEntities', row)
  })
}

async function publishedTokens(
  base: Awaited<ReturnType<typeof createSceneDefinitionFixture>>,
  entities: Array<ReturnType<typeof token>>
): Promise<{
  save: SceneDefinitionSaveProgress
  sceneId: string
  counts: BeginSceneDefinitionInput['counts']
}> {
  const counts = { ...base.input.counts, tokens: entities.length }
  const save = await base.owner.caller.mutation(begin, { ...base.input, counts })
  for (let offset = 0; offset < entities.length; offset += 8)
    await base.owner.caller.mutation(append, {
      input: {
        saveId: save.saveId,
        offset,
        collection: 'tokens',
        entities: entities.slice(offset, offset + 8)
      }
    })
  await base.owner.caller.mutation(publish, { saveId: save.saveId })
  if (!save.liveSceneId) throw new Error('Missing live Scene')
  return { save, sceneId: save.liveSceneId, counts }
}

async function publishedBarriers(
  base: Awaited<ReturnType<typeof createSceneDefinitionFixture>>,
  entities: SceneBarrier[]
) {
  const counts = { ...base.input.counts, barriers: entities.length }
  const save = await base.owner.caller.mutation(begin, { ...base.input, counts })
  for (let offset = 0; offset < entities.length; offset += 8)
    await base.owner.caller.mutation(append, {
      input: {
        saveId: save.saveId,
        offset,
        collection: 'barriers',
        entities: entities.slice(offset, offset + 8)
      }
    })
  await base.owner.caller.mutation(publish, { saveId: save.saveId })
  if (!save.liveSceneId) throw new Error('Missing live Scene')
  return { save, sceneId: save.liveSceneId, counts }
}

it('exports object-form query arguments for Convex deployment packaging', () => {
  const registered: unknown = registeredEntities
  if (
    typeof registered !== 'function' ||
    !('exportArgs' in registered) ||
    typeof registered.exportArgs !== 'function'
  )
    throw new Error('Registered query does not expose Convex exportArgs.')
  expect(JSON.parse(registered.exportArgs())).toHaveProperty('type', 'object')
})

it('returns immutable base geometry and preserves a door initial state', async () => {
  const base = await createSceneDefinitionFixture()
  const value = door()
  const published = await publishedBarriers(base, [value])
  await expect(
    base.owner.caller.query(geometryEntities, {
      sceneId: published.sceneId,
      definitionSaveId: published.save.saveId,
      expectedVersion: 0,
      collection: 'barriers',
      phase: 'BASE',
      afterOrdinal: null,
      numItems: 8
    })
  ).resolves.toMatchObject({
    page: [{ ordinal: 0, value: { entity: value }, doorState: 'CLOSED' }],
    next: { phase: 'APPENDED', afterOrdinal: null }
  })
})

it('normalizes uppercase immutable token identifiers after validating their stored checksum', async () => {
  const base = await createSceneDefinitionFixture()
  const value = {
    ...token('A0000000-0000-4000-8000-000000000001'),
    assetId: 'A0000000-0000-4000-8000-000000000002',
    controlledByUserIds: [
      'A0000000-0000-4000-8000-000000000003',
      'a0000000-0000-4000-8000-000000000003'
    ]
  }
  const published = await publishedTokens(base, [value])
  await expect(
    base.owner.caller.query(geometryEntities, {
      sceneId: published.sceneId,
      definitionSaveId: published.save.saveId,
      expectedVersion: 0,
      collection: 'tokens',
      phase: 'BASE',
      afterOrdinal: null,
      numItems: 8
    })
  ).resolves.toMatchObject({
    page: [
      {
        value: {
          entity: {
            id: value.id.toLowerCase(),
            assetId: value.assetId.toLowerCase(),
            controlledByUserIds: [value.controlledByUserIds[0]!.toLowerCase()]
          }
        }
      }
    ]
  })
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('sceneDefinitionEntities')
      .withIndex('by_saveId_collection_ordinal', (q) =>
        q.eq('saveId', published.save.saveId).eq('value.collection', 'tokens')
      )
      .unique()
    if (!row || row.value.collection !== 'tokens') throw new Error('Missing immutable token.')
    expect(row.entityId).toBe(value.id)
    expect(row.checksum).toBe(checksumCanonicalJson(row.value))
    expect(row.value.entity.controlledByUserIds).toEqual(value.controlledByUserIds)
  })
})

it('omits a re-added base entity from BASE and emits it in APPENDED', async () => {
  const base = await createSceneDefinitionFixture()
  const original = token()
  const published = await publishedTokens(base, [original])
  const replacement = token(original.id.toLowerCase())
  await seedCurrent(base, published, 'tokens', 1, 2, [
    storedEntity({
      sceneId: published.sceneId,
      collection: 'tokens',
      entityId: replacement.id.toLowerCase(),
      value: { collection: 'tokens', entity: replacement },
      ordinal: 1,
      version: 1
    })
  ])
  const baseInput = input(published, 'tokens', 'BASE', 1)
  await expect(base.owner.caller.query(geometryEntities, baseInput)).resolves.toMatchObject({
    page: []
  })
  await expect(
    base.owner.caller.query(geometryEntities, input(published, 'tokens', 'APPENDED', 1))
  ).resolves.toMatchObject({
    page: [{ ordinal: 1, value: { entity: replacement } }]
  })
})

it('pages more than eight base rows and transitions an empty BASE to APPENDED', async () => {
  const base = await createSceneDefinitionFixture()
  const values = Array.from({ length: 9 }, () => token())
  const published = await publishedTokens(base, values)
  const first = await base.owner.caller.query(geometryEntities, input(published, 'tokens', 'BASE'))
  expect(first.page).toHaveLength(8)
  expect(first.next).toMatchObject({ phase: 'BASE' })
  if (!first.next) throw new Error('Missing BASE continuation')
  await expect(
    base.owner.caller.query(
      geometryEntities,
      input(published, 'tokens', 'BASE', 0, first.next.afterOrdinal)
    )
  ).resolves.toMatchObject({
    page: [{ ordinal: 8 }],
    next: { phase: 'APPENDED', afterOrdinal: null }
  })

  const emptyBase = await createSceneDefinitionFixture()
  const empty = await publishedTokens(emptyBase, [])
  await expect(
    emptyBase.owner.caller.query(geometryEntities, input(empty, 'tokens', 'BASE'))
  ).resolves.toEqual({
    version: 0,
    collection: 'tokens',
    page: [],
    next: { phase: 'APPENDED', afterOrdinal: null }
  })
})

it('skips historical tombstones while paging appended geometry', async () => {
  const base = await createSceneDefinitionFixture()
  const published = await publishedTokens(base, [])
  const added = Array.from({ length: 9 }, () => token())
  const tombstones = Array.from({ length: 12 }, () =>
    storedEntity({
      sceneId: published.sceneId,
      collection: 'tokens',
      entityId: crypto.randomUUID(),
      value: null,
      ordinal: null,
      version: 1
    })
  )
  await seedCurrent(base, published, 'tokens', 9, 21, [
    ...tombstones,
    ...added.map((entity, index) =>
      storedEntity({
        sceneId: published.sceneId,
        collection: 'tokens',
        entityId: entity.id,
        value: { collection: 'tokens', entity },
        ordinal: index + 12,
        version: 1
      })
    )
  ])
  const first = await base.owner.caller.query(
    geometryEntities,
    input(published, 'tokens', 'APPENDED', 1)
  )
  expect(first.page).toHaveLength(8)
  expect(first.next).toEqual({ phase: 'APPENDED', afterOrdinal: 19 })
  await expect(
    base.owner.caller.query(geometryEntities, input(published, 'tokens', 'APPENDED', 1, 19))
  ).resolves.toMatchObject({ page: [{ ordinal: 20, value: { entity: added[8] } }], next: null })
})

it('uses current base overrides, hides tombstones, and exposes explicit door state', async () => {
  const base = await createSceneDefinitionFixture()
  const original = token()
  const published = await publishedTokens(base, [original])
  const changed = { ...token(original.id), label: 'Moved' }
  await seedCurrent(base, published, 'tokens', 1, 1, [
    storedEntity({
      sceneId: published.sceneId,
      collection: 'tokens',
      entityId: changed.id,
      value: { collection: 'tokens', entity: changed },
      ordinal: 0,
      version: 1
    })
  ])
  await expect(
    base.owner.caller.query(geometryEntities, input(published, 'tokens', 'BASE', 1))
  ).resolves.toMatchObject({ page: [{ value: { entity: changed } }] })

  const doorBase = await createSceneDefinitionFixture()
  const initial = door()
  const doorPublished = await publishedBarriers(doorBase, [initial])
  await seedCurrent(doorBase, doorPublished, 'barriers', 1, 1, [
    storedEntity({
      sceneId: doorPublished.sceneId,
      collection: 'barriers',
      entityId: initial.id,
      value: { collection: 'barriers', entity: initial },
      ordinal: 0,
      version: 1,
      doorState: 'OPEN'
    })
  ])
  await expect(
    doorBase.owner.caller.query(geometryEntities, input(doorPublished, 'barriers', 'BASE', 1))
  ).resolves.toMatchObject({ page: [{ doorState: 'OPEN' }] })

  const tombstoneBase = await createSceneDefinitionFixture()
  const removed = token()
  const tombstonePublished = await publishedTokens(tombstoneBase, [removed])
  await seedCurrent(tombstoneBase, tombstonePublished, 'tokens', 0, 1, [
    storedEntity({
      sceneId: tombstonePublished.sceneId,
      collection: 'tokens',
      entityId: removed.id,
      value: null,
      ordinal: null,
      version: 1
    })
  ])
  await expect(
    tombstoneBase.owner.caller.query(
      geometryEntities,
      input(tombstonePublished, 'tokens', 'BASE', 1)
    )
  ).resolves.toMatchObject({ page: [] })
})

it('keeps a nonterminal empty BASE page when a keyset row was re-added', async () => {
  const base = await createSceneDefinitionFixture()
  const first = token()
  const second = token()
  const published = await publishedTokens(base, [first, second])
  const readded = token(first.id)
  await seedCurrent(base, published, 'tokens', 2, 3, [
    storedEntity({
      sceneId: published.sceneId,
      collection: 'tokens',
      entityId: readded.id,
      value: { collection: 'tokens', entity: readded },
      ordinal: 2,
      version: 1
    })
  ])
  await expect(
    base.owner.caller.query(geometryEntities, input(published, 'tokens', 'BASE', 1, null, 1))
  ).resolves.toEqual({
    version: 1,
    collection: 'tokens',
    page: [],
    next: { phase: 'BASE', afterOrdinal: 0 }
  })
  await expect(
    base.owner.caller.query(geometryEntities, input(published, 'tokens', 'BASE', 1, 0, 1))
  ).resolves.toMatchObject({ page: [{ ordinal: 1, value: { entity: second } }] })
})

it('rejects malformed current geometry rows', async () => {
  for (const kind of ['checksum', 'futureVersion', 'noncanonicalKey', 'invalidOrdinal'] as const) {
    const base = await createSceneDefinitionFixture()
    const original = token('a0000000-0000-4000-8000-000000000001')
    const published = await publishedTokens(base, [])
    await seedCurrent(base, published, 'tokens', 1, 1, [
      storedEntity({
        sceneId: published.sceneId,
        collection: 'tokens',
        entityId: original.id,
        value: { collection: 'tokens', entity: original },
        ordinal: 0,
        version: 1
      })
    ])
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('sceneLiveEntities')
        .withIndex('by_sceneId_collection_entityId', (q) =>
          q.eq('sceneId', published.sceneId).eq('collection', 'tokens').eq('entityId', original.id)
        )
        .unique()
      if (!row) throw new Error('Missing current token.')
      if (kind === 'checksum') await ctx.db.patch(row._id, { checksum: '0'.repeat(64) })
      if (kind !== 'checksum') {
        const { _id, _creationTime, checksum: _checksum, ...stored } = row
        const corrupted =
          kind === 'futureVersion'
            ? { ...stored, version: 2 }
            : kind === 'noncanonicalKey'
              ? {
                  ...stored,
                  entityId: original.id.toUpperCase(),
                  value: {
                    collection: 'tokens' as const,
                    entity: { ...original, id: original.id.toUpperCase() }
                  }
                }
              : { ...stored, ordinal: 1 }
        await ctx.db.replace(_id, { ...corrupted, checksum: checksumCanonicalJson(corrupted) })
      }
    })
    await expect(
      base.owner.caller.query(geometryEntities, input(published, 'tokens', 'APPENDED', 1))
    ).rejects.toThrow('inconsistent')
  }
})

it('rejects ordinal collisions in lookahead before continuation could skip an entity', async () => {
  for (const phase of ['BASE', 'APPENDED'] as const) {
    const base = await createSceneDefinitionFixture()
    const values = [token(), token()]
    const published = await publishedTokens(base, phase === 'BASE' ? values : [])
    if (phase === 'BASE') {
      await base.t.run(async (ctx) => {
        const rows = await ctx.db
          .query('sceneDefinitionEntities')
          .withIndex('by_saveId_collection_ordinal', (q) =>
            q.eq('saveId', published.save.saveId).eq('value.collection', 'tokens')
          )
          .take(2)
        if (rows.length !== 2) throw new Error('Missing source rows.')
        await ctx.db.patch(rows[1]!._id, { ordinal: 0 })
      })
    } else {
      await seedCurrent(
        base,
        published,
        'tokens',
        2,
        2,
        values.map((entity) =>
          storedEntity({
            sceneId: published.sceneId,
            collection: 'tokens',
            entityId: entity.id,
            value: { collection: 'tokens', entity },
            ordinal: 0,
            version: 1
          })
        )
      )
    }
    await expect(
      base.owner.caller.query(
        geometryEntities,
        input(published, 'tokens', phase, phase === 'BASE' ? 0 : 1, null, 1)
      )
    ).rejects.toThrow('ordinals are inconsistent')
  }
})

it('rejects missing and invalid current door state', async () => {
  const missingBase = await createSceneDefinitionFixture()
  const missingDoor = door()
  const missingPublished = await publishedBarriers(missingBase, [missingDoor])
  await seedCurrent(missingBase, missingPublished, 'barriers', 1, 1, [
    storedEntity({
      sceneId: missingPublished.sceneId,
      collection: 'barriers',
      entityId: missingDoor.id,
      value: { collection: 'barriers', entity: missingDoor },
      ordinal: 0,
      version: 1
    })
  ])
  await expect(
    missingBase.owner.caller.query(geometryEntities, input(missingPublished, 'barriers', 'BASE', 1))
  ).rejects.toThrow()

  const extraBase = await createSceneDefinitionFixture()
  const value = token()
  const extraPublished = await publishedTokens(extraBase, [value])
  await seedCurrent(extraBase, extraPublished, 'tokens', 1, 1, [
    storedEntity({
      sceneId: extraPublished.sceneId,
      collection: 'tokens',
      entityId: value.id,
      value: { collection: 'tokens', entity: value },
      ordinal: 0,
      version: 1,
      doorState: 'OPEN'
    })
  ])
  await expect(
    extraBase.owner.caller.query(geometryEntities, input(extraPublished, 'tokens', 'BASE', 1))
  ).rejects.toThrow()
})

it('requires current membership and the exact version/save fence', async () => {
  const base = await createSceneDefinitionFixture()
  const published = await publishedTokens(base, [token()])
  await expect(
    base.other.caller.query(geometryEntities, input(published, 'tokens', 'BASE'))
  ).resolves.toMatchObject({ page: [{ ordinal: 0 }] })
  await base.t.run(async (ctx) => {
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!membership) throw new Error('Missing Campaign membership.')
    await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
  })
  await expect(
    base.other.caller.query(geometryEntities, input(published, 'tokens', 'BASE'))
  ).rejects.toThrow()
  await expect(
    base.owner.caller.query(geometryEntities, input(published, 'tokens', 'BASE', 1))
  ).rejects.toThrow('snapshot changed')
  await expect(
    base.owner.caller.query(geometryEntities, {
      ...input(published, 'tokens', 'BASE'),
      definitionSaveId: crypto.randomUUID()
    })
  ).rejects.toThrow('snapshot changed')
  await base.t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    if (!campaign) throw new Error('Missing Campaign.')
    await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
  })
  await expect(
    base.owner.caller.query(geometryEntities, input(published, 'tokens', 'BASE'))
  ).resolves.toMatchObject({ page: [{ ordinal: 0 }] })
})
