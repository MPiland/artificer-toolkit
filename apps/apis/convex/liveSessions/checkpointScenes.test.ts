import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  LiveSessionCheckpointRequest,
  LiveSessionCheckpointResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import type { LiveSessionCheckpointRecords } from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import {
  liveSessionCheckpointSceneKeys,
  type LiveSessionCheckpointScene,
  type LiveSessionCheckpointSceneChange,
  type LiveSessionCheckpointSceneTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import type { LiveSessionAuthorityDto } from '@artificer-toolkit/schema/api/liveSessionState'
import type { LiveSessionPresentationCommitInput } from '@artificer-toolkit/schema/api/liveSessions'
import type { SetCampaignLiveScenePresentationResultDto } from '@artificer-toolkit/schema/api/vttScenes'
import {
  canonicalJsonRecordSchema,
  type JsonValue
} from '@artificer-toolkit/schema/shared/jsonDelta'
import { decodeCheckpointRecord } from '@artificer-toolkit/encounter-persistence/checkpointRecords'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { diffJson } from '@artificer-toolkit/encounter-persistence/jsonDelta'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { createRun } from '../../tests/fixtures/encounterScene'
import {
  attachFixtureRoom,
  checkpointRoom,
  executeSceneInRoom,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import {
  createSceneDefinitionFixture,
  publishEmptyScene,
  publishScene
} from '../../tests/fixtures/sceneDefinitions'
import { api } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import { parseFogLayer, parseFogSave, readFogChunk } from '../scenes/fogDocuments'
import { parseLiveEntity, readLiveSceneForUser } from '../scenes/liveDocuments'

useLocalRoomWorker()
afterEach(() => vi.useRealTimers())

const publish = makeFunctionReference<
  'mutation',
  LiveSessionCheckpointRequest,
  LiveSessionCheckpointResponse
>('liveSessions/checkpoint:publish')
const present = makeFunctionReference<
  'mutation',
  LiveSessionPresentationCommitInput,
  SetCampaignLiveScenePresentationResultDto
>('scenes/presentations:setFromRoom')
const createBlueprint = makeFunctionReference<
  'mutation',
  {
    gameSystemId: string
    name: string
    commandId: string
    enemies: { kind: 'CUSTOM'; label: string; maxHitPoints: number }[]
  },
  { id: string }
>('encounters/blueprints:create')

const tables = Object.keys(liveSessionCheckpointSceneKeys) as LiveSessionCheckpointSceneTable[]
function content(row: { _id: unknown; _creationTime: unknown }) {
  const { _id, _creationTime, ...value } = row
  return canonicalJsonRecordSchema.parse(JSON.parse(canonicalizeJson(value)))
}

function change(
  table: LiveSessionCheckpointSceneTable,
  next: Record<string, JsonValue>,
  before: Record<string, JsonValue> | null = null
): LiveSessionCheckpointSceneChange {
  return {
    table,
    key: liveSessionCheckpointSceneKeys[table].map((field) => {
      const value = next[field]
      if (value !== null && typeof value !== 'string' && typeof value !== 'number')
        throw new Error('Missing Scene fixture identity.')
      return value
    }),
    previousChecksum: before ? checksumCanonicalJson(before) : null,
    nextChecksum: checksumCanonicalJson(next),
    delta: diffJson(before, next)
  }
}

function frame(
  authority: Pick<
    LiveSessionAuthorityDto,
    'campaignId' | 'epoch' | 'persistedSequence' | 'persistedStateChecksum'
  >,
  records: LiveSessionCheckpointRecords
): LiveSessionCheckpointRequest {
  return {
    campaignId: authority.campaignId,
    epoch: authority.epoch,
    checkpointId: crypto.randomUUID(),
    fromSequence: authority.persistedSequence,
    fromChecksum: authority.persistedStateChecksum,
    sequence: authority.persistedSequence + 1,
    checksum: 'b'.repeat(64),
    payloadChecksum: checksumCanonicalJson(records),
    knownAuthorization: null,
    reason: 'BACKLOG',
    records
  }
}

async function fixture(withSecondScene = false) {
  const base = await createSceneDefinitionFixture()
  const token = {
    id: crypto.randomUUID(),
    assetId: null,
    controlledByUserIds: [base.other.userId],
    height: 1,
    hidden: false,
    label: 'Checkpoint token',
    locked: false,
    position: { x: 100, y: 100 },
    rotationDegrees: 0,
    senses: [],
    // A short sight line, so the move explores cells and leaves an owner fog layer.
    vision: { angleDegrees: 360, brightRange: 0, dimRange: 5, directionDegrees: 0, enabled: true },
    width: 1
  }
  const scene = await publishScene(base, { tokens: [token] })
  const presentation = await base.owner.caller.mutation(api.scenes.presentations.set, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: base.campaign.id,
    sceneId: scene.sceneId
  })
  await attachFixtureRoom(base.t, base.campaign.id)
  // The real room's own checkpoint is the fixture oracle: its rows are normalized into a publication
  // that these tests then replay through the checkpoint mutation, against the authority it claimed.
  const result = await executeSceneInRoom(base.owner.caller, {
    type: 'MOVE_SCENE_TOKEN',
    commandId: crypto.randomUUID(),
    sceneId: scene.sceneId,
    tokenId: token.id,
    expectedSceneVersion: 0,
    expectedEncounterVersion: null,
    correlationId: null,
    movementKind: 'VOLUNTARY',
    path: [token.position, { x: 900, y: 100 }]
  })
  await checkpointRoom(base.campaign.id)
  vi.useFakeTimers()
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Checkpoint rollback Run',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 1 }]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const { changes, chunk } = await base.t.run(async (ctx) => {
    const changes: LiveSessionCheckpointSceneChange[] = []
    let chunk: Doc<'sceneFogChunks'>['chunk'] | null = null
    for (const table of tables) {
      const rows = await ctx.db.query(table).take(1000)
      // The room writes every chunk of the explored layer; every other family has one row.
      if (table === 'sceneFogChunks') expect(rows.length).toBeGreaterThan(0)
      else expect(rows).toHaveLength(1)
      for (const row of rows) changes.push(change(table, content(row)))
      for (const row of rows) {
        if (table === 'sceneFogChunks') chunk ??= (row as Doc<'sceneFogChunks'>).chunk
        await ctx.db.delete(row._id)
      }
    }
    if (!chunk) throw new Error('Missing fog chunk fixture.')
    return { changes, chunk }
  })
  const secondScene = withSecondScene
    ? await publishEmptyScene({ ...base, input: { ...base.input, commandId: crypto.randomUUID() } })
    : null
  const authority = await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .unique()
    if (!row) throw new Error('Missing live authority.')
    return {
      campaignId: row.campaignId,
      epoch: row.epoch,
      persistedSequence: row.persistedSequence,
      persistedStateChecksum: row.persistedStateChecksum
    }
  })
  const publication: LiveSessionCheckpointScene = {
    sceneId: scene.sceneId,
    definitionSaveId: scene.save.saveId,
    definitionVersion: 1,
    presentationVersion: presentation.version,
    fromVersion: 0,
    toVersion: result.version,
    changes
  }
  return {
    ...base,
    scene,
    secondScene,
    authority,
    publication,
    chunk,
    token: { ...token, position: { x: 900, y: 100 } },
    run
  }
}

type Fixture = Awaited<ReturnType<typeof fixture>>

async function snapshot(base: Fixture) {
  return base.t.run(async (ctx) => ({
    rows: await Promise.all(
      tables.map(async (table) => [table, await ctx.db.query(table).take(1000)])
    ),
    ledgers: await ctx.db.query('receiptLedgers').take(100),
    ledgerParts: await ctx.db.query('receiptLedgerParts').take(100),
    sources: await ctx.db.query('campaignScenes').take(100),
    definitions: await ctx.db.query('sceneDefinitionSaves').take(100),
    definitionEntities: await ctx.db.query('sceneDefinitionEntities').take(100),
    presentations: await ctx.db.query('campaignScenePresentations').take(100),
    runs: await ctx.db.query('encounterRuns').take(100),
    authorities: await ctx.db.query('campaignLiveAuthorities').take(100),
    revisions: await ctx.db.query('sceneVisionRevisions').take(100),
    scheduled: await ctx.db.system.query('_scheduled_functions').take(100)
  }))
}

async function assertRejected(
  base: Fixture,
  scene: LiveSessionCheckpointScene,
  message: string | RegExp
) {
  const before = await snapshot(base)
  await expect(
    base.t.mutation(
      publish,
      frame(base.authority, {
        changes: [],
        history: [],
        scenes: [scene]
      })
    )
  ).rejects.toThrow(message)
  expect(await snapshot(base)).toEqual(before)
}

it('publishes native token and fog rows with the authority acknowledgement, and replays unchanged', async () => {
  const base = await fixture()
  const before = await snapshot(base)
  const input = frame(base.authority, { changes: [], history: [], scenes: [base.publication] })
  const committed = await base.t.mutation(publish, input)
  expect(committed.status).toBe('COMMITTED')
  expect(committed.authority).toMatchObject({
    persistedSequence: input.sequence,
    persistedStateChecksum: input.checksum,
    lastCheckpoint: { checkpointId: input.checkpointId, payloadChecksum: input.payloadChecksum }
  })
  const after = await snapshot(base)
  expect(after.sources).toEqual(before.sources)
  expect(after.definitions).toEqual(before.definitions)
  expect(after.definitionEntities).toEqual(before.definitionEntities)
  expect(after.presentations).toEqual(before.presentations)
  for (const table of tables) {
    const rows = await base.t.run((ctx) => ctx.db.query(table).take(1000))
    expect(rows.map(content)).toEqual(
      base.publication.changes
        .filter((entry) => entry.table === table)
        .map((entry) => {
          if (!entry.delta || !('set' in entry.delta)) throw new Error('Missing fixture insertion.')
          return entry.delta.set
        })
    )
  }
  await base.t.run(async (ctx) => {
    const scene = await readLiveSceneForUser(ctx, base.scene.sceneId, 'OWNER', base.owner.userId)
    expect(scene.header).toMatchObject({
      version: 1,
      currentCounts: { tokens: 1 },
      fogLayerCount: 1
    })
    const entity = await ctx.db.query('sceneLiveEntities').unique()
    const fogLayer = await ctx.db.query('sceneFogLayers').unique()
    const fogSave = await ctx.db.query('sceneFogSaves').unique()
    if (!entity || !fogLayer || !fogSave) throw new Error('Missing publication.')
    expect(parseLiveEntity(entity, 1).value).toEqual({
      collection: 'tokens',
      entity: base.token
    })
    const parsedLayer = parseFogLayer(fogLayer, 1)
    expect(parseFogSave(fogSave).status).toBe('PUBLISHED')
    expect(
      await readFogChunk(ctx, parsedLayer.chunks[0]!, base.scene.sceneId, parsedLayer)
    ).toEqual(base.chunk)
  })
  await expect(
    base.owner.caller.query(api.scenes.fogReads.chunks, {
      sceneId: base.scene.sceneId,
      ownerUserId: base.other.userId,
      expectedVersion: 1,
      offset: 0,
      numItems: 8
    })
  ).resolves.toMatchObject({ page: expect.arrayContaining([base.chunk]), isDone: false })
  await expect(base.t.mutation(publish, input)).resolves.toMatchObject({ status: 'REPLAYED' })
  expect(await snapshot(base)).toEqual(after)
  const changed = { ...input, checksum: 'c'.repeat(64) }
  await expect(base.t.mutation(publish, changed)).rejects.toThrow()
  expect(await snapshot(base)).toEqual(after)
})

it.each(['missing child', 'malformed chunk', 'foreign Scene'] as const)(
  'rolls back the Scene and simultaneous Run update for %s',
  async (failure) => {
    const base = await fixture()
    const scene = structuredClone(base.publication)
    if (failure === 'missing child')
      scene.changes = scene.changes.filter((entry) => entry.table !== 'sceneFogChunks')
    else {
      const target = failure === 'malformed chunk' ? 'sceneFogChunks' : 'sceneFogSaves'
      scene.changes = scene.changes.map((entry) => {
        if (entry.table !== target || !entry.delta || !('set' in entry.delta)) return entry
        const next = canonicalJsonRecordSchema.parse(entry.delta.set)
        if (failure === 'foreign Scene') next.sceneId = crypto.randomUUID()
        else next.checksum = 'f'.repeat(64)
        return change(target, next)
      })
    }
    const run = await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
      if (!row) throw new Error('Missing rollback Run.')
      const { _id, _creationTime, ...stored } = row
      const state = { ...readRunState(row), version: row.version + 1 }
      const before = decodeCheckpointRecord('encounterRuns', stored)
      const next = decodeCheckpointRecord('encounterRuns', {
        ...stored,
        version: state.version,
        stateJson: canonicalizeJson(state),
        stateChecksum: checksumCanonicalJson(state)
      })
      return {
        table: 'encounterRuns' as const,
        key: [row.id],
        previousChecksum: checksumCanonicalJson(before),
        nextChecksum: checksumCanonicalJson(next),
        delta: diffJson(before, next)
      }
    })
    const before = await snapshot(base)
    await expect(
      base.t.mutation(
        publish,
        frame(base.authority, {
          changes: [run],
          history: [],
          scenes: [scene]
        })
      )
    ).rejects.toThrow()
    expect(await snapshot(base)).toEqual(before)
  }
)

it.each(['source', 'Scene version', 'presentation'] as const)(
  'refuses a stale %s pin atomically',
  async (pin) => {
    const base = await fixture()
    const scene = { ...base.publication }
    if (pin === 'source') scene.definitionSaveId = crypto.randomUUID()
    if (pin === 'Scene version') {
      scene.fromVersion = 1
      scene.toVersion = 2
    }
    if (pin === 'presentation') scene.presentationVersion += 1
    await assertRejected(base, scene, /stale/)
  }
)

it('refuses an old A presentation after A → B → A without changing any checkpoint state', async () => {
  const base = await fixture(true)
  if (!base.secondScene) throw new Error('Missing second materialized Scene.')
  let version = base.publication.presentationVersion
  for (const sceneId of [base.secondScene.sceneId, base.scene.sceneId]) {
    const result = await base.t.mutation(present, {
      campaignId: base.campaign.id,
      actorUserId: base.owner.userId,
      epoch: base.authority.epoch,
      expectedSequence: base.authority.persistedSequence,
      expectedStateChecksum: base.authority.persistedStateChecksum,
      input: {
        type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
        campaignId: base.campaign.id,
        commandId: crypto.randomUUID(),
        expectedPresentationVersion: version,
        sceneId
      }
    })
    version = result.version
  }
  expect(version).toBe(base.publication.presentationVersion + 2)
  await assertRejected(base, base.publication, /presentation is stale/)
})

it('merges existing head, token and fog rows only when their canonical previous checksums match', async () => {
  const base = await fixture()
  const first = await base.t.mutation(
    publish,
    frame(base.authority, {
      changes: [],
      history: [],
      scenes: [base.publication]
    })
  )
  base.authority = first.authority
  const changes = await base.t.run(async (ctx) => {
    const head = await ctx.db.query('sceneLiveStates').unique()
    const entity = await ctx.db.query('sceneLiveEntities').unique()
    const fogLayer = await ctx.db.query('sceneFogLayers').unique()
    if (!head || !entity || !fogLayer || !entity.value || entity.value.collection !== 'tokens')
      throw new Error('Missing merge fixture.')
    const { checksum: _entityChecksum, ...entityFields } = content(entity)
    const nextEntity = canonicalJsonRecordSchema.parse({
      ...entityFields,
      version: 2,
      value: { collection: 'tokens', entity: { ...entity.value.entity, hidden: true } }
    })
    const { checksum: _layerChecksum, ...layerFields } = content(fogLayer)
    const nextLayer = { ...layerFields, version: 2 }
    return [
      change('sceneLiveStates', { ...content(head), version: 2 }, content(head)),
      change(
        'sceneLiveEntities',
        { ...nextEntity, checksum: checksumCanonicalJson(nextEntity) },
        content(entity)
      ),
      change(
        'sceneFogLayers',
        { ...nextLayer, checksum: checksumCanonicalJson(nextLayer) },
        content(fogLayer)
      )
    ]
  })
  const scene = { ...base.publication, fromVersion: 1, toVersion: 2, changes }
  await assertRejected(
    base,
    {
      ...scene,
      changes: changes.map((entry, index) =>
        index === 1 ? { ...entry, previousChecksum: 'f'.repeat(64) } : entry
      )
    },
    /record changed before publication/
  )
  await expect(
    base.t.mutation(
      publish,
      frame(base.authority, {
        changes: [],
        history: [],
        scenes: [scene]
      })
    )
  ).resolves.toMatchObject({ status: 'COMMITTED' })
  await base.t.run(async (ctx) => {
    const entity = await ctx.db.query('sceneLiveEntities').unique()
    const fogLayer = await ctx.db.query('sceneFogLayers').unique()
    if (!entity || !fogLayer) throw new Error('Missing merged Scene.')
    expect(parseLiveEntity(entity, 2)).toMatchObject({
      version: 2,
      value: { entity: { hidden: true } }
    })
    const parsedLayer = parseFogLayer(fogLayer, 2)
    expect(
      await readFogChunk(ctx, parsedLayer.chunks[0]!, base.scene.sceneId, parsedLayer)
    ).toEqual(base.chunk)
    expect(await ctx.db.query('sceneFogSaves').take(100)).toHaveLength(1)
  })
})

it('rejects a checkpointed token that stores senses', async () => {
  const base = await fixture()
  const changes = base.publication.changes.map((entry) => {
    if (entry.table !== 'sceneLiveEntities' || !entry.delta || !('set' in entry.delta)) return entry
    const { checksum: _checksum, ...fields } = canonicalJsonRecordSchema.parse(entry.delta.set)
    const next = canonicalJsonRecordSchema.parse({
      ...fields,
      value: {
        collection: 'tokens',
        entity: {
          ...base.token,
          senses: [
            {
              channel: 'VISUAL',
              illuminationAccess: 'ORDINARY_DARKNESS',
              label: 'Darkvision',
              range: 60,
              senseId: crypto.randomUUID()
            }
          ]
        }
      }
    })
    return change('sceneLiveEntities', { ...next, checksum: checksumCanonicalJson(next) })
  })
  await expect(
    base.t.mutation(
      publish,
      frame(base.authority, {
        changes: [],
        history: [],
        scenes: [{ ...base.publication, changes }]
      })
    )
  ).rejects.toThrow('Checkpoint Scene saves never store token senses.')
  await base.t.run(async (ctx) => {
    expect(await ctx.db.query('sceneLiveEntities').take(1)).toEqual([])
  })
})
