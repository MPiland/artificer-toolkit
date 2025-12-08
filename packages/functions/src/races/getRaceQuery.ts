import type { Database } from '@artificer/db'
import type { Race } from '@artificer/shared/types'
import type { Kysely } from 'kysely'
import { selectRace } from './selectRace'

export async function getRaceQuery(db: Kysely<Database>, id: string): Promise<Race> {
  return await db
    .selectFrom('races')
    .select((eb) => selectRace(eb).as('value'))
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
    .then((row) => row?.value ?? null)
}
