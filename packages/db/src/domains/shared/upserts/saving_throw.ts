import type { DBLike } from '#types'
import type { SavingThrowAuthored } from '@artificer-toolkit/shared'

export async function upsertSavingThrow(db: DBLike, json_data: SavingThrowAuthored) {
  const trx = await db.startTransaction().execute()

  const savingThrow = json_data.savingThrowKind === 'FIXED_VALUE'
    ? {
        id: json_data.id,
        ability_code: json_data.ability,
        saving_throw_kind: json_data.savingThrowKind,
        dc: json_data.dc
      }
    : {
        id: json_data.id,
        ability_code: json_data.ability,
        saving_throw_kind: json_data.savingThrowKind,
        dc: null
      }

  try {
    await trx
      .insertInto('saving_throws')
      .values(savingThrow as never)
      .onConflict((oc) => oc.column('id')
        .doUpdateSet(({ ref }) => ({
          ability_code: ref('excluded.ability_code') as never,
          saving_throw_kind: ref('excluded.saving_throw_kind') as never,
          dc: ref('excluded.dc') as never
        })))
      .executeTakeFirstOrThrow()

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
