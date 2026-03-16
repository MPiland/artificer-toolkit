import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  DAMAGE_BONUS_KIND,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND,
  MOMENT,
  MOMENT_GROUP_TYPE,
  MOMENT_RESOLUTION_KIND,
  MOMENT_ROLL_TABLE_KIND,
  MOMENTS_BY_TRIGGER,
  SCALING,
  SCALING_SOURCE,
  TRIGGER,
  type ConditionAuthored,
  type DamageAuthored,
  type EffectAuthored,
  type MomentAuthored,
  type Trigger
} from '@artificer-toolkit/shared'

export type EffectRow = {
  id: string
  sort_order: number
}

export type EffectInvocationRow = {
  effect_id: string
  trigger_code: string
  activation_type: string
  activation_value: number | null
  range_characteristic_id: string
  shape_characteristic_id: string | null
  saving_throw_id: string | null
}

export type EffectMomentRow = {
  id: string
  effect_id: string
  trigger_code: string
  moment_code: string
  group_type: string
  resolution_kind: string
  duration_id: string | null
  roll_table_kind: string | null
  die: string | null
}

export type MomentRollTableEntryRow = {
  id: string
  effect_id: string
  trigger_code: string
  moment_code: string
  description: string | null
  sort_order: number
  duration_id: string | null
  roll_value: number | null
  roll_min: number | null
  roll_max: number | null
}

export type DamageRow = {
  id: string
  damage_type_id: string
  value_kind: string
  scaling_kind: string
  scaling_source: string | null
  class_id: string | null
  sort_order: number
}

export type DamageValueRow = {
  id: string
  damage_id: string
  amount: number | null
  dice: string | null
  multiplier: number | null
  min: number | null
  max: number | null
}

export type DamageScalingLevelRow = {
  id: string
  damage_id: string
  level: number
  sort_order: number
  amount: number | null
  dice: string | null
}

export type DamageBonusKindRow = {
  damage_id: string
  bonus_kind: string
  sort_order: number
}

export type DamageBonusRow = {
  id: string
  damage_id: string
  bonus_kind: string
  ability_code: string | null
  skill_id: string | null
  multiplier: number | null
  min: number | null
  max: number | null
  sort_order: number
}

export type ConditionRow = {
  id: string
  condition_type_id: string
}

function requireTriggerCode(effectId: string, value: string): EffectInvocationRow['trigger_code'] {
  if (!(value in TRIGGER)) {
    throw new Error(`Effect "${effectId}" has invalid triggerCode "${value}".`)
  }

  return value
}

function requireActivationCode(effectId: string, value: string): EffectInvocationRow['activation_type'] {
  if (!(value in ACTIVATION_CODE)) {
    throw new Error(`Effect "${effectId}" has invalid activation code "${value}".`)
  }

  return value
}

function requireMomentCode(effectId: string, triggerCode: Trigger, value: string): EffectMomentRow['moment_code'] {
  if (!(value in MOMENT)) {
    throw new Error(`Effect "${effectId}" has invalid moment code "${value}".`)
  }

  if (!MOMENTS_BY_TRIGGER[triggerCode].includes(value as (typeof MOMENTS_BY_TRIGGER)[Trigger][number])) {
    throw new Error(`Effect "${effectId}" has invalid moment code "${value}" for trigger "${triggerCode}".`)
  }

  return value
}

function requireMomentGroupType(effectId: string, value: string): EffectMomentRow['group_type'] {
  if (!(value in MOMENT_GROUP_TYPE)) {
    throw new Error(`Effect "${effectId}" has invalid moment group type "${value}".`)
  }

  return value
}

function requireMomentResolutionKind(effectId: string, value: string): EffectMomentRow['resolution_kind'] {
  if (!(value in MOMENT_RESOLUTION_KIND)) {
    throw new Error(`Effect "${effectId}" has invalid moment resolution kind "${value}".`)
  }

  return value
}

function requireMomentRollTableKind(effectId: string, value: string): EffectMomentRow['roll_table_kind'] {
  if (!(value in MOMENT_ROLL_TABLE_KIND)) {
    throw new Error(`Effect "${effectId}" has invalid roll table kind "${value}".`)
  }

  return value
}

function requireDamageValueKind(damageId: string, value: string): DamageRow['value_kind'] {
  if (!(value in DAMAGE_VALUE_KIND)) {
    throw new Error(`Damage "${damageId}" has invalid value kind "${value}".`)
  }

  return value
}

function requireScalingKind(damageId: string, value: string): DamageRow['scaling_kind'] {
  if (!(value in SCALING)) {
    throw new Error(`Damage "${damageId}" has invalid scaling kind "${value}".`)
  }

  return value
}

function requireScalingSource(damageId: string, value: string): DamageRow['scaling_source'] {
  if (!(value in SCALING_SOURCE)) {
    throw new Error(`Damage "${damageId}" has invalid scaling source "${value}".`)
  }

  return value
}

function requireDamageBonusKind(damageId: string, value: string): DamageBonusRow['bonus_kind'] {
  if (!(value in DAMAGE_BONUS_KIND)) {
    throw new Error(`Damage "${damageId}" has invalid bonus kind "${value}".`)
  }

  return value
}

function requireAbilityCode(ownerId: string, value: string): string {
  if (!(value in ABILITY_CODE)) {
    throw new Error(`Owned row "${ownerId}" has invalid ability code "${value}".`)
  }

  return value
}

export function mapEffectRow(json_data: EffectAuthored): EffectRow {
  return {
    id: json_data.id,
    sort_order: json_data.order
  }
}

export function mapInvocationRow(json_data: EffectAuthored): EffectInvocationRow {
  return {
    effect_id: json_data.id,
    trigger_code: requireTriggerCode(json_data.id, json_data.invocation.triggerCode),
    activation_type: requireActivationCode(json_data.id, json_data.invocation.activation.code),
    activation_value: 'amount' in json_data.invocation.activation
      ? json_data.invocation.activation.amount
      : null,
    range_characteristic_id: json_data.invocation.range.id,
    shape_characteristic_id: json_data.invocation.shape?.id ?? null,
    saving_throw_id: 'savingThrow' in json_data.invocation
      ? json_data.invocation.savingThrow.id
      : null
  }
}

export function mapMomentRow(
  effectId: string,
  triggerCode: Trigger,
  json_data: MomentAuthored
): EffectMomentRow {
  return {
    id: json_data.id,
    effect_id: effectId,
    trigger_code: requireTriggerCode(effectId, triggerCode),
    moment_code: requireMomentCode(effectId, triggerCode, json_data.moment),
    group_type: requireMomentGroupType(effectId, json_data.groupType),
    resolution_kind: requireMomentResolutionKind(effectId, json_data.resolutionKind),
    duration_id: json_data.resolutionKind === MOMENT_RESOLUTION_KIND.DIRECT
      ? json_data.duration?.id ?? null
      : null,
    roll_table_kind: json_data.resolutionKind === MOMENT_RESOLUTION_KIND.ROLL_TABLE
      ? requireMomentRollTableKind(effectId, json_data.rollTableKind)
      : null,
    die: json_data.resolutionKind === MOMENT_RESOLUTION_KIND.ROLL_TABLE
      ? json_data.dieConfig
      : null
  }
}

export function mapRollTableEntryRow(
  effectId: string,
  triggerCode: Trigger,
  momentCode: string,
  order: number,
  json_data: Extract<MomentAuthored, { resolutionKind: 'ROLL_TABLE' }>['table'][number]
): MomentRollTableEntryRow {
  return {
    id: json_data.id,
    effect_id: effectId,
    trigger_code: requireTriggerCode(effectId, triggerCode),
    moment_code: requireMomentCode(effectId, triggerCode, momentCode),
    description: json_data.description ?? null,
    sort_order: order,
    duration_id: json_data.duration?.id ?? null,
    roll_value: 'rollValue' in json_data ? json_data.rollValue : null,
    roll_min: 'rollRange' in json_data ? json_data.rollRange[0] : null,
    roll_max: 'rollRange' in json_data ? json_data.rollRange[1] : null
  }
}

export function mapDamageRow(json_data: DamageAuthored): DamageRow {
  return {
    id: json_data.id,
    damage_type_id: json_data.damageTypeId,
    value_kind: requireDamageValueKind(json_data.id, json_data.valueKind),
    scaling_kind: requireScalingKind(json_data.id, json_data.scalingKind),
    scaling_source: json_data.scalingKind === SCALING.PER_LEVEL
      ? requireScalingSource(json_data.id, json_data.scalingSource)
      : null,
    class_id: json_data.scalingKind === SCALING.PER_LEVEL && json_data.scalingSource === SCALING_SOURCE.CLASS_LEVEL
      ? json_data.classId
      : null,
    sort_order: 0
  }
}

export function mapDamageValueRow(json_data: DamageAuthored): DamageValueRow | null {
  if (json_data.scalingKind === SCALING.PER_LEVEL && json_data.valueKind !== DAMAGE_VALUE_KIND.POOL) {
    return null
  }

  switch (json_data.valueKind) {
    case DAMAGE_VALUE_KIND.FIXED:
      return {
        id: json_data.id,
        damage_id: json_data.id,
        amount: json_data.amount,
        dice: null,
        multiplier: null,
        min: null,
        max: null
      }

    case DAMAGE_VALUE_KIND.DICE:
      return {
        id: json_data.id,
        damage_id: json_data.id,
        amount: null,
        dice: json_data.diceConfig,
        multiplier: null,
        min: null,
        max: null
      }

    case DAMAGE_VALUE_KIND.POOL:
      return {
        id: json_data.id,
        damage_id: json_data.id,
        amount: json_data.amount ?? null,
        dice: null,
        multiplier: json_data.scalingKind === SCALING.PER_LEVEL ? json_data.multiplier ?? null : null,
        min: json_data.scalingKind === SCALING.PER_LEVEL ? json_data.min ?? null : null,
        max: json_data.scalingKind === SCALING.PER_LEVEL ? json_data.max ?? null : null
      }

    default:
      return json_data satisfies never
  }
}

export function mapDamageScalingRows(json_data: DamageAuthored): DamageScalingLevelRow[] {
  if (json_data.scalingKind !== SCALING.PER_LEVEL) {
    return []
  }

  switch (json_data.valueKind) {
    case DAMAGE_VALUE_KIND.FIXED:
      return json_data.levels.map((level) => ({
        id: level.id,
        damage_id: json_data.id,
        level: level.level,
        sort_order: level.order,
        amount: level.amount,
        dice: null
      }))

    case DAMAGE_VALUE_KIND.DICE:
      return json_data.levels.map((level) => ({
        id: level.id,
        damage_id: json_data.id,
        level: level.level,
        sort_order: level.order,
        amount: null,
        dice: level.diceConfig
      }))

    case DAMAGE_VALUE_KIND.POOL:
      return []

    default:
      return json_data satisfies never
  }
}

export function mapDamageBonusRows(json_data: DamageAuthored): DamageBonusRow[] {
  return (json_data.bonuses ?? []).map((bonus) => ({
    id: bonus.id,
    damage_id: json_data.id,
    bonus_kind: requireDamageBonusKind(json_data.id, bonus.bonusKind),
    ability_code: bonus.bonusKind === DAMAGE_BONUS_KIND.ABILITY_BONUS
      ? requireAbilityCode(bonus.id, bonus.ability)
      : null,
    skill_id: bonus.bonusKind === DAMAGE_BONUS_KIND.SKILL_BONUS
      ? bonus.skillId
      : null,
    multiplier: bonus.multiplier ?? null,
    min: bonus.min ?? null,
    max: bonus.max ?? null,
    sort_order: bonus.order
  }))
}

export function mapDamageBonusKindRows(json_data: DamageAuthored): DamageBonusKindRow[] {
  const seen = new Set<string>()
  const rows: DamageBonusKindRow[] = []

  for (const bonus of json_data.bonuses ?? []) {
    if (seen.has(bonus.bonusKind)) continue
    seen.add(bonus.bonusKind)
    rows.push({
      damage_id: json_data.id,
      bonus_kind: requireDamageBonusKind(json_data.id, bonus.bonusKind),
      sort_order: rows.length + 1
    })
  }

  return rows
}

export function mapConditionRow(json_data: ConditionAuthored): ConditionRow {
  return {
    id: json_data.id,
    condition_type_id: json_data.conditionId
  }
}

export {
  EFFECT_KIND,
  MOMENT_RESOLUTION_KIND
}
