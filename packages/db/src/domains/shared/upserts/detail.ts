import type { DBLike } from '#types'
import type { DetailAuthored } from '@artificer-toolkit/shared'
import { withTransaction } from '../../../utils/index.js'

export async function upsertDetail(db: DBLike, json_data: DetailAuthored) {
  return withTransaction(db, async (trx) => {
    await trx.insertInto('details')
      .values({
        id: json_data.id,
        label: json_data.label,
        description: json_data.description,
        sort_order: json_data.order
      })
      .onConflict((oc) => oc.column('id').doUpdateSet((eb) => ({
        label: eb.ref('excluded.label'),
        description: eb.ref('excluded.description'),
        sort_order: eb.ref('excluded.sort_order')
      })))
      .executeTakeFirstOrThrow()

  })
}
