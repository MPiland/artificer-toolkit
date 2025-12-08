import type { Database } from '@artificer/db'
import type { Speed } from '@artificer/shared/types'
import type { ExpressionBuilder } from 'kysely'
import { jsonObjectFrom } from 'kysely/helpers/postgres'

export function speed(ebX: ExpressionBuilder<Database, keyof Database>) {
  return jsonObjectFrom<Speed>(
    ebX
      .selectFrom('measures')
      .select((eb) => [
        eb.ref('id').as('id'),
        eb.ref('amount').$notNull()
          .as('amount'),
        eb.ref('unit_id').$notNull()
          .as('unitId')
      ])
      .where(({ eb, and }) => and([
        eb(eb.ref('id'), '=', ebX.ref('speed_id')),
        eb(eb.ref('kind'), '=', 'SPEED')
      ]))
  )
}
