import type { DBLike } from '#types'
import { withTransaction } from '../../../utils/index.js'
import type { SavingThrowAuthored, SavingThrowDcBonusAuthored } from '@artificer-toolkit/shared'

function mapBonusRow(savingThrowId: string, bonus: SavingThrowDcBonusAuthored, index: number) {
  return {
    id: bonus.id,
    saving_throw_id: savingThrowId,
    sort_order: index + 1,
    bonus_kind: bonus.bonusKind,
    ability_code: bonus.bonusKind === 'ABILITY_MODIFIER' ? bonus.ability : null,
    amount: bonus.bonusKind === 'STATIC_BONUS' ? bonus.amount : null
  }
}

export async function upsertSavingThrow(db: DBLike, json_data: SavingThrowAuthored) {
  const savingThrow = json_data.dcMethod === 'SOURCE_SAVE_DC'
    ? {
        id: json_data.id,
        ability_code: json_data.ability,
        dc_method: json_data.dcMethod,
        base_dc: null
      }
    : {
        id: json_data.id,
        ability_code: json_data.ability,
        dc_method: json_data.dcMethod,
        base_dc: json_data.baseDc
      }

  return withTransaction(db, async (trx) => {
    await trx
      .insertInto('saving_throws')
      .values(savingThrow as never)
      .onConflict((oc) => oc.column('id')
        .doUpdateSet((eb) => ({
          ability_code: eb.ref('excluded.ability_code') as never,
          dc_method: eb.ref('excluded.dc_method') as never,
          base_dc: eb.ref('excluded.base_dc') as never
        })))
      .executeTakeFirstOrThrow()

    await trx.deleteFrom('saving_throw_dc_bonuses')
      .where('saving_throw_id', '=', json_data.id)
      .execute()

    if (json_data.dcMethod !== 'SOURCE_SAVE_DC' && json_data.bonuses?.length) {
      await trx
        .insertInto('saving_throw_dc_bonuses')
        .values(json_data.bonuses.map((bonus, index) => mapBonusRow(json_data.id, bonus, index)) as never)
        .execute()
    }

  })
}
