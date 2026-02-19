import type { DB } from '@artificer-toolkit/functions/types'
import type { SubfeatureModifier } from '@artificer-toolkit/shared/types'
import { selectSubfeatureModifier } from './selectSubfeatureModifier.js'

export async function getSubfeatureModifierQuery(
  db: DB,
  id: string
): Promise<SubfeatureModifier | null> {
  return await db
    .selectFrom('subfeature_modifiers')
    .where('id', '=', id)
    .select((eb) => selectSubfeatureModifier(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
