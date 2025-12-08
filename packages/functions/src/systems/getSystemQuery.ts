import type { Database } from '@artificer/db'
import type { System } from '@artificer/shared/types'
import type { Kysely } from 'kysely'
import { selectSystem } from './selectSystem'

export async function getSystemQuery(db: Kysely<Database>, id: string): Promise<System> {
  return await db
    .selectFrom('systems')
    .select((eb) => selectSystem(eb).as('value'))
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
    .then((row) => row?.value ?? null)
}
