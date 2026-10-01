import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  developmentCheckpointSceneInputSchema,
  developmentCheckpointSceneInspectionSchema,
  type DevelopmentCheckpointSceneInput,
  type DevelopmentCheckpointSceneInspection
} from '@artificer-toolkit/schema/api/developmentCheckpointScenes'
import {
  liveSessionCheckpointSceneSchema,
  liveSessionCheckpointSceneSchemas,
  liveSessionCheckpointSceneKeys,
  type LiveSessionCheckpointScene,
  type LiveSessionCheckpointSceneChange,
  type LiveSessionCheckpointSceneTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import { sceneStoredPresentationSchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { canonicalJsonRecordSchema } from '@artificer-toolkit/schema/shared/jsonDelta'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { QueryCtx } from '../_generated/server'
import { untrackedInternalMutation } from '../lib/mutations'
import { internalQuery } from '../lib/queries'
import { parseLiveEntity, readLiveSceneForUser } from '../scenes/liveDocuments'
import {
  parseFogCommand,
  parseFogLayer,
  parseFogSave,
  parseReferencedFogChunk
} from '../scenes/fogDocuments'
import {
  parseGeometryCommand,
  parseGeometrySave
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { readCampaignLiveAuthority } from './authorityGuard'
import { readCheckpointFixture } from './developmentCheckpoint'

function fields<Row extends { _id: unknown; _creationTime: unknown }>(row: Row) {
  const { _id, _creationTime, ...value } = row
  return canonicalJsonRecordSchema.parse(JSON.parse(canonicalizeJson(value)))
}

/** All reads are complete within the reserved proof bounds, including historical fog saves. */
async function readFixtureScene(
  ctx: QueryCtx,
  input: DevelopmentCheckpointSceneInput,
  capturing = false
) {
  const { scope, sceneId } = input
  await readCheckpointFixture(ctx, scope)
  if (capturing && (await readCampaignLiveAuthority(ctx, scope.campaignId)))
    throw new Error('Fixture Campaign already has live authority.')
  const { header, live } = await readLiveSceneForUser(ctx, sceneId, 'OWNER', scope.ownerUserId)
  const presentationRow = await ctx.db
    .query('campaignScenePresentations')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', scope.campaignId))
    .unique()
  const presentation = presentationRow
    ? sceneStoredPresentationSchema.parse(fields(presentationRow))
    : null
  if (
    header.campaignId !== scope.campaignId ||
    header.name !== 'Checkpoint native Scene' ||
    !presentation ||
    presentation.sceneId !== header.id ||
    presentation.activeMapAssetId !== header.map.assetId
  )
    throw new Error('Checkpoint proof requires the exact presented fixture Scene.')

  const [states, entities, commands, geometrySaves, fogSaves, fogLayers] = await Promise.all([
    ctx.db
      .query('sceneLiveStates')
      .withIndex('by_sceneId', (q) => q.eq('sceneId', header.id))
      .take(2),
    ctx.db
      .query('sceneLiveEntities')
      .withIndex('by_sceneId_collection_entityId', (q) => q.eq('sceneId', header.id))
      .take(33),
    ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', header.id))
      .take(33),
    ctx.db
      .query('sceneGeometrySaves')
      .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', header.id))
      .take(33),
    ctx.db
      .query('sceneFogSaves')
      .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', header.id))
      .take(33),
    ctx.db
      .query('sceneFogLayers')
      .withIndex('by_sceneId_ownerUserId', (q) => q.eq('sceneId', header.id))
      .take(5)
  ])
  if (
    states.length > 1 ||
    [entities, commands, geometrySaves, fogSaves].some((rows) => rows.length > 32) ||
    fogLayers.length > 4
  )
    throw new Error('Checkpoint Scene fixture exceeds its complete inspection bound.')
  const chunksBySave = await Promise.all(
    fogSaves.map(async (saveRow) => {
      const save = parseFogSave(saveRow)
      if (
        save.status !== 'PUBLISHED' ||
        ![scope.ownerUserId, scope.playerUserId].includes(save.actorUserId) ||
        (save.input.layer.ownerUserId !== null &&
          ![scope.ownerUserId, scope.playerUserId].includes(save.input.layer.ownerUserId))
      )
        throw new Error('Checkpoint fixture fog save is incomplete or belongs to another account.')
      const chunks = await ctx.db
        .query('sceneFogChunks')
        .withIndex('by_saveId_ordinal', (q) => q.eq('saveId', save.id))
        .take(17)
      if (chunks.length > 16 || chunks.length !== save.input.chunkManifest.length)
        throw new Error('Checkpoint fixture fog chunks exceed their complete bound or are missing.')
      for (const [ordinal, chunk] of chunks.entries()) {
        const manifest = save.input.chunkManifest[ordinal]!
        parseReferencedFogChunk(
          saveRow,
          chunk,
          { ...manifest, saveId: save.id, ordinal },
          header.id,
          save.input.layer
        )
      }
      return chunks
    })
  )
  const fogChunks = chunksBySave.flat()
  const rows = {
    sceneLiveStates: states,
    sceneLiveEntities: entities,
    sceneLiveCommands: commands,
    sceneGeometrySaves: geometrySaves,
    sceneFogSaves: fogSaves,
    sceneFogLayers: fogLayers,
    sceneFogChunks: fogChunks
  }
  for (const table of Object.keys(rows) as LiveSessionCheckpointSceneTable[])
    for (const row of rows[table]) liveSessionCheckpointSceneSchemas[table].parse(fields(row))
  if (
    (live?.fogLayerCount ?? 0) !== fogLayers.length ||
    (live === null && Object.values(rows).some((family) => family.length > 0))
  )
    throw new Error('Checkpoint fixture Scene head is incomplete.')
  const entityOrdinals = new Set<string>()
  const counts = { ...header.counts, measurements: 0 }
  for (const row of entities) {
    const entity = parseLiveEntity(row, header.version)
    const base =
      entity.collection === 'measurements'
        ? null
        : await ctx.db
            .query('sceneDefinitionEntities')
            .withIndex('by_saveId_collection_entityId', (q) =>
              q
                .eq('saveId', header.definitionSaveId)
                .eq(
                  'value.collection',
                  entity.collection as Exclude<typeof entity.collection, 'measurements'>
                )
                .eq('entityId', entity.entityId)
            )
            .unique()
    counts[entity.collection] += Number(entity.value !== null) - Number(base !== null)
    if (entity.ordinal === null) continue
    const identity = canonicalizeJson([entity.collection, entity.ordinal])
    if (
      !live ||
      entity.ordinal >= live.nextOrdinals[entity.collection] ||
      entityOrdinals.has(identity)
    )
      throw new Error('Checkpoint fixture Scene entity ordering is inconsistent.')
    entityOrdinals.add(identity)
  }
  if (
    live &&
    (checksumCanonicalJson(counts) !== checksumCanonicalJson(live.counts) ||
      Object.keys(counts).some((collection) => {
        const key = collection as keyof typeof counts
        return live.nextOrdinals[key] < (key === 'measurements' ? 0 : header.counts[key])
      }))
  )
    throw new Error('Checkpoint fixture Scene entity counts are inconsistent.')
  const layerOrdinals = new Set<number>()
  for (const row of fogLayers) {
    const layer = parseFogLayer(row, header.version)
    if (!live || layer.ordinal >= live.nextFogOrdinal || layerOrdinals.has(layer.ordinal))
      throw new Error('Checkpoint fixture fog ordering is inconsistent.')
    layerOrdinals.add(layer.ordinal)
    for (const reference of layer.chunks)
      parseReferencedFogChunk(
        fogSaves.find((save) => save.id === reference.saveId) ?? null,
        fogChunks.find(
          (chunk) => chunk.saveId === reference.saveId && chunk.ordinal === reference.ordinal
        ) ?? null,
        reference,
        header.id,
        layer
      )
  }
  for (const row of geometrySaves) {
    const save = parseGeometrySave(row)
    if (
      save.status !== 'PUBLISHED' ||
      save.snapshotVersion > header.version ||
      ![scope.ownerUserId, scope.playerUserId].includes(save.actorUserId)
    )
      throw new Error(
        'Checkpoint fixture geometry save is incomplete or belongs to another account.'
      )
    for (const child of save.fogSaves) {
      const fog = fogSaves.find((candidate) => candidate.id === child.saveId)
      if (
        !fog ||
        fog.geometrySaveId !== save.id ||
        fog.actorUserId !== save.actorUserId ||
        fog.commandId !== fog.id ||
        fog.input.layer.ownerUserId !== child.ownerUserId
      )
        throw new Error('Checkpoint fixture geometry fog reference is inconsistent.')
    }
  }
  for (const save of fogSaves) {
    if (!save.geometrySaveId) continue
    const parent = geometrySaves.find((candidate) => candidate.id === save.geometrySaveId)
    if (
      !parent ||
      parent.actorUserId !== save.actorUserId ||
      save.commandId !== save.id ||
      !parent.fogSaves.some(
        (child) => child.saveId === save.id && child.ownerUserId === save.input.layer.ownerUserId
      )
    )
      throw new Error('Checkpoint fixture fog parent is inconsistent.')
  }
  for (const command of commands) {
    if (
      ![scope.ownerUserId, scope.playerUserId].includes(command.actorUserId) ||
      command.input.sceneId !== header.id ||
      command.result.sceneId !== header.id ||
      command.commandId !== command.input.commandId ||
      command.commandId !== command.result.commandId ||
      command.inputChecksum !== checksumCanonicalJson(command.input) ||
      command.resultChecksum !== checksumCanonicalJson(command.result) ||
      command.result.replayed ||
      command.result.version > header.version
    )
      throw new Error('Checkpoint fixture Scene receipt is inconsistent.')
    if (command.encoding === 'FOG_PATCH') {
      parseFogCommand(command, header.version)
      const save = fogSaves.find((candidate) => candidate.id === command.result.patch.saveId)
      if (
        !save ||
        save.commandId !== command.commandId ||
        save.actorUserId !== command.actorUserId ||
        save.inputChecksum !== command.inputChecksum
      )
        throw new Error('Checkpoint fixture fog receipt source is incomplete.')
    }
    if (command.encoding === 'GEOMETRY') {
      parseGeometryCommand(command, header.version)
      const save = geometrySaves.find((candidate) => candidate.commandId === command.commandId)
      if (
        !save ||
        save.actorUserId !== command.actorUserId ||
        save.inputChecksum !== command.inputChecksum ||
        save.fogSaves.length !== command.result.fogPatches.length ||
        command.result.fogPatches.some((patch) => {
          const fog = fogSaves.find((candidate) => candidate.id === patch.saveId)
          return (
            !fog ||
            fog.geometrySaveId !== save.id ||
            fog.input.layer.ownerUserId !== patch.ownerUserId ||
            fog.input.layer.width !== patch.width ||
            fog.input.layer.height !== patch.height ||
            fog.input.chunkManifest.length !== patch.chunkCount
          )
        })
      )
        throw new Error('Checkpoint fixture geometry receipt source is incomplete.')
    }
    if (
      command.encoding === 'UNDO' &&
      command.undoneCommandId !== command.result.delta.undoneCommandId
    )
      throw new Error('Checkpoint fixture undo receipt is inconsistent.')
  }
  const normalized = (Object.keys(rows) as LiveSessionCheckpointSceneTable[]).map((table) => {
    const identities = new Set<string>()
    const records = rows[table]
      .map((row) => {
        const value = fields(row)
        const identity = canonicalizeJson(
          liveSessionCheckpointSceneKeys[table].map((key) => value[key])
        )
        if (identities.has(identity))
          throw new Error('Checkpoint fixture Scene public identity is duplicated.')
        identities.add(identity)
        return value
      })
      .sort((left, right) => {
        const leftKey = canonicalizeJson(
          liveSessionCheckpointSceneKeys[table].map((key) => left[key])
        )
        const rightKey = canonicalizeJson(
          liveSessionCheckpointSceneKeys[table].map((key) => right[key])
        )
        return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
      })
    return { table, records }
  })
  return { header, presentation, rows, normalized }
}

/** Rewind only the freshly authored local fixture, before any room can claim it. */
export const capture = untrackedInternalMutation({
  args: zodToConvexFields(developmentCheckpointSceneInputSchema.shape),
  returns: zodToConvex(liveSessionCheckpointSceneSchema),
  handler: async (ctx, args): Promise<LiveSessionCheckpointScene> => {
    const input = developmentCheckpointSceneInputSchema.parse(args)
    const { header, presentation, rows, normalized } = await readFixtureScene(ctx, input, true)
    if (header.version === 0 || Object.values(rows).some((family) => family.length === 0))
      throw new Error('Checkpoint capture requires authentic rows in all seven Scene families.')
    const changes: LiveSessionCheckpointSceneChange[] = normalized.flatMap(({ table, records }) =>
      records.map((value) => ({
        table,
        key: liveSessionCheckpointSceneKeys[table].map((key) => {
          const identity = value[key]
          if (identity !== null && typeof identity !== 'string' && typeof identity !== 'number')
            throw new Error('Checkpoint fixture Scene identity is incomplete.')
          return identity
        }),
        previousChecksum: null,
        nextChecksum: checksumCanonicalJson(value),
        delta: { set: value }
      }))
    )
    const result = liveSessionCheckpointSceneSchema.parse({
      sceneId: header.id,
      definitionSaveId: header.definitionSaveId,
      definitionVersion: header.definitionVersion,
      presentationVersion: presentation.version,
      fromVersion: 0,
      toVersion: header.version,
      changes
    })
    for (const family of Object.values(rows)) for (const row of family) await ctx.db.delete(row._id)
    return result
  }
})

export const inspect = internalQuery({
  args: zodToConvexFields(developmentCheckpointSceneInputSchema.shape),
  returns: zodToConvex(developmentCheckpointSceneInspectionSchema),
  handler: async (ctx, args): Promise<DevelopmentCheckpointSceneInspection> => {
    const input = developmentCheckpointSceneInputSchema.parse(args)
    const { header, presentation, rows, normalized } = await readFixtureScene(ctx, input)
    return developmentCheckpointSceneInspectionSchema.parse({
      digest: checksumCanonicalJson(normalized),
      version: header.version,
      presentationVersion: presentation.version,
      counts: Object.fromEntries(
        Object.entries(rows).map(([table, family]) => [table, family.length])
      )
    })
  }
})
