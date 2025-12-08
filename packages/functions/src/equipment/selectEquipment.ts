import type { Database } from '@artificer/db'
import type { Equipment, Contains } from '@artificer/shared/types'
import { type ExpressionBuilder, type RawBuilder, sql } from 'kysely'
import { jsonBuildObject, jsonArrayFrom } from 'kysely/helpers/postgres'
import { damage, saveDc, prerequisites, range, speed } from '@functions/fragments'
import { features } from '@functions/features'

export function selectEquipment(eb: ExpressionBuilder<Database, 'equipment'>): RawBuilder<Equipment> {
  return jsonBuildObject({
    id: eb.ref('id'),
    label: eb.ref('label'),
    description: eb.ref('description'),
    quote: eb.ref('quote'),
    cost: eb
      .selectFrom('costs')
      .whereRef('cost_id', '=', 'id')
      .select([
        'amount',
        'currency_id as currencyId'
      ]),
    weight: eb
      .selectFrom('measures')
      .where(({ eb: eb2, and }) => and([
        eb2(eb2.ref('weight_id'), '=', eb.ref('id')),
        eb2(eb2.ref('kind'), '=', 'WEIGHT')
      ]))
      .select([
        'amount',
        'unit_id as unitId'
      ]),
    capacity: eb
      .selectFrom('measures')
      .where(({ eb: eb2, and }) => and([
        eb2(eb2.ref('capacity_id'), '=', eb.ref('id')),
        eb2(eb2.ref('kind'), '=', 'CAPACITY')
      ]))
      .select([
        'amount',
        'unit_id as unitId'
      ]),
    maxStack: eb.ref('max_stack'),
    propertyIds: eb
      .selectFrom('equipment_properties')
      .whereRef('equipment_id', '=', 'id')
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          eb2.ref('property_id')
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar(),
    categoryId: eb.ref('category_id'),
    rarityId: eb.ref('rarity_id'),
    attributeIds: eb
      .selectFrom('equipment_attributes')
      .whereRef('equipment_id', '=', 'id')
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          eb2.ref('attribute_id')
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar(),
    damage: damage(eb),
    saveDc: saveDc(eb),
    primaryAbilityId: eb.ref('primary_ability_id'),
    secondaryAbilityId: eb.ref('secondary_ability_id'),
    optionalAbilityId: eb.ref('optional_ability_id'),
    maxBonus: eb.ref('max_bonus'),
    armorClass: eb.ref('armor_class'),
    prerequisites: prerequisites(eb, (eb2) => eb2
      .selectFrom('equipment_prerequisites as bridge')
      .whereRef('equipment_id', '=', 'id')
      .select([
        'bridge.prerequisite_id',
        'bridge.position'
      ])
      .orderBy('bridge.position')),
    speed: speed(eb),
    range: range(eb),
    features: features(eb, (eb2) => eb2
      .selectFrom('equipment_features as bridge')
      .whereRef('equipment_id', '=', 'id')
      .select([
        'bridge.feature_id',
        'bridge.position'
      ])
      .orderBy('bridge.position')),
    contains: jsonArrayFrom<Contains>(
      eb
        .selectFrom('equipment_contains')
        .whereRef('equipment_id', '=', 'id')
        .select([
          'equipment_id as equipmentId',
          'quantity'
        ])
    ),
    userId: eb
      .case()
      .when(eb.ref('is_master'), 'is', true)
      .then('master')
      .else(eb.ref('user_id'))
      .end()
      .$notNull(),
    systemId: eb.ref('system_id')
  })
}
