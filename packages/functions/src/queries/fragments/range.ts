import type { Database } from '@artificer-toolkit/db/types'
import type { Range } from '@artificer-toolkit/shared/types'
import type { ExpressionBuilder } from 'kysely'
import { jsonObjectFrom } from 'kysely/helpers/postgres'

export function range(ebX: ExpressionBuilder<Database, keyof Database>) {
  return jsonObjectFrom<Range>(
    ebX
      .selectFrom('characteristics')
      .select([
        'id',
        'min_amount as minAmount',
        'max_amount as maxAmount',
        'distance',
        'unit_id as unitId'
      ])
      .where(({ eb, and }) => and([
        eb(eb.ref('id'), '=', ebX.ref('range_id')),
        eb(eb.ref('type'), '=', 'RANGE')
      ]))
  )
}
