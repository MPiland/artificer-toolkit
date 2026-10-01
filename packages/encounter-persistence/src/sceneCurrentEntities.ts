import {
  sceneCurrentEntityPageInputSchema,
  sceneCurrentEntityPageSchema,
  type SceneCurrentEntityPage,
  type SceneCurrentEntityPageInput
} from '@artificer-toolkit/schema/api/sceneRecipient'
import {
  sceneLiveEntitySchema,
  type SceneLiveEntity,
  type SceneLiveStateHeader
} from '@artificer-toolkit/schema/api/sceneLiveState'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import type {
  sceneStoredLiveEntitySchema,
  sceneStoredLiveStateSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { normalizeSceneGeometryEntity } from './sceneGeometryValues.js'
import { parseSceneLiveEntity } from './sceneLiveState.js'

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

/** Page readers return at most `numItems + 1` stored rows, including the continuation lookahead. */
export async function readSceneCurrentEntities(
  input: SceneCurrentEntityPageInput,
  scene: {
    header: SceneLiveStateHeader
    live: ReturnType<typeof sceneStoredLiveStateSchema.parse> | null
  },
  readers: {
    readDefinitionEntities(input: {
      saveId: string
      collection: Exclude<SceneCurrentEntityPageInput['collection'], 'measurements'>
      afterOrdinal: number
      numItems: number
    }): Promise<readonly ReturnType<typeof sceneStoredDefinitionEntitySchema.parse>[]>
    readLiveEntity(input: {
      sceneId: string
      collection: SceneCurrentEntityPageInput['collection']
      entityId: string
    }): Promise<ReturnType<typeof sceneStoredLiveEntitySchema.parse> | null>
    readLiveEntities(input: {
      sceneId: string
      collection: SceneCurrentEntityPageInput['collection']
      afterOrdinal: number
      numItems: number
    }): Promise<readonly ReturnType<typeof sceneStoredLiveEntitySchema.parse>[]>
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
    const result = await readers.readDefinitionEntities({
      saveId: header.definitionSaveId,
      collection: parsed.collection,
      afterOrdinal: parsed.afterOrdinal ?? -1,
      numItems: parsed.numItems
    })
    // Include lookahead in uniqueness checks so a continuation cannot skip an ordinal collision.
    if (new Set(result.map((row) => row.ordinal)).size !== result.length)
      throw new Error('Stored Scene geometry ordinals are inconsistent.')
    const selected = result.slice(0, parsed.numItems)
    const page = await Promise.all(
      selected.map(async (row) => {
        const source = sceneStoredDefinitionEntitySchema.parse(row)
        if (
          source.saveId !== header.definitionSaveId ||
          source.value.collection !== parsed.collection ||
          source.entityId !== source.value.entity.id ||
          source.ordinal >= baseCount ||
          source.checksum !== checksumCanonicalJson(source.value)
        )
          throw new Error('Stored Scene geometry source is inconsistent.')
        const value = normalizeCurrentEntity(sceneLiveEntitySchema.parse(source.value))
        const overrideRow = await readers.readLiveEntity({
          sceneId: header.id,
          collection: parsed.collection,
          entityId: value.entity.id
        })
        if (!overrideRow)
          return {
            ordinal: source.ordinal,
            value,
            doorState:
              value.collection === 'barriers' && value.entity.kind === 'DOOR'
                ? value.entity.initialState
                : null
          }
        const override = parseSceneLiveEntity(overrideRow, header.version)
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
  const result = await readers.readLiveEntities({
    sceneId: header.id,
    collection: parsed.collection,
    afterOrdinal,
    numItems: parsed.numItems
  })
  if (new Set(result.map((row) => row.ordinal)).size !== result.length)
    throw new Error('Stored Scene geometry ordinals are inconsistent.')
  const page = result.slice(0, parsed.numItems).map((row) => {
    const value = parseSceneLiveEntity(row, header.version)
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
