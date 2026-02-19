import type { DB } from '@artificer-toolkit/functions/types'
import type { System } from '@artificer-toolkit/shared/types'
import { selectSystem } from './selectSystem.js'

export async function getSystemQuery(db: DB, id: string): Promise<System> {
  return await db
    .selectFrom('systems')
    .select((eb) => selectSystem(eb).as('value'))
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
    .then((row) => row?.value ?? null)
}
