import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { SenseGrantAuthored } from '@artificer-toolkit/shared'

export async function upsertSenseGrant(
  db: DBLike,
  json_data: SenseGrantAuthored
) {
  const trx = await db.startTransaction().execute()

  try {
    await sql`
      select public.upsert_sense_grant(${JSON.stringify(json_data)}::jsonb)
    `.execute(trx)

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
