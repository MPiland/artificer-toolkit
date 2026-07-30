import type { DBLike } from '#types'
import { sql } from 'kysely'
import type { RepositoryFindAllOptions } from '../../../repositories/contracts.js'

export interface EquipmentListItem {
  id: string
  label: string
  description: string | null
  quote: string | null
  status: string
  systemId: string
  category: string | null
  capacityAmount: number | null
  chargeId: string | null
  maxStack: number | null
  parentEquipmentId: string | null
  properties: string[]
  requiresAttunement: boolean
  userId: string
  ownerUserId: string | null
  isMaster: boolean | null
}

export interface EquipmentMetaObject {
  id: string
  equipmentIds: string[]
}

export interface EquipmentMeta {
  categories: EquipmentMetaObject[]
  rarities: EquipmentMetaObject[]
  properties: EquipmentMetaObject[]
  features: EquipmentMetaObject[]
}

export interface EquipmentListQueryResult {
  items: EquipmentListItem[]
  meta: EquipmentMeta
}

export async function getEquipmentListQuery(
  db: DBLike,
  filter?: RepositoryFindAllOptions
): Promise<EquipmentListQueryResult> {
  let itemQuery = db
    .selectFrom('equipment')
    .select([
      'id',
      'label',
      'description',
      'quote',
      'status',
      'system_id as systemId',
      'category',
      'capacity_amount as capacityAmount',
      'charge_id as chargeId',
      'max_stack as maxStack',
      'parent_equipment_id as parentEquipmentId',
      'requires_attunement as requiresAttunement',
      'user_id as ownerUserId',
      'is_master as isMaster',
      sql<string>`case when ${sql.ref('is_master')} then 'master' else ${sql.ref('user_id')}::text end`.as(
        'userId'
      )
    ])

  if (filter?.systemId) {
    itemQuery = itemQuery.where('system_id', '=', filter.systemId)
  }

  if (filter?.userId) {
    itemQuery = itemQuery.where('user_id', '=', filter.userId)
  }

  const itemRows = await itemQuery.execute().then((rows) => (rows?.length ? rows : []))
  const equipmentIds = itemRows.map((item) => item.id)

  if (equipmentIds.length === 0) {
    return {
      items: [],
      meta: {
        categories: [],
        rarities: [],
        properties: [],
        features: []
      }
    }
  }

  const categories: EquipmentMetaObject[] = (await db
    .selectFrom('equipment')
    .select((eb) => [
      'category as id',
      eb.fn
        .agg<string[]>('array_agg', [eb.ref('id')])
        .distinct()
        .as('equipmentIds')
    ])
    .where('id', 'in', equipmentIds)
    .where('category', 'is not', null)
    .groupBy('category')
    .execute()) as EquipmentMetaObject[]

  const rarities: EquipmentMetaObject[] = (await db
    .selectFrom('equipment')
    .select((eb) => [
      'rarity_id as id',
      eb.fn
        .agg<string[]>('array_agg', [eb.ref('id')])
        .distinct()
        .as('equipmentIds')
    ])
    .where('id', 'in', equipmentIds)
    .where('rarity_id', 'is not', null)
    .groupBy('rarity_id')
    .execute()) as EquipmentMetaObject[]

  const properties: EquipmentMetaObject[] = await db
    .selectFrom('equipment_properties')
    .select((eb) => [
      'property_code as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('equipment_id')]).as('equipmentIds')
    ])
    .where('equipment_id', 'in', equipmentIds)
    .groupBy('property_code')
    .execute()

  const features: EquipmentMetaObject[] = await db
    .selectFrom('equipment_features')
    .select((eb) => [
      'feature_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('equipment_id')]).as('equipmentIds')
    ])
    .where('equipment_id', 'in', equipmentIds)
    .groupBy('feature_id')
    .execute()

  const propertyCodesByEquipmentId = new Map<string, string[]>()
  for (const property of properties) {
    for (const equipmentId of property.equipmentIds) {
      const propertyCodes = propertyCodesByEquipmentId.get(equipmentId) ?? []
      propertyCodes.push(property.id)
      propertyCodesByEquipmentId.set(equipmentId, propertyCodes)
    }
  }

  const items: EquipmentListItem[] = itemRows.map((item) => ({
    ...item,
    properties: propertyCodesByEquipmentId.get(item.id) ?? []
  }))

  return {
    items,
    meta: {
      categories,
      rarities,
      properties,
      features
    }
  }
}
