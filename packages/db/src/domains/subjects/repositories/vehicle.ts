import { SIZE_CODE, type SizeCode, type VehicleAuthored } from '@artificer-toolkit/shared'
import { costDtoSchema } from '@artificer-toolkit/schema/subjects/shared'
import type { DBLike } from '#types'
import { upsertVehicle } from '../upserts/vehicle.js'
import { createDetailRepository } from '../../shared/repositories/detail.js'
import { createFeatureRepository } from '../../features/repositories/feature.js'
import type {
  RepositoryFindAllOptions,
  VehicleRepository
} from '../../../repositories/contracts.js'
import { hydrateByIds, orderedHydratedRecords } from '../../../repositories/batch.js'
import { hydrateSubjectStatus } from '../status.js'

function requireCategory(vehicleId: string, value: string): VehicleAuthored['category'] {
  if (!['LAND', 'WATER', 'AIR', 'SPELLJAMMER'].includes(value)) {
    throw new Error(`Vehicle "${vehicleId}" has invalid category "${value}".`)
  }

  return value as VehicleAuthored['category']
}

function requireSizeCode(vehicleId: string, value: string): SizeCode {
  if (!(value in SIZE_CODE)) {
    throw new Error(`Vehicle "${vehicleId}" has invalid size_code "${value}".`)
  }

  return value as SizeCode
}

function requireLinkedRecord<T>(value: T | null, message: string): T {
  if (value === null) {
    throw new Error(message)
  }

  return value
}

function hydrateCost(vehicleId: string, value: unknown): VehicleAuthored['cost'] {
  if (value == null) {
    return undefined
  }

  const parsed = costDtoSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`Vehicle "${vehicleId}" has invalid cost. ${parsed.error.message}`)
  }

  return parsed.data
}

async function hydrateVehicleById(db: DBLike, id: string): Promise<VehicleAuthored | null> {
  const row = await db
    .selectFrom('vehicles')
    .select([
      'id',
      'system_id',
      'user_id',
      'label',
      'description',
      'status',
      'category',
      'size_code',
      'armor_class',
      'hit_points',
      'speed',
      'speed_note',
      'crew_min',
      'crew_max',
      'passenger_capacity',
      'cargo_capacity',
      'cost',
      'properties'
    ])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!row) return null
  if (!row.user_id) {
    throw new Error(`Vehicle "${id}" is missing user ownership and cannot be hydrated.`)
  }

  const [detailLinks, featureLinks] = await Promise.all([
    db
      .selectFrom('vehicle_details')
      .select(['detail_id', 'sort_order'])
      .where('vehicle_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('vehicle_features')
      .select(['feature_id', 'sort_order'])
      .where('vehicle_id', '=', id)
      .orderBy('sort_order')
      .execute()
  ])

  const detailRepository = createDetailRepository(db)
  const featureRepository = createFeatureRepository(db, row.system_id)
  const [detailsById, featuresById] = await Promise.all([
    detailRepository.findByIds(detailLinks.map((link) => link.detail_id)),
    featureRepository.findByIds(featureLinks.map((link) => link.feature_id))
  ])
  const authoredDetails = detailLinks.map((link) =>
    requireLinkedRecord(
      detailsById.get(link.detail_id) ?? null,
      `Vehicle "${id}" is linked to missing detail "${link.detail_id}".`
    )
  )
  const authoredFeatures = featureLinks.map((link) =>
    requireLinkedRecord(
      featuresById.get(link.feature_id) ?? null,
      `Vehicle "${id}" is linked to missing feature "${link.feature_id}".`
    )
  )

  return {
    id: row.id,
    label: row.label,
    description: row.description ?? undefined,
    status: hydrateSubjectStatus(row.status),
    details: authoredDetails.length > 0 ? authoredDetails : undefined,
    userId: row.user_id,
    systemId: row.system_id,
    category: requireCategory(id, row.category),
    size: row.size_code ? requireSizeCode(id, row.size_code) : undefined,
    armorClass: row.armor_class ?? undefined,
    hitPoints: row.hit_points ?? undefined,
    speed: row.speed ?? undefined,
    speedNote: row.speed_note ?? undefined,
    crewMin: row.crew_min ?? undefined,
    crewMax: row.crew_max ?? undefined,
    passengerCapacity: row.passenger_capacity ?? undefined,
    cargoCapacity: row.cargo_capacity ?? undefined,
    cost: hydrateCost(id, row.cost),
    properties: row.properties ?? undefined,
    features: authoredFeatures.length > 0 ? authoredFeatures : undefined
  }
}

export function createVehicleRepository(db: DBLike): VehicleRepository {
  return {
    async upsert(entity) {
      await upsertVehicle(db, entity, entity.systemId)
    },

    async findById(id) {
      return hydrateVehicleById(db, id)
    },

    async findByIds(ids) {
      return hydrateByIds(ids, (id) => hydrateVehicleById(db, id))
    },

    async findAll(filter?: RepositoryFindAllOptions) {
      let query = db.selectFrom('vehicles').select('id').orderBy('label')

      if (filter?.systemId) {
        query = query.where('system_id', '=', filter.systemId)
      }

      if (filter?.userId) {
        query = query.where('user_id', '=', filter.userId)
      }

      const rows = await query.execute()
      return orderedHydratedRecords(
        rows.map((row) => row.id),
        await hydrateByIds(
          rows.map((row) => row.id),
          (id) => hydrateVehicleById(db, id)
        )
      )
    }
  }
}
