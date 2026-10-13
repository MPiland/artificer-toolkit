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
import { readLiveSceneForUser } from '../scenes/liveDocuments'
import { parseSceneLiveEntity } from '@artificer-toolkit/encounter-persistence/sceneLiveState'
import {
  parseSceneFogLayer,
  parseSceneFogSave,
  parseSceneReferencedFogChunk
} from '@artificer-toolkit/encounter-persistence/sceneFogDocuments'
import { requireCampaignLiveAuthority } from './authorityGuard'

interface SceneIndexRange extends IndexRange {
  eq(field: string, value: string | number | null): SceneIndexRange
}

function withoutSystemFields<Row extends { _id: unknown; _creationTime: unknown }>(row: Row) {
  const { _id, _creationTime, ...fields } = row
  return fields
}

function content<Row extends { _id: unknown; _creationTime: unknown }>(row: Row) {
  return canonicalJsonRecordSchema.parse(JSON.parse(canonicalizeJson(withoutSystemFields(row))))
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
  frame: { campaignId: string; epoch: string; checkpointId: string },
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
      // The one read of this record: the checksum fence (Amendment 18) and the append-only check.
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
        throw new Error('Checkpoint Scene saves are append-only.')
      const next = liveSessionCheckpointSceneSchemas[change.table].parse(value)
      if (
        change.table === 'sceneLiveEntities' &&
        'value' in next &&
        next.value?.collection === 'tokens' &&
        next.value.entity.senses.length
      )
        throw new Error('Checkpoint Scene saves never store token senses.')
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
    // Reader invariants run on the values about to be written (ADR 0035 Amendment 27): a row this
    // checkpoint writes is never read back. Only rows from earlier checkpoints are read, and each
    // distinct save and tile once, because repeated 256-entry manifests can exhaust the read limit.
    const fogSaves = new Map<string, WithoutSystemFields<Doc<'sceneFogSaves'>> | null>()
    const fogChunks = new Map<string, WithoutSystemFields<Doc<'sceneFogChunks'>> | null>()
    for (const written of rows) {
      if (written.table === 'sceneFogSaves' && written.next) {
        const save = written.next as WithoutSystemFields<Doc<'sceneFogSaves'>>
        fogSaves.set(save.id, save)
      }
      if (written.table === 'sceneFogChunks' && written.next) {
        const chunk = written.next as WithoutSystemFields<Doc<'sceneFogChunks'>>
        fogChunks.set(`${chunk.saveId}:${chunk.ordinal}`, chunk)
      }
    }
    const readFogSave = async (id: string) => {
      if (!fogSaves.has(id)) {
        const row = await ctx.db
          .query('sceneFogSaves')
          .withIndex('by_publicId', (q) => q.eq('id', id))
          .unique()
        fogSaves.set(id, row && withoutSystemFields(row))
      }
      return fogSaves.get(id) ?? null
    }
    const checkedChunks = new Set<string>()
    const checkChunk = async (
      reference: Doc<'sceneFogLayers'>['chunks'][number],
      layer: Doc<'sceneFogSaves'>['input']['layer']
    ) => {
      const identity = canonicalizeJson([reference, layer.ownerUserId, layer.width, layer.height])
      if (checkedChunks.has(identity)) return
      const chunkKey = `${reference.saveId}:${reference.ordinal}`
      if (!fogChunks.has(chunkKey)) {
        const row = await ctx.db
          .query('sceneFogChunks')
          .withIndex('by_saveId_ordinal', (q) =>
            q.eq('saveId', reference.saveId).eq('ordinal', reference.ordinal)
          )
          .unique()
        fogChunks.set(chunkKey, row && withoutSystemFields(row))
      }
      parseSceneReferencedFogChunk(
        await readFogSave(reference.saveId),
        fogChunks.get(chunkKey) ?? null,
        reference,
        scene.sceneId,
        layer
      )
      checkedChunks.add(identity)
    }
    // An ordinal is unique in the final state: no two written rows claim it, and an unwritten row
    // from an earlier checkpoint does not hold it.
    const claimedOrdinals = new Set<string>()
    const claimOrdinal = (slot: string) => {
      if (claimedOrdinals.has(slot)) throw new Error('Checkpoint Scene ordinal is claimed twice.')
      claimedOrdinals.add(slot)
    }
    for (const written of rows) {
      if (!written.next) continue
      switch (written.table) {
        case 'sceneLiveEntities': {
          const entity = written.next as WithoutSystemFields<Doc<'sceneLiveEntities'>>
          parseSceneLiveEntity(entity, scene.toVersion)
          if (entity.ordinal === null) break
          claimOrdinal(`entity:${entity.collection}:${entity.ordinal}`)
          const holder = await ctx.db
            .query('sceneLiveEntities')
            .withIndex('by_sceneId_collection_ordinal', (q) =>
              q
                .eq('sceneId', scene.sceneId)
                .eq('collection', entity.collection)
                .eq('ordinal', entity.ordinal)
            )
            .unique()
          if (
            holder &&
            !identities.has(
              `sceneLiveEntities:${canonicalizeJson([scene.sceneId, holder.collection, holder.entityId])}`
            )
          )
            throw new Error('Checkpoint Scene entity ordinal is already allocated.')
          break
        }
        case 'sceneFogLayers': {
          const layer = parseSceneFogLayer(written.next, scene.toVersion)
          claimOrdinal(`fog:${layer.ordinal}`)
          const holder = await ctx.db
            .query('sceneFogLayers')
            .withIndex('by_sceneId_ordinal', (q) =>
              q.eq('sceneId', scene.sceneId).eq('ordinal', layer.ordinal)
            )
            .unique()
          if (
            holder &&
            !identities.has(
              `sceneFogLayers:${canonicalizeJson([scene.sceneId, holder.ownerUserId])}`
            )
          )
            throw new Error('Checkpoint Scene fog ordinal is already allocated.')
          for (const reference of layer.chunks) await checkChunk(reference, layer)
          break
        }
        case 'sceneFogSaves': {
          const save = parseSceneFogSave(written.next)
          if (save.status !== 'PUBLISHED') throw new Error('Checkpoint fog save is incomplete.')
          for (const [ordinal, manifest] of save.input.chunkManifest.entries())
            await checkChunk({ ...manifest, saveId: save.id, ordinal }, save.input.layer)
          break
        }
        case 'sceneFogChunks': {
          const chunk = written.next as WithoutSystemFields<Doc<'sceneFogChunks'>>
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
      }
    }
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
  }
}
