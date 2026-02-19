import type { DB } from '@artificer-toolkit/functions/types'
import type { SubfeatureOption } from '@artificer-toolkit/shared/types'
import { selectSubfeatureOption } from './selectSubfeatureOption.js'

export async function getSubfeatureOptionQuery(
  db: DB,
  id: string
): Promise<SubfeatureOption | null> {
  return await db
    .selectFrom('subfeature_options')
    .where('id', '=', id)
    .select((eb) => selectSubfeatureOption(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
