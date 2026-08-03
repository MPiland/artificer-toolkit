import type { DBLike } from '#types'
import { withTransaction } from '../../../utils/index.js'
import type { Json } from '../../../types/supabase.database.js'
import { SIZE_CODE, type SizeCode, type VehicleAuthored } from '@artificer-toolkit/shared'
import { upsertDetail } from '../../shared/upserts/index.js'
import { upsertFeature } from '../../features/upserts/index.js'
import { normalizeSubjectStatus } from '../status.js'

type VehicleRow = {
  id: string
  system_id: string
  user_id: string
  label: string
  description: string | null
  status: VehicleAuthored['status']
  category: string
  size_code: string | null
  armor_class: number | null
  hit_points: number | null
  speed: number | null
  speed_note: string | null
  crew_min: number | null
  crew_max: number | null
  passenger_capacity: number | null
  cargo_capacity: string | null
  weight_amount: number | null
  weight_unit: string | null
  cost: Json | null
  properties: string[] | null
  is_master: boolean | null
}

type VehicleDetailRow = {
  vehicle_id: string
  detail_id: string
  sort_order: number
}

type VehicleFeatureRow = {
  vehicle_id: string
  feature_id: string
  sort_order: number
}

function requireCategory(vehicleId: string, value: string): VehicleAuthored['category'] {
  if (!['LAND', 'WATER', 'AIR', 'SPELLJAMMER'].includes(value)) {
    throw new Error(`Vehicle "${vehicleId}" has invalid category "${value}".`)
  }

  return value as VehicleAuthored['category']
}

function requireSizeCode(vehicleId: string, value: string): SizeCode {
  if (!(value in SIZE_CODE)) {
    throw new Error(`Vehicle "${vehicleId}" has invalid size "${value}".`)
  }

  return value as SizeCode
}

export async function upsertVehicle(db: DBLike, json_data: VehicleAuthored, _systemId: string) {
  const row: VehicleRow = {
    id: json_data.id,
    system_id: json_data.systemId,
    user_id: json_data.userId,
    label: json_data.label,
    description: json_data.description ?? null,
    status: normalizeSubjectStatus(json_data.status),
    category: requireCategory(json_data.id, json_data.category),
    size_code: json_data.size ? requireSizeCode(json_data.id, json_data.size) : null,
    armor_class: json_data.armorClass ?? null,
    hit_points: json_data.hitPoints ?? null,
    speed: json_data.speed ?? null,
    speed_note: json_data.speedNote ?? null,
    crew_min: json_data.crewMin ?? null,
    crew_max: json_data.crewMax ?? null,
    passenger_capacity: json_data.passengerCapacity ?? null,
    cargo_capacity: json_data.cargoCapacity ?? null,
    weight_amount: json_data.weight?.amount ?? null,
    weight_unit: json_data.weight?.unit ?? null,
    cost: json_data.cost ? (json_data.cost as unknown as Json) : null,
    properties: json_data.properties ?? null,
    is_master: null
  }

  const detailRows: VehicleDetailRow[] = (json_data.details ?? []).map((detail) => ({
    vehicle_id: json_data.id,
    detail_id: detail.id,
    sort_order: detail.order
  }))

  const featureRows: VehicleFeatureRow[] = (json_data.features ?? []).map((feature) => ({
    vehicle_id: json_data.id,
    feature_id: feature.id,
    sort_order: feature.order
  }))

  return withTransaction(db, async (trx) => {
    await trx
      .insertInto('vehicles')
      .values(row)
      .onConflict((oc) => oc.column('id').doUpdateSet(row))
      .execute()

    await trx.deleteFrom('vehicle_details').where('vehicle_id', '=', json_data.id).execute()

    await trx.deleteFrom('vehicle_features').where('vehicle_id', '=', json_data.id).execute()

    for (const detail of json_data.details ?? []) {
      await upsertDetail(trx, detail)
    }

    for (const feature of json_data.features ?? []) {
      await upsertFeature(trx, feature, json_data.systemId)
    }

    if (detailRows.length > 0) {
      await trx.insertInto('vehicle_details').values(detailRows).execute()
    }

    if (featureRows.length > 0) {
      await trx.insertInto('vehicle_features').values(featureRows).execute()
    }
  })
}
