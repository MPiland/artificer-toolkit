import type { Database } from '@artificer/db'
import type { Kysely } from 'kysely'
import type { Background } from '@artificer/shared/types'
import { selectBackground } from './selectBackground'

export async function getBackgroundQuery(
  db: Kysely<Database>,
  id: string
): Promise<Background | null> {
  return await db
    .selectFrom('backgrounds')
    .select((eb) => selectBackground(eb).as('value'))
    .where('id', '=', id)
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
