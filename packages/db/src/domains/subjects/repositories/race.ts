import {
  MEASUREMENT_UNIT_CODE,
  RACE_CATEGORY_CODE,
  RACE_SELECTION_MODE,
  SIZE_CODE,
  resolveRaceAuthored,
  type RaceAuthored,
  type ResolvedRace
} from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertRace } from '../upserts/race.js'
import { createDetailRepository } from '../../shared/repositories/detail.js'
import { createFeatureRepository } from '../../features/repositories/feature.js'
import type { RaceRepository, RepositoryFindAllOptions } from '../../../repositories/contracts.js'
import { orderedHydratedRecords, uniqueIds } from '../../../repositories/batch.js'
import { hydrateSubjectStatus } from '../status.js'

export interface RaceRepositoryReadOptions extends RepositoryFindAllOptions {
  allowedFeatureIds?: ReadonlySet<string>
  includeFeatureEffects?: boolean
}

export type RaceRepositoryWithReadOptions = Omit<
  RaceRepository,
  'findById' | 'findByIds' | 'findResolvedById'
> & {
  findById(id: string, filter?: RaceRepositoryReadOptions): Promise<RaceAuthored | null>
  findByIds(
    ids: readonly string[],
    filter?: RaceRepositoryReadOptions
  ): Promise<Map<string, RaceAuthored>>
  findResolvedById(
    id: string,
    filter?: RaceRepositoryReadOptions
  ): Promise<ResolvedRace | null>
}

const RACE_COLUMNS = [
  'id',
  'system_id',
  'user_id',
  'label',
  'quote',
  'description',
  'status',
  'category',
  'selection_mode',
  'parent_race_id',
  'size_code'
] as const

type RaceRow = {
  id: string
  system_id: string
  user_id: string | null
  label: string
  quote: string | null
  description: string | null
  status: string
  category: string
  selection_mode: string | null
  parent_race_id: string | null
  size_code: string | null
}

type RaceAncestryOptionRow = {
  id: string
  ancestry_id: string
  label: string
  description: string | null
  sort_order: number
}

type RaceAncestryOptionFeatureLinkRow = {
  ancestry_option_id: string
  feature_id: string
  sort_order: number
}

type RaceOwnedRow = { race_id: string }

function requireLinkedRecord<T>(
  value: T | null,
  message: string
): T {
  if (value === null) {
    throw new Error(message)
  }

  return value
}

function requireAncestryOptionDescription(
  raceId: string,
  optionId: string,
  value: string | null
): string {
  if (value == null) {
    throw new Error(`Race "${raceId}" ancestry option "${optionId}" is missing description.`)
  }

  return value
}

function requireRaceCategory(
  raceId: string,
  value: string
): RaceAuthored['category'] {
  if (value !== RACE_CATEGORY_CODE.BASE && value !== RACE_CATEGORY_CODE.SUBRACE) {
    throw new Error(`Race "${raceId}" has invalid category "${value}".`)
  }

  return value
}

function requireSelectionMode(
  raceId: string,
  value: string
): Extract<RaceAuthored, { category: 'BASE' }>['selectionMode'] {
  if (
    value !== RACE_SELECTION_MODE.DIRECT
    && value !== RACE_SELECTION_MODE.REQUIRES_SUBRACE
  ) {
    throw new Error(`Race "${raceId}" has invalid selection_mode "${value}".`)
  }

  return value
}

function requireSizeCode(
  raceId: string,
  value: string
): Extract<RaceAuthored, { category: 'BASE' }>['size'] {
  if (!(value in SIZE_CODE)) {
    throw new Error(`Race "${raceId}" has invalid size_code "${value}".`)
  }

  return value as Extract<RaceAuthored, { category: 'BASE' }>['size']
}

function requireMeasurementUnit(
  raceId: string,
  speedId: string,
  value: string
): Extract<RaceAuthored, { category: 'BASE' }>['speeds'][number]['unit'] {
  if (!(value in MEASUREMENT_UNIT_CODE)) {
    throw new Error(`Race "${raceId}" speed "${speedId}" has invalid unit_code "${value}".`)
  }

  return value as Extract<RaceAuthored, { category: 'BASE' }>['speeds'][number]['unit']
}

async function hydrateRaceById(
  db: DBLike,
  id: string,
  options: RaceRepositoryReadOptions = {}
): Promise<RaceAuthored | null> {
  const racesById = await hydrateRacesByIds(db, [id], options)
  return racesById.get(id) ?? null
}

function groupRaceRows<T extends RaceOwnedRow>(rows: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>()

  for (const row of rows) {
    const bucket = grouped.get(row.race_id)
    if (bucket) {
      bucket.push(row)
    } else {
      grouped.set(row.race_id, [row])
    }
  }

  return grouped
}

async function hydrateRaceRows(
  db: DBLike,
  rows: readonly RaceRow[],
  options: RaceRepositoryReadOptions = {}
): Promise<Map<string, RaceAuthored>> {
  const raceIds = rows.map((row) => row.id)
  if (raceIds.length === 0) {
    return new Map()
  }

  const [featureLinks, ancestryRows, detailLinks, speedRows, heritageRows] = await Promise.all([
    db.selectFrom('race_features').select(['race_id', 'feature_id', 'sort_order']).where('race_id', 'in', raceIds).orderBy('sort_order').execute(),
    db.selectFrom('race_ancestries').select(['id', 'race_id', 'label', 'description']).where('race_id', 'in', raceIds).execute(),
    db.selectFrom('race_details').select(['race_id', 'detail_id', 'sort_order']).where('race_id', 'in', raceIds).orderBy('sort_order').execute(),
    db.selectFrom('race_speeds').select(['race_id', 'speed_id', 'amount', 'unit_code']).where('race_id', 'in', raceIds).orderBy('speed_id').execute(),
    db.selectFrom('race_heritages').select(['race_id', 'heritage_id', 'sort_order']).where('race_id', 'in', raceIds).orderBy('sort_order').execute()
  ])
  const ancestryIds = ancestryRows.map((ancestry) => ancestry.id)
  const optionRows: RaceAncestryOptionRow[] = ancestryIds.length > 0
    ? await db.selectFrom('race_ancestry_options')
        .select(['id', 'ancestry_id', 'label', 'description', 'sort_order'])
        .where('ancestry_id', 'in', ancestryIds)
        .orderBy('sort_order')
        .execute()
    : []
  const optionIds = optionRows.map((option) => option.id)
  const optionFeatureLinks: RaceAncestryOptionFeatureLinkRow[] = optionIds.length > 0
    ? await db.selectFrom('race_ancestry_option_features')
        .select(['ancestry_option_id', 'feature_id', 'sort_order'])
        .where('ancestry_option_id', 'in', optionIds)
        .orderBy('sort_order')
        .execute()
    : []
  const selectedFeatureLinks = options.allowedFeatureIds
    ? featureLinks.filter((link) => options.allowedFeatureIds?.has(link.feature_id))
    : featureLinks
  const selectedOptionFeatureLinks = options.allowedFeatureIds
    ? optionFeatureLinks.filter((link) => options.allowedFeatureIds?.has(link.feature_id))
    : optionFeatureLinks
  const detailRepository = createDetailRepository(db)
  const featureLinksByRace = groupRaceRows(selectedFeatureLinks)
  const ancestryByRace = groupRaceRows(ancestryRows)
  const optionsByAncestry = new Map<string, RaceAncestryOptionRow[]>()

  for (const option of optionRows) {
    optionsByAncestry.set(option.ancestry_id, [
      ...(optionsByAncestry.get(option.ancestry_id) ?? []),
      option
    ])
  }

  const optionFeaturesByOption = new Map<string, RaceAncestryOptionFeatureLinkRow[]>()
  for (const link of selectedOptionFeatureLinks) {
    optionFeaturesByOption.set(link.ancestry_option_id, [
      ...(optionFeaturesByOption.get(link.ancestry_option_id) ?? []),
      link
    ])
  }

  const [detailsById, featuresById] = await Promise.all([
    detailRepository.findByIds(detailLinks.map((link) => link.detail_id)),
    createFeatureRepository(db).findByIds([
      ...selectedFeatureLinks.map((link) => link.feature_id),
      ...selectedOptionFeatureLinks.map((link) => link.feature_id)
    ], { includeEffects: options.includeFeatureEffects })
  ])
  const detailLinksByRace = groupRaceRows(detailLinks)
  const speedsByRace = groupRaceRows(speedRows)
  const heritagesByRace = groupRaceRows(heritageRows)
  const authoredById = new Map<string, RaceAuthored>()

  for (const row of rows) {
    if (!row.user_id) {
      throw new Error(`Race "${row.id}" is missing user ownership and cannot be hydrated.`)
    }

    const id = row.id
    const authoredDetails = (detailLinksByRace.get(id) ?? []).map((link) => requireLinkedRecord(
      detailsById.get(link.detail_id) ?? null,
      `Race "${id}" is linked to missing detail "${link.detail_id}".`
    ))
    const authoredFeatures = (featureLinksByRace.get(id) ?? []).map((link) => requireLinkedRecord(
      featuresById.get(link.feature_id) ?? null,
      `Race "${id}" is linked to missing feature "${link.feature_id}".`
    ))
    const ancestry = ancestryByRace.get(id)?.[0]
    const authoredAncestry = ancestry
      ? {
          id: ancestry.id,
          label: ancestry.label,
          description: ancestry.description ?? undefined,
          options: (optionsByAncestry.get(ancestry.id) ?? []).map((option) => {
            const links = optionFeaturesByOption.get(option.id) ?? []
            return {
              id: option.id,
              label: option.label,
              description: requireAncestryOptionDescription(id, option.id, option.description),
              order: option.sort_order,
              features: links.length > 0
                ? links.map((link) => requireLinkedRecord(
                    featuresById.get(link.feature_id) ?? null,
                    `Race "${id}" ancestry option "${option.id}" is linked to missing feature "${link.feature_id}".`
                  ))
                : undefined
            }
          })
        }
      : undefined
    const authoredSpeeds = (speedsByRace.get(id) ?? []).map((speed) => ({
      speedId: speed.speed_id,
      amount: speed.amount,
      unit: requireMeasurementUnit(id, speed.speed_id, speed.unit_code)
    }))
    const heritageIds = (heritagesByRace.get(id) ?? []).map((entry) => entry.heritage_id)
    const category = requireRaceCategory(id, row.category)
    const common = {
      id,
      label: row.label,
      quote: row.quote ?? undefined,
      description: row.description ?? undefined,
      status: hydrateSubjectStatus(row.status),
      details: authoredDetails.length > 0 ? authoredDetails : undefined,
      features: authoredFeatures.length > 0 ? authoredFeatures : undefined,
      userId: row.user_id,
      systemId: row.system_id
    }

    if (category === RACE_CATEGORY_CODE.BASE) {
      if (row.selection_mode == null) {
        throw new Error(`Race "${id}" is missing selection_mode for BASE payload.`)
      }
      if (!row.size_code) {
        throw new Error(`Race "${id}" is missing size_code for BASE payload.`)
      }

      authoredById.set(id, {
        ...common,
        heritageIds: heritageIds.length > 0 ? heritageIds : undefined,
        category,
        selectionMode: requireSelectionMode(id, row.selection_mode),
        ancestry: authoredAncestry,
        size: requireSizeCode(id, row.size_code),
        speeds: authoredSpeeds
      })
      continue
    }

    authoredById.set(id, {
      ...common,
      category,
      parentRaceId: requireLinkedRecord(
        row.parent_race_id,
        `Race "${id}" is missing parent_race_id for SUBRACE payload.`
      )
    })
  }

  return authoredById
}

async function hydrateRacesByIds(
  db: DBLike,
  ids: readonly string[],
  options: RaceRepositoryReadOptions = {}
): Promise<Map<string, RaceAuthored>> {
  const distinctIds = uniqueIds(ids)
  if (distinctIds.length === 0) {
    return new Map()
  }

  const rows = await db.selectFrom('races').select(RACE_COLUMNS).where('id', 'in', distinctIds).execute() as RaceRow[]
  const rowsById = new Map(rows.map((row) => [row.id, row]))

  return hydrateRaceRows(db, distinctIds.flatMap((id) => {
    const row = rowsById.get(id)
    return row ? [row] : []
  }), options)
}

export function createRaceRepository(db: DBLike): RaceRepositoryWithReadOptions {
  async function loadRaceLineage(
    id: string,
    cache: Map<string, RaceAuthored | null>,
    options: RaceRepositoryReadOptions
  ): Promise<RaceAuthored | null> {
    if (cache.has(id)) {
      return cache.get(id) ?? null
    }

    const authored = await hydrateRaceById(db, id, options)
    cache.set(id, authored)

    if (authored?.category === RACE_CATEGORY_CODE.SUBRACE) {
      await loadRaceLineage(authored.parentRaceId, cache, options)
    }

    return authored
  }

  async function hydrateResolvedRaceById(
    id: string,
    options: RaceRepositoryReadOptions = {}
  ): Promise<ResolvedRace | null> {
    const cache = new Map<string, RaceAuthored | null>()
    const authored = await loadRaceLineage(id, cache, options)

    if (!authored) {
      return null
    }

    return resolveRaceAuthored(
      authored,
      (parentId: string) => cache.get(parentId) ?? undefined
    )
  }

  return {
    async upsert(entity) {
      await upsertRace(db, entity, entity.systemId)
    },

    async findById(id, filter) {
      return hydrateRaceById(db, id, filter)
    },

    async findByIds(ids, filter) {
      return hydrateRacesByIds(db, ids, filter)
    },

    async findResolvedById(id, filter) {
      return hydrateResolvedRaceById(id, filter)
    },

    async findAll(filter?: RepositoryFindAllOptions) {
      let query = db
        .selectFrom('races')
        .select(RACE_COLUMNS)
        .orderBy('label')

      if (filter?.systemId) {
        query = query.where('system_id', '=', filter.systemId)
      }

      if (filter?.userId) {
        query = query.where('user_id', '=', filter.userId)
      }

      const rows = await query.execute()
      return orderedHydratedRecords(
        rows.map((row) => row.id),
        await hydrateRaceRows(db, rows as RaceRow[])
      )
    },

    async findResolvedAll(filter?: RepositoryFindAllOptions) {
      let query = db
        .selectFrom('races')
        .select(RACE_COLUMNS)
        .orderBy('label')

      if (filter?.systemId) {
        query = query.where('system_id', '=', filter.systemId)
      }

      if (filter?.userId) {
        query = query.where('user_id', '=', filter.userId)
      }

      const rows = await query.execute() as RaceRow[]
      const rowsById = new Map(rows.map((row) => [row.id, row]))
      let missingParentIds = uniqueIds(rows.flatMap((row) =>
        row.parent_race_id && !rowsById.has(row.parent_race_id) ? [row.parent_race_id] : []
      ))

      while (missingParentIds.length > 0) {
        const parentRows = await db
          .selectFrom('races')
          .select(RACE_COLUMNS)
          .where('id', 'in', missingParentIds)
          .execute() as RaceRow[]

        for (const parentRow of parentRows) {
          rowsById.set(parentRow.id, parentRow)
        }

        if (parentRows.length === 0) {
          break
        }

        missingParentIds = uniqueIds(parentRows.flatMap((parentRow) =>
          parentRow.parent_race_id && !rowsById.has(parentRow.parent_race_id)
            ? [parentRow.parent_race_id]
            : []
        ))
      }

      const cache = await hydrateRaceRows(db, [...rowsById.values()])

      return rows.flatMap((row) => {
        const authored = cache.get(row.id)

        if (!authored) {
          return []
        }

        return [
          resolveRaceAuthored(
            authored,
            (parentId: string) => cache.get(parentId) ?? undefined
          )
        ]
      })
    }
  }
}
