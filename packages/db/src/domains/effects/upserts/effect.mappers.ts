import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_ORIGIN_KIND,
  PATH_GROUP_TYPE,
  PATH_LIFECYCLE_CONSUME_EVENT,
  PATH_LIFECYCLE_END_EVENT,
  PATH_LIFECYCLE_RECURRING_KIND,
  PATH_ROLL_TABLE_KIND,
  EFFECT_INVOCATION_KIND,
  PATH_CODES_BY_TRIGGER,
  DAMAGE_BONUS_KIND,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND,
  SCALING,
  SCALABLE_SCALING_KIND,
  SCALING_SOURCE,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type PathLifecycleAuthored,
  type EffectAuthored,
  type EffectPathAuthored,
  type ConditionAuthored,
  type DamageAuthored,
  type OutcomeAuthored,
  type PathChoiceOptionAuthored,
  type PathRollTableRowAuthored,
  type ResultBlockAuthored,
  type TargetingAuthored,
  type Trigger
} from '@artificer-toolkit/shared'
import type { Json } from '#types'

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
  target_selection_kind: string | null
  target_disposition_kind: string | null
  max_targets: number | null
  max_targets_scaling: Json | null
  excluded_creature_type_ids: string[] | null
}

export type EffectPathRow = {
  id: string
  effect_id: string
  sort_order: number
  path_code: string
  group_type: string
  selection_kind: string
  origin_kind: string | null
  range_override_characteristic_id: string | null
  target_selection_kind: string | null
  target_disposition_kind: string | null
  max_targets: number | null
  max_targets_scaling: Json | null
  excluded_creature_type_ids: string[] | null
  result_block_id: string | null
  roll_table_kind: string | null
  die: string | null
}

export type EffectResultBlockRow = {
  id: string
  result_kind: 'SINGLE' | 'SEQUENCE'
  duration_id: string | null
  lifecycle_recurring_kind: string | null
  lifecycle_consume_on_first_event: string | null
  lifecycle_end_on_events: string[] | null
}

export type EffectPathChoiceOptionRow = {
  id: string
  path_id: string
  label: string | null
  description: string | null
  sort_order: number
  result_block_id: string
}

export type EffectPathRollTableRow = {
  id: string
  path_id: string
  sort_order: number
  roll_value: number | null
  roll_min: number | null
  roll_max: number | null
  result_block_id: string
}

export type EffectResultBlockOutcomeRow = {
  result_block_id: string
  outcome_id: string
  effect_kind: string
  sort_order: number
}

export type EffectGenericOutcomeRow = {
  id: string
  effect_kind: string
  json_data: Json
}

type AnyEffectPath = EffectPathAuthored<Trigger, OutcomeAuthored>
type AnyResultBlock = ResultBlockAuthored<OutcomeAuthored>

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

type TargetingColumns = Pick<
  EffectInvocationRow,
  'target_selection_kind' | 'target_disposition_kind' | 'max_targets' | 'max_targets_scaling' | 'excluded_creature_type_ids'
>

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

function requirePathCode(effectId: string, triggerCode: Trigger, value: string): EffectPathRow['path_code'] {
  if (!(value in PATH_CODE)) {
    throw new Error(`Effect "${effectId}" has invalid path code "${value}".`)
  }

  if (!PATH_CODES_BY_TRIGGER[triggerCode].includes(value as (typeof PATH_CODES_BY_TRIGGER)[Trigger][number])) {
    throw new Error(`Effect "${effectId}" has invalid path code "${value}" for trigger "${triggerCode}".`)
  }

  return value
}

function requirePathGroupType(effectId: string, value: string): EffectPathRow['group_type'] {
  if (!(value in PATH_GROUP_TYPE)) {
    throw new Error(`Effect "${effectId}" has invalid path group type "${value}".`)
  }

  return value
}

function requirePathRollTableKind(effectId: string, value: string): EffectPathRow['roll_table_kind'] {
  if (!(value in PATH_ROLL_TABLE_KIND)) {
    throw new Error(`Effect "${effectId}" has invalid roll table kind "${value}".`)
  }

  return value
}

function requirePathOriginKind(effectId: string, value: string): EffectPathRow['origin_kind'] {
  if (!(value in PATH_ORIGIN_KIND)) {
    throw new Error(`Effect "${effectId}" has invalid path origin kind "${value}".`)
  }

  return value
}

function requirePathLifecycleRecurringKind(effectId: string, value: string): EffectResultBlockRow['lifecycle_recurring_kind'] {
  if (!(value in PATH_LIFECYCLE_RECURRING_KIND)) {
    throw new Error(`Effect "${effectId}" has invalid lifecycle recurring kind "${value}".`)
  }

  return value
}

function requirePathLifecycleConsumeEvent(effectId: string, value: string): string {
  if (!(value in PATH_LIFECYCLE_CONSUME_EVENT)) {
    throw new Error(`Effect "${effectId}" has invalid lifecycle consume event "${value}".`)
  }

  return value
}

function requirePathLifecycleEndEvent(effectId: string, value: string): string {
  if (!(value in PATH_LIFECYCLE_END_EVENT)) {
    throw new Error(`Effect "${effectId}" has invalid lifecycle end event "${value}".`)
  }

  return value
}

function requireTargetSelectionKind(ownerId: string, value: string): string {
  if (!(value in TARGET_SELECTION_KIND)) {
    throw new Error(`Owned row "${ownerId}" has invalid target selection kind "${value}".`)
  }

  return value
}

function requireTargetDispositionKind(ownerId: string, value: string): string {
  if (!(value in TARGET_DISPOSITION_KIND)) {
    throw new Error(`Owned row "${ownerId}" has invalid target disposition kind "${value}".`)
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
  if (!(value in SCALING) && !(value in SCALABLE_SCALING_KIND)) {
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

function mapTargetingColumns(
  ownerId: string,
  targeting?: TargetingAuthored
): TargetingColumns {
  return {
    target_selection_kind: targeting
      ? requireTargetSelectionKind(ownerId, targeting.selectionKind)
      : null,
    target_disposition_kind: targeting && 'dispositionKind' in targeting && targeting.dispositionKind
      ? requireTargetDispositionKind(ownerId, targeting.dispositionKind)
      : null,
    max_targets: targeting && targeting.selectionKind === TARGET_SELECTION_KIND.CHOSEN_CREATURES && 'maxTargets' in targeting
      ? targeting.maxTargets ?? null
      : null,
    max_targets_scaling: targeting && targeting.selectionKind === TARGET_SELECTION_KIND.CHOSEN_CREATURES && 'maxTargetsScaling' in targeting
      ? targeting.maxTargetsScaling ?? null
      : null,
    excluded_creature_type_ids: targeting && 'excludedCreatureTypeIds' in targeting
      ? targeting.excludedCreatureTypeIds ?? null
      : null
  }
}

function mapLifecycleColumns(
  effectId: string,
  lifecycle?: PathLifecycleAuthored
) {
  return {
    lifecycle_recurring_kind: lifecycle?.recurringKind
      ? requirePathLifecycleRecurringKind(effectId, lifecycle.recurringKind)
      : null,
    lifecycle_consume_on_first_event: lifecycle?.consumeOnFirstEvent
      ? requirePathLifecycleConsumeEvent(effectId, lifecycle.consumeOnFirstEvent)
      : null,
    lifecycle_end_on_events: lifecycle?.endOnEvents?.length
      ? lifecycle.endOnEvents.map((event) => requirePathLifecycleEndEvent(effectId, event))
      : null
  }
}

function mapResultLifecycleColumns(
  effectId: string,
  lifecycle?: PathLifecycleAuthored
) {
  return mapLifecycleColumns(effectId, lifecycle)
}

export function mapEffectRow(json_data: EffectAuthored): EffectRow {
  return {
    id: json_data.id,
    sort_order: json_data.order
  }
}

export function mapInvocationRow(json_data: EffectAuthored): EffectInvocationRow {
  const isPassive = json_data.invocation.kind === EFFECT_INVOCATION_KIND.PASSIVE
  const activation = 'activation' in json_data.invocation
    ? json_data.invocation.activation
    : { code: ACTIVATION_CODE.FREE }

  return {
    effect_id: json_data.id,
    trigger_code: requireTriggerCode(json_data.id, json_data.invocation.triggerCode),
    activation_type: requireActivationCode(json_data.id, activation.code),
    activation_value: isPassive
      ? -1
      : 'amount' in activation
      ? activation.amount
      : null,
    range_characteristic_id: json_data.invocation.range.id,
    shape_characteristic_id: json_data.invocation.shape?.id ?? null,
    saving_throw_id: 'savingThrow' in json_data.invocation
      ? json_data.invocation.savingThrow.id
      : null,
    ...mapTargetingColumns(json_data.id, json_data.invocation.targeting)
  }
}

export function mapEffectPathRow(
  effectId: string,
  triggerCode: Trigger,
  json_data: AnyEffectPath
): EffectPathRow {
  return {
    id: json_data.id,
    effect_id: effectId,
    sort_order: json_data.order,
    path_code: requirePathCode(effectId, triggerCode, json_data.pathCode),
    group_type: requirePathGroupType(effectId, json_data.groupType),
    selection_kind: json_data.selectionKind,
    origin_kind: json_data.originKind
      ? requirePathOriginKind(effectId, json_data.originKind)
      : null,
    range_override_characteristic_id: json_data.rangeOverride?.id ?? null,
    ...mapTargetingColumns(json_data.id, json_data.targetingOverride),
    result_block_id: json_data.selectionKind === 'FIXED'
      ? json_data.resultBlock.id
      : null,
    roll_table_kind: json_data.selectionKind === 'ROLL_TABLE'
      ? requirePathRollTableKind(effectId, json_data.rollTableKind)
      : null,
    die: json_data.selectionKind === 'ROLL_TABLE'
      ? json_data.dieConfig
      : null
  }
}

export function mapEffectResultBlockRow(
  effectId: string,
  resultBlock: AnyResultBlock
): EffectResultBlockRow {
  return {
    id: resultBlock.id,
    result_kind: resultBlock.resultKind,
    duration_id: resultBlock.duration?.id ?? null,
    ...mapResultLifecycleColumns(effectId, resultBlock.lifecycle)
  }
}

export function mapEffectPathChoiceOptionRow(
  pathId: string,
  json_data: PathChoiceOptionAuthored<OutcomeAuthored>
): EffectPathChoiceOptionRow {
  return {
    id: json_data.id,
    path_id: pathId,
    label: json_data.label ?? null,
    description: json_data.description ?? null,
    sort_order: json_data.order,
    result_block_id: json_data.resultBlock.id
  }
}

export function mapEffectPathRollTableRow(
  pathId: string,
  json_data: PathRollTableRowAuthored<OutcomeAuthored>
): EffectPathRollTableRow {
  return {
    id: json_data.id,
    path_id: pathId,
    sort_order: json_data.order,
    roll_value: json_data.rollValue ?? null,
    roll_min: json_data.rollRange?.[0] ?? null,
    roll_max: json_data.rollRange?.[1] ?? null,
    result_block_id: json_data.resultBlock.id
  }
}

export function mapEffectResultBlockOutcomeRow(
  resultBlockId: string,
  json_data: OutcomeAuthored,
  order: number
): EffectResultBlockOutcomeRow {
  return {
    result_block_id: resultBlockId,
    outcome_id: json_data.id,
    effect_kind: json_data.effectKind,
    sort_order: order
  }
}

export function mapEffectGenericOutcomeRow(
  json_data: Exclude<OutcomeAuthored, DamageAuthored | ConditionAuthored>
): EffectGenericOutcomeRow {
  return {
    id: json_data.id,
    effect_kind: json_data.effectKind,
    json_data: JSON.parse(JSON.stringify(json_data)) as Json
  }
}

export function mapDamageRow(json_data: DamageAuthored): DamageRow {
  return {
    id: json_data.id,
    damage_type_id: json_data.damageTypeId,
    value_kind: requireDamageValueKind(json_data.id, json_data.valueKind),
    scaling_kind: requireScalingKind(json_data.id, json_data.scalingKind),
    scaling_source: json_data.scalingKind !== SCALING.NONE
      ? requireScalingSource(json_data.id, json_data.scalingSource)
      : null,
    class_id: json_data.scalingKind !== SCALING.NONE && json_data.scalingSource === SCALING_SOURCE.CLASS_LEVEL
      ? json_data.classId
      : null,
    sort_order: 0
  }
}

export function mapDamageValueRow(json_data: DamageAuthored): DamageValueRow | null {
  if (json_data.scalingKind !== SCALING.NONE && json_data.valueKind !== DAMAGE_VALUE_KIND.POOL) {
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
  if (json_data.scalingKind === SCALING.NONE || json_data.valueKind === DAMAGE_VALUE_KIND.POOL) {
    return []
  }

  switch (json_data.valueKind) {
    case DAMAGE_VALUE_KIND.FIXED:
      return json_data.scalingKind === SCALING.PER_LEVEL
        ? json_data.levels.map((level) => ({
            id: level.id,
            damage_id: json_data.id,
            level: level.level,
            sort_order: level.order,
            amount: level.amount,
            dice: null
          }))
        : json_data.breakpoints.map((breakpoint) => ({
            id: breakpoint.id,
            damage_id: json_data.id,
            level: breakpoint.level,
            sort_order: breakpoint.order,
            amount: breakpoint.value.amount,
            dice: null
          }))

    case DAMAGE_VALUE_KIND.DICE:
      return json_data.scalingKind === SCALING.PER_LEVEL
        ? json_data.levels.map((level) => ({
            id: level.id,
            damage_id: json_data.id,
            level: level.level,
            sort_order: level.order,
            amount: null,
            dice: level.diceConfig
          }))
        : json_data.breakpoints.map((breakpoint) => ({
            id: breakpoint.id,
            damage_id: json_data.id,
            level: breakpoint.level,
            sort_order: breakpoint.order,
            amount: null,
            dice: breakpoint.value.diceConfig
          }))

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
  EFFECT_KIND
}




