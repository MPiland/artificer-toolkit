import type { Database } from '@artificer/db'
import type { SpellListItem } from '@artificer/shared/types'
import type { Kysely } from 'kysely'

export async function getSpellListQuery(db: Kysely<Database>): Promise<SpellListItem[]> {
  return await db
    .selectFrom('spells')
    .select((eb) => [
      'id',
      'label',
      'description',
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
