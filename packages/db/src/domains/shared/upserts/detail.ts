import type { DBLike } from '@db-types'
import type { DetailAuthored } from '@artificer-toolkit/shared'

export async function upsertDetail(db: DBLike, json_data: DetailAuthored) {
  const trx = await db.startTransaction().execute()

  try {
    await trx.insertInto('details')
      .values({
        id: json_data.id,
        label: json_data.label,
        description: json_data.description,
        sort_order: json_data.order
      })
      .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
        label: ref('excluded.label'),
        description: ref('excluded.description'),
        sort_order: ref('excluded.sort_order')
      })))
      .executeTakeFirstOrThrow()

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
