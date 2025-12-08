import type { Database } from '@artificer/db'
import type { Class } from '@artificer/shared/types'
import type { Kysely } from 'kysely'
import { selectClass } from './selectClass'

export const getClassQuery = async (db: Kysely<Database>, id: string): Promise<Class | null> => {
  return await db
    .selectFrom('classes')
    .where('id', '=', id)
    .select((eb) => selectClass(eb).as('value'))
    .executeTakeFirst()
    .then((row) => row?.value ?? null)
}
