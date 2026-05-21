import type {
  ChargeAuthored,
  ChargeBonusAuthored
} from '@artificer-toolkit/shared'
import { ABILITY_CODE } from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { uniqueIds } from '../../../repositories/batch.js'

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

function requireChargeResetKind(
  chargeId: string,
  value: string
): ChargeAuthored['resetKind'] {
  if (value !== 'LONG_REST' && value !== 'SHORT_REST' && value !== 'MANUAL') {
    throw new Error(`Charge "${chargeId}" has invalid reset_kind "${value}".`)
  }

  return value
}

function requireChargeScalingKind(
  chargeId: string,
  value: string
): 'NONE' | 'PER_LEVEL' {
  if (value !== 'NONE' && value !== 'PER_LEVEL') {
    throw new Error(`Charge "${chargeId}" has invalid scaling_kind "${value}".`)
  }

  return value
}

function requireAbilityCode(
  bonusId: string,
  value: string
): keyof typeof ABILITY_CODE {
  if (!(value in ABILITY_CODE)) {
    throw new Error(`Charge bonus "${bonusId}" has invalid ability_code "${value}".`)
  }

  return value as keyof typeof ABILITY_CODE
}

function hydrateChargeBonus(row: ChargeBonusRow): ChargeBonusAuthored {
  switch (row.bonus_kind) {
    case 'ABILITY_MODIFIER':
      if (!row.ability_code) {
        throw new Error(`Charge bonus "${row.id}" is missing ability_code.`)
      }

      return {
        id: row.id,
        bonusKind: 'ABILITY_MODIFIER',
        ability: requireAbilityCode(row.id, row.ability_code),
        multiplier: row.multiplier ?? undefined,
        min: row.min ?? undefined,
        max: row.max ?? undefined,
        order: row.sort_order
      } as ChargeBonusAuthored

    case 'SKILL_BONUS':
      if (!row.skill_id) {
        throw new Error(`Charge bonus "${row.id}" is missing skill_id.`)
      }

      return {
        id: row.id,
        bonusKind: 'SKILL_BONUS',
        skillId: row.skill_id,
        multiplier: row.multiplier ?? undefined,
        min: row.min ?? undefined,
        max: row.max ?? undefined,
        order: row.sort_order
      }

    case 'PROFICIENCY_BONUS':
      return {
        id: row.id,
        bonusKind: 'PROFICIENCY_BONUS',
        multiplier: row.multiplier ?? undefined,
        min: row.min ?? undefined,
        max: row.max ?? undefined,
        order: row.sort_order
      }

    default:
      throw new Error(`Unsupported charge bonus kind "${row.bonus_kind}".`)
  }
}

type ChargeRow = {
  id: string
  scaling_kind: string
  reset_kind: string
}

type ChargeLimitRow = {
  charge_id: string
  limit_kind: string
  class_id: string | null
  amount: number | null
  multiplier: number | null
  min: number | null
  max: number | null
}

type ChargeScalingLevelRow = {
  id: string
  charge_id: string
  level: number
  amount: number
  sort_order: number
}

function groupByChargeId<T extends { charge_id: string }>(rows: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>()

  for (const row of rows) {
    const existing = grouped.get(row.charge_id)

    if (existing) {
      existing.push(row)
    } else {
      grouped.set(row.charge_id, [row])
    }
  }

  return grouped
}

function hydrateChargeFromRows(
  id: string,
  charge: ChargeRow,
  limit: ChargeLimitRow | undefined,
  scalingLevels: readonly ChargeScalingLevelRow[],
  bonuses: readonly ChargeBonusRow[]
): ChargeAuthored {
  const authoredBonuses = bonuses.map(hydrateChargeBonus)
  const resetKind = requireChargeResetKind(charge.id, charge.reset_kind)
  const scalingKind = requireChargeScalingKind(charge.id, charge.scaling_kind)

  if (scalingKind === 'PER_LEVEL') {
    return {
      id: charge.id,
      resetKind,
      bonuses: authoredBonuses.length > 0 ? authoredBonuses : undefined,
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'PER_LEVEL',
      levels: scalingLevels.map((level) => ({
        id: level.id,
        level: level.level,
        amount: level.amount
      }))
    }
  }

  if (!limit) {
    throw new Error(`Charge "${id}" is missing its limit row.`)
  }

  switch (limit.limit_kind) {
    case 'FIXED_AMOUNT':
      if (limit.amount == null) {
        throw new Error(`Charge "${id}" fixed amount limit is missing amount.`)
      }

      return {
        id: charge.id,
        resetKind,
        bonuses: authoredBonuses.length > 0 ? authoredBonuses : undefined,
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: limit.amount
      }

    case 'CHARACTER_LEVEL':
      return {
        id: charge.id,
        resetKind,
        bonuses: authoredBonuses.length > 0 ? authoredBonuses : undefined,
        limitKind: 'CHARACTER_LEVEL',
        scalingKind: 'NONE',
        multiplier: limit.multiplier ?? undefined,
        min: limit.min ?? undefined,
        max: limit.max ?? undefined
      }

    case 'CLASS_LEVEL':
      if (!limit.class_id) {
        throw new Error(`Charge "${id}" class-level limit is missing class_id.`)
      }

      return {
        id: charge.id,
        resetKind,
        bonuses: authoredBonuses.length > 0 ? authoredBonuses : undefined,
        limitKind: 'CLASS_LEVEL',
        scalingKind: 'NONE',
        classId: limit.class_id,
        multiplier: limit.multiplier ?? undefined,
        min: limit.min ?? undefined,
        max: limit.max ?? undefined
      }

    case 'PARENT_CLASS_LEVEL':
      return {
        id: charge.id,
        resetKind,
        bonuses: authoredBonuses.length > 0 ? authoredBonuses : undefined,
        limitKind: 'PARENT_CLASS_LEVEL',
        scalingKind: 'NONE',
        multiplier: limit.multiplier ?? undefined,
        min: limit.min ?? undefined,
        max: limit.max ?? undefined
      }

    case 'SPELL_CAST_LEVEL':
      return {
        id: charge.id,
        resetKind,
        bonuses: authoredBonuses.length > 0 ? authoredBonuses : undefined,
        limitKind: 'SPELL_CAST_LEVEL',
        scalingKind: 'NONE',
        multiplier: limit.multiplier ?? undefined,
        min: limit.min ?? undefined,
        max: limit.max ?? undefined
      }

    default:
      throw new Error(`Unsupported charge limit kind "${limit.limit_kind}".`)
  }
}

export async function hydrateChargeById(
  db: DBLike,
  id: string
): Promise<ChargeAuthored | null> {
  const charge = await db
    .selectFrom('charges')
    .select(['id', 'scaling_kind', 'reset_kind'])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!charge) return null

  const [limit, scalingLevels, bonuses] = await Promise.all([
    db.selectFrom('charge_limits')
      .select(['charge_id', 'limit_kind', 'class_id', 'amount', 'multiplier', 'min', 'max'])
      .where('charge_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('charge_scaling_levels')
      .select(['id', 'charge_id', 'level', 'amount', 'sort_order'])
      .where('charge_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('charge_bonuses')
      .select(['id', 'charge_id', 'bonus_kind', 'ability_code', 'skill_id', 'multiplier', 'min', 'max', 'sort_order'])
      .where('charge_id', '=', id)
      .orderBy('sort_order')
      .execute() as Promise<ChargeBonusRow[]>
  ])

  const authoredBonuses = bonuses.map(hydrateChargeBonus)
  const resetKind = requireChargeResetKind(charge.id, charge.reset_kind)
  const scalingKind = requireChargeScalingKind(charge.id, charge.scaling_kind)

  if (scalingKind === 'PER_LEVEL') {
    return {
      id: charge.id,
      resetKind,
      bonuses: authoredBonuses.length > 0 ? authoredBonuses : undefined,
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'PER_LEVEL',
      levels: scalingLevels.map((level) => ({
        id: level.id,
        level: level.level,
        amount: level.amount
      }))
    }
  }

  if (!limit) {
    throw new Error(`Charge "${id}" is missing its limit row.`)
  }

  switch (limit.limit_kind) {
    case 'FIXED_AMOUNT':
      if (limit.amount == null) {
        throw new Error(`Charge "${id}" fixed amount limit is missing amount.`)
      }

      return {
        id: charge.id,
        resetKind,
        bonuses: authoredBonuses.length > 0 ? authoredBonuses : undefined,
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: limit.amount
      }

    case 'CHARACTER_LEVEL':
      return {
        id: charge.id,
        resetKind,
        bonuses: authoredBonuses.length > 0 ? authoredBonuses : undefined,
        limitKind: 'CHARACTER_LEVEL',
        scalingKind: 'NONE',
        multiplier: limit.multiplier ?? undefined,
        min: limit.min ?? undefined,
        max: limit.max ?? undefined
      }

    case 'CLASS_LEVEL':
      if (!limit.class_id) {
        throw new Error(`Charge "${id}" class-level limit is missing class_id.`)
      }

      return {
        id: charge.id,
        resetKind,
        bonuses: authoredBonuses.length > 0 ? authoredBonuses : undefined,
        limitKind: 'CLASS_LEVEL',
        scalingKind: 'NONE',
        classId: limit.class_id,
        multiplier: limit.multiplier ?? undefined,
        min: limit.min ?? undefined,
        max: limit.max ?? undefined
      }

    case 'PARENT_CLASS_LEVEL':
      return {
        id: charge.id,
        resetKind,
        bonuses: authoredBonuses.length > 0 ? authoredBonuses : undefined,
        limitKind: 'PARENT_CLASS_LEVEL',
        scalingKind: 'NONE',
        multiplier: limit.multiplier ?? undefined,
        min: limit.min ?? undefined,
        max: limit.max ?? undefined
      }

    case 'SPELL_CAST_LEVEL':
      return {
        id: charge.id,
        resetKind,
        bonuses: authoredBonuses.length > 0 ? authoredBonuses : undefined,
        limitKind: 'SPELL_CAST_LEVEL',
        scalingKind: 'NONE',
        multiplier: limit.multiplier ?? undefined,
        min: limit.min ?? undefined,
        max: limit.max ?? undefined
      }

    default:
      throw new Error(`Unsupported charge limit kind "${limit.limit_kind}".`)
  }
}

export async function hydrateChargesByIds(
  db: DBLike,
  ids: readonly string[]
): Promise<Map<string, ChargeAuthored>> {
  const distinctIds = uniqueIds(ids)

  if (distinctIds.length === 0) {
    return new Map()
  }

  const [charges, limits, scalingLevels, bonuses] = await Promise.all([
    db.selectFrom('charges')
      .select(['id', 'scaling_kind', 'reset_kind'])
      .where('id', 'in', distinctIds)
      .execute() as Promise<ChargeRow[]>,
    db.selectFrom('charge_limits')
      .select(['charge_id', 'limit_kind', 'class_id', 'amount', 'multiplier', 'min', 'max'])
      .where('charge_id', 'in', distinctIds)
      .execute() as Promise<ChargeLimitRow[]>,
    db.selectFrom('charge_scaling_levels')
      .select(['id', 'charge_id', 'level', 'amount', 'sort_order'])
      .where('charge_id', 'in', distinctIds)
      .orderBy('sort_order')
      .execute() as Promise<ChargeScalingLevelRow[]>,
    db.selectFrom('charge_bonuses')
      .select(['id', 'charge_id', 'bonus_kind', 'ability_code', 'skill_id', 'multiplier', 'min', 'max', 'sort_order'])
      .where('charge_id', 'in', distinctIds)
      .orderBy('sort_order')
      .execute() as Promise<ChargeBonusRow[]>
  ])
  const chargesById = new Map(charges.map((charge) => [charge.id, charge]))
  const limitsByChargeId = new Map(limits.map((limit) => [limit.charge_id, limit]))
  const scalingLevelsByChargeId = groupByChargeId(scalingLevels)
  const bonusesByChargeId = groupByChargeId(bonuses)
  const hydrated = new Map<string, ChargeAuthored>()

  for (const id of distinctIds) {
    const charge = chargesById.get(id)

    if (!charge) continue

    hydrated.set(
      id,
      hydrateChargeFromRows(
        id,
        charge,
        limitsByChargeId.get(id),
        scalingLevelsByChargeId.get(id) ?? [],
        bonusesByChargeId.get(id) ?? []
      )
    )
  }

  return hydrated
}
