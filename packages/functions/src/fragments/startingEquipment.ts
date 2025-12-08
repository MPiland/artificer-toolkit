import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'
import { sql, type NotNull, type ExpressionBuilder } from 'kysely'
import type { Database } from '@artificer/db'
import type { EquipmentOptionItem, EquipmentCurrency, EquipmentOption, EquipmentGroup, EquipmentSet, StartingEquipment } from '@artificer/shared/types'

// ──────────────────────────────────────────────
// 1. Items
// ──────────────────────────────────────────────

export function startingEquipmentOptionItems(eb: ExpressionBuilder<Database, 'starting_equipment_options'>) {
  return jsonArrayFrom<EquipmentOptionItem>(
    eb
      .selectFrom('starting_equipment_option_items')
      .select((eb2) => [
        'id',
        'selection_count as selectionCount',
        'category_id as categoryId',
        'position',
        'quantity',
        eb2
          .selectFrom('starting_equipment_option_item_attributes')
          .whereRef('option_item_id', '=', 'id')
          .select((eb3) => [
            eb3.fn.coalesce(eb3.fn.agg<string[]>('array_agg', [
              'attribute_id'
            ]), sql<string[]>`'{}'::text[]`).as('value')
          ])
          .as('attributeIds'),
        eb2
          .selectFrom('starting_equipment_option_item_properties')
          .whereRef('option_item_id', '=', 'id')
          .select((eb3) => [
            eb3.fn.coalesce(eb3.fn.agg<string[]>('array_agg', [
              'property_id'
            ]), sql<string[]>`'{}'::text[]`).as('value')
          ])
          .as('propertyIds'),
        eb2
          .selectFrom('starting_equipment_option_item_equipment')
          .whereRef('option_item_id', '=', 'id')
          .select((eb3) => [
            eb3.fn.coalesce(eb3.fn.agg<string[]>('array_agg', [
              eb3
                .case()
                .when(eb3.ref('use_all'))
                .then('all')
                .else(eb3.ref('equipment_id'))
                .end()
            ]), sql<string[]>`'{}'::text[]`).as('value')
          ])
          .as('equipmentIds'),
        jsonArrayFrom<EquipmentCurrency>(
          eb2
            .selectFrom('starting_equipment_option_item_currencies')
            .select([
              'currency_id as currencyId', 'amount'
            ])
            .whereRef('option_item_id', '=', 'id')
        ).as('currencies')
      ])
      .whereRef('option_id', '=', 'id')
      .$narrowType<{ equipmentIds: NotNull }>()
  )
}

// ──────────────────────────────────────────────
// 2. Options
// ──────────────────────────────────────────────
export function startingEquipmentOptions(eb: ExpressionBuilder<Database, 'starting_equipment_groups'>) {
  return jsonArrayFrom<EquipmentOption>(
    eb
      .selectFrom('starting_equipment_options')
      .select((eb2) => [
        'id',
        'position',
        startingEquipmentOptionItems(eb2).as('items')
      ])
      .whereRef('group_id', '=', 'id')
  )
}

// ──────────────────────────────────────────────
// 3. Groups
// ──────────────────────────────────────────────
export function startingEquipmentGroups(eb: ExpressionBuilder<Database, 'starting_equipment_sets'>) {
  return jsonArrayFrom<EquipmentGroup>(
    eb
      .selectFrom('starting_equipment_groups')
      .select((eb2) => [
        'id',
        'position',
        startingEquipmentOptions(eb2).as('options')
      ])
      .whereRef('set_id', '=', 'id')
  )
}

// ──────────────────────────────────────────────
// 4. Sets
// ──────────────────────────────────────────────

export function startingEquipmentSets(eb: ExpressionBuilder<Database, 'starting_equipment'>) {
  return jsonArrayFrom<EquipmentSet>(
    eb
      .selectFrom('starting_equipment_sets')
      .select((eb2) => [
        'id',
        'position',
        startingEquipmentGroups(eb2).as('groups')
      ])
      .whereRef('starting_equipment_id', '=', 'id')
  )
}

// ──────────────────────────────────────────────
// 5. Top-level startingEquipment object
//    ★ PARENT-ALIAS + PARENT-FK ARE CONFIGURABLE
// ──────────────────────────────────────────────

export function startingEquipment(ebX: ExpressionBuilder<Database, keyof Database>) {
  return jsonObjectFrom<StartingEquipment>(
    ebX
      .selectFrom('starting_equipment')
      .whereRef('id', '=', ebX.ref('starting_equipment_id'))
      .select((eb) => [
        'id',
        startingEquipmentSets(eb).as('sets')
      ])
  )
}
