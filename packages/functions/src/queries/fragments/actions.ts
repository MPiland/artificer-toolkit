import type { Database } from '@artificer-toolkit/db/types'
import type { ActionProperty, Actions } from '@artificer-toolkit/shared/types'
import type { ExpressionBuilder, RawBuilder } from 'kysely'
import { jsonObjectFrom } from 'kysely/helpers/postgres'

function actionFields(eb: ExpressionBuilder<Database, 'actions'>, slot: 'CASTING' | 'SECONDARY' | 'PRIMARY' | 'BONUS') {
  return jsonObjectFrom<ActionProperty>(
    eb
      .selectFrom('action_fields')
      .select([
        'id as id', 'action_id as actionId', 'amount as amount'
      ])
      .where(({ eb: eb2, and }) => and([
        eb2(eb2.ref('action_id'), '=', eb.ref('id')),
        eb2(eb2.ref('slot'), '=', slot)
      ]))
  )
}

export function actions(
  ebX: ExpressionBuilder<Database, keyof Database>
): RawBuilder<Actions> {
  return jsonObjectFrom<Actions>(
    ebX
      .selectFrom('actions')
      .select((eb) => [
        eb.ref('id').as('id'),
        actionFields(eb, 'PRIMARY').as('primary'),
        actionFields(eb, 'SECONDARY').as('secondary'),
        actionFields(eb, 'BONUS').as('bonus'),
        actionFields(eb, 'CASTING').as('casting')
      ])
      .whereRef('id', '=', 'action_id')
  )
    .$notNull()
}
