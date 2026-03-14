import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { EquipmentAuthored } from '@artificer-toolkit/shared'

export async function upsertEquipment(
  db: DBLike,
  json_data: EquipmentAuthored,
  systemId: string
) {
  const trx = await db.startTransaction().execute()

  try {
    await sql`
      select public.upsert_equipment(${JSON.stringify(json_data)}::jsonb, ${systemId}::uuid)
    `.execute(trx)

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
