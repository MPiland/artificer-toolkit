import {
  sceneCurrentEntityPageInputSchema,
  sceneCurrentEntityPageSchema,
  type SceneCurrentEntityPage,
  type SceneCurrentEntityPageInput
} from '@artificer-toolkit/schema/api/sceneRecipient'
import {
  type SceneLiveEntity,
  sceneLiveEntitySchema
} from '@artificer-toolkit/schema/api/sceneLiveState'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { parseLiveEntity, readLiveScene } from './liveDocuments'
import { normalizeSceneGeometryEntity } from './geometryValues'

function stored<T extends { _id: unknown; _creationTime: unknown }>(row: T) {
  const { _id, _creationTime, ...value } = row
  return value
}

function normalizeCurrentEntity(value: SceneLiveEntity): SceneLiveEntity {
  if (value.collection === 'tokens' || value.collection === 'barriers')
    return normalizeSceneGeometryEntity(value)
  return value
}

function checkPage(rows: ReadonlyArray<{ ordinal: number; value: SceneLiveEntity }>) {
  const ordinals = new Set<number>()
  const ids = new Set<string>()
  for (const row of rows) {
    if (ordinals.has(row.ordinal))
      throw new Error('Stored Scene geometry ordinals are inconsistent.')
    if (ids.has(row.value.entity.id))
      throw new Error('Stored Scene geometry identities are inconsistent.')
    ordinals.add(row.ordinal)
    ids.add(row.value.entity.id)
  }
}

type LiveSceneRead = Pick<Awaited<ReturnType<typeof readLiveScene>>, 'header' | 'live'>

export async function readCurrentEntitiesFromScene(
  ctx: QueryCtx,
  input: SceneCurrentEntityPageInput,
  scene: LiveSceneRead,
  prefetched?: {
    definitionEntities: readonly Doc<'sceneDefinitionEntities'>[]
    liveEntities: readonly Doc<'sceneLiveEntities'>[]
  }
): Promise<SceneCurrentEntityPage> {
  const parsed = sceneCurrentEntityPageInputSchema.parse(input)
  const { header, live } = scene
  if (
    header.version !== parsed.expectedVersion ||
    header.definitionSaveId !== parsed.definitionSaveId.toLowerCase()
  )
    throw new Error('Live Scene snapshot changed before geometry hydration.')

  const baseCount = parsed.collection === 'measurements' ? 0 : header.counts[parsed.collection]
  const currentCount = header.currentCounts[parsed.collection]
  const nextOrdinal = live?.nextOrdinals[parsed.collection] ?? baseCount
  if (nextOrdinal < baseCount || currentCount > nextOrdinal)
    throw new Error('Stored Scene geometry state is inconsistent.')

  if (parsed.phase === 'BASE') {
    if (parsed.collection === 'measurements')
      return sceneCurrentEntityPageSchema.parse({
        version: header.version,
        collection: parsed.collection,
        page: [],
        next: { phase: 'APPENDED', afterOrdinal: null }
      })

    const collection = parsed.collection
    const result = prefetched
      ? prefetched.definitionEntities
          .filter(
            (row) =>
              row.saveId === header.definitionSaveId &&
              row.value.collection === collection &&
              row.ordinal > (parsed.afterOrdinal ?? -1)
          )
          .sort((left, right) => left.ordinal - right.ordinal)
          .slice(0, parsed.numItems + 1)
      : await ctx.db
          .query('sceneDefinitionEntities')
          .withIndex('by_saveId_collection_ordinal', (q) =>
            q
              .eq('saveId', header.definitionSaveId)
              .eq('value.collection', collection)
              .gt('ordinal', parsed.afterOrdinal ?? -1)
          )
          .take(parsed.numItems + 1)
    // Include lookahead in uniqueness checks so a continuation cannot skip an ordinal collision.
    if (new Set(result.map((row) => row.ordinal)).size !== result.length)
      throw new Error('Stored Scene geometry ordinals are inconsistent.')
    const selected = result.slice(0, parsed.numItems)
    const page = await Promise.all(
      selected.map(async (row) => {
        const source = sceneStoredDefinitionEntitySchema.parse(stored(row))
        if (
          source.saveId !== header.definitionSaveId ||
          source.value.collection !== parsed.collection ||
          source.entityId !== source.value.entity.id ||
          source.ordinal >= baseCount ||
          source.checksum !== checksumCanonicalJson(source.value)
        )
          throw new Error('Stored Scene geometry source is inconsistent.')
        const value = normalizeCurrentEntity(sceneLiveEntitySchema.parse(source.value))
        const matchingOverrides = prefetched?.liveEntities.filter(
          (row) =>
            row.sceneId === header.id &&
            row.collection === parsed.collection &&
            row.entityId === value.entity.id
        )
        if (matchingOverrides && matchingOverrides.length > 1)
          throw new Error('Stored Scene geometry override is inconsistent.')
        const overrideRow = prefetched
          ? (matchingOverrides?.[0] ?? null)
          : await ctx.db
              .query('sceneLiveEntities')
              .withIndex('by_sceneId_collection_entityId', (q) =>
                q
                  .eq('sceneId', header.id)
                  .eq('collection', parsed.collection)
                  .eq('entityId', value.entity.id)
              )
              .unique()
        if (!overrideRow)
          return {
            ordinal: source.ordinal,
            value,
            doorState:
              value.collection === 'barriers' && value.entity.kind === 'DOOR'
                ? value.entity.initialState
                : null
          }
        const override = parseLiveEntity(overrideRow, header.version)
        if (override.value === null) return null
        if (
          override.sceneId !== header.id ||
          override.collection !== parsed.collection ||
          override.ordinal === null ||
          override.ordinal >= nextOrdinal
        )
          throw new Error('Stored Scene geometry override is inconsistent.')
        const overrideValue = normalizeCurrentEntity(sceneLiveEntitySchema.parse(override.value))
        if (override.ordinal < baseCount) {
          if (override.ordinal !== source.ordinal)
            throw new Error('Stored Scene geometry override is inconsistent.')
          return {
            ordinal: source.ordinal,
            value: overrideValue,
            doorState: override.doorState ?? null
          }
        }
        return null
      })
    )
    const filtered = page.filter((row): row is NonNullable<typeof row> => row !== null)
    checkPage(filtered)
    return sceneCurrentEntityPageSchema.parse({
      version: header.version,
      collection: parsed.collection,
      page: filtered,
      next:
        result.length > parsed.numItems
          ? { phase: 'BASE', afterOrdinal: selected.at(-1)!.ordinal }
          : { phase: 'APPENDED', afterOrdinal: null }
    })
  }

  const afterOrdinal = Math.max(baseCount - 1, parsed.afterOrdinal ?? -1)
  const result = prefetched
    ? prefetched.liveEntities
        .filter(
          (row) =>
            row.sceneId === header.id &&
            row.collection === parsed.collection &&
            row.ordinal !== null &&
            row.ordinal > afterOrdinal
        )
        .sort((left, right) => left.ordinal! - right.ordinal!)
        .slice(0, parsed.numItems + 1)
    : await ctx.db
        .query('sceneLiveEntities')
        .withIndex('by_sceneId_collection_ordinal', (q) =>
          q.eq('sceneId', header.id).eq('collection', parsed.collection).gt('ordinal', afterOrdinal)
        )
        .take(parsed.numItems + 1)
  if (new Set(result.map((row) => row.ordinal)).size !== result.length)
    throw new Error('Stored Scene geometry ordinals are inconsistent.')
  const page = result.slice(0, parsed.numItems).map((row) => {
    const value = parseLiveEntity(row, header.version)
    if (
      value.sceneId !== header.id ||
      value.collection !== parsed.collection ||
      value.value === null ||
      value.ordinal === null ||
      value.ordinal < baseCount ||
      value.ordinal >= nextOrdinal
    )
      throw new Error('Stored appended Scene geometry is inconsistent.')
    return {
      ordinal: value.ordinal,
      value: normalizeCurrentEntity(sceneLiveEntitySchema.parse(value.value)),
      doorState: value.doorState ?? null
    }
  })
  checkPage(page)
  return sceneCurrentEntityPageSchema.parse({
    version: header.version,
    collection: parsed.collection,
    page,
    next:
      result.length > parsed.numItems
        ? { phase: 'APPENDED', afterOrdinal: page.at(-1)!.ordinal }
        : null
  })
}

export async function readCurrentEntities(
  ctx: QueryCtx,
  input: SceneCurrentEntityPageInput,
  scope: 'OWNER' | 'MEMBER'
): Promise<SceneCurrentEntityPage> {
  const parsed = sceneCurrentEntityPageInputSchema.parse(input)
  return readCurrentEntitiesFromScene(ctx, parsed, await readLiveScene(ctx, parsed.sceneId, scope))
}
