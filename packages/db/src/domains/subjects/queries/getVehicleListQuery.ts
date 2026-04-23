import type { DBLike } from '#types'
import { details } from './fragments/index.js'

interface VehicleListItem {
  id: string
  label: string
  description: string | null
  status: string
  systemId: string
  details: unknown
  userId: string
}

interface VehicleMetaObject {
  id: string
  vehicleIds: string[]
}

interface VehicleMeta {
  categories: VehicleMetaObject[]
  features: VehicleMetaObject[]
}

export async function getVehicleListQuery(db: DBLike): Promise<{ items: VehicleListItem[], meta: VehicleMeta }> {
  const items = await db
    .selectFrom('vehicles')
    .select((eb) => [
      'id',
      'label',
      'description',
      'status',
      'system_id as systemId',
      details(eb, (eb2) => eb2
        .selectFrom('vehicle_details as bridge')
        .whereRef('bridge.vehicle_id', '=', 'id')
        .select([
          'bridge.detail_id',
          'bridge.sort_order as position'
        ])
        .orderBy('bridge.sort_order'))
        .as('details'),
      eb
        .case()
        .when(eb.ref('is_master'), 'is', true)
        .then('master')
        .else(eb.ref('user_id'))
        .end()
        .$notNull()
        .as('userId')
    ])
    .execute()
    .then((rows) => rows?.length ? rows : [])

  const categories: VehicleMetaObject[] = await db
    .selectFrom('vehicles')
    .select((eb) => [
      'category as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct()
        .as('vehicleIds')
    ])
    .where('category', 'is not', null)
    .groupBy('category')
    .execute() as VehicleMetaObject[]

  const features: VehicleMetaObject[] = await db
    .selectFrom('vehicle_features')
    .select((eb) => [
      'feature_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('vehicle_id')]).as('vehicleIds')
    ])
    .groupBy('feature_id')
    .execute()

  return {
    items,
    meta: {
      categories,
      features
    }
  }
}
