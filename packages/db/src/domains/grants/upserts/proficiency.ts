import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { ProficiencyGrantAuthored } from '@artificer-toolkit/shared'

export async function upsertProficiencyGrant(
  db: DBLike,
  json_data: ProficiencyGrantAuthored
) {
  const trx = await db.startTransaction().execute()

  try {
    await sql`
      select public.upsert_proficiency_grant(${JSON.stringify(json_data)}::jsonb)
    `.execute(trx)

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
