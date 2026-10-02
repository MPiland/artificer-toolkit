import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  LiveSessionCheckpointInput,
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
  commitSceneInRoom,
  insertActiveLiveAuthority
} from '../../tests/fixtures/liveSessionWorker'
import {
  createSceneDefinitionFixture,
  publishEmptyScene,
  publishScene
} from '../../tests/fixtures/sceneDefinitions'
import { api } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { readReceiptLedger } from '../lib/receiptLedgers'
import { parseFogLayer, parseFogSave, readFogChunk } from '../scenes/fogDocuments'
import {
  parseGeometryCommand,
  parseGeometrySave,
  readSpatialPreparation
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { parseLiveEntity, readLiveSceneForUser } from '../scenes/liveDocuments'

afterEach(() => vi.useRealTimers())

const publish = makeFunctionReference<
  'mutation',
  LiveSessionCheckpointInput,
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

/** Scene command receipts live in packed Scene ledgers; their header rows only index them. */
async function readSceneCommands(ctx: MutationCtx) {
  const ledgers = await ctx.db
    .query('receiptLedgers')
    .withIndex('by_scope_scopeId', (q) => q.eq('scope', 'SCENE'))
    .take(100)
  const decoded = await Promise.all(ledgers.map((ledger) => readReceiptLedger(ctx, ledger.id)))
  return decoded.flatMap(({ entries }) => entries.flatMap((entry) => (entry ? [entry.value] : [])))
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
): LiveSessionCheckpointInput {
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
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch: crypto.randomUUID(),
      createdAt: base.campaign.createdAt
    })
  )
  // The room's own checkpoint is the fixture oracle: its rows are normalized into a publication
  // that these tests then replay through the checkpoint mutation.
  const result = await commitSceneInRoom(base.owner.caller, base.campaign.id, {
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
      const values =
        table === 'sceneLiveCommands' ? await readSceneCommands(ctx) : rows.map(content)
      for (const value of values) changes.push(change(table, value))
      for (const row of rows) {
        if (table === 'sceneFogChunks') chunk ??= (row as Doc<'sceneFogChunks'>).chunk
        await ctx.db.delete(row._id)
      }
    }
    for (const ledger of await ctx.db.query('receiptLedgers').take(100)) {
      for (const part of await ctx.db
        .query('receiptLedgerParts')
        .withIndex('by_ledgerId_index', (q) => q.eq('ledgerId', ledger.id))
        .take(100))
        await ctx.db.delete(part._id)
      await ctx.db.delete(ledger._id)
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
    result,
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

it('publishes native token, fog and geometry rows with the authority acknowledgement, and replays unchanged', async () => {
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
    const stored =
      table === 'sceneLiveCommands' ? await base.t.run(readSceneCommands) : rows.map(content)
    expect(stored).toEqual(
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
    const geometrySave = await ctx.db.query('sceneGeometrySaves').unique()
    const [receipt, ...otherReceipts] = await readSceneCommands(ctx)
    const ledgers = await ctx.db.query('receiptLedgers').take(10)
    if (!entity || !fogLayer || !fogSave || !geometrySave || !receipt || otherReceipts.length)
      throw new Error('Missing publication.')
    expect(ledgers).toMatchObject([
      {
        scope: 'SCENE',
        scopeId: base.scene.sceneId,
        checkpointId: input.checkpointId
      }
    ])
    expect(await ctx.db.query('sceneLiveCommands').take(10)).toHaveLength(1)
    expect(parseLiveEntity(entity, 1).value).toEqual({
      collection: 'tokens',
      entity: base.token
    })
    const parsedLayer = parseFogLayer(fogLayer, 1)
    expect(parseFogSave(fogSave).status).toBe('PUBLISHED')
    expect(
      await readFogChunk(ctx, parsedLayer.chunks[0]!, base.scene.sceneId, parsedLayer)
    ).toEqual(base.chunk)
    expect(parseGeometrySave(geometrySave).status).toBe('PUBLISHED')
    expect(readSpatialPreparation(parseGeometrySave(geometrySave))).toBeNull()
    expect(parseGeometryCommand(receipt, 1).result).toEqual(base.result)
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

it('rejects changed reuse of a Scene receipt in a later checkpoint without advancing the head or authority', async () => {
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
    const [receipt] = await readSceneCommands(ctx)
    if (!head || !receipt) throw new Error('Missing receipt fixture.')
    return [
      change('sceneLiveStates', { ...content(head), version: 2 }, content(head)),
      change('sceneLiveCommands', { ...receipt, actorUserId: base.other.userId }, receipt)
    ]
  })
  await assertRejected(
    base,
    { ...base.publication, fromVersion: 1, toVersion: 2, changes },
    /append-only/
  )
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
    expect(await ctx.db.query('sceneGeometrySaves').take(100)).toHaveLength(1)
    expect(await ctx.db.query('sceneFogSaves').take(100)).toHaveLength(1)
  })
})

it('appends pending movement evidence at the current Scene version without writing mutable Scene state', async () => {
  const base = await fixture()
  const input = {
    type: 'MOVE_SCENE_TOKEN' as const,
    sceneId: base.scene.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    expectedEncounterVersion: base.run.version,
    correlationId: null,
    tokenId: base.token.id,
    movementKind: 'VOLUNTARY' as const,
    path: [base.token.position, { x: 20, y: 20 }]
  }
  const result = {
    sceneId: input.sceneId,
    commandId: input.commandId,
    version: 0,
    replayed: false,
    delta: null,
    fogPatches: [],
    occurrence: {
      occurrenceId: crypto.randomUUID(),
      occurrenceVersion: 0,
      status: 'PENDING' as const,
      outcome: null,
      pending: null
    }
  }
  const changes = [
    change(
      'sceneGeometrySaves',
      canonicalJsonRecordSchema.parse({
        id: crypto.randomUUID(),
        sceneId: input.sceneId,
        commandId: input.commandId,
        actorUserId: base.owner.userId,
        input,
        inputChecksum: checksumCanonicalJson(input),
        snapshotVersion: 0,
        status: 'PUBLISHED',
        expiresAt: Date.now() + 60_000,
        fogSaves: []
      })
    ),
    change(
      'sceneLiveCommands',
      canonicalJsonRecordSchema.parse({
        sceneId: input.sceneId,
        commandId: input.commandId,
        actorUserId: base.owner.userId,
        encoding: 'GEOMETRY',
        input,
        inputChecksum: checksumCanonicalJson(input),
        result,
        resultChecksum: checksumCanonicalJson(result)
      })
    )
  ]
  const before = await snapshot(base)
  const checkpoint = frame(base.authority, {
    changes: [],
    history: [],
    scenes: [{ ...base.publication, toVersion: 0, changes }]
  })
  await expect(base.t.mutation(publish, checkpoint)).resolves.toMatchObject({ status: 'COMMITTED' })
  await base.t.run(async (ctx) => {
    expect(await ctx.db.query('sceneLiveStates').take(100)).toEqual([])
    expect(await ctx.db.query('sceneLiveEntities').take(100)).toEqual([])
    expect(await ctx.db.query('sceneFogLayers').take(100)).toEqual([])
    const [receipt] = await readSceneCommands(ctx)
    if (!receipt) throw new Error('Missing pending receipt.')
    expect(parseGeometryCommand(receipt, 0).result).toEqual(result)
  })
  const after = await snapshot(base)
  expect(after.sources).toEqual(before.sources)
  await expect(base.t.mutation(publish, checkpoint)).resolves.toMatchObject({ status: 'REPLAYED' })
  expect(await snapshot(base)).toEqual(after)
})
