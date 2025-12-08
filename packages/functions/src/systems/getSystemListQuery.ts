import type { Database } from '@artificer/db'
import type { SystemListItem } from '@artificer/shared/types'
import type { Kysely } from 'kysely'

export async function getSystemQueryList(db: Kysely<Database>): Promise<SystemListItem[]> {
  return await db
    .selectFrom('systems')
    .select((eb) => [
      'id',
      'label',
      'description',
      eb
        .case()
        .when(eb.ref('is_master'), 'is', true)
        .then('master')
        .else(eb.ref('user_id'))
        .end()
        .$notNull()
        .as('userId')
    ])
    .execute()
    .then((rows) => rows?.length ? rows : [])
}
