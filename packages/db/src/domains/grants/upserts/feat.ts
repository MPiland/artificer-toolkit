import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { FeatGrantAuthored } from '@artificer-toolkit/shared'

export async function upsertFeatGrant(db: DBLike, json_data: FeatGrantAuthored) {
  const trx = await db.startTransaction().execute()

  try {
    await sql`
      select public.upsert_feat_grant(${JSON.stringify(json_data)}::jsonb)
    `.execute(trx)

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
