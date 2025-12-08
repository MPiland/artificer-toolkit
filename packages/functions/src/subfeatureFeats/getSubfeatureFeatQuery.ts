import type { Database } from '@artificer/db'
import type { Kysely } from 'kysely'
import type { SubfeatureFeat } from '@artificer/shared/types'
import { selectSubfeatureFeat } from './selectSubfeatureFeat'

export async function getSubfeatureFeatQuery(
  db: Kysely<Database>,
  id: string
): Promise<SubfeatureFeat | null> {
  return await db
    .selectFrom('subfeature_feats')
    .where('id', '=', id)
    .select((eb) => selectSubfeatureFeat(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
