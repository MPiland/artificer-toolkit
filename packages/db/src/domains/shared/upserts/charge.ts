import {
  type ChargeAuthored,
  type ChargeBonusAuthored
} from '@artificer-toolkit/shared'
import type { DBLike } from '@artificer-toolkit/db/types'
import { assertNever } from '../../../utils/index.js'

type ChargeBonusRow = {
  charge_id: string
  bonus_kind: string
  ability_code: string | null
  skill_id: string | null
  multiplier: number | null
  min: number | null
  max: number | null
  sort_order: number
}

type ChargeLimitRow = {
  charge_id: string
  limit_kind: string
  amount: number | null
  multiplier: number | null
  min: number | null
  max: number | null
}

type ChargeScalingLevelRow = {
  charge_id: string
  level: number
  sort_order: number
  amount: number
}

export function mapChargeBonusToRow(
  json_data: ChargeBonusAuthored,
  charge_id: string
): ChargeBonusRow {
  switch (json_data.bonusKind) {
    case 'ABILITY_MODIFIER': {
      return {
        charge_id: charge_id,
        bonus_kind: json_data.bonusKind,
        ability_code: json_data.ability,
        multiplier: json_data.multiplier ?? null,
        max: json_data.max ?? null,
        min: json_data.min ?? null,
        skill_id: null,
        sort_order: json_data.order
      }
    }

    case 'SKILL_BONUS': {
      return {
        charge_id: charge_id,
        bonus_kind: json_data.bonusKind,
        ability_code: null,
        multiplier: json_data.multiplier ?? null,
        max: json_data.max ?? null,
        min: json_data.min ?? null,
        skill_id: json_data.skillId,
        sort_order: json_data.order
      }
    }

    case 'PROFICIENCY_BONUS': {
      return {
        charge_id: charge_id,
        bonus_kind: json_data.bonusKind,
        ability_code: null,
        multiplier: json_data.multiplier ?? null,
        max: json_data.max ?? null,
        min: json_data.min ?? null,
        skill_id: null,
        sort_order: json_data.order
      }
    }

    default: {
      assertNever(json_data)
    }
  }
}

export function mapChargeLimitToRow(
  json_data: ChargeAuthored,
  charge_id: string
): ChargeLimitRow | null {
  if (json_data.scalingKind !== 'NONE') return null

  switch (json_data.limitKind) {
    case 'CHARACTER_LEVEL':
    case 'SOURCE_LEVEL':
      return {
        charge_id,
        limit_kind: json_data.limitKind,
        multiplier: json_data.multiplier ?? null,
        amount: null,
        min: json_data.min ?? null,
        max: json_data.max ?? null
      }

    case 'FIXED_AMOUNT':
      return {
        charge_id,
        limit_kind: 'FIXED_AMOUNT',
        amount: json_data.amount,
        multiplier: null,
        min: null,
        max: null
      }

    default: {
      return assertNever(json_data)
    }
  }
}

export function mapChargeScalingToRow(
  json_data: ChargeAuthored,
  charge_id: string
): ChargeScalingLevelRow[] {
  if (json_data.scalingKind !== 'PER_LEVEL') return []

  return json_data.levels.map((entry) => ({
    charge_id,
    level: entry.level,
    sort_order: entry.level,
    amount: entry.amount
  }))
}

export async function upsertCharge(db: DBLike, json_data: ChargeAuthored) {
  const trx = await db.startTransaction().execute()
  try {
    const charge = await trx
      .insertInto('charges')
      .values({
        id: json_data.id,
        scaling_kind: json_data.scalingKind,
        reset_kind: json_data.resetKind
      })
      .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
        scaling_kind: ref('excluded.scaling_kind'),
        reset_kind: ref('excluded.reset_kind')
      })))
      .returning('id')
      .executeTakeFirstOrThrow()

    const trxAfterCharge = await trx.savepoint('after_charge').execute()

    switch (json_data.scalingKind) {
      case 'NONE': {
        try {
          await trx
            .deleteFrom('charge_scaling_levels')
            .where('charge_id', '=', charge.id)
            .execute()

          const limit = mapChargeLimitToRow(json_data, charge.id)

          if (limit) {
            await trx
              .insertInto('charge_limits')
              .values(limit)
              .onConflict((oc) => oc.column('charge_id').doUpdateSet(limit as never))
              .executeTakeFirstOrThrow()
          }
        } catch (error) {
          await trxAfterCharge.rollbackToSavepoint('after_charge').execute()
          throw error
        }
        break
      }

      case 'PER_LEVEL': {
        try {
          await trx
            .deleteFrom('charge_limits')
            .where('charge_id', '=', charge.id)
            .execute()

          const levels = mapChargeScalingToRow(json_data, charge.id)
          const levelNumbers = levels.map((level) => level.level)

          await trx
            .deleteFrom('charge_scaling_levels')
            .where((eb) => eb.and([
              eb('charge_id', '=', charge.id),
              eb('level', 'not in', levelNumbers)
            ]))
            .execute()

          await trx
            .insertInto('charge_scaling_levels')
            .values(levels)
            .onConflict((oc) => oc.columns(['charge_id', 'level']).doUpdateSet(({ ref }) => ({
              sort_order: ref('excluded.sort_order'),
              amount: ref('excluded.amount')
            })))
            .executeTakeFirstOrThrow()
        } catch (error) {
          await trxAfterCharge.rollbackToSavepoint('after_charge').execute()
          throw error
        }

        break
      }

      default: {
        assertNever(json_data)
      }
    }

    if (json_data.bonuses && json_data.bonuses.length) {
      const bonuses = json_data.bonuses.map((bonus) => mapChargeBonusToRow(bonus, charge.id))

      const bonusKinds = bonuses.map((bonus) => bonus.bonus_kind)
      try {
        await trx
          .deleteFrom('charge_bonuses')
          .where((eb) => eb.and([
            eb('charge_id', '=', charge.id),
            eb('bonus_kind', 'not in', bonusKinds)
          ]))
          .execute()
        await trx
          .insertInto('charge_bonuses')
          .values(bonuses)
          .onConflict((oc) => oc.columns(['charge_id', 'bonus_kind']).doUpdateSet(({ ref }) => ({
            ability_code: ref('excluded.ability_code'),
            skill_id: ref('excluded.skill_id'),
            multiplier: ref('excluded.multiplier'),
            min: ref('excluded.min'),
            max: ref('excluded.max'),
            sort_order: ref('excluded.sort_order')
          })))
          .executeTakeFirstOrThrow()
      } catch (error) {
        await trxAfterCharge.rollbackToSavepoint('after_charge').execute()
        throw error
      }
    } else {
      await trx
        .deleteFrom('charge_bonuses')
        .where('charge_id', '=', charge.id)
        .execute()
    }

    await trxAfterCharge.releaseSavepoint('after_charge').execute()

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
