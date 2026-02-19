import type { DB } from '@artificer-toolkit/functions/types'
import { selectEquipment } from './selectEquipment.js'
import type { Equipment } from '@artificer-toolkit/shared/types'

export async function getEquipmentQuery(db: DB, id: string): Promise<Equipment | null> {
  return await db
    .selectFrom('equipment')
    .where('id', '=', id)
    .select((eb) => selectEquipment(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
