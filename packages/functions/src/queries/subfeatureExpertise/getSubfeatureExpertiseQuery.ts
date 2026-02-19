import type { DB } from '@artificer-toolkit/functions/types'
import type { SubfeatureExpertise } from '@artificer-toolkit/shared/types'
import { selectSubfeatureExpertise } from './selectSubfeatureExpertise.js'

export async function getSubfeatureExpertiseQuery(
  db: DB,
  id: string
): Promise<SubfeatureExpertise | null> {
  return await db
    .selectFrom('subfeature_expertise')
    .where('id', '=', id)
    .select((eb) => selectSubfeatureExpertise(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
