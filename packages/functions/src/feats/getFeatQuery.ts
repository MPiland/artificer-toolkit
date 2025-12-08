import type { Database } from '@artificer/db'
import type { Kysely } from 'kysely'
import type { Feat } from '@artificer/shared/types'
import { selectFeat } from './selectFeat'

export async function getFeatQuery(
  db: Kysely<Database>,
  id: string
): Promise<Feat | null> {
  return await db
    .selectFrom('feats')
    .where('id', '=', id)
    .select((eb) => selectFeat(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
