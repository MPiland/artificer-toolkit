import type { Database } from '@artificer/db'
import type { Duration } from '@artificer/shared/types'
import type { ExpressionBuilder } from 'kysely'
import { jsonObjectFrom } from 'kysely/helpers/postgres'

export function duration(ebX: ExpressionBuilder<Database, keyof Database>) {
  return jsonObjectFrom<Duration>(
    ebX
      .selectFrom('characteristics')
      .select([
        'id',
        'amount'
      ])
      .where(({ eb, and }) => and([
        eb(eb.ref('id'), '=', 'duration_id'),
        eb(eb.ref('type'), '=', 'DURATION')
      ]))
  )
}
