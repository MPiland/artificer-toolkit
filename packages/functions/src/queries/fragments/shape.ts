import type { Database } from '@artificer-toolkit/db/types'
import type { Shape } from '@artificer-toolkit/shared/types'
import type { ExpressionBuilder } from 'kysely'
import { jsonObjectFrom } from 'kysely/helpers/postgres'

export function shape(ebX: ExpressionBuilder<Database, keyof Database>) {
  return jsonObjectFrom<Shape>(
    ebX
      .selectFrom('characteristics')
      .select([
        'id',
        'size',
        'unit_id as unitId'
      ])
      .where(({ eb, and }) => and([
        eb(eb.ref('id'), '=', ebX.ref('shape_id')),
        eb(eb.ref('type'), '=', 'SHAPE')
      ]))
  )
}
