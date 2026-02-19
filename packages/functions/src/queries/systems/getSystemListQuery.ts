import type { DB } from '@artificer-toolkit/functions/types'
import type { SystemListItem } from '@artificer-toolkit/shared/types'

export async function getSystemListQuery(db: DB): Promise<SystemListItem[]> {
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
