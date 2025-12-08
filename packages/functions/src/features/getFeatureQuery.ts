import type { Database } from '@artificer/db'
import type { Kysely } from 'kysely'
import type { Feature } from '@artificer/shared/types'
import { selectFeature } from './selectFeature'

export async function getFeatureQuery(
  db: Kysely<Database>,
  id: string
): Promise<Feature | null> {
  return await db
    .selectFrom('features')
    .where('id', '=', id)
    .select((eb) => selectFeature(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
