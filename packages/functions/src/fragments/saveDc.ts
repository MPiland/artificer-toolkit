import type { Database } from '@artificer/db'
import type { SaveDc } from '@artificer/shared/types'
import { type ExpressionBuilder, sql } from 'kysely'
import { jsonObjectFrom } from 'kysely/helpers/postgres'

export function saveDc(ebX: ExpressionBuilder<Database, keyof Database>) {
  return jsonObjectFrom<SaveDc>(
    ebX
      .selectFrom('save_dc')
      .select((eb) => [
        eb.ref('id').as('id'),
        eb.ref('ability_id').$notNull()
          .as('saveAbilityId'),
        eb.ref('base_value')
          .as('baseValue'),
        eb.ref('scaling_ability_id')
          .as('scalingAbilityId'),
        eb
          .selectFrom('save_dc_attributes')
          .whereRef('save_dc_id', '=', eb.ref('id'))
          .select((eb2) => [
            eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
              'attribute_id'
            ]), sql<string[]>`'[]'::jsonb`).as('value')
          ])
          .as('scalingAttributeIds')
      ])
      .whereRef('id', '=', 'save_dc_id')
  )
}
