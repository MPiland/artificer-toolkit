import type { DBLike } from '#types'

interface EquipmentListItem {
  id: string
  label: string
  description: string | null
  quote: string | null
  status: string
  systemId: string
  userId: string
  ownerUserId: string | null
  isMaster: boolean | null
}

interface EquipmentMetaObject {
  id: string
  equipmentIds: string[]
}

interface EquipmentMeta {
  categories: EquipmentMetaObject[]
  rarities: EquipmentMetaObject[]
  properties: EquipmentMetaObject[]
  features: EquipmentMetaObject[]
}

export async function getEquipmentListQuery(db: DBLike): Promise<{ items: EquipmentListItem[], meta: EquipmentMeta }> {
  const items = await db
    .selectFrom('equipment')
    .select((eb) => [
      'id',
      'label',
      'description',
      'quote',
      'status',
      'system_id as systemId',
      'user_id as ownerUserId',
      'is_master as isMaster',
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

  const categories: EquipmentMetaObject[] = await db
    .selectFrom('equipment')
    .select((eb) => [
      'category as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct().as('equipmentIds')
    ])
    .where('category', 'is not', null)
    .groupBy('category')
    .execute() as EquipmentMetaObject[]

  const rarities: EquipmentMetaObject[] = await db
    .selectFrom('equipment')
    .select((eb) => [
      'rarity_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct().as('equipmentIds')
    ])
    .where('rarity_id', 'is not', null)
    .groupBy('rarity_id')
    .execute() as EquipmentMetaObject[]

  const properties: EquipmentMetaObject[] = await db
    .selectFrom('equipment_properties')
    .select((eb) => [
      'property_code as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('equipment_id')]).as('equipmentIds')
    ])
    .groupBy('property_code')
    .execute()

  const features: EquipmentMetaObject[] = await db
    .selectFrom('equipment_features')
    .select((eb) => [
      'feature_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('equipment_id')]).as('equipmentIds')
    ])
    .groupBy('feature_id')
    .execute()

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
