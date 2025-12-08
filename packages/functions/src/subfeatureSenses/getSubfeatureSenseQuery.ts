import type { Database } from '@artificer/db'
import type { Kysely } from 'kysely'
import type { SubfeatureSense } from '@artificer/shared/types'
import { selectSubfeatureSense } from './selectSubfeatureSense'

export async function getSubfeatureSenseQuery(
  db: Kysely<Database>,
  id: string
): Promise<SubfeatureSense | null> {
  return await db
    .selectFrom('subfeature_senses')
    .where('id', '=', id)
    .select((eb) => selectSubfeatureSense(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
