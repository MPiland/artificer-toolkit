import type { Database } from '@artificer/db'
import type { RaceListItem } from '@artificer/shared/types'
import type { Kysely } from 'kysely'
import { details } from '@functions/fragments'

export async function getRacelistQuery(db: Kysely<Database>): Promise<RaceListItem[]> {
  return await db
    .selectFrom('races')
    .select((eb) => [
      'id',
      'label',
      'description',
      'quote',
      'system_id as systemId',
      details(eb, (eb2) => eb2
        .selectFrom('class_details as bridge')
        .whereRef('class_id', '=', 'id')
        .select([
          'bridge.detail_id',
          'bridge.position'
        ])
        .orderBy('position'))
        .as('details'),
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
