import type { DB } from '@artificer-toolkit/functions/types'
import type { Feature } from '@artificer-toolkit/shared/types'
import { selectFeature } from './selectFeature.js'

export async function getFeatureQuery(
  db: DB,
  id: string
): Promise<Feature | null> {
  return await db
    .selectFrom('features')
    .where('id', '=', id)
    .select((eb) => selectFeature(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
