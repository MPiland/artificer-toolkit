import type { Database } from '@artificer/db'
import type { Kysely } from 'kysely'
import type { SubfeatureExpertise } from '@artificer/shared/types'
import { selectSubfeatureExpertise } from './selectSubfeatureExpertise'

export async function getSubfeatureExpertiseQuery(
  db: Kysely<Database>,
  id: string
): Promise<SubfeatureExpertise | null> {
  return await db
    .selectFrom('subfeature_expertise')
    .where('id', '=', id)
    .select((eb) => selectSubfeatureExpertise(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
