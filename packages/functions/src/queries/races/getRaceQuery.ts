import type { DB } from '@artificer-toolkit/functions/types'
import type { Race } from '@artificer-toolkit/shared/types'
import { selectRace } from './selectRace.js'

export async function getRaceQuery(db: DB, id: string): Promise<Race> {
  return await db
    .selectFrom('races')
    .select((eb) => selectRace(eb).as('value'))
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
    .then((row) => row?.value ?? null)
}
