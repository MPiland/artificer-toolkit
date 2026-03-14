import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { StartingEquipmentAuthored } from '@artificer-toolkit/shared'

/**
 * Starting equipment is already normalized through nested SQL procedures.
 * The TS wrapper keeps the authored shape at the package boundary and
 * delegates the tree write to the database-owned upsert routine.
 */
export async function upsertStartingEquipment(
  db: DBLike,
  json_data: StartingEquipmentAuthored
) {
  const trx = await db.startTransaction().execute()

  try {
    await sql`
      select public.upsert_starting_equipment(${JSON.stringify(json_data)}::jsonb)
    `.execute(trx)

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
