import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { ClassAuthored } from '@artificer-toolkit/shared'

export async function upsertClass(
  db: DBLike,
  json_data: ClassAuthored,
  systemId: string
) {
  const trx = await db.startTransaction().execute()

  try {
    await sql`
      select public.upsert_class(${JSON.stringify(json_data)}::jsonb, ${systemId}::uuid)
    `.execute(trx)

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
