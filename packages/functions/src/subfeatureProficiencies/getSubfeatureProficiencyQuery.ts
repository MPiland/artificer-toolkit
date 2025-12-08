import type { Database } from '@artificer/db'
import type { Kysely } from 'kysely'
import type { SubfeatureProficiency } from '@artificer/shared/types'
import { selectSubfeatureProficiency } from './selectSubfeatureProficiency'

export async function getSubfeatureProficiencyQuery(
  db: Kysely<Database>,
  id: string
): Promise<SubfeatureProficiency | null> {
  return await db
    .selectFrom('subfeature_proficiencies')
    .where('id', '=', id)
    .select((eb) => selectSubfeatureProficiency(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
