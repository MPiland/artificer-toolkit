import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  DAMAGE_BONUS_KIND,
  DAMAGE_VALUE_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  EFFECT_INVOCATION_KIND,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  PATH_ORIGIN_KIND,
  PATH_GROUP_TYPE,
  PATH_LIFECYCLE_CONSUME_EVENT,
  PATH_LIFECYCLE_END_EVENT,
  PATH_LIFECYCLE_RECURRING_KIND,
  PATH_ROLL_TABLE_KIND,
  PATH_CODES_BY_TRIGGER,
  RANGE_KIND,
  SAVING_THROW_KIND,
  SCALING,
  SCALABLE_SCALING_KIND,
  SCALING_SOURCE,
  SHAPE_KIND,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type PathLifecycleAuthored,
  type ConditionAuthored,
  type DamageAuthored,
  type ActivationAuthored,
  type DurationAuthored,
  type EffectAuthored,
  type OutcomeAuthored,
  type OutcomeRowMetadataAuthored,
  type RangeAuthored,
  type ScalableValueAuthored,
  type SavingThrowAuthored,
  type ShapeAuthored,
  type ShapeMeasurementAuthored,
  type TargetingAuthored,
  type Trigger
} from '@artificer-toolkit/shared'
import type { DBLike, Json } from '#types'
import { upsertEffect } from '../upserts/effect.js'
import type { EffectRepository } from '../../../repositories/contracts.js'
import { hydrateByIds, orderedHydratedRecords } from '../../../repositories/batch.js'
type DamageBonus = NonNullable<DamageAuthored['bonuses']>[number]
type EffectPath = NonNullable<EffectAuthored['paths']>[number]
type ResultBlock = Extract<EffectPath, { selectionKind: 'FIXED' }>['resultBlock']
type DbNumeric = number | string

function readScalableValue<TValue extends Record<string, unknown>>(value: Json | null | undefined): ScalableValueAuthored<TValue> | undefined {
  return value == null
    ? undefined
    : value as ScalableValueAuthored<TValue>
}

function requireLinkedRecord<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message)
  }

  return value
}

function readNumericValue(ownerId: string, value: DbNumeric, field: string): number {
  const numericValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numericValue)) {
    throw new Error(`Owned row "${ownerId}" has invalid ${field} "${String(value)}".`)
  }

  return numericValue
}

function readOptionalNumericValue(
  ownerId: string,
  value: DbNumeric | null | undefined,
  field: string
): number | undefined {
  return value == null
    ? undefined
    : readNumericValue(ownerId, value, field)
}

function requireNumericValue(
  ownerId: string,
  value: DbNumeric | null | undefined,
  field: string,
  message: string
): number {
  return readNumericValue(ownerId, requireLinkedRecord(value, message), field)
}

function buildActivation(
  effectId: string,
  activationType: string,
  activationValue: number | null
): ActivationAuthored {
  const activationCode = requireActivationCode(effectId, activationType)

  return activationCode === ACTIVATION_CODE.FREE
    ? { code: activationCode }
    : {
        code: activationCode,
        amount: requireLinkedRecord(activationValue, `Effect "${effectId}" activation "${activationCode}" is missing amount.`)
      }
}

function isPassiveInvocation(activationType: string, activationValue: number | null): boolean {
  return activationType === ACTIVATION_CODE.FREE && activationValue === -1
}

function requireActivationCode(effectId: string, value: string): ActivationAuthored['code'] {
  if (!(value in ACTIVATION_CODE)) {
    throw new Error(`Effect "${effectId}" has invalid activation_type "${value}".`)
  }

  return value as ActivationAuthored['code']
}

function requireTriggerCode(effectId: string, value: string): EffectAuthored['invocation']['triggerCode'] {
  if (!(value in TRIGGER)) {
    throw new Error(`Effect "${effectId}" has invalid trigger_code "${value}".`)
  }

  return value as EffectAuthored['invocation']['triggerCode']
}

function requireRangeKind(characteristicId: string, value: string) {
  if (!(value in RANGE_KIND)) {
    throw new Error(`Range characteristic "${characteristicId}" has invalid kind "${value}".`)
  }

  return value as keyof typeof RANGE_KIND
}

function requireMeasurementUnit(ownerId: string, value: string) {
  if (!(value in MEASUREMENT_UNIT_CODE)) {
    throw new Error(`Owned row "${ownerId}" has invalid unit_code "${value}".`)
  }

  return value as keyof typeof MEASUREMENT_UNIT_CODE
}

function requireShapeKind(characteristicId: string, value: string) {
  if (!(value in SHAPE_KIND)) {
    throw new Error(`Shape characteristic "${characteristicId}" has invalid kind "${value}".`)
  }

  return value as keyof typeof SHAPE_KIND
}

function requireDurationKind(characteristicId: string, value: string) {
  if (!(value in DURATION_KIND)) {
    throw new Error(`Duration characteristic "${characteristicId}" has invalid kind "${value}".`)
  }

  return value as keyof typeof DURATION_KIND
}

function requireSavingThrowKind(savingThrowId: string, value: string) {
  if (!(value in SAVING_THROW_KIND)) {
    throw new Error(`Saving throw "${savingThrowId}" has invalid kind "${value}".`)
  }

  return value as keyof typeof SAVING_THROW_KIND
}

function requirePathCode(effectId: string, triggerCode: Trigger, value: string) {
  if (!(value in PATH_CODE)) {
    throw new Error(`Effect "${effectId}" has invalid path_code "${value}".`)
  }

  if (!PATH_CODES_BY_TRIGGER[triggerCode].includes(value as (typeof PATH_CODES_BY_TRIGGER)[Trigger][number])) {
    throw new Error(`Effect "${effectId}" has invalid path_code "${value}" for trigger "${triggerCode}".`)
  }

  return value as EffectPath['pathCode']
}

function requirePathGroupType(effectId: string, value: string) {
  if (!(value in PATH_GROUP_TYPE)) {
    throw new Error(`Effect "${effectId}" has invalid group_type "${value}".`)
  }

  return value as keyof typeof PATH_GROUP_TYPE
}

function requirePathRollTableKind(effectId: string, value: string) {
  if (!(value in PATH_ROLL_TABLE_KIND)) {
    throw new Error(`Effect "${effectId}" has invalid roll_table_kind "${value}".`)
  }

  return value as keyof typeof PATH_ROLL_TABLE_KIND
}

function requirePathOriginKind(effectId: string, value: string) {
  if (!(value in PATH_ORIGIN_KIND)) {
    throw new Error(`Effect "${effectId}" has invalid origin_kind "${value}".`)
  }

  return value as keyof typeof PATH_ORIGIN_KIND
}

function requirePathLifecycleRecurringKind(effectId: string, value: string) {
  if (!(value in PATH_LIFECYCLE_RECURRING_KIND)) {
    throw new Error(`Effect "${effectId}" has invalid lifecycle_recurring_kind "${value}".`)
  }

  return value as keyof typeof PATH_LIFECYCLE_RECURRING_KIND
}

function requirePathLifecycleConsumeEvent(effectId: string, value: string) {
  if (!(value in PATH_LIFECYCLE_CONSUME_EVENT)) {
    throw new Error(`Effect "${effectId}" has invalid lifecycle_consume_on_first_event "${value}".`)
  }

  return value as keyof typeof PATH_LIFECYCLE_CONSUME_EVENT
}

function requirePathLifecycleEndEvent(effectId: string, value: string) {
  if (!(value in PATH_LIFECYCLE_END_EVENT)) {
    throw new Error(`Effect "${effectId}" has invalid lifecycle_end_on_event "${value}".`)
  }

  return value as keyof typeof PATH_LIFECYCLE_END_EVENT
}

function requireTargetSelectionKind(ownerId: string, value: string) {
  if (!(value in TARGET_SELECTION_KIND)) {
    throw new Error(`Owned row "${ownerId}" has invalid target_selection_kind "${value}".`)
  }

  return value as keyof typeof TARGET_SELECTION_KIND
}

function requireTargetDispositionKind(ownerId: string, value: string) {
  if (!(value in TARGET_DISPOSITION_KIND)) {
    throw new Error(`Owned row "${ownerId}" has invalid target_disposition_kind "${value}".`)
  }

  return value as keyof typeof TARGET_DISPOSITION_KIND
}

function requireDamageValueKind(damageId: string, value: string) {
  if (!(value in DAMAGE_VALUE_KIND)) {
    throw new Error(`Damage "${damageId}" has invalid value_kind "${value}".`)
  }

  return value as keyof typeof DAMAGE_VALUE_KIND
}

function requireScalingKind(damageId: string, value: string): string {
  if (!(value in SCALING) && !(value in SCALABLE_SCALING_KIND)) {
    throw new Error(`Damage "${damageId}" has invalid scaling_kind "${value}".`)
  }

  return value
}

function requireScalingSource(damageId: string, value: string) {
  if (!(value in SCALING_SOURCE)) {
    throw new Error(`Damage "${damageId}" has invalid scaling_source "${value}".`)
  }

  return value as keyof typeof SCALING_SOURCE
}

function requireDamageBonusKind(damageId: string, value: string) {
  if (!(value in DAMAGE_BONUS_KIND)) {
    throw new Error(`Damage "${damageId}" has invalid bonus_kind "${value}".`)
  }

  return value as keyof typeof DAMAGE_BONUS_KIND
}

function requireAbilityCode(ownerId: string, value: string) {
  if (!(value in ABILITY_CODE)) {
    throw new Error(`Owned row "${ownerId}" has invalid ability_code "${value}".`)
  }

  return value as keyof typeof ABILITY_CODE
}

function buildTargeting(
  ownerId: string,
  selectionKind: string | null,
  dispositionKind: string | null,
  maxTargets: number | null,
  maxTargetsScaling: Json | null,
  excludedCreatureTypeIds: string[] | null
): TargetingAuthored | undefined {
  if (!selectionKind) {
    return undefined
  }

  const normalizedSelectionKind = requireTargetSelectionKind(ownerId, selectionKind)

  if (normalizedSelectionKind === TARGET_SELECTION_KIND.SELF) {
    return {
      selectionKind: normalizedSelectionKind
    }
  }

  if (normalizedSelectionKind === TARGET_SELECTION_KIND.CHOSEN_CREATURES) {
    return {
      selectionKind: normalizedSelectionKind,
      dispositionKind: dispositionKind
        ? requireTargetDispositionKind(ownerId, dispositionKind)
        : undefined,
      maxTargets: maxTargets ?? undefined,
      maxTargetsScaling: maxTargetsScaling
        ? (maxTargetsScaling as NonNullable<Extract<TargetingAuthored, { selectionKind: typeof TARGET_SELECTION_KIND.CHOSEN_CREATURES }>['maxTargetsScaling']>)
        : undefined,
      excludedCreatureTypeIds: excludedCreatureTypeIds?.length
        ? excludedCreatureTypeIds
        : undefined
    }
  }

  return {
    selectionKind: normalizedSelectionKind,
    dispositionKind: dispositionKind
      ? requireTargetDispositionKind(ownerId, dispositionKind)
      : undefined,
    excludedCreatureTypeIds: excludedCreatureTypeIds?.length
      ? excludedCreatureTypeIds
      : undefined
  }
}

function buildLifecycle(
  effectId: string,
  recurringKind: string | null,
  consumeOnFirstEvent: string | null,
  endOnEvents: string[] | null
): PathLifecycleAuthored | undefined {
  const lifecycle: PathLifecycleAuthored = {}

  if (recurringKind) {
    lifecycle.recurringKind = requirePathLifecycleRecurringKind(effectId, recurringKind)
  }

  if (consumeOnFirstEvent) {
    lifecycle.consumeOnFirstEvent = requirePathLifecycleConsumeEvent(effectId, consumeOnFirstEvent)
  }

  if (endOnEvents?.length) {
    lifecycle.endOnEvents = endOnEvents.map((event) => requirePathLifecycleEndEvent(effectId, event))
  }

  return Object.keys(lifecycle).length > 0
    ? lifecycle
    : undefined
}

async function hydrateRangeById(db: DBLike, id: string) {
  const row = await db
    .selectFrom('characteristic_ranges')
    .select([
      'kind', 'min', 'unit_code', 'scaling'
    ])
    .where('characteristic_id', '=', id)
    .executeTakeFirst()

  const range = requireLinkedRecord(row, `Range characteristic "${id}" is missing.`)
  const kind = requireRangeKind(id, range.kind)

  if (kind === RANGE_KIND.DISTANCE) {
    return {
      id,
      rangeKind: kind,
      amount: requireNumericValue(id, range.min, 'range.min', `Range characteristic "${id}" is missing amount.`),
      unit: requireMeasurementUnit(id, requireLinkedRecord(range.unit_code, `Range characteristic "${id}" is missing unit_code.`)),
      scaling: readScalableValue<{
        amount: number
        unit: keyof typeof MEASUREMENT_UNIT_CODE
      }>(range.scaling)
    } as RangeAuthored
  }

  return {
    id,
    rangeKind: kind
  }
}

async function hydrateDurationById(db: DBLike, id: string): Promise<DurationAuthored> {
  const row = await db
    .selectFrom('characteristic_durations')
    .select(['kind', 'amount', 'scaling'])
    .where('characteristic_id', '=', id)
    .executeTakeFirst()

  const duration = requireLinkedRecord(row, `Duration characteristic "${id}" is missing.`)
  const kind = requireDurationKind(id, duration.kind)

  if (kind === DURATION_KIND.INSTANTANEOUS) {
    return { id, durationKind: kind }
  }

  return {
    id,
    durationKind: kind,
    amount: requireNumericValue(id, duration.amount, 'duration.amount', `Duration characteristic "${id}" is missing amount.`),
    scaling: readScalableValue<{ amount: number }>(duration.scaling)
  } as DurationAuthored
}

async function hydrateShapeById(db: DBLike, id: string): Promise<ShapeAuthored> {
  const [shapeRow, dimensionRows] = await Promise.all([
    db.selectFrom('characteristic_shapes')
      .select(['kind'])
      .where('characteristic_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('characteristic_shape_dimensions')
      .select([
        'dimension', 'amount', 'unit_code', 'scaling'
      ])
      .where('characteristic_id', '=', id)
      .execute()
  ])

  const shape = requireLinkedRecord(shapeRow, `Shape characteristic "${id}" is missing.`)
  const kind = requireShapeKind(id, shape.kind)
  const dimensions = new Map(dimensionRows.map((row) => [row.dimension, row]))

  const measurement = (dimension: string) => {
    const row = requireLinkedRecord(dimensions.get(dimension), `Shape characteristic "${id}" is missing dimension "${dimension}".`)

    return {
      amount: requireNumericValue(id, row.amount, `shape.${dimension}.amount`, `Shape characteristic "${id}" is missing ${dimension} amount.`),
      unit: requireMeasurementUnit(id, row.unit_code),
      scaling: readScalableValue<{
        amount: number
        unit: keyof typeof MEASUREMENT_UNIT_CODE
      }>(row.scaling)
    } as ShapeMeasurementAuthored
  }

  switch (kind) {
    case SHAPE_KIND.LINE:
    case SHAPE_KIND.CONE:
      return {
        id,
        shapeKind: kind,
        length: measurement('LENGTH')
      }

    case SHAPE_KIND.CUBE:
      return {
        id,
        shapeKind: kind,
        edgeLength: measurement('EDGE_LENGTH')
      }

    case SHAPE_KIND.CYLINDER:
      return {
        id,
        shapeKind: kind,
        radius: measurement('RADIUS'),
        height: dimensions.has('HEIGHT') ? measurement('HEIGHT') : undefined
      }

    case SHAPE_KIND.SPHERE:
    case SHAPE_KIND.CIRCLE:
    case SHAPE_KIND.DOME:
      return {
        id,
        shapeKind: kind,
        radius: measurement('RADIUS')
      }

    case SHAPE_KIND.WALL:
      return {
        id,
        shapeKind: kind,
        length: measurement('LENGTH'),
        height: measurement('HEIGHT'),
        thickness: dimensions.has('THICKNESS') ? measurement('THICKNESS') : undefined
      }

    default:
      return kind satisfies never
  }
}

async function hydrateSavingThrowById(db: DBLike, id: string) {
  const row = await db
    .selectFrom('saving_throws')
    .select(['saving_throw_kind', 'ability_code', 'dc'])
    .where('id', '=', id)
    .executeTakeFirst()

  const savingThrow = requireLinkedRecord(row, `Saving throw "${id}" is missing.`)
  const kind = requireSavingThrowKind(id, savingThrow.saving_throw_kind)

  if (kind === SAVING_THROW_KIND.SOURCE_SAVE_DC) {
    return {
      id,
      savingThrowKind: kind,
      ability: requireAbilityCode(id, requireLinkedRecord(savingThrow.ability_code, `Saving throw "${id}" is missing ability_code.`))
    }
  }

  return {
    id,
    savingThrowKind: kind,
    ability: requireAbilityCode(id, requireLinkedRecord(savingThrow.ability_code, `Saving throw "${id}" is missing ability_code.`)),
    dc: requireLinkedRecord(savingThrow.dc, `Saving throw "${id}" is missing dc.`)
  }
}

async function hydrateConditionById(db: DBLike, id: string): Promise<ConditionAuthored | null> {
  const row = await db
    .selectFrom('conditions')
    .select(['condition_type_id'])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!row) return null

  return {
    id,
    effectKind: EFFECT_KIND.CONDITION,
    conditionId: row.condition_type_id
  }
}

function normalizeGenericOutcome(
  effectId: string,
  entryId: string,
  effectKind: string,
  json_data: unknown
): OutcomeAuthored {
  const payload = typeof json_data === 'string'
    ? JSON.parse(json_data) as unknown
    : json_data

  if (!payload || typeof payload !== 'object') {
    throw new Error(`Effect "${effectId}" entry "${entryId}" is missing valid generic outcome payload.`)
  }

  const outcome = payload as OutcomeAuthored

  if (outcome.id !== entryId) {
    throw new Error(`Effect "${effectId}" entry "${entryId}" generic payload is linked to "${outcome.id}" instead of sharing the owned id.`)
  }

  if (outcome.effectKind !== effectKind) {
    throw new Error(`Effect "${effectId}" entry "${entryId}" generic payload kind "${outcome.effectKind}" does not match "${effectKind}".`)
  }

  const {
    label: _label,
    description: _description,
    ...normalized
  } = outcome as OutcomeAuthored & Partial<OutcomeRowMetadataAuthored>

  return normalized
}

async function hydrateDamageById(db: DBLike, id: string): Promise<DamageAuthored | null> {
  const row = await db
    .selectFrom('damages')
    .select([
      'id',
      'damage_type_id',
      'value_kind',
      'scaling_kind',
      'scaling_source',
      'class_id'
    ])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!row) return null

  const [valueRow, scalingRows, bonusRows] = await Promise.all([
    db.selectFrom('damage_values')
      .select([
        'amount', 'dice', 'multiplier', 'min', 'max'
      ])
      .where('damage_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('damage_scaling_levels')
      .select([
        'id', 'level', 'sort_order', 'amount', 'dice'
      ])
      .where('damage_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('damage_bonuses')
      .select([
        'id', 'bonus_kind', 'ability_code', 'skill_id', 'multiplier', 'min', 'max', 'sort_order'
      ])
      .where('damage_id', '=', id)
      .orderBy('sort_order')
      .execute()
  ])

  const bonuses: DamageAuthored['bonuses'] = bonusRows.length > 0
    ? bonusRows.map((bonus) => {
        const kind = requireDamageBonusKind(id, bonus.bonus_kind)

        switch (kind) {
          case DAMAGE_BONUS_KIND.ABILITY_BONUS:
            return {
              id: bonus.id,
              bonusKind: kind,
              ability: requireAbilityCode(bonus.id, requireLinkedRecord(bonus.ability_code, `Damage bonus "${bonus.id}" is missing ability_code.`)),
              multiplier: readOptionalNumericValue(bonus.id, bonus.multiplier, 'damage_bonus.multiplier'),
              min: readOptionalNumericValue(bonus.id, bonus.min, 'damage_bonus.min'),
              max: readOptionalNumericValue(bonus.id, bonus.max, 'damage_bonus.max'),
              order: bonus.sort_order
            } satisfies DamageBonus

          case DAMAGE_BONUS_KIND.SKILL_BONUS:
            return {
              id: bonus.id,
              bonusKind: kind,
              skillId: requireLinkedRecord(bonus.skill_id, `Damage bonus "${bonus.id}" is missing skill_id.`),
              multiplier: readOptionalNumericValue(bonus.id, bonus.multiplier, 'damage_bonus.multiplier'),
              min: readOptionalNumericValue(bonus.id, bonus.min, 'damage_bonus.min'),
              max: readOptionalNumericValue(bonus.id, bonus.max, 'damage_bonus.max'),
              order: bonus.sort_order
            } satisfies DamageBonus

          case DAMAGE_BONUS_KIND.PROFICIENCY_BONUS:
            return {
              id: bonus.id,
              bonusKind: kind,
              multiplier: readOptionalNumericValue(bonus.id, bonus.multiplier, 'damage_bonus.multiplier'),
              min: readOptionalNumericValue(bonus.id, bonus.min, 'damage_bonus.min'),
              max: readOptionalNumericValue(bonus.id, bonus.max, 'damage_bonus.max'),
              order: bonus.sort_order
            } satisfies DamageBonus

          default:
            return kind satisfies never
        }
      })
    : undefined

  const scalingKind = requireScalingKind(id, row.scaling_kind)
  const valueKind = requireDamageValueKind(id, row.value_kind)

  if (scalingKind === SCALING.NONE) {
    const value = requireLinkedRecord(valueRow, `Damage "${id}" is missing damage_values row.`)

    switch (valueKind) {
      case DAMAGE_VALUE_KIND.FIXED:
        return {
          id,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: row.damage_type_id,
          bonuses,
          valueKind,
          scalingKind: SCALING.NONE,
          amount: requireNumericValue(id, value.amount, 'damage_values.amount', `Damage "${id}" FIXED payload is missing amount.`)
        }

      case DAMAGE_VALUE_KIND.DICE:
        return {
          id,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: row.damage_type_id,
          bonuses,
          valueKind,
          scalingKind: SCALING.NONE,
          diceConfig: requireLinkedRecord(value.dice, `Damage "${id}" DICE payload is missing dice.`)
        }

      case DAMAGE_VALUE_KIND.POOL:
        return {
          id,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: row.damage_type_id,
          bonuses,
          valueKind,
          scalingKind: SCALING.NONE,
          amount: requireNumericValue(id, value.amount, 'damage_values.amount', `Damage "${id}" POOL payload is missing amount.`)
        }

      default:
        return valueKind satisfies never
    }
  }

  const scalingSource = requireScalingSource(id, requireLinkedRecord(row.scaling_source, `Damage "${id}" is missing scaling_source.`))

  if (valueKind === DAMAGE_VALUE_KIND.POOL) {
    const value = requireLinkedRecord(valueRow, `Damage "${id}" POOL PER_LEVEL payload is missing damage_values row.`)

    if (scalingKind === SCALABLE_SCALING_KIND.BREAKPOINTS) {
      throw new Error(`Damage "${id}" POOL BREAKPOINTS payload is not supported.`)
    }

    if (scalingSource === SCALING_SOURCE.CLASS_LEVEL) {
      return {
        id,
        effectKind: EFFECT_KIND.DAMAGE,
        damageTypeId: row.damage_type_id,
        bonuses,
        valueKind,
        scalingKind: SCALING.PER_LEVEL,
        scalingSource,
        classId: requireLinkedRecord(row.class_id, `Damage "${id}" CLASS_LEVEL scaling is missing class_id.`),
        amount: readOptionalNumericValue(id, value.amount, 'damage_values.amount'),
        multiplier: readOptionalNumericValue(id, value.multiplier, 'damage_values.multiplier'),
        min: readOptionalNumericValue(id, value.min, 'damage_values.min'),
        max: readOptionalNumericValue(id, value.max, 'damage_values.max')
      }
    }

    return {
      id,
      effectKind: EFFECT_KIND.DAMAGE,
      damageTypeId: row.damage_type_id,
      bonuses,
      valueKind,
      scalingKind: SCALING.PER_LEVEL,
      scalingSource,
      amount: readOptionalNumericValue(id, value.amount, 'damage_values.amount'),
      multiplier: readOptionalNumericValue(id, value.multiplier, 'damage_values.multiplier'),
      min: readOptionalNumericValue(id, value.min, 'damage_values.min'),
      max: readOptionalNumericValue(id, value.max, 'damage_values.max')
    }
  }

  if (scalingRows.length === 0) {
    throw new Error(`Damage "${id}" ${valueKind} PER_LEVEL payload is missing scaling levels.`)
  }

  if (valueKind === DAMAGE_VALUE_KIND.FIXED) {
    if (scalingKind === SCALABLE_SCALING_KIND.BREAKPOINTS) {
      if (scalingSource === SCALING_SOURCE.CLASS_LEVEL) {
        return {
          id,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: row.damage_type_id,
          bonuses,
          valueKind,
          scalingKind: SCALABLE_SCALING_KIND.BREAKPOINTS,
          scalingSource,
          classId: requireLinkedRecord(row.class_id, `Damage "${id}" CLASS_LEVEL scaling is missing class_id.`),
          breakpoints: scalingRows.map((level) => ({
            id: level.id,
            level: level.level,
            order: level.sort_order,
            value: {
              amount: requireNumericValue(level.id, level.amount, 'damage_scaling_levels.amount', `Damage level "${level.id}" is missing amount.`)
            }
          }))
        }
      }

      return {
        id,
        effectKind: EFFECT_KIND.DAMAGE,
        damageTypeId: row.damage_type_id,
        bonuses,
        valueKind,
        scalingKind: SCALABLE_SCALING_KIND.BREAKPOINTS,
        scalingSource,
        breakpoints: scalingRows.map((level) => ({
          id: level.id,
          level: level.level,
          order: level.sort_order,
          value: {
            amount: requireNumericValue(level.id, level.amount, 'damage_scaling_levels.amount', `Damage level "${level.id}" is missing amount.`)
          }
        }))
      }
    }

    if (scalingSource === SCALING_SOURCE.CLASS_LEVEL) {
      return {
        id,
        effectKind: EFFECT_KIND.DAMAGE,
        damageTypeId: row.damage_type_id,
        bonuses,
        valueKind,
        scalingKind: SCALING.PER_LEVEL,
        scalingSource,
        classId: requireLinkedRecord(row.class_id, `Damage "${id}" CLASS_LEVEL scaling is missing class_id.`),
        levels: scalingRows.map((level) => ({
          id: level.id,
          level: level.level,
          order: level.sort_order,
          amount: requireNumericValue(level.id, level.amount, 'damage_scaling_levels.amount', `Damage level "${level.id}" is missing amount.`)
        }))
      }
    }

    return {
      id,
      effectKind: EFFECT_KIND.DAMAGE,
      damageTypeId: row.damage_type_id,
      bonuses,
      valueKind,
      scalingKind: SCALING.PER_LEVEL,
      scalingSource,
      levels: scalingRows.map((level) => ({
        id: level.id,
        level: level.level,
        order: level.sort_order,
        amount: requireNumericValue(level.id, level.amount, 'damage_scaling_levels.amount', `Damage level "${level.id}" is missing amount.`)
      }))
    }
  }

  if (scalingKind === SCALABLE_SCALING_KIND.BREAKPOINTS) {
    if (scalingSource === SCALING_SOURCE.CLASS_LEVEL) {
      return {
        id,
        effectKind: EFFECT_KIND.DAMAGE,
        damageTypeId: row.damage_type_id,
        bonuses,
        valueKind,
        scalingKind: SCALABLE_SCALING_KIND.BREAKPOINTS,
        scalingSource,
        classId: requireLinkedRecord(row.class_id, `Damage "${id}" CLASS_LEVEL scaling is missing class_id.`),
        breakpoints: scalingRows.map((level) => ({
          id: level.id,
          level: level.level,
          order: level.sort_order,
          value: {
            diceConfig: requireLinkedRecord(level.dice, `Damage level "${level.id}" is missing dice.`)
          }
        }))
      }
    }

    return {
      id,
      effectKind: EFFECT_KIND.DAMAGE,
      damageTypeId: row.damage_type_id,
      bonuses,
      valueKind,
      scalingKind: SCALABLE_SCALING_KIND.BREAKPOINTS,
      scalingSource,
      breakpoints: scalingRows.map((level) => ({
        id: level.id,
        level: level.level,
        order: level.sort_order,
        value: {
          diceConfig: requireLinkedRecord(level.dice, `Damage level "${level.id}" is missing dice.`)
        }
      }))
    }
  }

  if (scalingSource === SCALING_SOURCE.CLASS_LEVEL) {
    return {
      id,
      effectKind: EFFECT_KIND.DAMAGE,
      damageTypeId: row.damage_type_id,
      bonuses,
      valueKind,
      scalingKind: SCALING.PER_LEVEL,
      scalingSource,
      classId: requireLinkedRecord(row.class_id, `Damage "${id}" CLASS_LEVEL scaling is missing class_id.`),
      levels: scalingRows.map((level) => ({
        id: level.id,
        level: level.level,
        order: level.sort_order,
        diceConfig: requireLinkedRecord(level.dice, `Damage level "${level.id}" is missing dice.`)
      }))
    }
  }

  return {
    id,
    effectKind: EFFECT_KIND.DAMAGE,
    damageTypeId: row.damage_type_id,
    bonuses,
    valueKind,
    scalingKind: SCALING.PER_LEVEL,
    scalingSource,
    levels: scalingRows.map((level) => ({
      id: level.id,
      level: level.level,
      order: level.sort_order,
      diceConfig: requireLinkedRecord(level.dice, `Damage level "${level.id}" is missing dice.`)
    }))
  }
}

function requireSelectionKind(effectId: string, value: string): EffectPath['selectionKind'] {
  if (value !== 'FIXED' && value !== 'CHOICE' && value !== 'ROLL_TABLE') {
    throw new Error(`Effect "${effectId}" has invalid selection_kind "${value}".`)
  }

  return value
}

function requireResultKind(resultBlockId: string, value: string): ResultBlock['resultKind'] {
  if (value !== 'SINGLE' && value !== 'SEQUENCE') {
    throw new Error(`Effect result block "${resultBlockId}" has invalid result_kind "${value}".`)
  }

  return value
}

async function hydrateGenericOutcomeById(
  db: DBLike,
  effectId: string,
  outcomeId: string,
  effectKind: string
): Promise<OutcomeAuthored> {
  const row = await db
    .selectFrom('effect_generic_outcomes')
    .select(['effect_kind', 'json_data'])
    .where('id', '=', outcomeId)
    .executeTakeFirst()

  const genericOutcome = requireLinkedRecord(row, `Effect "${effectId}" outcome "${outcomeId}" is missing generic payload.`)

  return normalizeGenericOutcome(effectId, outcomeId, effectKind, genericOutcome.json_data)
}

async function hydrateOutcomeById(
  db: DBLike,
  effectId: string,
  outcomeId: string,
  effectKind: string
): Promise<OutcomeAuthored> {
  if (effectKind === EFFECT_KIND.DAMAGE) {
    return requireLinkedRecord(
      await hydrateDamageById(db, outcomeId),
      `Effect "${effectId}" outcome "${outcomeId}" is linked to missing damage "${outcomeId}".`
    )
  }

  if (effectKind === EFFECT_KIND.CONDITION) {
    return requireLinkedRecord(
      await hydrateConditionById(db, outcomeId),
      `Effect "${effectId}" outcome "${outcomeId}" is linked to missing condition "${outcomeId}".`
    )
  }

  return hydrateGenericOutcomeById(db, effectId, outcomeId, effectKind)
}

async function hydrateResultBlockById(
  db: DBLike,
  effectId: string,
  resultBlockId: string
): Promise<ResultBlock> {
  const [resultBlockRow, outcomeRows] = await Promise.all([
    db.selectFrom('effect_result_blocks')
      .select([
        'result_kind',
        'duration_id',
        'lifecycle_recurring_kind',
        'lifecycle_consume_on_first_event',
        'lifecycle_end_on_events'
      ])
      .where('id', '=', resultBlockId)
      .executeTakeFirst(),
    db.selectFrom('effect_result_block_outcomes')
      .select(['outcome_id', 'effect_kind', 'sort_order'])
      .where('result_block_id', '=', resultBlockId)
      .orderBy('sort_order')
      .execute()
  ])

  const resultBlock = requireLinkedRecord(resultBlockRow, `Effect "${effectId}" is missing result block "${resultBlockId}".`)
  const [duration, outcomes] = await Promise.all([
    resultBlock.duration_id ? hydrateDurationById(db, resultBlock.duration_id) : Promise.resolve(undefined),
    Promise.all(outcomeRows.map((row) => hydrateOutcomeById(db, effectId, row.outcome_id, row.effect_kind)))
  ])

  const lifecycle = buildLifecycle(
    effectId,
    resultBlock.lifecycle_recurring_kind,
    resultBlock.lifecycle_consume_on_first_event,
    resultBlock.lifecycle_end_on_events
  )

  return {
    id: resultBlockId,
    resultKind: requireResultKind(resultBlockId, resultBlock.result_kind),
    ...(duration ? { duration } : {}),
    ...(lifecycle ? { lifecycle } : {}),
    outcomes
  }
}

async function hydrateNativePaths(
  db: DBLike,
  effectId: string,
  triggerCode: Trigger
): Promise<NonNullable<EffectAuthored['paths']> | null> {
  const pathRows = await db
    .selectFrom('effect_paths')
    .select([
      'id',
      'sort_order',
      'path_code',
      'group_type',
      'selection_kind',
      'origin_kind',
      'range_override_characteristic_id',
      'target_selection_kind',
      'target_disposition_kind',
      'max_targets',
      'max_targets_scaling',
      'excluded_creature_type_ids',
      'result_block_id',
      'roll_table_kind',
      'die'
    ])
    .where('effect_id', '=', effectId)
    .orderBy('sort_order')
    .execute()

  if (pathRows.length === 0) {
    return null
  }

  const paths: NonNullable<EffectAuthored['paths']> = []

  for (const pathRow of pathRows) {
    const pathCode = requirePathCode(effectId, triggerCode, pathRow.path_code)
    const groupType = requirePathGroupType(effectId, pathRow.group_type)
    const selectionKind = requireSelectionKind(effectId, pathRow.selection_kind)
    const targetingOverride = buildTargeting(pathRow.id, pathRow.target_selection_kind, pathRow.target_disposition_kind, pathRow.max_targets, pathRow.max_targets_scaling, pathRow.excluded_creature_type_ids)
    const originKind = pathRow.origin_kind
      ? requirePathOriginKind(effectId, pathRow.origin_kind)
      : undefined
    const rangeOverride = pathRow.range_override_characteristic_id
      ? await hydrateRangeById(db, pathRow.range_override_characteristic_id)
      : undefined

    if (selectionKind === 'FIXED') {
      paths.push({
        id: pathRow.id,
        order: pathRow.sort_order,
        pathCode,
        groupType,
        selectionKind,
        resultBlock: await hydrateResultBlockById(db, effectId, requireLinkedRecord(pathRow.result_block_id, `Effect "${effectId}" fixed path "${pathRow.id}" is missing result_block_id.`)),
        ...(originKind ? { originKind } : {}),
        ...(rangeOverride ? { rangeOverride } : {}),
        ...(targetingOverride ? { targetingOverride } : {})
      })
      continue
    }

    if (selectionKind === 'CHOICE') {
      const optionRows = await db
        .selectFrom('effect_path_choice_options')
        .select(['id', 'label', 'description', 'sort_order', 'result_block_id'])
        .where('path_id', '=', pathRow.id)
        .orderBy('sort_order')
        .execute()

      paths.push({
        id: pathRow.id,
        order: pathRow.sort_order,
        pathCode,
        groupType,
        selectionKind,
        options: await Promise.all(optionRows.map(async (option) => ({
          id: option.id,
          order: option.sort_order,
          ...(option.label !== null ? { label: option.label } : {}),
          ...(option.description !== null ? { description: option.description } : {}),
          resultBlock: await hydrateResultBlockById(db, effectId, option.result_block_id)
        }))),
        ...(originKind ? { originKind } : {}),
        ...(rangeOverride ? { rangeOverride } : {}),
        ...(targetingOverride ? { targetingOverride } : {})
      })
      continue
    }

    const rollTableKind = requirePathRollTableKind(effectId, requireLinkedRecord(pathRow.roll_table_kind, `Effect "${effectId}" roll-table path "${pathRow.id}" is missing roll_table_kind.`))
    const dieConfig = requireLinkedRecord(pathRow.die, `Effect "${effectId}" roll-table path "${pathRow.id}" is missing die.`)
    const rowRows = await db
      .selectFrom('effect_path_roll_table_rows')
      .select(['id', 'sort_order', 'roll_value', 'roll_min', 'roll_max', 'result_block_id'])
      .where('path_id', '=', pathRow.id)
      .orderBy('sort_order')
      .execute()

    paths.push({
      id: pathRow.id,
      order: pathRow.sort_order,
      pathCode,
      groupType,
      selectionKind,
      rollTableKind,
      dieConfig,
      rows: await Promise.all(rowRows.map(async (row) => ({
        id: row.id,
        order: row.sort_order,
        ...(
          row.roll_value !== null
            ? { rollValue: row.roll_value }
            : {
                rollRange: [
                  requireLinkedRecord(row.roll_min, `Effect "${effectId}" roll row "${row.id}" is missing roll_min.`),
                  requireLinkedRecord(row.roll_max, `Effect "${effectId}" roll row "${row.id}" is missing roll_max.`)
                ] as [number, number]
              }
        ),
        resultBlock: await hydrateResultBlockById(db, effectId, row.result_block_id)
      }))),
      ...(originKind ? { originKind } : {}),
      ...(rangeOverride ? { rangeOverride } : {}),
      ...(targetingOverride ? { targetingOverride } : {})
    })
  }

  return paths
}

async function hydrateEffectById(db: DBLike, id: string): Promise<EffectAuthored | null> {
  const row = await db
    .selectFrom('effects')
    .select(['id', 'sort_order'])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!row) return null

  const invocationRow = await db
    .selectFrom('effect_invocations')
    .select([
      'trigger_code',
      'activation_type',
      'activation_value',
      'range_characteristic_id',
      'shape_characteristic_id',
      'saving_throw_id',
      'target_selection_kind',
      'target_disposition_kind',
      'max_targets',
      'max_targets_scaling',
      'excluded_creature_type_ids'
    ])
    .where('effect_id', '=', id)
    .executeTakeFirst()

  const invocation = requireLinkedRecord(invocationRow, `Effect "${id}" is missing invocation row.`)
  const triggerCode = requireTriggerCode(id, invocation.trigger_code)
  const [
    range,
    shape,
    hydratedSavingThrow,
    nativePaths
  ] = await Promise.all([
    hydrateRangeById(db, invocation.range_characteristic_id),
    invocation.shape_characteristic_id ? hydrateShapeById(db, invocation.shape_characteristic_id) : Promise.resolve(undefined),
    invocation.saving_throw_id ? hydrateSavingThrowById(db, invocation.saving_throw_id) : Promise.resolve(undefined),
    hydrateNativePaths(db, id, triggerCode)
  ])

  const targeting = buildTargeting(id, invocation.target_selection_kind, invocation.target_disposition_kind, invocation.max_targets, invocation.max_targets_scaling, invocation.excluded_creature_type_ids)
  const passive = isPassiveInvocation(invocation.activation_type, invocation.activation_value)
  const activation = passive
    ? undefined
    : buildActivation(id, invocation.activation_type, invocation.activation_value)

  const authoredInvocation: EffectAuthored['invocation'] = passive
    ? triggerCode === TRIGGER.SAVING_THROW
      ? {
          kind: EFFECT_INVOCATION_KIND.PASSIVE,
          triggerCode,
          savingThrow: requireLinkedRecord(hydratedSavingThrow, `Effect "${id}" passive SAVING_THROW invocation is missing saving throw "${invocation.saving_throw_id}".`) as SavingThrowAuthored,
          range,
          ...(shape ? { shape } : {}),
          ...(targeting ? { targeting } : {})
        }
      : {
          kind: EFFECT_INVOCATION_KIND.PASSIVE,
          triggerCode,
          range,
          ...(shape ? { shape } : {}),
          ...(targeting ? { targeting } : {})
        }
    : triggerCode === TRIGGER.SAVING_THROW
      ? {
          kind: EFFECT_INVOCATION_KIND.ACTION,
          triggerCode,
          savingThrow: requireLinkedRecord(hydratedSavingThrow, `Effect "${id}" SAVING_THROW invocation is missing saving throw "${invocation.saving_throw_id}".`) as SavingThrowAuthored,
          activation: requireLinkedRecord(activation, `Effect "${id}" is missing activation payload.`),
          range,
          ...(shape ? { shape } : {}),
          ...(targeting ? { targeting } : {})
        }
      : {
          kind: EFFECT_INVOCATION_KIND.ACTION,
          triggerCode,
          activation: requireLinkedRecord(activation, `Effect "${id}" is missing activation payload.`),
          range,
          ...(shape ? { shape } : {}),
          ...(targeting ? { targeting } : {})
        }

  return {
    id: row.id,
    order: row.sort_order,
    invocation: authoredInvocation,
    paths: requireLinkedRecord(nativePaths, `Effect "${id}" is missing native paths.`)
  }
}

export function createEffectRepository(db: DBLike): EffectRepository {
  return {
    async upsert(entity) {
      await upsertEffect(db, entity)
    },

    async findById(id) {
      return hydrateEffectById(db, id)
    },

    async findByIds(ids) {
      return hydrateByIds(ids, (id) => hydrateEffectById(db, id))
    },

    async findAll() {
      const rows = await db
        .selectFrom('effects')
        .select('id')
        .orderBy('sort_order')
        .execute()

      return orderedHydratedRecords(
        rows.map((row) => row.id),
        await hydrateByIds(rows.map((row) => row.id), (id) => hydrateEffectById(db, id))
      )
    }
  }
}





