import type { DB } from '@artificer-toolkit/functions/types'
import type { SubfeatureFeat } from '@artificer-toolkit/shared/types'
import { selectSubfeatureFeat } from './selectSubfeatureFeat.js'

export async function getSubfeatureFeatQuery(
  db: DB,
  id: string
): Promise<SubfeatureFeat | null> {
  return await db
    .selectFrom('subfeature_feats')
    .where('id', '=', id)
    .select((eb) => selectSubfeatureFeat(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
