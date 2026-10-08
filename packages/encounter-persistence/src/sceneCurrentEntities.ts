import {
  sceneCurrentEntityPageInputSchema,
  sceneCurrentEntityPageSchema,
  type SceneCurrentEntityPage,
  type SceneCurrentEntityPageInput
} from '@artificer-toolkit/schema/api/sceneRecipient'
import type { SceneBaseOrdinals } from '@artificer-toolkit/schema/api/sceneGeometry'
import {
  campaignSceneStateDtoSchema,
  type CampaignSceneStateDto
} from '@artificer-toolkit/schema/api/vttScenes'
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

export const sceneCurrentCollections = [
  'annotations',
  'barriers',
  'darknessZones',
  'lights',
  'tokens',
  'measurements'
] as const

type SceneCurrentEntityPages = Record<
  (typeof sceneCurrentCollections)[number],
  SceneCurrentEntityPage['page']
>

/**
 * The Scene state a complete set of current-entity pages describes, with each token's and barrier's
 * definition ordinal (`null` once appended). Convex and the room share it so both build the same
 * Scene from the same rows; `fogLayers` are the stored layers to include, in owner order, and
 * `keep` drops the rows a viewer may not see.
 */
export function assembleCurrentScene(
  header: SceneLiveStateHeader,
  allPages: SceneCurrentEntityPages,
  fogLayers: CampaignSceneStateDto['fogLayers'],
  keep: (row: SceneCurrentEntityPage['page'][number]) => boolean = () => true
): { scene: CampaignSceneStateDto; baseOrdinals: SceneBaseOrdinals } {
  const pages = {
    annotations: allPages.annotations.filter(keep),
    barriers: allPages.barriers.filter(keep),
    darknessZones: allPages.darknessZones.filter(keep),
    lights: allPages.lights.filter(keep),
    measurements: allPages.measurements.filter(keep),
    tokens: allPages.tokens.filter(keep)
  }
  const doorStates: CampaignSceneStateDto['doorStates'] = {}
  for (const row of pages.barriers) {
    if (row.value.collection === 'barriers' && row.value.entity.kind === 'DOOR') {
      if (row.doorState === null) throw new Error('Current Scene door state is inconsistent.')
      doorStates[row.value.entity.id] = row.doorState
    }
  }
  const {
    definitionSaveId: _definitionSaveId,
    counts: _counts,
    currentCounts: _currentCounts,
    fogLayerCount: _fogLayerCount,
    ...state
  } = header
  const baseOrdinal = (collection: 'tokens' | 'barriers', ordinal: number) =>
    ordinal < header.counts[collection] ? ordinal : null
  return {
    scene: campaignSceneStateDtoSchema.parse({
      ...state,
      annotations: pages.annotations.map((row) => row.value.entity),
      barriers: pages.barriers.map((row) => row.value.entity),
      darknessZones: pages.darknessZones.map((row) => row.value.entity),
      doorStates,
      fogLayers,
      lights: pages.lights.map((row) => row.value.entity),
      measurements: pages.measurements.map((row) => row.value.entity),
      tokens: pages.tokens.map((row) => row.value.entity)
    }),
    baseOrdinals: {
      tokens: pages.tokens.map((row) => ({
        tokenId: row.value.entity.id,
        baseOrdinal: baseOrdinal('tokens', row.ordinal)
      })),
      barriers: pages.barriers.map((row) => ({
        barrierId: row.value.entity.id,
        baseOrdinal: baseOrdinal('barriers', row.ordinal)
      }))
    }
  }
}

/** Reads every current entity of every collection through a page reader, verifying live counts. */
export async function readAllCurrentEntityPages(
  header: SceneLiveStateHeader,
  readPage: (input: SceneCurrentEntityPageInput) => Promise<SceneCurrentEntityPage>
): Promise<SceneCurrentEntityPages> {
  const read = (collection: (typeof sceneCurrentCollections)[number]) =>
    readAllCurrentEntities(header, collection, readPage)
  const [annotations, barriers, darknessZones, lights, measurements, tokens] = await Promise.all([
    read('annotations'),
    read('barriers'),
    read('darknessZones'),
    read('lights'),
    read('measurements'),
    read('tokens')
  ])
  return { annotations, barriers, darknessZones, lights, measurements, tokens }
}

async function readAllCurrentEntities(
  header: SceneLiveStateHeader,
  collection: (typeof sceneCurrentCollections)[number],
  readPage: (input: SceneCurrentEntityPageInput) => Promise<SceneCurrentEntityPage>
): Promise<SceneCurrentEntityPage['page']> {
  const rows: SceneCurrentEntityPage['page'] = []
  let next: SceneCurrentEntityPage['next'] = { phase: 'BASE', afterOrdinal: null }
  while (next) {
    const page: SceneCurrentEntityPage = await readPage({
      sceneId: header.id,
      expectedVersion: header.version,
      definitionSaveId: header.definitionSaveId,
      collection,
      numItems: 8,
      ...next
    })
    if (page.version !== header.version || page.collection !== collection)
      throw new Error('Current Scene page is inconsistent.')
    rows.push(...page.page)
    if (rows.length > header.currentCounts[collection])
      throw new Error('Current Scene entity count is inconsistent.')
    next = page.next
  }
  if (
    rows.length !== header.currentCounts[collection] ||
    new Set(rows.map(({ value }) => value.entity.id)).size !== rows.length
  )
    throw new Error('Current Scene entities are inconsistent.')
  return rows
}
