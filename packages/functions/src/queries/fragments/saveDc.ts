import type { Database } from '@artificer-toolkit/db/types'
import type { SaveDc } from '@artificer-toolkit/shared/types'
import { type ExpressionBuilder, type NotNull, sql } from 'kysely'
import { jsonObjectFrom } from 'kysely/helpers/postgres'

export function saveDc(ebX: ExpressionBuilder<Database, keyof Database>) {
  return jsonObjectFrom<SaveDc>(
    ebX
      .selectFrom('save_dc')
      .select((eb) => [
        'id',
        'ability_id as saveAbilityId',
        'base_value as baseValue',
        'scaling_ability_id as scalingAbilityId',
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
      .$narrowType<{ saveAbilityId: NotNull, baseValue: NotNull }>()
      .whereRef('id', '=', 'save_dc_id')
  )
}
