import type { Database } from '@artificer/db'
import type { Spell } from '@artificer/shared/types'
import type { Kysely } from 'kysely'
import { selectSpell } from './selectSpells'

export async function getSpellQuery(db: Kysely<Database>, id: string): Promise<Spell> {
  return await db
    .selectFrom('spells')
    .select((eb) => selectSpell(eb).as('value'))
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
    .then((row) => row?.value ?? null)
}
