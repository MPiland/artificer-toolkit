import type { DB } from '@artificer-toolkit/functions/types'
import type { Background } from '@artificer-toolkit/shared/types'
import { selectBackground } from './selectBackground.js'

export async function getBackgroundQuery(
  db: DB,
  id: string
): Promise<Background | null> {
  return await db
    .selectFrom('backgrounds')
    .select((eb) => selectBackground(eb).as('value'))
    .where('id', '=', id)
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
