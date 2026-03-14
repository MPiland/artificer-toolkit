import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { SpellAuthored } from '@artificer-toolkit/shared'

export async function upsertSpell(
  db: DBLike,
  json_data: SpellAuthored,
  systemId: string
) {
  const trx = await db.startTransaction().execute()

  try {
    await sql`
      select public.upsert_spell(${JSON.stringify(json_data)}::jsonb, ${systemId}::uuid)
    `.execute(trx)

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
