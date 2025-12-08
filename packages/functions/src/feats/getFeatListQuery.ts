import type { Database } from '@artificer/db'
import type { FeatListItem } from '@artificer/shared/types'
import type { Kysely } from 'kysely'

export async function getFeatListQuery(db: Kysely<Database>): Promise<FeatListItem[]> {
  return db
    .selectFrom('feats')
    .select((eb) => [
      'id as id',
      'label as label',
      'description as description',
      'detail as detail',
      'system_id as systemId',
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
