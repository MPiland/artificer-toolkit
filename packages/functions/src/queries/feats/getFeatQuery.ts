import type { DB } from '@artificer-toolkit/functions/types'
import type { Feat } from '@artificer-toolkit/shared/types'
import { selectFeat } from './selectFeat.js'

export async function getFeatQuery(
  db: DB,
  id: string
): Promise<Feat | null> {
  return await db
    .selectFrom('feats')
    .where('id', '=', id)
    .select((eb) => selectFeat(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
