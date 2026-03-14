import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { OptionAuthored } from '@artificer-toolkit/shared'

export async function upsertOption(db: DBLike, json_data: OptionAuthored) {
  const trx = await db.startTransaction().execute()

  try {
    await sql`
      select public.upsert_feature_option(${JSON.stringify(json_data)}::jsonb)
    `.execute(trx)

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
