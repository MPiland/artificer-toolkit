import type { Database } from '@artificer/db'
import type { EquipmentListItem } from '@artificer/shared/types'
import type { Kysely } from 'kysely'

export async function getEquipmentListQuery(db: Kysely<Database>): Promise<EquipmentListItem[]> {
  return await db
    .selectFrom('equipment')
    .select((eb) => [
      'id',
      'label',
      'description',
      'quote',
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
