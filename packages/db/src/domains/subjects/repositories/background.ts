import type { BackgroundAuthored } from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertBackground } from '../upserts/background.js'
import type { BackgroundRepository, RepositoryFindAllOptions } from '../../../repositories/contracts.js'
import { orderedHydratedRecords, uniqueIds } from '../../../repositories/batch.js'
import { hydrateSubjectStatus } from '../status.js'

export interface BackgroundRepositoryReadOptions extends RepositoryFindAllOptions {
  allowedFeatureIds?: ReadonlySet<string>
  includeFeatureEffects?: boolean
}

export type BackgroundRepositoryWithReadOptions = Omit<
  BackgroundRepository,
  'findById' | 'findByIds'
> & {
  findById(id: string, filter?: BackgroundRepositoryReadOptions): Promise<BackgroundAuthored | null>
  findByIds(
    ids: readonly string[],
    filter?: BackgroundRepositoryReadOptions
  ): Promise<Map<string, BackgroundAuthored>>
}

const BACKGROUND_COLUMNS = [
  'id',
  'system_id',
  'user_id',
  'label',
  'description',
  'status',
  'starting_equipment_id'
] as const

type BackgroundRow = {
  id: string
  system_id: string
  user_id: string | null
  label: string
  description: string | null
  status: string
  starting_equipment_id: string | null
}

type BackgroundOwnedRow = { background_id: string }

function requireLinkedRecord<T>(
  value: T | null,
  message: string
): T {
  if (value === null) {
    throw new Error(message)
  }

  return value
}

async function hydrateBackgroundById(
  db: DBLike,
  id: string,
  options: BackgroundRepositoryReadOptions = {}
): Promise<BackgroundAuthored | null> {
  const backgroundsById = await hydrateBackgroundsByIds(db, [id], options)
  return backgroundsById.get(id) ?? null
}

function groupBackgroundRows<T extends BackgroundOwnedRow>(rows: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>()

  for (const row of rows) {
    const bucket = grouped.get(row.background_id)
    if (bucket) {
      bucket.push(row)
    } else {
      grouped.set(row.background_id, [row])
    }
  }

  return grouped
}

async function hydrateBackgroundRows(
  db: DBLike,
  rows: readonly BackgroundRow[],
  options: BackgroundRepositoryReadOptions = {}
): Promise<Map<string, BackgroundAuthored>> {
  const backgroundIds = rows.map((row) => row.id)
  if (backgroundIds.length === 0) {
    return new Map()
  }

  const [
    detailRepositoryModule,
    featureRepositoryModule,
    proficiencyRepositoryModule,
    startingEquipmentRepositoryModule,
    detailLinks,
    featureLinks,
    proficiencyLinks
  ] = await Promise.all([
    import('../../shared/repositories/detail.js'),
    import('../../features/repositories/feature.js'),
    import('../../grants/repositories/proficiency.js'),
    import('../../shared/repositories/starting_equipment.js'),
    db.selectFrom('background_details')
      .select(['background_id', 'detail_id', 'sort_order'])
      .where('background_id', 'in', backgroundIds)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('background_features')
      .select(['background_id', 'feature_id', 'sort_order'])
      .where('background_id', 'in', backgroundIds)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('background_proficiency_grants')
      .select(['background_id', 'proficiency_grant_id', 'sort_order'])
      .where('background_id', 'in', backgroundIds)
      .orderBy('sort_order')
      .execute()
  ])
  const detailRepository = detailRepositoryModule.createDetailRepository(db)
  const proficiencyRepository = proficiencyRepositoryModule.createProficiencyGrantRepository(db)
  const startingEquipmentRepository = startingEquipmentRepositoryModule.createStartingEquipmentRepository(db)
  const startingEquipmentIds = rows.flatMap((row) =>
    row.starting_equipment_id ? [row.starting_equipment_id] : []
  )
  const selectedFeatureLinks = options.allowedFeatureIds
    ? featureLinks.filter((link) => options.allowedFeatureIds?.has(link.feature_id))
    : featureLinks
  const featureLinksByBackground = groupBackgroundRows(selectedFeatureLinks)
  const [detailsById, featuresById, proficienciesById, startingEquipmentById] = await Promise.all([
    detailRepository.findByIds(detailLinks.map((link) => link.detail_id)),
    featureRepositoryModule.createFeatureRepository(db).findByIds(
      selectedFeatureLinks.map((link) => link.feature_id),
      { includeEffects: options.includeFeatureEffects }
    ),
    proficiencyRepository.findByIds(proficiencyLinks.map((link) => link.proficiency_grant_id)),
    startingEquipmentRepository.findByIds(startingEquipmentIds)
  ])
  const detailLinksByBackground = groupBackgroundRows(detailLinks)
  const proficiencyLinksByBackground = groupBackgroundRows(proficiencyLinks)
  const authoredById = new Map<string, BackgroundAuthored>()

  for (const row of rows) {
    if (!row.user_id) {
      throw new Error(`Background "${row.id}" is missing user ownership and cannot be hydrated.`)
    }

    const id = row.id
    const authoredDetails = (detailLinksByBackground.get(id) ?? []).map((link) =>
      requireLinkedRecord(
        detailsById.get(link.detail_id) ?? null,
        `Background "${id}" is linked to missing detail "${link.detail_id}".`
      )
    )
    const authoredFeatures = (featureLinksByBackground.get(id) ?? []).map((link) =>
      requireLinkedRecord(
        featuresById.get(link.feature_id) ?? null,
        `Background "${id}" is linked to missing feature "${link.feature_id}".`
      )
    )
    const authoredProficiencies = (proficiencyLinksByBackground.get(id) ?? []).map((link) =>
      requireLinkedRecord(
        proficienciesById.get(link.proficiency_grant_id) ?? null,
        `Background "${id}" is linked to missing proficiency grant "${link.proficiency_grant_id}".`
      )
    )
    const startingEquipment = row.starting_equipment_id
      ? requireLinkedRecord(
          startingEquipmentById.get(row.starting_equipment_id) ?? null,
          `Background "${id}" is linked to missing starting equipment "${row.starting_equipment_id}".`
        )
      : null

    authoredById.set(id, {
      kind: 'BACKGROUND',
      id,
      label: row.label,
      description: row.description ?? undefined,
      status: hydrateSubjectStatus(row.status),
      details: authoredDetails.length > 0 ? authoredDetails : undefined,
      features: authoredFeatures.length > 0 ? authoredFeatures : undefined,
      startingEquipment: startingEquipment ?? undefined,
      proficiencies: authoredProficiencies.length > 0 ? authoredProficiencies : undefined,
      userId: row.user_id,
      systemId: row.system_id
    })
  }

  return authoredById
}

async function hydrateBackgroundsByIds(
  db: DBLike,
  ids: readonly string[],
  options: BackgroundRepositoryReadOptions = {}
): Promise<Map<string, BackgroundAuthored>> {
  const distinctIds = uniqueIds(ids)
  if (distinctIds.length === 0) {
    return new Map()
  }

  const rows = await db
    .selectFrom('backgrounds')
    .select(BACKGROUND_COLUMNS)
    .where('id', 'in', distinctIds)
    .execute() as BackgroundRow[]
  const rowsById = new Map(rows.map((row) => [row.id, row]))

  return hydrateBackgroundRows(
    db,
    distinctIds.flatMap((id) => {
      const row = rowsById.get(id)
      return row ? [row] : []
    }),
    options
  )
}

export function createBackgroundRepository(db: DBLike): BackgroundRepositoryWithReadOptions {
  return {
    async upsert(entity) {
      await upsertBackground(db, entity, entity.systemId)
    },

    async findById(id, filter) {
      return hydrateBackgroundById(db, id, filter)
    },

    async findByIds(ids, filter) {
      return hydrateBackgroundsByIds(db, ids, filter)
    },

    async findAll(filter?: RepositoryFindAllOptions) {
      let query = db
        .selectFrom('backgrounds')
        .select(BACKGROUND_COLUMNS)
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
        await hydrateBackgroundRows(db, rows as BackgroundRow[])
      )
    }
  }
}
