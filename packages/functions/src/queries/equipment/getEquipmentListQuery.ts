import type { DB } from '@artificer-toolkit/functions/types'
import type { EquipmentAmountMeta, EquipmentListItem, EquipmentMeta, EquipmentMetaObject } from '@artificer-toolkit/shared/types'
import type { NotNull } from 'kysely'

export async function getEquipmentListQuery(db: DB): Promise<{ items: EquipmentListItem[], meta: EquipmentMeta }> {
  const items = await db
    .selectFrom('equipment')
    .select((eb) => [
      'id',
      'label',
      'description',
      'quote',
      'system_id as systemId',
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
      'category_id as id', eb.fn.agg<string[]>('array_agg', [
        eb.ref('id')
      ]).distinct()
        .as('equipmentIds')
    ])
    .where('category_id', 'is not', null)
    .groupBy('category_id')
    .execute()

  const properties: EquipmentMetaObject[] = await db
    .selectFrom('equipment_properties')
    .select((eb) => [
      'property_id as id',
      eb.fn.agg<string[]>('array_agg', [
        eb.ref('equipment_id')
      ]).as('equipmentIds')
    ])
    .groupBy('property_id')
    .execute()

  const primaryDamages: EquipmentMetaObject[] = await db
    .selectFrom('damage_fields as df')
    .innerJoin('damages as d', 'd.id', 'df.damage_id')
    .innerJoin('equipment as e', 'e.damage_id', 'd.id')
    .where('df.slot', '=', 'PRIMARY')
    .where('df.level', '=', 1)
    .where('df.damage_type_id', 'is not', null)
    .select((eb) => [
      'df.damage_type_id as id',
      eb.fn
        .agg<string[]>('array_agg', [
          eb.ref('e.id')
        ])
        .distinct()
        .as('equipmentIds')
    ])
    .$narrowType<{ id: NotNull }>()
    .groupBy('df.damage_type_id')
    .execute()

  const secondaryDamages: EquipmentMetaObject[] = await db
    .selectFrom('damage_fields as df')
    .innerJoin('damages as d', 'd.id', 'df.damage_id')
    .innerJoin('equipment as e', 'e.damage_id', 'd.id')
    .where('df.slot', '=', 'SECONDARY')
    .where('df.level', '=', 1)
    .where('df.damage_type_id', 'is not', null)
    .select((eb) => [
      'df.damage_type_id as id',
      eb.fn
        .agg<string[]>('array_agg', [
          eb.ref('e.id')
        ])
        .distinct()
        .as('equipmentIds')
    ])
    .$narrowType<{ id: NotNull }>()
    .groupBy('df.damage_type_id')
    .execute()

  const armorClasses: EquipmentMetaObject[] = await db
    .selectFrom('equipment')
    .select((eb) => [
      eb.ref('armor_class').$castTo<string>()
        .as('id'),
      eb.fn.agg<string[]>('array_agg', [
        eb.ref('id')
      ]).as('equipmentIds')
    ])
    .groupBy('armor_class')
    .execute()

  const costs: EquipmentAmountMeta[] = await db
    .selectFrom('costs')
    .innerJoin('equipment', 'equipment.cost_id', 'costs.id')
    .select((eb) => [
      'currency_id as id',
      'amount',
      eb.fn.agg<string[]>('array_agg', [
        eb.ref('equipment.id')
      ]).as('equipmentIds')
    ])
    .groupBy([
      'costs.currency_id',
      'costs.amount'
    ])
    .execute()

  const weights = await db
    .selectFrom('measures as m')
    .innerJoin('equipment as e', 'e.weight_id', 'm.id')
    .select((eb) => [
      'unit_id as id',
      'amount',
      eb.fn.agg<string[]>('array_agg', [
        eb.ref('e.id')
      ]).distinct()
        .as('equipmentIds')
    ])
    .where('m.kind', '=', 'WEIGHT')
    .execute()

  const features: EquipmentMetaObject[] = await db
    .selectFrom('equipment_features')
    .select((eb) => [
      'feature_id as id',
      eb.fn.agg<string[]>('array_agg', [
        eb.ref('equipment_id')
      ]).as('equipmentIds')
    ])
    .groupBy('feature_id')
    .execute()

  return {
    items,
    meta: {
      categories,
      properties,
      primaryDamages,
      secondaryDamages,
      armorClasses,
      costs,
      weights,
      features
    }
  }
}
