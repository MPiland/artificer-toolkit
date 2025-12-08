import type { Database } from '@artificer/db'
import type { Damage, DamageFields, ScalePerLevel } from '@artificer/shared/types'
import type { ExpressionBuilder } from 'kysely'
import { expressionBuilder, sql, type Expression } from 'kysely'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'

const DAMAGE_FIELD_COLUMNS = [
  'id as id',
  'die_config as dieConfig',
  'attribute_id as attributeId',
  'ability_id as abilityId',
  'set_amount as setAmount',
  'multiplier as multiplier',
  'min_amount as minAmount',
  'max_amount as maxAmount',
  'option_id as poolOptionId',
  'slot as slot',
  'kind as kind'
] as const

function damageFields(parentFk: Expression<string>) {
  const eb = expressionBuilder<Database>()
  return jsonArrayFrom<DamageFields>(
    eb
      .selectFrom('damage_fields')
      .select(DAMAGE_FIELD_COLUMNS)
      .select((eb2) => [
        eb2.case()
          .when(eb2.ref('match_weapon'), '=', true)
          .then('match_weapon')
          .else(eb2.ref('damage_type_id'))
          .end()
          .as('damageTypeId')
      ])
      .whereRef('damage_id', '=', parentFk)
  )
}

function scalePerLevelFields(parentFk: Expression<string>) {
  const eb = expressionBuilder<Database>()
  return jsonArrayFrom<ScalePerLevel>(
    eb
      .selectFrom('damage_fields')
      .select((eb2) => [
        ...DAMAGE_FIELD_COLUMNS,
        eb2.ref('level').$notNull()
          .as('level'),
        eb2.case()
          .when(eb2.ref('match_weapon'), '=', true)
          .then('match_weapon')
          .else(eb2.ref('damage_type_id'))
          .end()
          .as('damageTypeId')
      ])
      .whereRef('damage_id', '=', parentFk)
  )
}

export function damage(ebX: ExpressionBuilder<Database, keyof Database>) {
  return jsonObjectFrom<Damage>(
    ebX
      .selectFrom('damages')
      .select((eb) => [
        eb.ref('id').as('id'),
        eb
          .selectFrom('damage_attributes')
          .whereRef('damage_id', '=', 'id')
          .select((eb2) => [
            eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
              'attribute_id'
            ]), sql`'[]'::jsonb`).as('value')
          ])
          .as('attributeIds'),
        eb
          .selectFrom('damage_saves')
          .whereRef('damage_id', '=', 'id')
          .select((eb2) => [
            eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
              'save_id'
            ]), sql`'[]'::jsonb`).as('value')
          ])
          .as('damageSaveIds'),
        scalePerLevelFields(eb.ref('id')).as('scalePerLevel'),
        damageFields(eb.ref('id')).as('fields')
      ])
      .whereRef('id', '=', 'damage_id')
  )
}
