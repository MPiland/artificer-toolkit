import {
  type ChargeAuthored,
  type ChargeBonusAuthored
} from '@artificer-toolkit/shared'
import type { DBLike } from '@artificer-toolkit/db/types'
import { assertNever } from '@artificer-toolkit/functions/utils'
import type { SupabaseDatabase } from '@artificer-toolkit/db/types'

export function mapChargeBonusToRow(
  json_data: ChargeBonusAuthored,
  charge_id: string
): Omit<
  SupabaseDatabase['public']['Tables']['charge_bonuses']['Row'],
  'created_at' | 'updated_at'
> {
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
): Omit<
  SupabaseDatabase['public']['Tables']['charge_limits']['Row'],
  'created_at' | 'updated_at'
> | null {
  if (json_data.scalingKind !== 'NONE') return null

  switch (json_data.limitKind) {
    case 'CHARACTER_LEVEL':
      return {
        charge_id,
        limit_kind: 'CHARACTER_LEVEL',
        multiplier: json_data.multiplier ?? null,
        amount: null,
        class_id: null,
        spell_id: null
      }

    case 'CLASS_LEVEL':
      return {
        charge_id,
        limit_kind: 'CLASS_LEVEL',
        class_id: json_data.classId,
        multiplier: json_data.multiplier ?? null,
        amount: null,
        spell_id: null
      }

    case 'FIXED_AMOUNT':
      return {
        charge_id,
        limit_kind: 'FIXED_AMOUNT',
        amount: json_data.amount,
        multiplier: null,
        class_id: null,
        spell_id: null
      }

    case 'SPELL_LEVEL':
      return {
        charge_id,
        limit_kind: 'SPELL_LEVEL',
        spell_id: json_data.spellId,
        multiplier: json_data.multiplier ?? null,
        amount: null,
        class_id: null
      }

    default: {
      return assertNever(json_data)
    }
  }
}

export function mapChargeScalingToRow(
  json_data: ChargeAuthored,
  charge_id: string
): Omit<
  SupabaseDatabase['public']['Tables']['charge_scaling_levels']['Row'],
  'created_at' | 'updated_at'
>[] {
  if (json_data.scalingKind !== 'PER_LEVEL') return []

  return json_data.levels.map((entry) => ({
    charge_id,
    level: entry.level,
    sort_order: entry.order,
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
      .onConflict((oc) => oc.column('id').doUpdateSet({
        scaling_kind: (eb) => eb.ref('excluded.scaling_kind'),
        reset_kind: (eb) => eb.ref('excluded.reset_kind')
      }))
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
              .onConflict((oc) => oc.column('charge_id').doUpdateSet({
                limit_kind: (eb) => eb.ref('excluded.limit_kind'),
                class_id: (eb) => eb.ref('excluded.class_id'),
                spell_id: (eb) => eb.ref('excluded.spell_id'),
                amount: (eb) => eb.ref('excluded.amount'),
                multiplier: (eb) => eb.ref('excluded.multiplier')
              }))
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
            .onConflict((oc) => oc.columns(['charge_id', 'level']).doUpdateSet({
              sort_order: (eb) => eb.ref('excluded.sort_order'),
              amount: (eb) => eb.ref('excluded.amount')
            }))
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
          .onConflict((oc) => oc.columns(['charge_id', 'bonus_kind']).doUpdateSet({
            ability_code: (eb) => eb.ref('excluded.ability_code'),
            skill_id: (eb) => eb.ref('excluded.skill_id'),
            multiplier: (eb) => eb.ref('excluded.multiplier'),
            min: (eb) => eb.ref('excluded.min'),
            max: (eb) => eb.ref('excluded.max'),
            sort_order: (eb) => eb.ref('excluded.sort_order')
          }))
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
