import type { DB } from '@artificer-toolkit/functions/types'
import type { Spell } from '@artificer-toolkit/shared/types'
import { selectSpell } from './selectSpells.js'

export async function getSpellQuery(db: DB, id: string): Promise<Spell> {
  return await db
    .selectFrom('spells')
    .select((eb) => selectSpell(eb).as('value'))
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
    .then((row) => row?.value ?? null)
}
