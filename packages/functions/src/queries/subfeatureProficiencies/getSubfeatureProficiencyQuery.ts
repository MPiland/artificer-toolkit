import type { DB } from '@artificer-toolkit/functions/types'
import type { SubfeatureProficiency } from '@artificer-toolkit/shared/types'
import { selectSubfeatureProficiency } from './selectSubfeatureProficiency.js'

export async function getSubfeatureProficiencyQuery(
  db: DB,
  id: string
): Promise<SubfeatureProficiency | null> {
  return await db
    .selectFrom('subfeature_proficiencies')
    .where('id', '=', id)
    .select((eb) => selectSubfeatureProficiency(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
