import type { Database } from '@artificer/db'
import type { BackgroundListItem } from '@artificer/shared/types'
import { details } from '@functions/fragments'
import type { Kysely } from 'kysely'

export const getBackgroundListQuery = async (db: Kysely<Database>): Promise<BackgroundListItem[]> => {
  return db
    .selectFrom('backgrounds')
    .select((eb) => [
      'id as id',
      'label as label',
      'description as description',
      'system_id as systemId',
      details(eb, (eb2) => eb2
        .selectFrom('background_details as bridge')
        .whereRef('background_id', '=', 'id')
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
