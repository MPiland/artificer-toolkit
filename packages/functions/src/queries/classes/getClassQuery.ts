import type { DB } from '@artificer-toolkit/functions/types'
import type { Class } from '@artificer-toolkit/shared/types'
import { selectClass } from './selectClass.js'

export const getClassQuery = async (db: DB, id: string): Promise<Class | null> => {
  return await db
    .selectFrom('classes')
    .where('id', '=', id)
    .select((eb) => selectClass(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
