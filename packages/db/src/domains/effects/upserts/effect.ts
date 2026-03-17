import type { DBLike } from '#types'
import { MOMENT_RESOLUTION_KIND, type EffectAuthored } from '@artificer-toolkit/shared'
import {
  upsertDuration,
  upsertRange,
  upsertSavingThrow,
  upsertShape
} from '../../shared/upserts/index.js'
import {
  mapEffectRow,
  mapInvocationRow,
  mapMomentRow,
  mapRollTableEntryRow,
  EFFECT_KIND
} from './effect.mappers.js'
import {
  deleteEffectById,
  upsertCondition,
  upsertDamage
} from './effect.persistence.js'

export { deleteEffectById } from './effect.persistence.js'

export async function upsertEffect(db: DBLike, json_data: EffectAuthored): Promise<void> {
  const trx = await db.startTransaction().execute()

  try {
    await deleteEffectById(trx, json_data.id)

    await upsertRange(trx, json_data.invocation.range)

    if (json_data.invocation.shape) {
      await upsertShape(trx, json_data.invocation.shape)
    }

    if ('savingThrow' in json_data.invocation) {
      await upsertSavingThrow(trx, json_data.invocation.savingThrow)
    }

    await trx
      .insertInto('effects')
      .values(mapEffectRow(json_data))
      .execute()

    await trx
      .insertInto('effect_invocations')
      .values(mapInvocationRow(json_data))
      .execute()

    for (const moment of json_data.moments) {
      if (moment.resolutionKind === MOMENT_RESOLUTION_KIND.DIRECT && moment.duration) {
        await upsertDuration(trx, moment.duration)
      }

      await trx
        .insertInto('effect_moments')
        .values(mapMomentRow(json_data.id, json_data.invocation.triggerCode, moment))
        .execute()

      if (moment.resolutionKind === MOMENT_RESOLUTION_KIND.DIRECT) {
        if (moment.effectKind === EFFECT_KIND.DAMAGE) {
          await upsertDamage(trx, moment)
          await trx.insertInto('moment_direct_damages').values({
            effect_id: json_data.id,
            trigger_code: json_data.invocation.triggerCode,
            moment_code: moment.moment,
            damage_id: moment.id
          })
            .execute()
        } else {
          await upsertCondition(trx, moment)
          await trx.insertInto('moment_direct_conditions').values({
            effect_id: json_data.id,
            trigger_code: json_data.invocation.triggerCode,
            moment_code: moment.moment,
            condition_id: moment.id
          })
            .execute()
        }

        continue
      }

      for (const [index, entry] of moment.table.entries()) {
        if (entry.duration) {
          await upsertDuration(trx, entry.duration)
        }

        await trx
          .insertInto('moment_roll_table_entries')
          .values(mapRollTableEntryRow(json_data.id, json_data.invocation.triggerCode, moment.moment, index + 1, entry))
          .execute()

        if (entry.effectKind === EFFECT_KIND.DAMAGE) {
          await upsertDamage(trx, entry)
          await trx.insertInto('moment_roll_table_damages').values({
            entry_id: entry.id,
            damage_id: entry.id
          })
            .execute()
        } else {
          await upsertCondition(trx, entry)
          await trx.insertInto('moment_roll_table_conditions').values({
            entry_id: entry.id,
            condition_id: entry.id
          })
            .execute()
        }
      }
    }

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
