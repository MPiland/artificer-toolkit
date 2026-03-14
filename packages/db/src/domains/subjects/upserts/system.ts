import { sql } from 'kysely'
import type { DBLike } from '#types'
import type { SystemSeedRecord } from '../../../source-data/content.js'

function mapSystemDtoToSqlPayload(json_data: SystemSeedRecord) {
  return {
    ...json_data,
    conditions: json_data.conditionTypes
  }
}

export async function upsertSystem(
  db: DBLike,
  json_data: SystemSeedRecord
) {
  const trx = await db.startTransaction().execute()

  try {
    await sql`
      select public.upsert_system(${JSON.stringify(mapSystemDtoToSqlPayload(json_data))}::jsonb)
    `.execute(trx)

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
