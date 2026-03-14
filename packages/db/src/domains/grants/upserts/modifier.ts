import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { ModifierGrantAuthored } from '@artificer-toolkit/shared'

export async function upsertModifierGrant(
  db: DBLike,
  json_data: ModifierGrantAuthored
) {
  const trx = await db.startTransaction().execute()

  try {
    await sql`
      select public.upsert_modifier_grant(${JSON.stringify(json_data)}::jsonb)
    `.execute(trx)

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
