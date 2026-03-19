import type { DBLike } from '#types'
import {
  EFFECT_KIND,
  BRANCH_RESOLUTION_KIND,
  type ConditionAuthored,
  type DamageAuthored,
  type EffectAuthored
} from '@artificer-toolkit/shared'
import {
  upsertDuration,
  upsertRange,
  upsertSavingThrow,
  upsertShape
} from '../../shared/upserts/index.js'
import {
  mapEffectRow,
  mapInvocationRow,
  mapBranchRow,
  mapBranchRollTableEntryRow
} from './effect.mappers.js'
import {
  deleteEffectById,
  upsertCondition,
  upsertDamage
} from './effect.persistence.js'

export { deleteEffectById } from './effect.persistence.js'

type PersistableOutcome = DamageAuthored | ConditionAuthored

function assertPersistableOutcome(ownerId: string, outcome: { effectKind: string }): asserts outcome is PersistableOutcome {
  if (outcome.effectKind === EFFECT_KIND.DAMAGE || outcome.effectKind === EFFECT_KIND.CONDITION) {
    return
  }

  throw new Error(
    `Effect "${ownerId}" uses outcome kind "${outcome.effectKind}", but DB persistence currently supports only DAMAGE and CONDITION branches.`
  )
}

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

    for (const branch of json_data.branches) {
      if (branch.resolutionKind === BRANCH_RESOLUTION_KIND.DIRECT && branch.duration) {
        await upsertDuration(trx, branch.duration)
      }

      await trx
        .insertInto('effect_branches')
        .values(mapBranchRow(json_data.id, json_data.invocation.triggerCode, branch))
        .execute()

      if (branch.resolutionKind === BRANCH_RESOLUTION_KIND.DIRECT) {
        assertPersistableOutcome(json_data.id, branch)

        if (branch.effectKind === EFFECT_KIND.DAMAGE) {
          await upsertDamage(trx, branch)
          await trx.insertInto('branch_direct_damages').values({
            effect_id: json_data.id,
            trigger_code: json_data.invocation.triggerCode,
            branch_code: branch.branch,
            damage_id: branch.id
          })
            .execute()
        } else {
          await upsertCondition(trx, branch)
          await trx.insertInto('branch_direct_conditions').values({
            effect_id: json_data.id,
            trigger_code: json_data.invocation.triggerCode,
            branch_code: branch.branch,
            condition_id: branch.id
          })
            .execute()
        }

        continue
      }

      for (const [index, entry] of branch.table.entries()) {
        if (entry.duration) {
          await upsertDuration(trx, entry.duration)
        }

        await trx
          .insertInto('branch_roll_table_entries')
          .values(mapBranchRollTableEntryRow(json_data.id, json_data.invocation.triggerCode, branch.branch, index + 1, entry))
          .execute()

        assertPersistableOutcome(json_data.id, entry)

        if (entry.effectKind === EFFECT_KIND.DAMAGE) {
          await upsertDamage(trx, entry)
          await trx.insertInto('branch_roll_table_damages').values({
            entry_id: entry.id,
            damage_id: entry.id
          })
            .execute()
        } else {
          await upsertCondition(trx, entry)
          await trx.insertInto('branch_roll_table_conditions').values({
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
