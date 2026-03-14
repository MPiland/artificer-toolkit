import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { BackgroundAuthored } from '@artificer-toolkit/shared'

export async function upsertBackground(
  db: DBLike,
  json_data: BackgroundAuthored,
  systemId: string
) {
  const trx = await db.startTransaction().execute()

  try {
    await sql`
      select public.upsert_background(${JSON.stringify(json_data)}::jsonb, ${systemId}::uuid)
    `.execute(trx)

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
