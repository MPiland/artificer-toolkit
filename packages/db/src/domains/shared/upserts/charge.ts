import {
  ABILITY_CODE,
  type ChargeAuthored,
  type ChargeBonusAuthored
} from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { assertNever } from '../../../utils/index.js'

type ChargeAuthoredWrite = ChargeAuthored | ({
  limitKind: 'CLASS_LEVEL'
  scalingKind: 'NONE'
  classId: string
  multiplier?: number
  min?: number
  max?: number
} | {
  limitKind: 'PARENT_CLASS_LEVEL' | 'SPELL_CAST_LEVEL'
  scalingKind: 'NONE'
  multiplier?: number
  min?: number
  max?: number
}) & Pick<ChargeAuthored, 'id' | 'resetKind' | 'bonuses'>

type ChargeBonusRow = {
  id: string
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
  class_id: string | null
  ability_code: string | null
  amount: number | null
  multiplier: number | null
  min: number | null
  max: number | null
}

type ChargeScalingLevelRow = {
  id: string
  charge_id: string
  level: number
  sort_order: number
  amount: number
}

function requireChargeResetKind(
  chargeId: string,
  value: string
): ChargeAuthored['resetKind'] {
  if (value !== 'LONG_REST' && value !== 'SHORT_REST' && value !== 'MANUAL') {
    throw new Error(`Charge "${chargeId}" has invalid resetKind "${value}".`)
  }

  return value
}

function requireChargeScalingKind(
  chargeId: string,
  value: string
): ChargeAuthored['scalingKind'] {
  if (value !== 'NONE' && value !== 'PER_LEVEL') {
    throw new Error(`Charge "${chargeId}" has invalid scalingKind "${value}".`)
  }

  return value
}

function requireChargeLimitKind(
  chargeId: string,
  value: string
): void {
  if (
    value !== 'FIXED_AMOUNT'
    && value !== 'CHARACTER_LEVEL'
    && value !== 'CLASS_LEVEL'
    && value !== 'PARENT_CLASS_LEVEL'
    && value !== 'SPELL_CAST_LEVEL'
  ) {
    throw new Error(`Charge "${chargeId}" has invalid limitKind "${value}".`)
  }
}

function requireAbilityCode(
  bonusId: string,
  value: string
): string {
  if (!(value in ABILITY_CODE)) {
    throw new Error(`Charge bonus "${bonusId}" has invalid ability "${value}".`)
  }

  return value
}

function requireClassId(
  chargeId: string,
  classId: string | undefined
): string {
  if (!classId) {
    throw new Error(`Charge "${chargeId}" is missing classId for CLASS_LEVEL limit.`)
  }

  return classId
}

function requireFixedAmount(
  chargeId: string,
  amount: number | undefined
): number {
  if (amount == null) {
    throw new Error(`Charge "${chargeId}" is missing amount for FIXED_AMOUNT limit.`)
  }

  return amount
}

function requireScalingLevels(
  chargeId: string,
  levels: { id: string, level: number, amount: number }[] | undefined
): { id: string, level: number, amount: number }[] {
  if (!levels) {
    throw new Error(`Charge "${chargeId}" is missing levels for PER_LEVEL scaling.`)
  }

  return levels
}

export function mapChargeBonusToRow(
  json_data: ChargeBonusAuthored,
  charge_id: string
): ChargeBonusRow {
  switch (json_data.bonusKind) {
    case 'ABILITY_MODIFIER': {
      return {
        id: json_data.id,
        charge_id: charge_id,
        bonus_kind: json_data.bonusKind,
        ability_code: requireAbilityCode(json_data.id, json_data.ability),
        multiplier: json_data.multiplier ?? null,
        max: json_data.max ?? null,
        min: json_data.min ?? null,
        skill_id: null,
        sort_order: json_data.order
      }
    }

    case 'SKILL_BONUS': {
      return {
        id: json_data.id,
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
        id: json_data.id,
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
  json_data: ChargeAuthoredWrite,
  charge_id: string
): ChargeLimitRow | null {
  if (json_data.scalingKind !== 'NONE') return null

  requireChargeLimitKind(charge_id, json_data.limitKind)

  switch (json_data.limitKind) {
    case 'ABILITY_MODIFIER':
      return {
        charge_id,
        limit_kind: json_data.limitKind,
        class_id: null,
        ability_code: requireAbilityCode(charge_id, json_data.ability),
        amount: null,
        multiplier: json_data.multiplier ?? null,
        min: json_data.min ?? null,
        max: json_data.max ?? null
      }

    case 'CHARACTER_LEVEL':
      return {
        charge_id,
        limit_kind: json_data.limitKind,
        class_id: null,
        ability_code: null,
        multiplier: json_data.multiplier ?? null,
        amount: null,
        min: json_data.min ?? null,
        max: json_data.max ?? null
      }

    case 'CLASS_LEVEL':
      return {
        charge_id,
        limit_kind: json_data.limitKind,
        class_id: requireClassId(charge_id, json_data.classId),
        ability_code: null,
        multiplier: json_data.multiplier ?? null,
        amount: null,
        min: json_data.min ?? null,
        max: json_data.max ?? null
      }

    case 'PARENT_CLASS_LEVEL':
    case 'SPELL_CAST_LEVEL':
      return {
        charge_id,
        limit_kind: json_data.limitKind,
        class_id: null,
        ability_code: null,
        multiplier: json_data.multiplier ?? null,
        amount: null,
        min: json_data.min ?? null,
        max: json_data.max ?? null
      }

    case 'FIXED_AMOUNT':
      return {
        charge_id,
        limit_kind: json_data.limitKind,
        class_id: null,
        ability_code: null,
        amount: requireFixedAmount(charge_id, json_data.amount),
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
  json_data: ChargeAuthoredWrite,
  charge_id: string
): ChargeScalingLevelRow[] {
  if (json_data.scalingKind !== 'PER_LEVEL') return []

  return requireScalingLevels(charge_id, json_data.levels).map((entry) => ({
    id: entry.id,
    charge_id,
    level: entry.level,
    sort_order: entry.level,
    amount: entry.amount
  }))
}

export async function upsertCharge(db: DBLike, json_data: ChargeAuthored) {
  const chargeData = json_data as ChargeAuthoredWrite
  const scalingKind = requireChargeScalingKind(chargeData.id, chargeData.scalingKind)
  const resetKind = requireChargeResetKind(chargeData.id, chargeData.resetKind)
  const limit = mapChargeLimitToRow(chargeData, chargeData.id)
  const levels = mapChargeScalingToRow(chargeData, chargeData.id)
  const bonuses = chargeData.bonuses?.map((bonus) => mapChargeBonusToRow(bonus, chargeData.id)) ?? []
  const trx = await db.startTransaction().execute()
  try {
    await trx
      .insertInto('charges')
      .values({
        id: chargeData.id,
        scaling_kind: scalingKind,
        reset_kind: resetKind
      })
      .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
        scaling_kind: ref('excluded.scaling_kind'),
        reset_kind: ref('excluded.reset_kind')
      })))
      .execute()

    switch (scalingKind) {
      case 'NONE': {
        await trx
          .deleteFrom('charge_scaling_levels')
          .where('charge_id', '=', chargeData.id)
          .execute()

        if (limit) {
          await trx
            .insertInto('charge_limits')
            .values(limit)
            .onConflict((oc) => oc.column('charge_id').doUpdateSet(({ ref }) => ({
              limit_kind: ref('excluded.limit_kind'),
              class_id: ref('excluded.class_id'),
              amount: ref('excluded.amount'),
              multiplier: ref('excluded.multiplier'),
              min: ref('excluded.min'),
              max: ref('excluded.max')
            })))
            .execute()
        }
        break
      }

      case 'PER_LEVEL': {
        await trx
          .deleteFrom('charge_limits')
          .where('charge_id', '=', chargeData.id)
          .execute()

        await trx
          .deleteFrom('charge_scaling_levels')
          .where('charge_id', '=', chargeData.id)
          .execute()

        if (levels.length > 0) {
          await trx
            .insertInto('charge_scaling_levels')
            .values(levels)
            .execute()
        }
        break
      }

      default: {
        assertNever(chargeData as never)
      }
    }

    if (bonuses.length) {
      await trx
        .deleteFrom('charge_bonuses')
        .where('charge_id', '=', chargeData.id)
        .execute()

      await trx
        .insertInto('charge_bonuses')
        .values(bonuses)
        .execute()
    } else {
      await trx
        .deleteFrom('charge_bonuses')
        .where('charge_id', '=', chargeData.id)
        .execute()
    }

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
