import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  LiveSessionCheckpointInput,
  LiveSessionCheckpointResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import type { LiveSessionCheckpointRecords } from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import {
  liveSessionCheckpointSceneKeys,
  liveSessionCheckpointSceneSchemas,
  type LiveSessionCheckpointScene,
  type LiveSessionCheckpointSceneChange,
  type LiveSessionCheckpointSceneTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import type { LiveSessionJoinOptionsDto } from '@artificer-toolkit/schema/api/liveSessionIdentity'
import type {
  LiveSessionActivationInput,
  LiveSessionAuthorityDto
} from '@artificer-toolkit/schema/api/liveSessionState'
import type { LiveSessionPresentationCommitInput } from '@artificer-toolkit/schema/api/liveSessions'
import type { SetCampaignLiveScenePresentationResultDto } from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneGeometryCommandResultSchema,
  type SceneGeometryCommandResult,
  type SceneGeometryExecuteInput
} from '@artificer-toolkit/schema/api/sceneGeometry'
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
  createSceneDefinitionFixture,
  publishEmptyScene
} from '../../tests/fixtures/sceneDefinitions'
import { api, internal } from '../_generated/api'
import { parseFogLayer, parseFogSave, readFogChunk } from '../scenes/fogDocuments'
import {
  parseGeometryCommand,
  parseGeometrySave,
  readSpatialPreparation
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { parseLiveEntity, readLiveSceneForUser } from '../scenes/liveDocuments'

afterEach(() => vi.useRealTimers())

const claim = makeFunctionReference<'mutation', LiveSessionJoinOptionsDto, LiveSessionAuthorityDto>(
  'liveSessions/authority:claim'
)
const activate = makeFunctionReference<
  'mutation',
  LiveSessionActivationInput,
  LiveSessionAuthorityDto
>('liveSessions/authority:commitActivation')
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
const layer = {
  ownerUserId: null,
  width: 1,
  height: 1,
  chunks: [{ index: 0, x: 0, y: 0, width: 1, height: 1, data: 'AQ==' }]
}

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
  authority: LiveSessionAuthorityDto,
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
  vi.useFakeTimers()
  const base = await createSceneDefinitionFixture()
  const scene = await publishEmptyScene(base)
  const presentation = await base.owner.caller.mutation(api.scenes.presentations.set, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: base.campaign.id,
    sceneId: scene.sceneId
  })
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
  const token = {
    id: crypto.randomUUID(),
    assetId: null,
    controlledByUserIds: [],
    height: 1,
    hidden: false,
    label: 'Checkpoint token',
    locked: false,
    position: { x: 10, y: 20 },
    rotationDegrees: 0,
    vision: null,
    width: 1
  }
  const staged = await base.owner.caller.mutation(internal.scenes.geometryStaging.begin, {
    input: {
      type: 'UPSERT_SCENE_TOKEN',
      sceneId: scene.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      token
    }
  })
  if (staged.kind !== 'READY') throw new Error('Missing geometry fixture save.')
  await base.owner.caller.mutation(internal.scenes.geometryStaging.stageFog, {
    saveId: staged.saveId,
    layer
  })
  const result = await base.owner.caller.mutation(internal.scenes.geometryCommands.finish, {
    saveId: staged.saveId,
    baseOrdinal: null
  })
  // Use native publication as the fixture oracle, then publish those normalized rows through the room.
  const changes = await base.t.run(async (ctx) => {
    const changes: LiveSessionCheckpointSceneChange[] = []
    for (const table of tables) {
      const rows = await ctx.db.query(table).take(100)
      expect(rows).toHaveLength(1)
      for (const row of rows) {
        changes.push(change(table, content(row)))
        await ctx.db.delete(row._id)
      }
    }
    return changes
  })
  const secondScene = withSecondScene
    ? await publishEmptyScene({ ...base, input: { ...base.input, commandId: crypto.randomUUID() } })
    : null
  const claimed = await base.owner.caller.mutation(claim, { campaignId: base.campaign.id })
  const authority = await base.t.mutation(activate, {
    campaignId: base.campaign.id,
    epoch: claimed.epoch,
    activationFingerprint: claimed.activationFingerprint,
    stateChecksum: 'a'.repeat(64)
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
  return { ...base, scene, secondScene, authority, publication, result, token, run }
}

type Fixture = Awaited<ReturnType<typeof fixture>>

async function snapshot(base: Fixture) {
  return base.t.run(async (ctx) => ({
    rows: await Promise.all(
      tables.map(async (table) => [table, await ctx.db.query(table).take(100)])
    ),
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
    const rows = await base.t.run((ctx) => ctx.db.query(table).take(100))
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
    const geometrySave = await ctx.db.query('sceneGeometrySaves').unique()
    const receipt = await ctx.db.query('sceneLiveCommands').unique()
    if (!entity || !fogLayer || !fogSave || !geometrySave || !receipt)
      throw new Error('Missing publication.')
    expect(parseLiveEntity(entity, 1).value).toEqual({ collection: 'tokens', entity: base.token })
    const parsedLayer = parseFogLayer(fogLayer, 1)
    expect(parseFogSave(fogSave).status).toBe('PUBLISHED')
    expect(
      await readFogChunk(ctx, parsedLayer.chunks[0]!, base.scene.sceneId, parsedLayer)
    ).toEqual(layer.chunks[0])
    expect(parseGeometrySave(geometrySave).status).toBe('PUBLISHED')
    expect(readSpatialPreparation(parseGeometrySave(geometrySave))).toBeNull()
    expect(parseGeometryCommand(receipt, 1).result).toEqual(base.result)
  })
  await expect(
    base.owner.caller.query(api.scenes.geometryReads.commandChunks, {
      sceneId: base.scene.sceneId,
      commandId: base.result.commandId,
      ownerUserId: null,
      offset: 0,
      numItems: 8
    })
  ).resolves.toMatchObject({ result: base.result, page: layer.chunks, isDone: true })
  await expect(
    base.owner.caller.query(api.scenes.fogReads.chunks, {
      sceneId: base.scene.sceneId,
      ownerUserId: null,
      expectedVersion: 1,
      offset: 0,
      numItems: 8
    })
  ).resolves.toMatchObject({ page: layer.chunks, isDone: true })
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
    const receipt = await ctx.db.query('sceneLiveCommands').unique()
    if (!head || !receipt) throw new Error('Missing receipt fixture.')
    return [
      change('sceneLiveStates', { ...content(head), version: 2 }, content(head)),
      change(
        'sceneLiveCommands',
        { ...content(receipt), actorUserId: base.other.userId },
        content(receipt)
      )
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
    ).toEqual(layer.chunks[0])
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
    const receipt = await ctx.db.query('sceneLiveCommands').unique()
    if (!receipt) throw new Error('Missing pending receipt.')
    expect(parseGeometryCommand(receipt, 0).result).toEqual(result)
  })
  const after = await snapshot(base)
  expect(after.sources).toEqual(before.sources)
  await expect(base.t.mutation(publish, checkpoint)).resolves.toMatchObject({ status: 'REPLAYED' })
  expect(await snapshot(base)).toEqual(after)
})

async function stagedGeometry(
  base: Awaited<ReturnType<typeof createSceneDefinitionFixture>>,
  args: SceneGeometryExecuteInput
): Promise<SceneGeometryCommandResult> {
  const staged = await base.owner.caller.mutation(internal.scenes.geometryStaging.begin, args)
  if (staged.kind !== 'READY') throw new Error('Missing folded geometry fixture save.')
  return sceneGeometryCommandResultSchema.parse(
    await base.owner.caller.mutation(internal.scenes.geometryCommands.finish, {
      saveId: staged.saveId,
      baseOrdinal: null
    })
  )
}

async function nativeFoldFixture() {
  vi.useFakeTimers()
  const base = await createSceneDefinitionFixture()
  const scene = await publishEmptyScene(base)
  const presentation = await base.owner.caller.mutation(api.scenes.presentations.set, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: base.campaign.id,
    sceneId: scene.sceneId
  })
  const token = {
    id: crypto.randomUUID(),
    assetId: null,
    controlledByUserIds: [],
    height: 1,
    hidden: false,
    label: 'Folded token',
    locked: false,
    position: { x: 10, y: 20 },
    rotationDegrees: 0,
    vision: null,
    width: 1
  }
  const seeded = await stagedGeometry(base, {
    input: {
      type: 'UPSERT_SCENE_TOKEN',
      sceneId: scene.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      token
    }
  })
  return { ...base, scene, presentation, token, seeded }
}

type NativeFoldFixture = Awaited<ReturnType<typeof nativeFoldFixture>>

function nativeRows(base: NativeFoldFixture) {
  return base.t.run(async (ctx) =>
    Promise.all(
      tables.map(async (table) => ({
        table,
        rows: (await ctx.db.query(table).take(100)).map(content)
      }))
    )
  )
}

async function nativeReaderOutput(base: NativeFoldFixture, version: number) {
  return {
    header: await base.owner.caller.query(api.scenes.liveReads.header, {
      sceneId: base.scene.sceneId
    }),
    tokens: await base.owner.caller.query(internal.scenes.geometryReads.entities, {
      sceneId: base.scene.sceneId,
      expectedVersion: version,
      definitionSaveId: base.scene.save.saveId,
      collection: 'tokens',
      phase: 'APPENDED',
      afterOrdinal: null,
      numItems: 8
    }),
    fog: await base.owner.caller.query(api.scenes.fogReads.layers, {
      sceneId: base.scene.sceneId,
      expectedVersion: version,
      paginationOpts: { cursor: null, numItems: 8 }
    })
  }
}

async function publishNativeFold(
  base: NativeFoldFixture,
  baseline: Awaited<ReturnType<typeof nativeRows>>,
  fromVersion: number,
  toVersion: number
) {
  const finalRows = await nativeRows(base)
  const expectedReaders = await nativeReaderOutput(base, toVersion)
  const changes: LiveSessionCheckpointSceneChange[] = []
  for (const { table, rows } of finalRows) {
    const previous = baseline.find((entry) => entry.table === table)!.rows
    const identity = (row: Record<string, JsonValue>) =>
      canonicalizeJson(liveSessionCheckpointSceneKeys[table].map((field) => row[field]))
    const beforeByKey = new Map(previous.map((row) => [identity(row), row]))
    for (const row of rows) {
      const before = beforeByKey.get(identity(row)) ?? null
      beforeByKey.delete(identity(row))
      if (checksumCanonicalJson(row) !== (before ? checksumCanonicalJson(before) : null))
        changes.push(change(table, row, before))
    }
    for (const row of beforeByKey.values()) {
      const deletion = change(table, row)
      changes.push({
        ...deletion,
        previousChecksum: deletion.nextChecksum,
        nextChecksum: null,
        delta: null
      })
    }
  }
  await base.t.run(async (ctx) => {
    for (const { table, rows } of baseline) {
      for (const row of await ctx.db.query(table).take(100)) await ctx.db.delete(row._id)
      for (const row of rows)
        await ctx.db.insert(table, liveSessionCheckpointSceneSchemas[table].parse(row))
    }
  })
  const claimed = await base.owner.caller.mutation(claim, { campaignId: base.campaign.id })
  const authority = await base.t.mutation(activate, {
    campaignId: base.campaign.id,
    epoch: claimed.epoch,
    activationFingerprint: claimed.activationFingerprint,
    stateChecksum: 'a'.repeat(64)
  })
  const input = frame(authority, {
    changes: [],
    history: [],
    scenes: [
      {
        sceneId: base.scene.sceneId,
        definitionSaveId: base.scene.save.saveId,
        definitionVersion: 1,
        presentationVersion: base.presentation.version,
        fromVersion,
        toVersion,
        changes
      }
    ]
  })
  await expect(base.t.mutation(publish, input)).resolves.toMatchObject({ status: 'COMMITTED' })
  expect(await nativeRows(base)).toEqual(finalRows)
  expect(await nativeReaderOutput(base, toVersion)).toEqual(expectedReaders)
  const after = await base.t.run(async (ctx) => ({
    rows: await Promise.all(tables.map(async (table) => await ctx.db.query(table).take(100))),
    authority: await ctx.db.query('campaignLiveAuthorities').take(10),
    revisions: await ctx.db.query('sceneVisionRevisions').take(100),
    scheduled: await ctx.db.system.query('_scheduled_functions').take(100)
  }))
  await expect(base.t.mutation(publish, input)).resolves.toMatchObject({ status: 'REPLAYED' })
  expect(
    await base.t.run(async (ctx) => ({
      rows: await Promise.all(tables.map(async (table) => await ctx.db.query(table).take(100))),
      authority: await ctx.db.query('campaignLiveAuthorities').take(10),
      revisions: await ctx.db.query('sceneVisionRevisions').take(100),
      scheduled: await ctx.db.system.query('_scheduled_functions').take(100)
    }))
  ).toEqual(after)
  return { changes, expectedReaders }
}

it.each(['UPSERT → REMOVE', 'REMOVE → recreate'] as const)(
  'folds native %s commands while preserving consumed entity ordinals',
  async (sequence) => {
    const base = await nativeFoldFixture()
    const baseline = await nativeRows(base)
    const token =
      sequence === 'UPSERT → REMOVE' ? { ...base.token, id: crypto.randomUUID() } : base.token
    const first = await stagedGeometry(base, {
      input:
        sequence === 'UPSERT → REMOVE'
          ? {
              type: 'UPSERT_SCENE_TOKEN',
              sceneId: base.scene.sceneId,
              commandId: crypto.randomUUID(),
              expectedSceneVersion: 1,
              token
            }
          : {
              type: 'REMOVE_SCENE_TOKEN',
              sceneId: base.scene.sceneId,
              commandId: crypto.randomUUID(),
              expectedSceneVersion: 1,
              tokenId: token.id
            }
    })
    const last = await stagedGeometry(base, {
      input:
        sequence === 'UPSERT → REMOVE'
          ? {
              type: 'REMOVE_SCENE_TOKEN',
              sceneId: base.scene.sceneId,
              commandId: crypto.randomUUID(),
              expectedSceneVersion: first.version,
              tokenId: token.id
            }
          : {
              type: 'UPSERT_SCENE_TOKEN',
              sceneId: base.scene.sceneId,
              commandId: crypto.randomUUID(),
              expectedSceneVersion: first.version,
              token
            }
    })
    const head = await base.t.run((ctx) => ctx.db.query('sceneLiveStates').unique())
    expect(head).toMatchObject({ counts: { tokens: 1 }, nextOrdinals: { tokens: 2 } })
    const entity = await base.t.run((ctx) =>
      ctx.db
        .query('sceneLiveEntities')
        .withIndex('by_sceneId_collection_entityId', (q) =>
          q.eq('sceneId', base.scene.sceneId).eq('collection', 'tokens').eq('entityId', token.id)
        )
        .unique()
    )
    expect(entity).toMatchObject(
      sequence === 'UPSERT → REMOVE' ? { value: null, ordinal: null } : { ordinal: 1 }
    )
    await publishNativeFold(base, baseline, base.seeded.version, last.version)
  }
)

it('folds native geometry undo deleting the first owner fog layer without reclaiming its ordinal', async () => {
  const base = await nativeFoldFixture()
  const staged = await base.owner.caller.mutation(internal.scenes.geometryStaging.begin, {
    input: {
      type: 'MOVE_SCENE_TOKEN',
      sceneId: base.scene.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: base.seeded.version,
      expectedEncounterVersion: null,
      correlationId: null,
      tokenId: base.token.id,
      movementKind: 'VOLUNTARY',
      path: [base.token.position, { x: 20, y: 20 }]
    }
  })
  if (staged.kind !== 'READY') throw new Error('Missing undo geometry fixture.')
  await base.owner.caller.mutation(internal.scenes.geometryStaging.stageFog, {
    saveId: staged.saveId,
    layer: { ...layer, ownerUserId: base.owner.userId }
  })
  const moved = await base.owner.caller.mutation(internal.scenes.geometryCommands.finish, {
    saveId: staged.saveId,
    baseOrdinal: null
  })
  const baseline = await nativeRows(base)
  expect(baseline.find((entry) => entry.table === 'sceneFogLayers')!.rows).toHaveLength(1)
  const undone = await base.owner.caller.mutation(internal.scenes.undo.finish, {
    targetCommandId: moved.commandId,
    input: {
      type: 'UNDO_LAST_SCENE_MOVE',
      sceneId: base.scene.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: moved.version
    }
  })
  expect(undone.restoredFogOwners).toEqual([base.owner.userId])
  const head = await base.t.run((ctx) => ctx.db.query('sceneLiveStates').unique())
  expect(head).toMatchObject({ fogLayerCount: 0, nextFogOrdinal: 1 })
  const folded = await publishNativeFold(base, baseline, moved.version, undone.version)
  expect(folded.changes).toContainEqual(
    expect.objectContaining({ table: 'sceneFogLayers', nextChecksum: null, delta: null })
  )
  expect(folded.expectedReaders.fog.page).toEqual([])
  expect(folded.expectedReaders.tokens.page).toMatchObject([
    { value: { entity: { position: base.token.position } } }
  ])
})
