import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { SpellGrantAuthored } from '@artificer-toolkit/shared'

export async function upsertSpellGrant(
  db: DBLike,
  json_data: SpellGrantAuthored
) {
  const trx = await db.startTransaction().execute()

  try {
    await sql`
      select public.upsert_spell_grant(${JSON.stringify(json_data)}::jsonb)
    `.execute(trx)

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
