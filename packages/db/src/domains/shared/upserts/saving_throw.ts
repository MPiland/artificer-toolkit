import type { DBLike } from '#types'
import type { SavingThrowAuthored } from '@artificer-toolkit/shared'
import { assertNever } from '../../../utils/index.js'

export async function upsertSavingThrow(db: DBLike, json_data: SavingThrowAuthored) {
  const trx = await db.startTransaction().execute()

  const savingThrow = (() => {
    switch (json_data.savingThrowKind) {
      case 'FIXED_VALUE':
        return {
          id: json_data.id,
          ability_code: json_data.ability,
          saving_throw_kind: json_data.savingThrowKind,
          dc: json_data.dc
        }

      case 'SPELL_SAVE_DC':
        return {
          id: json_data.id,
          ability_code: 'SPELLCASTING',
          saving_throw_kind: json_data.savingThrowKind,
          dc: null
        }

      default:
        return assertNever(json_data)
    }
  })()

  try {
    await trx
      .insertInto('saving_throws')
      .values(savingThrow)
      .onConflict((oc) => oc.column('id')
        .doUpdateSet(({ ref }) => ({
          ability_code: ref('excluded.ability_code'),
          saving_throw_kind: ref('excluded.saving_throw_kind'),
          dc: ref('excluded.dc')
        })))
      .executeTakeFirstOrThrow()

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
