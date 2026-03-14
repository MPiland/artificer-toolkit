import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { FeatureAuthored } from '@artificer-toolkit/shared'

export async function upsertFeature(db: DBLike, json_data: FeatureAuthored) {
  const trx = await db.startTransaction().execute()

  try {
    await sql`
      select public.upsert_feature(${JSON.stringify(json_data)}::jsonb)
    `.execute(trx)

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
