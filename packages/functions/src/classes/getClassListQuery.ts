import type { Database } from '@artificer/db'
import type { ClassListItem } from '@artificer/shared/types'
import { details } from '@functions/fragments/details'
import type { Kysely } from 'kysely'

export const getClassListQuery = async (db: Kysely<Database>): Promise<ClassListItem[]> => {
  return db
    .selectFrom('classes')
    .select((eb) => [
      'id',
      'label',
      'description',
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
