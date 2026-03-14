import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { EffectAuthored } from '@artificer-toolkit/shared'

export async function upsertEffect(db: DBLike, json_data: EffectAuthored) {
  const trx = await db.startTransaction().execute()

  try {
    await sql`
      select public.upsert_effect(${JSON.stringify(json_data)}::jsonb)
    `.execute(trx)

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
