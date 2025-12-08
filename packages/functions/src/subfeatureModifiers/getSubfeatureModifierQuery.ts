import type { Database } from '@artificer/db'
import type { Kysely } from 'kysely'
import type { SubfeatureModifier } from '@artificer/shared/types'
import { selectSubfeatureModifier } from './selectSubfeatureModifier'

export async function getSubfeatureModifierQuery(
  db: Kysely<Database>,
  id: string
): Promise<SubfeatureModifier | null> {
  return await db
    .selectFrom('subfeature_modifiers')
    .where('id', '=', id)
    .select((eb) => selectSubfeatureModifier(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
