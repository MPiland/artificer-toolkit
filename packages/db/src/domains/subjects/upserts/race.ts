import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { RaceAuthored } from '@artificer-toolkit/shared'

export async function upsertRace(
  db: DBLike,
  json_data: RaceAuthored,
  systemId: string
) {
  const trx = await db.startTransaction().execute()

  try {
    await sql`
      select public.upsert_race(${JSON.stringify(json_data)}::jsonb, ${systemId}::uuid)
    `.execute(trx)

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
