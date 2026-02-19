import type { DBLike } from '#types'
import { assertNever } from '@artificer-toolkit/functions'
import type { SavingThrowAuthored } from '@artificer-toolkit/shared'

export async function upsertSavingThrow(db: DBLike, json_data: SavingThrowAuthored) {
  const trx = await db.startTransaction().execute()

  const savingThrow = (() => {
    switch (json_data.savingThrowKind) {
      case 'FIXED_VALUE':
        return {
          id: json_data.id,
          ability: json_data.ability,
          saving_throw_kind: json_data.savingThrowKind,
          dc: json_data.dc
        }

      case 'SPELL_SAVE_DC':
        return {
          id: json_data.id,
          ability: json_data.ability,
          saving_throw_kind: json_data.savingThrowKind
        }

      default:
        return assertNever(json_data)
    }
  })()

  try {
    await trx.insertInto('saving_throws')
      .values(savingThrow)
      .onConflict((oc) => oc.column('id')
        .doUpdateSet({
          ability: (eb) => eb.ref('excluded.ability'),
          saving_throw_kind: (eb) => eb.ref('excluded.saving_throw_kind'),
          dc: (eb) => eb.ref('excluded.dc')
        }))
      .executeTakeFirstOrThrow()

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
