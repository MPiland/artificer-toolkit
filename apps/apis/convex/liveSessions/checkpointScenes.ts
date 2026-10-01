import type { IndexNames, IndexRange, WithoutSystemFields } from 'convex/server'
import {
  liveSessionCheckpointSceneSchemas,
  liveSessionCheckpointSceneKeys,
  liveSessionCheckpointSceneIndexes,
  type LiveSessionCheckpointScene,
  type LiveSessionCheckpointSceneTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import { canonicalJsonRecordSchema } from '@artificer-toolkit/schema/shared/jsonDelta'
import { applyJsonDelta } from '@artificer-toolkit/encounter-persistence/jsonDelta'
import { changedFields } from '@artificer-toolkit/encounter-persistence/documents'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { DataModel, Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { livePublicationCampaignScope } from '../campaigns/authority'
import { parseLiveEntity, readLiveSceneForUser } from '../scenes/liveDocuments'
import {
  parseFogLayer,
  parseFogSave,
  parseFogCommand,
  parseReferencedFogChunk
} from '../scenes/fogDocuments'
import {
  parseGeometrySave,
  parseGeometryCommand,
  readSpatialPreparation
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { requireCampaignLiveAuthority } from './authorityGuard'

interface SceneIndexRange extends IndexRange {
  eq(field: string, value: string | number | null): SceneIndexRange
}

function content<Row extends { _id: unknown; _creationTime: unknown }>(row: Row) {
  const { _id, _creationTime, ...fields } = row
  return canonicalJsonRecordSchema.parse(JSON.parse(canonicalizeJson(fields)))
}

async function readRow<Table extends LiveSessionCheckpointSceneTable>(
  ctx: MutationCtx,
  table: Table,
  key: (string | number | null)[]
): Promise<Doc<Table> | null> {
  return ctx.db
    .query(table)
    .withIndex(
      liveSessionCheckpointSceneIndexes[table] as IndexNames<DataModel[Table]>,
      (query) => {
        // The shared contract validates this complete index's scalar key in field order.
        let range = query as unknown as SceneIndexRange
        for (const [index, field] of liveSessionCheckpointSceneKeys[table].entries())
          range = range.eq(field, key[index]!)
        return range
      }
    )
    .unique()
}

/** Complete normalized Scene writes share the rules, private play and acknowledgement transaction. */
export async function applyCheckpointScenes(
  ctx: MutationCtx,
  frame: { campaignId: string; epoch: string },
  scenes: readonly LiveSessionCheckpointScene[]
) {
  if (!scenes.length) return
  const authority = await requireCampaignLiveAuthority(ctx, frame)
  const scope = livePublicationCampaignScope(authority)
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', frame.campaignId))
    .unique()
  const presentation = await ctx.db
    .query('campaignScenePresentations')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', frame.campaignId))
    .unique()
  if (!campaign) throw new Error('Checkpoint Campaign is unavailable.')
  const identities = new Set<string>()
  const publishedScenes = new Set<string>()
  for (const scene of scenes) {
    if (publishedScenes.has(scene.sceneId)) throw new Error('Checkpoint Scene is duplicated.')
    publishedScenes.add(scene.sceneId)
    if (
      presentation?.sceneId !== scene.sceneId ||
      presentation.version !== scene.presentationVersion
    )
      throw new Error('Checkpoint Scene presentation is stale.')
    const { header, live } = await readLiveSceneForUser(
      ctx,
      scene.sceneId,
      'OWNER',
      campaign.ownerUserId,
      scope
    )
    if (
      header.campaignId !== frame.campaignId ||
      header.definitionSaveId !== scene.definitionSaveId ||
      header.definitionVersion !== scene.definitionVersion ||
      header.version !== scene.fromVersion
    )
      throw new Error('Checkpoint Scene source or version is stale.')

    const rows: {
      table: LiveSessionCheckpointSceneTable
      key: (string | number | null)[]
      before: Doc<LiveSessionCheckpointSceneTable> | null
      next: WithoutSystemFields<Doc<LiveSessionCheckpointSceneTable>> | null
    }[] = []
    for (const change of scene.changes) {
      const identity = `${change.table}:${canonicalizeJson(change.key)}`
      if (identities.has(identity)) throw new Error('Checkpoint Scene record is duplicated.')
      identities.add(identity)
      const before = await readRow(ctx, change.table, change.key)
      const previous = before ? content(before) : null
      if ((previous ? checksumCanonicalJson(previous) : null) !== change.previousChecksum)
        throw new Error('Checkpoint Scene record changed before publication.')
      if (!change.delta) {
        if (change.table !== 'sceneFogLayers' || !before || previous?.sceneId !== scene.sceneId)
          throw new Error('Checkpoint can remove only an existing Scene fog layer.')
        rows.push({ table: change.table, key: change.key, before, next: null })
        continue
      }
      const value = canonicalJsonRecordSchema.parse(applyJsonDelta(previous, change.delta))
      if (checksumCanonicalJson(value) !== change.nextChecksum)
        throw new Error('Checkpoint Scene delta checksum does not match.')
      if (
        liveSessionCheckpointSceneKeys[change.table].some(
          (field, index) => value[field] !== change.key[index]
        )
      )
        throw new Error('Checkpoint Scene record identity cannot change.')
      if (change.table !== 'sceneFogChunks' && value.sceneId !== scene.sceneId)
        throw new Error('Checkpoint record belongs to another Scene.')
      if (
        !['sceneLiveStates', 'sceneLiveEntities', 'sceneFogLayers'].includes(change.table) &&
        before
      )
        throw new Error('Checkpoint Scene saves and receipts are append-only.')
      const next = liveSessionCheckpointSceneSchemas[change.table].parse(value)
      rows.push({ table: change.table, key: change.key, before, next })
    }
    const head = rows.find((row) => row.table === 'sceneLiveStates')?.next as
      | WithoutSystemFields<Doc<'sceneLiveStates'>>
      | undefined
    if (
      (scene.toVersion > scene.fromVersion && !head) ||
      (head &&
        (head.version !== scene.toVersion ||
          Object.values(head.settings).some((setting) => setting.version > head.version)))
    )
      throw new Error('Checkpoint Scene head is incomplete.')
    const newLayers = rows.filter(
      (row) => row.table === 'sceneFogLayers' && !row.before && row.next
    )
    const removedLayers = rows.filter(
      (row) => row.table === 'sceneFogLayers' && row.before && !row.next
    )
    if (
      head &&
      (head.fogLayerCount !==
        (live?.fogLayerCount ?? 0) + newLayers.length - removedLayers.length ||
        head.nextFogOrdinal < (live?.nextFogOrdinal ?? 0) + newLayers.length)
    )
      throw new Error('Checkpoint Scene fog ordering is inconsistent.')
    const counts = { ...header.currentCounts }
    const nextOrdinals = { ...(live?.nextOrdinals ?? { ...header.counts, measurements: 0 }) }
    for (const written of rows.filter((row) => row.table === 'sceneLiveEntities')) {
      const next = written.next as WithoutSystemFields<Doc<'sceneLiveEntities'>>
      const before = written.before as Doc<'sceneLiveEntities'> | null
      const base =
        next.collection === 'measurements'
          ? null
          : await ctx.db
              .query('sceneDefinitionEntities')
              .withIndex('by_saveId_collection_entityId', (q) =>
                q
                  .eq('saveId', scene.definitionSaveId)
                  .eq(
                    'value.collection',
                    next.collection as Exclude<typeof next.collection, 'measurements'>
                  )
                  .eq('entityId', next.entityId)
              )
              .unique()
      const existed = before ? before.value !== null : base !== null
      const exists = next.value !== null
      counts[next.collection] += Number(exists) - Number(existed)
      const previousOrdinal = before ? before.ordinal : base?.ordinal
      if (
        exists &&
        head &&
        (next.ordinal! >= head.nextOrdinals[next.collection] ||
          (next.ordinal !== previousOrdinal && next.ordinal! < nextOrdinals[next.collection]))
      )
        throw new Error('Checkpoint Scene entity allocation is outside its ordering interval.')
    }
    if (
      head &&
      (checksumCanonicalJson(counts) !== checksumCanonicalJson(head.counts) ||
        Object.keys(nextOrdinals).some((collection) => {
          const key = collection as keyof typeof nextOrdinals
          return head.nextOrdinals[key] < nextOrdinals[key]
        }))
    )
      throw new Error('Checkpoint Scene entity counts or ordering are inconsistent.')
    for (const row of rows) {
      if (!row.next) {
        await ctx.db.delete(row.before!._id)
        continue
      }
      if (row.table === 'sceneFogLayers' && head) {
        const layer = row.next as WithoutSystemFields<Doc<'sceneFogLayers'>>
        const previous = row.before as Doc<'sceneFogLayers'> | null
        if (
          layer.ordinal >= head.nextFogOrdinal ||
          (layer.ordinal !== previous?.ordinal && layer.ordinal < (live?.nextFogOrdinal ?? 0))
        )
          throw new Error('Checkpoint Scene fog allocation is outside its ordering interval.')
      }
      if (
        (row.table === 'sceneFogLayers' || row.table === 'sceneLiveEntities') &&
        'version' in row.next &&
        (row.next.version <= scene.fromVersion || row.next.version > scene.toVersion)
      )
        throw new Error('Checkpoint Scene row version is outside the published range.')
      if (row.before) {
        const previous = content(row.before)
        const next = content({
          ...row.next,
          _id: row.before._id,
          _creationTime: row.before._creationTime
        })
        const removed = Object.fromEntries(
          Object.keys(previous)
            .filter((field) => !Object.hasOwn(next, field))
            .map((field) => [field, undefined])
        )
        await ctx.db.patch(row.before._id, { ...changedFields(previous, next), ...removed })
      } else await ctx.db.insert(row.table, row.next)
    }

    const publishedFogSaves = new Map<string, Doc<'sceneFogSaves'> | null>()
    const checkedChunks = new Set<string>()
    const readFogSave = async (id: string) => {
      if (!publishedFogSaves.has(id))
        publishedFogSaves.set(
          id,
          await ctx.db
            .query('sceneFogSaves')
            .withIndex('by_publicId', (q) => q.eq('id', id))
            .unique()
        )
      return publishedFogSaves.get(id) ?? null
    }
    const checkChunk = async (
      reference: Doc<'sceneFogLayers'>['chunks'][number],
      layer: Doc<'sceneFogSaves'>['input']['layer']
    ) => {
      const identity = canonicalizeJson([reference, layer.ownerUserId, layer.width, layer.height])
      if (checkedChunks.has(identity)) return
      const save = await readFogSave(reference.saveId)
      const chunk = await ctx.db
        .query('sceneFogChunks')
        .withIndex('by_saveId_ordinal', (q) =>
          q.eq('saveId', reference.saveId).eq('ordinal', reference.ordinal)
        )
        .unique()
      parseReferencedFogChunk(save, chunk, reference, scene.sceneId, layer)
      checkedChunks.add(identity)
    }
    // Reader invariants run after all rows exist, inside the same rollback boundary. Each distinct
    // save and tile is read once: repeated 256-entry manifests can otherwise exhaust the read limit.
    for (const written of rows) {
      if (!written.next) continue
      const row = await readRow(ctx, written.table, written.key)
      if (!row) throw new Error('Checkpoint Scene record is missing after publication.')
      switch (written.table) {
        case 'sceneLiveEntities':
          parseLiveEntity(row as Doc<'sceneLiveEntities'>, scene.toVersion)
          if ('collection' in row && 'ordinal' in row && row.ordinal !== null)
            await ctx.db
              .query('sceneLiveEntities')
              .withIndex('by_sceneId_collection_ordinal', (q) =>
                q
                  .eq('sceneId', scene.sceneId)
                  .eq('collection', row.collection)
                  .eq('ordinal', row.ordinal)
              )
              .unique()
          break
        case 'sceneFogLayers': {
          const layer = parseFogLayer(row as Doc<'sceneFogLayers'>, scene.toVersion)
          await ctx.db
            .query('sceneFogLayers')
            .withIndex('by_sceneId_ordinal', (q) =>
              q.eq('sceneId', scene.sceneId).eq('ordinal', layer.ordinal)
            )
            .unique()
          for (const reference of layer.chunks) await checkChunk(reference, layer)
          break
        }
        case 'sceneFogSaves': {
          const save = parseFogSave(row as Doc<'sceneFogSaves'>)
          if (save.status !== 'PUBLISHED') throw new Error('Checkpoint fog save is incomplete.')
          for (const [ordinal, manifest] of save.input.chunkManifest.entries())
            await checkChunk({ ...manifest, saveId: save.id, ordinal }, save.input.layer)
          if (save.geometrySaveId) {
            const parent = await ctx.db
              .query('sceneGeometrySaves')
              .withIndex('by_publicId', (q) => q.eq('id', save.geometrySaveId!))
              .unique()
            if (
              !parent ||
              parent.sceneId !== scene.sceneId ||
              parent.status !== 'PUBLISHED' ||
              save.commandId !== save.id ||
              parent.actorUserId !== save.actorUserId ||
              !parent.fogSaves.some(
                (child) =>
                  child.saveId === save.id && child.ownerUserId === save.input.layer.ownerUserId
              )
            )
              throw new Error('Checkpoint fog save parent is inconsistent.')
          }
          break
        }
        case 'sceneFogChunks': {
          const chunk = row as Doc<'sceneFogChunks'>
          const save = await readFogSave(chunk.saveId)
          const manifest = save?.input.chunkManifest[chunk.ordinal]
          if (!save || save.sceneId !== scene.sceneId || !manifest)
            throw new Error('Checkpoint fog chunk belongs to another Scene or missing save.')
          await checkChunk(
            { ...manifest, saveId: save.id, ordinal: chunk.ordinal },
            save.input.layer
          )
          break
        }
        case 'sceneGeometrySaves': {
          const save = parseGeometrySave(row as Doc<'sceneGeometrySaves'>)
          if (
            save.status !== 'PUBLISHED' ||
            save.snapshotVersion < scene.fromVersion ||
            save.snapshotVersion > scene.toVersion
          )
            throw new Error('Checkpoint geometry save is incomplete or stale.')
          readSpatialPreparation(save)
          for (const child of save.fogSaves) {
            const fog = await readFogSave(child.saveId)
            if (
              !fog ||
              fog.sceneId !== scene.sceneId ||
              fog.status !== 'PUBLISHED' ||
              fog.geometrySaveId !== save.id ||
              fog.commandId !== fog.id ||
              fog.actorUserId !== save.actorUserId ||
              fog.input.layer.ownerUserId !== child.ownerUserId
            )
              throw new Error('Checkpoint geometry fog publication is incomplete.')
          }
          break
        }
        case 'sceneLiveCommands': {
          const command = row as Doc<'sceneLiveCommands'>
          if (
            command.input.sceneId !== scene.sceneId ||
            command.result.sceneId !== scene.sceneId ||
            command.commandId !== command.input.commandId ||
            command.commandId !== command.result.commandId ||
            command.inputChecksum !== checksumCanonicalJson(command.input) ||
            command.resultChecksum !== checksumCanonicalJson(command.result) ||
            command.result.replayed ||
            command.result.version < scene.fromVersion ||
            command.result.version > scene.toVersion
          )
            throw new Error('Checkpoint Scene receipt is inconsistent.')
          if (command.encoding === 'GEOMETRY') {
            parseGeometryCommand(command, scene.toVersion)
            const save = await ctx.db
              .query('sceneGeometrySaves')
              .withIndex('by_sceneId_commandId', (q) =>
                q.eq('sceneId', scene.sceneId).eq('commandId', command.commandId)
              )
              .unique()
            if (
              !save ||
              save.status !== 'PUBLISHED' ||
              save.actorUserId !== command.actorUserId ||
              save.inputChecksum !== command.inputChecksum ||
              save.fogSaves.length !== command.result.fogPatches.length ||
              command.result.fogPatches.some(
                (patch) =>
                  !save.fogSaves.some(
                    (child) =>
                      child.saveId === patch.saveId && child.ownerUserId === patch.ownerUserId
                  )
              )
            )
              throw new Error('Checkpoint geometry receipt publication is incomplete.')
            for (const patch of command.result.fogPatches) {
              const fog = await readFogSave(patch.saveId)
              if (
                !fog ||
                fog.status !== 'PUBLISHED' ||
                fog.sceneId !== scene.sceneId ||
                fog.geometrySaveId !== save.id ||
                fog.input.layer.width !== patch.width ||
                fog.input.layer.height !== patch.height ||
                fog.input.chunkManifest.length !== patch.chunkCount
              )
                throw new Error('Checkpoint geometry receipt fog references are inconsistent.')
            }
          }
          if (command.encoding === 'FOG_PATCH') {
            parseFogCommand(command, scene.toVersion)
            const save = await readFogSave(command.result.patch.saveId)
            if (
              !save ||
              save.status !== 'PUBLISHED' ||
              save.sceneId !== scene.sceneId ||
              save.commandId !== command.commandId ||
              save.actorUserId !== command.actorUserId ||
              save.inputChecksum !== command.inputChecksum
            )
              throw new Error('Checkpoint fog receipt publication is incomplete.')
          }
          if (
            command.encoding === 'UNDO' &&
            command.undoneCommandId !== command.result.delta.undoneCommandId
          )
            throw new Error('Checkpoint Scene undo receipt is inconsistent.')
          break
        }
      }
    }
  }
}
