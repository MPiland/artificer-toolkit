import type { DBLike } from '#types'
import { withTransaction } from '../../../utils/index.js'
import {
  EFFECT_KIND,
  type ConditionAuthored,
  type DamageAuthored,
  type EffectAuthored,
  type EffectPathAuthored,
  type OutcomeAuthored
} from '@artificer-toolkit/shared'
import {
  upsertDuration,
  upsertRange,
  upsertSavingThrow,
  upsertShape
} from '../../shared/upserts/index.js'
import {
  mapEffectRow,
  mapEffectGenericOutcomeRow,
  mapEffectPathChoiceOptionRow,
  mapEffectPathRollTableRow,
  mapEffectPathRow,
  mapEffectResultBlockOutcomeRow,
  mapEffectResultBlockRow,
  mapInvocationRow
} from './effect.mappers.js'
import {
  deleteEffectById,
  upsertCondition,
  upsertDamage
} from './effect.persistence.js'

export { deleteEffectById } from './effect.persistence.js'

type PersistableOutcome = DamageAuthored | ConditionAuthored
type PersistableGenericOutcome = Exclude<OutcomeAuthored, PersistableOutcome>

function isRelationalOutcome(outcome: OutcomeAuthored): outcome is PersistableOutcome {
  if (outcome.effectKind === EFFECT_KIND.DAMAGE || outcome.effectKind === EFFECT_KIND.CONDITION) {
    return true
  }

  return false
}

async function upsertGenericOutcome(
  db: DBLike,
  outcome: PersistableGenericOutcome
): Promise<void> {
  await db
    .insertInto('effect_generic_outcomes')
    .values(mapEffectGenericOutcomeRow(outcome))
    .onConflict((oc) => oc.column('id').doUpdateSet((eb) => ({
      effect_kind: eb.ref('excluded.effect_kind'),
      json_data: eb.ref('excluded.json_data')
    })))
    .execute()
}

async function upsertResultBlock(
  db: DBLike,
  effectId: string,
  resultBlock: Extract<EffectPathAuthored, { selectionKind: 'FIXED' }>['resultBlock']
): Promise<void> {
  if (resultBlock.duration) {
    await upsertDuration(db, resultBlock.duration)
  }

  await db
    .insertInto('effect_result_blocks')
    .values(mapEffectResultBlockRow(effectId, resultBlock))
    .execute()

  for (const [index, outcome] of resultBlock.outcomes.entries()) {
    if (isRelationalOutcome(outcome)) {
      if (outcome.effectKind === EFFECT_KIND.DAMAGE) {
        await upsertDamage(db, outcome)
      } else {
        await upsertCondition(db, outcome)
      }
    } else {
      await upsertGenericOutcome(db, outcome)
    }

    await db
      .insertInto('effect_result_block_outcomes')
      .values(mapEffectResultBlockOutcomeRow(resultBlock.id, outcome, index + 1))
      .execute()
  }
}

export async function upsertEffect(db: DBLike, json_data: EffectAuthored): Promise<void> {
  return withTransaction(db, async (trx) => {
    await deleteEffectById(trx, json_data.id)
    const paths = json_data.paths ?? []

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

    for (const path of paths) {
      if (path.rangeOverride) {
        await upsertRange(trx, path.rangeOverride)
      }

      if (path.selectionKind === 'FIXED') {
        await upsertResultBlock(trx, json_data.id, path.resultBlock)

        await trx
          .insertInto('effect_paths')
          .values(mapEffectPathRow(json_data.id, json_data.invocation.triggerCode, path))
          .execute()
        continue
      }

      await trx
        .insertInto('effect_paths')
        .values(mapEffectPathRow(json_data.id, json_data.invocation.triggerCode, path))
        .execute()

      if (path.selectionKind === 'CHOICE') {
        for (const option of path.options) {
          await upsertResultBlock(trx, json_data.id, option.resultBlock)

          await trx
            .insertInto('effect_path_choice_options')
            .values(mapEffectPathChoiceOptionRow(path.id, option))
            .execute()
        }

        continue
      }

      for (const row of path.rows) {
        await upsertResultBlock(trx, json_data.id, row.resultBlock)

        await trx
          .insertInto('effect_path_roll_table_rows')
          .values(mapEffectPathRollTableRow(path.id, row))
          .execute()
      }
    }

  })
}


