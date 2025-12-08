import type { Database } from '@artificer/db'
import type { Kysely } from 'kysely'
import type { SubfeatureOption } from '@artificer/shared/types'
import { selectSubfeatureOption } from './selectSubfeatureOption'

export async function getSubfeatureOptionQuery(
  db: Kysely<Database>,
  id: string
): Promise<SubfeatureOption | null> {
  return await db
    .selectFrom('subfeature_options')
    .where('id', '=', id)
    .select((eb) => selectSubfeatureOption(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
