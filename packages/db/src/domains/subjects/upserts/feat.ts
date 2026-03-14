import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { FeatAuthored } from '@artificer-toolkit/shared'

export async function upsertFeat(
  db: DBLike,
  json_data: FeatAuthored,
  systemId: string
) {
  const trx = await db.startTransaction().execute()

  try {
    await sql`
      select public.upsert_feat(${JSON.stringify(json_data)}::jsonb, ${systemId}::uuid)
    `.execute(trx)

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
