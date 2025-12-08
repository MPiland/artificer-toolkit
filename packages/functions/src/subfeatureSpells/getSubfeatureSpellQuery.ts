import type { Database } from '@artificer/db'
import type { Kysely } from 'kysely'
import type { SubfeatureSpell } from '@artificer/shared/types'
import { selectSubfeatureSpell } from './selectSubfeatureSpell'

export async function getSubfeatureSpellQuery(
  db: Kysely<Database>,
  id: string
): Promise<SubfeatureSpell | null> {
  return await db
    .selectFrom('subfeature_spells')
    .where('id', '=', id)
    .select((eb) => selectSubfeatureSpell(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
