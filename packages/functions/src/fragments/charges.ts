import type { Database } from '@artificer/db'
import type { Charge, UsesPerLevel } from '@artificer/shared/types'
import type { ExpressionBuilder } from 'kysely'
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'

export function usesPerLevel(eb: ExpressionBuilder<Database, 'charges'>) {
  return jsonArrayFrom<UsesPerLevel>(
    eb.selectFrom('charge_uses_per_level')
      .select([
        'level', 'uses'
      ])
      .whereRef('charge_id', '=', 'id')
  )
}

export function charges(ebX: ExpressionBuilder<Database, keyof Database>) {
  return jsonObjectFrom<Charge>(
    ebX
      .selectFrom('charges')
      .select((eb) => [
        eb.ref('id').as('id'),
        eb.ref('reset_id').as('resetId'),
        eb.ref('limit_id').as('limitId'),
        eb.ref('ability_id').as('abilityId'),
        eb.ref('min_amount').as('minAmount'),
        eb.ref('add_amount').as('addAmount'),
        eb.ref('set_amount').as('setAmount'),
        eb.ref('multiplier').as('multiplier'),
        usesPerLevel(eb).as('usesPerLevel')
      ])
      .whereRef('id', '=', 'charge_id')
  )
}
