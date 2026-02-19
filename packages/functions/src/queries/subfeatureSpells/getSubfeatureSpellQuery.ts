import type { DB } from '@artificer-toolkit/functions/types'
import type { SubfeatureSpell } from '@artificer-toolkit/shared/types'
import { selectSubfeatureSpell } from './selectSubfeatureSpell.js'

export async function getSubfeatureSpellQuery(
  db: DB,
  id: string
): Promise<SubfeatureSpell | null> {
  return await db
    .selectFrom('subfeature_spells')
    .where('id', '=', id)
    .select((eb) => selectSubfeatureSpell(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
