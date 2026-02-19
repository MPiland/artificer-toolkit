import type { DB } from '@artificer-toolkit/functions/types'
import type { SubfeatureSense } from '@artificer-toolkit/shared/types'
import { selectSubfeatureSense } from './selectSubfeatureSense.js'

export async function getSubfeatureSenseQuery(
  db: DB,
  id: string
): Promise<SubfeatureSense | null> {
  return await db
    .selectFrom('subfeature_senses')
    .where('id', '=', id)
    .select((eb) => selectSubfeatureSense(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
