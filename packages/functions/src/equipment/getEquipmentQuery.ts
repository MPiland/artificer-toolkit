import type { Database } from '@artificer/db'
import type { Expression } from 'kysely'
import type { Kysely } from 'kysely'
import { selectEquipment } from './selectEquipment'
import type { Equipment } from '@artificer/shared/types'

export async function getEquipmentQuery(db: Kysely<Database>, id: Expression<string>): Promise<Equipment | null> {
  return await db
    .selectFrom('equipment')
    .where('id', '=', id)
    .select((eb) => selectEquipment(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
