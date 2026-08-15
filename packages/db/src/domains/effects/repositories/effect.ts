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
  SAVING_THROW_DC_BONUS_KIND,
  SAVING_THROW_DC_METHOD,
  SCALING,
  SCALING_AMOUNT_KIND,
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
  type RangeAuthored,
  type ScalableValueAuthored,
  type SavingThrowAuthored,
  type SavingThrowDcBonusAuthored,
  type ShapeAuthored,
  type ShapeMeasurementAuthored,
  type TargetingAuthored,
  type Trigger
} from '@artificer-toolkit/shared'
import type { DBLike, Json } from '#types'
import { upsertEffect } from '../upserts/effect.js'
import type { EffectRepository } from '../../../repositories/contracts.js'
import { hydrateByIds, orderedHydratedRecords, uniqueIds } from '../../../repositories/batch.js'
type DamageBonus = NonNullable<DamageAuthored['bonuses']>[number]
type EffectPath = NonNullable<EffectAuthored['paths']>[number]
type ResultBlock = Extract<EffectPath, { selectionKind: 'FIXED' }>['resultBlock']
type DbNumeric = number | string
type DamageRow = {
  id: string
  damage_type_id: string
  value_kind: string
  scaling_kind: string
  amount_kind: string | null
  amount_multiplier: DbNumeric | null
  scaling_source: string | null
  class_id: string | null
}
type DamageScalingLevelRow = {
  id: string
  damage_id: string
  level: number
  sort_order: number
  amount: DbNumeric | null
  dice: string | null
}
type DamageBonusRow = {
  id: string
  damage_id: string
  bonus_kind: string
  ability_code: string | null
  skill_id: string | null
  multiplier: DbNumeric | null
  min: DbNumeric | null
  max: DbNumeric | null
  sort_order: number
}
type SavingThrowDcBonusRow = {
  id: string
  saving_throw_id: string
  bonus_kind: string
  ability_code: string | null
  amount: DbNumeric | null
  sort_order: number
}

function readScalableValue<TValue extends Record<string, unknown>>(
  value: Json | null | undefined
): ScalableValueAuthored<TValue> | undefined {
  return value == null ? undefined : (value as ScalableValueAuthored<TValue>)
}

function requireLinkedRecord<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message)
  }

  return value
}

function readRollTableRepeatConfig(
  effectId: string,
  rowId: string,
  value: Json | null
): Extract<
  import('@artificer-toolkit/shared').PathRollTableRowAuthored,
  { resolutionKind: 'REPEAT_TABLE' }
>['repeat'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Effect "${effectId}" roll row "${rowId}" is missing repeat_config.`)
  }

  const count = value.count
  const rerollValues = value.rerollValues
  if (!Number.isInteger(count) || (count as number) < 1 || (count as number) > 100) {
    throw new Error(`Effect "${effectId}" roll row "${rowId}" has invalid repeat count.`)
  }
  if (!Array.isArray(rerollValues)) {
    throw new Error(`Effect "${effectId}" roll row "${rowId}" has invalid reroll values.`)
  }

  const parsedRerollValues = rerollValues.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(
        `Effect "${effectId}" roll row "${rowId}" reroll value ${index + 1} is invalid.`
      )
    }
    if (
      typeof entry.id !== 'string' ||
      !Number.isInteger(entry.order) ||
      !Number.isInteger(entry.value)
    ) {
      throw new Error(
        `Effect "${effectId}" roll row "${rowId}" reroll value ${index + 1} is invalid.`
      )
    }
    return { id: entry.id, order: entry.order as number, value: entry.value as number }
  })

  return { count: count as number, rerollValues: parsedRerollValues }
}

function indexRowsById<T extends { id: string }>(rows: readonly T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]))
}

function groupRowsByKey<T, K extends string>(
  rows: readonly T[],
  getKey: (row: T) => K
): Map<K, T[]> {
  const grouped = new Map<K, T[]>()

  for (const row of rows) {
    const key = getKey(row)
    const group = grouped.get(key)

    if (group) {
      group.push(row)
    } else {
      grouped.set(key, [row])
    }
  }

  return grouped
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
  return value == null ? undefined : readNumericValue(ownerId, value, field)
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
        amount: requireLinkedRecord(
          activationValue,
          `Effect "${effectId}" activation "${activationCode}" is missing amount.`
        )
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

function requireTriggerCode(
  effectId: string,
  value: string
): EffectAuthored['invocation']['triggerCode'] {
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

function isAmountlessDurationKind(kind: keyof typeof DURATION_KIND) {
  return kind === DURATION_KIND.INSTANTANEOUS || kind === DURATION_KIND.UNTIL_DISPELLED
}

function requireSavingThrowDcMethod(savingThrowId: string, value: string) {
  if (!(value in SAVING_THROW_DC_METHOD)) {
    throw new Error(`Saving throw "${savingThrowId}" has invalid DC method "${value}".`)
  }

  return value as keyof typeof SAVING_THROW_DC_METHOD
}

function requireSavingThrowDcBonusKind(bonusId: string, value: string) {
  if (!(value in SAVING_THROW_DC_BONUS_KIND)) {
    throw new Error(`Saving throw DC bonus "${bonusId}" has invalid kind "${value}".`)
  }

  return value as keyof typeof SAVING_THROW_DC_BONUS_KIND
}

function requirePathCode(effectId: string, triggerCode: Trigger, value: string) {
  if (!(value in PATH_CODE)) {
    throw new Error(`Effect "${effectId}" has invalid path_code "${value}".`)
  }

  if (
    !PATH_CODES_BY_TRIGGER[triggerCode].includes(
      value as (typeof PATH_CODES_BY_TRIGGER)[Trigger][number]
    )
  ) {
    throw new Error(
      `Effect "${effectId}" has invalid path_code "${value}" for trigger "${triggerCode}".`
    )
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
  resolutionCount: number | null,
  resolutionCountScaling: Json | null,
  allowRepeatedTargets: boolean | null,
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
        ? (maxTargetsScaling as NonNullable<
            Extract<
              TargetingAuthored,
              { selectionKind: typeof TARGET_SELECTION_KIND.CHOSEN_CREATURES }
            >['maxTargetsScaling']
          >)
        : undefined,
      resolutionCount: resolutionCount ?? undefined,
      resolutionCountScaling: resolutionCountScaling
        ? (resolutionCountScaling as NonNullable<
            Extract<
              TargetingAuthored,
              { selectionKind: typeof TARGET_SELECTION_KIND.CHOSEN_CREATURES }
            >['resolutionCountScaling']
          >)
        : undefined,
      allowRepeatedTargets: allowRepeatedTargets ?? undefined,
      excludedCreatureTypeIds: excludedCreatureTypeIds?.length ? excludedCreatureTypeIds : undefined
    }
  }

  return {
    selectionKind: normalizedSelectionKind,
    dispositionKind: dispositionKind
      ? requireTargetDispositionKind(ownerId, dispositionKind)
      : undefined,
    excludedCreatureTypeIds: excludedCreatureTypeIds?.length ? excludedCreatureTypeIds : undefined
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
    lifecycle.endOnEvents = endOnEvents.map((event) =>
      requirePathLifecycleEndEvent(effectId, event)
    )
  }

  return Object.keys(lifecycle).length > 0 ? lifecycle : undefined
}

async function hydrateRangeById(db: DBLike, id: string) {
  const row = await db
    .selectFrom('characteristic_ranges')
    .select(['kind', 'min', 'unit_code', 'scaling'])
    .where('characteristic_id', '=', id)
    .executeTakeFirst()

  const range = requireLinkedRecord(row, `Range characteristic "${id}" is missing.`)
  const kind = requireRangeKind(id, range.kind)

  if (kind === RANGE_KIND.DISTANCE) {
    return {
      id,
      rangeKind: kind,
      amount: requireNumericValue(
        id,
        range.min,
        'range.min',
        `Range characteristic "${id}" is missing amount.`
      ),
      unit: requireMeasurementUnit(
        id,
        requireLinkedRecord(range.unit_code, `Range characteristic "${id}" is missing unit_code.`)
      ),
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

  if (isAmountlessDurationKind(kind)) {
    return { id, durationKind: kind }
  }

  return {
    id,
    durationKind: kind,
    amount: requireNumericValue(
      id,
      duration.amount,
      'duration.amount',
      `Duration characteristic "${id}" is missing amount.`
    ),
    scaling: readScalableValue<{ amount: number }>(duration.scaling)
  } as DurationAuthored
}

function hydrateDamageAmountMetadata(
  damageId: string,
  row: Pick<DamageRow, 'amount_kind' | 'amount_multiplier'>
): Partial<Pick<DamageAuthored, 'amountKind' | 'multiplier'>> {
  const amountKind = row.amount_kind
  if (
    amountKind != null &&
    !Object.values(SCALING_AMOUNT_KIND).includes(
      amountKind as (typeof SCALING_AMOUNT_KIND)[keyof typeof SCALING_AMOUNT_KIND]
    )
  ) {
    throw new Error(`Damage "${damageId}" has invalid amount_kind "${amountKind}".`)
  }

  const multiplier = readOptionalNumericValue(
    damageId,
    row.amount_multiplier,
    'damages.amount_multiplier'
  )

  return {
    ...(amountKind ? { amountKind: amountKind as DamageAuthored['amountKind'] } : {}),
    ...(multiplier == null ? {} : { multiplier })
  }
}

async function hydrateShapeById(db: DBLike, id: string): Promise<ShapeAuthored> {
  const [shapeRow, dimensionRows] = await Promise.all([
    db
      .selectFrom('characteristic_shapes')
      .select(['kind'])
      .where('characteristic_id', '=', id)
      .executeTakeFirst(),
    db
      .selectFrom('characteristic_shape_dimensions')
      .select(['dimension', 'amount', 'unit_code', 'scaling'])
      .where('characteristic_id', '=', id)
      .execute()
  ])

  const shape = requireLinkedRecord(shapeRow, `Shape characteristic "${id}" is missing.`)
  const kind = requireShapeKind(id, shape.kind)
  const dimensions = new Map(dimensionRows.map((row) => [row.dimension, row]))

  const measurement = (dimension: string) => {
    const row = requireLinkedRecord(
      dimensions.get(dimension),
      `Shape characteristic "${id}" is missing dimension "${dimension}".`
    )

    return {
      amount: requireNumericValue(
        id,
        row.amount,
        `shape.${dimension}.amount`,
        `Shape characteristic "${id}" is missing ${dimension} amount.`
      ),
      unit: requireMeasurementUnit(id, row.unit_code),
      scaling: readScalableValue<{
        amount: number
        unit: keyof typeof MEASUREMENT_UNIT_CODE
      }>(row.scaling)
    } as ShapeMeasurementAuthored
  }

  switch (kind) {
    case SHAPE_KIND.LINE:
      return {
        id,
        shapeKind: kind,
        length: measurement('LENGTH'),
        width: dimensions.has('WIDTH') ? measurement('WIDTH') : undefined
      }

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
        height: measurement('HEIGHT')
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

function buildSavingThrowDcBonus(row: SavingThrowDcBonusRow): SavingThrowDcBonusAuthored {
  const bonusKind = requireSavingThrowDcBonusKind(row.id, row.bonus_kind)

  if (bonusKind === SAVING_THROW_DC_BONUS_KIND.ABILITY_MODIFIER) {
    return {
      id: row.id,
      bonusKind,
      ability: requireAbilityCode(
        row.id,
        requireLinkedRecord(
          row.ability_code,
          `Saving throw DC bonus "${row.id}" is missing ability_code.`
        )
      )
    }
  }

  if (bonusKind === SAVING_THROW_DC_BONUS_KIND.STATIC_BONUS) {
    return {
      id: row.id,
      bonusKind,
      amount: requireNumericValue(
        row.id,
        row.amount,
        'amount',
        `Saving throw DC bonus "${row.id}" is missing amount.`
      )
    }
  }

  return {
    id: row.id,
    bonusKind
  }
}

async function hydrateSavingThrowBonusesBySavingThrowIds(
  db: DBLike,
  ids: readonly string[]
): Promise<Map<string, SavingThrowDcBonusAuthored[]>> {
  const distinctIds = uniqueIds(ids)
  const rows =
    distinctIds.length > 0
      ? ((await db
          .selectFrom('saving_throw_dc_bonuses')
          .select(['id', 'saving_throw_id', 'bonus_kind', 'ability_code', 'amount', 'sort_order'])
          .where('saving_throw_id', 'in', distinctIds)
          .orderBy('sort_order')
          .execute()) as SavingThrowDcBonusRow[])
      : []
  const groupedRows = groupRowsByKey(rows, (row) => row.saving_throw_id)
  const bonuses = new Map<string, SavingThrowDcBonusAuthored[]>()

  for (const id of distinctIds) {
    bonuses.set(id, (groupedRows.get(id) ?? []).map(buildSavingThrowDcBonus))
  }

  return bonuses
}

async function hydrateSavingThrowById(db: DBLike, id: string) {
  const [row, bonusesBySavingThrowId] = await Promise.all([
    db
      .selectFrom('saving_throws')
      .select(['dc_method', 'ability_code', 'base_dc'])
      .where('id', '=', id)
      .executeTakeFirst(),
    hydrateSavingThrowBonusesBySavingThrowIds(db, [id])
  ])

  const savingThrow = requireLinkedRecord(row, `Saving throw "${id}" is missing.`)
  const dcMethod = requireSavingThrowDcMethod(id, savingThrow.dc_method)

  if (dcMethod === SAVING_THROW_DC_METHOD.SOURCE_SAVE_DC) {
    return {
      id,
      dcMethod,
      ability: requireAbilityCode(
        id,
        requireLinkedRecord(
          savingThrow.ability_code,
          `Saving throw "${id}" is missing ability_code.`
        )
      )
    }
  }

  const bonuses = bonusesBySavingThrowId.get(id) ?? []

  return {
    id,
    dcMethod,
    ability: requireAbilityCode(
      id,
      requireLinkedRecord(savingThrow.ability_code, `Saving throw "${id}" is missing ability_code.`)
    ),
    baseDc: requireLinkedRecord(savingThrow.base_dc, `Saving throw "${id}" is missing base_dc.`),
    bonuses:
      dcMethod === SAVING_THROW_DC_METHOD.DERIVED_DC
        ? bonuses
        : bonuses.length > 0
          ? bonuses
          : undefined
  } as SavingThrowAuthored
}

async function hydrateRangesByIds(
  db: DBLike,
  ids: readonly string[]
): Promise<Map<string, RangeAuthored>> {
  const distinctIds = uniqueIds(ids)
  const rows =
    distinctIds.length > 0
      ? await db
          .selectFrom('characteristic_ranges')
          .select(['characteristic_id', 'kind', 'min', 'unit_code', 'scaling'])
          .where('characteristic_id', 'in', distinctIds)
          .execute()
      : []
  const ranges = new Map<string, RangeAuthored>()

  for (const id of distinctIds) {
    const row = requireLinkedRecord(
      rows.find((range) => range.characteristic_id === id),
      `Range characteristic "${id}" is missing.`
    )
    const kind = requireRangeKind(id, row.kind)

    ranges.set(
      id,
      kind === RANGE_KIND.DISTANCE
        ? ({
            id,
            rangeKind: kind,
            amount: requireNumericValue(
              id,
              row.min,
              'range.min',
              `Range characteristic "${id}" is missing amount.`
            ),
            unit: requireMeasurementUnit(
              id,
              requireLinkedRecord(
                row.unit_code,
                `Range characteristic "${id}" is missing unit_code.`
              )
            ),
            scaling: readScalableValue<{
              amount: number
              unit: keyof typeof MEASUREMENT_UNIT_CODE
            }>(row.scaling)
          } as RangeAuthored)
        : {
            id,
            rangeKind: kind
          }
    )
  }

  return ranges
}

async function hydrateDurationsByIds(
  db: DBLike,
  ids: readonly string[]
): Promise<Map<string, DurationAuthored>> {
  const distinctIds = uniqueIds(ids)
  const rows =
    distinctIds.length > 0
      ? await db
          .selectFrom('characteristic_durations')
          .select(['characteristic_id', 'kind', 'amount', 'scaling'])
          .where('characteristic_id', 'in', distinctIds)
          .execute()
      : []
  const durations = new Map<string, DurationAuthored>()

  for (const id of distinctIds) {
    const row = requireLinkedRecord(
      rows.find((duration) => duration.characteristic_id === id),
      `Duration characteristic "${id}" is missing.`
    )
    const kind = requireDurationKind(id, row.kind)

    durations.set(
      id,
      isAmountlessDurationKind(kind)
        ? { id, durationKind: kind }
        : ({
            id,
            durationKind: kind,
            amount: requireNumericValue(
              id,
              row.amount,
              'duration.amount',
              `Duration characteristic "${id}" is missing amount.`
            ),
            scaling: readScalableValue<{ amount: number }>(row.scaling)
          } as DurationAuthored)
    )
  }

  return durations
}

async function hydrateShapesByIds(
  db: DBLike,
  ids: readonly string[]
): Promise<Map<string, ShapeAuthored>> {
  const distinctIds = uniqueIds(ids)
  const [shapeRows, dimensionRows] =
    distinctIds.length > 0
      ? await Promise.all([
          db
            .selectFrom('characteristic_shapes')
            .select(['characteristic_id', 'kind'])
            .where('characteristic_id', 'in', distinctIds)
            .execute(),
          db
            .selectFrom('characteristic_shape_dimensions')
            .select(['characteristic_id', 'dimension', 'amount', 'unit_code', 'scaling'])
            .where('characteristic_id', 'in', distinctIds)
            .execute()
        ])
      : [[], []]
  const shapes = new Map<string, ShapeAuthored>()
  const dimensionsByShapeId = groupRowsByKey(dimensionRows, (row) => row.characteristic_id)

  for (const id of distinctIds) {
    const shape = requireLinkedRecord(
      shapeRows.find((row) => row.characteristic_id === id),
      `Shape characteristic "${id}" is missing.`
    )
    const kind = requireShapeKind(id, shape.kind)
    const dimensions = new Map(
      (dimensionsByShapeId.get(id) ?? []).map((row) => [row.dimension, row])
    )
    const measurement = (dimension: string) => {
      const row = requireLinkedRecord(
        dimensions.get(dimension),
        `Shape characteristic "${id}" is missing dimension "${dimension}".`
      )

      return {
        amount: requireNumericValue(
          id,
          row.amount,
          `shape.${dimension}.amount`,
          `Shape characteristic "${id}" is missing ${dimension} amount.`
        ),
        unit: requireMeasurementUnit(id, row.unit_code),
        scaling: readScalableValue<{
          amount: number
          unit: keyof typeof MEASUREMENT_UNIT_CODE
        }>(row.scaling)
      } as ShapeMeasurementAuthored
    }

    switch (kind) {
      case SHAPE_KIND.LINE:
        shapes.set(id, {
          id,
          shapeKind: kind,
          length: measurement('LENGTH'),
          width: dimensions.has('WIDTH') ? measurement('WIDTH') : undefined
        })
        break

      case SHAPE_KIND.CONE:
        shapes.set(id, {
          id,
          shapeKind: kind,
          length: measurement('LENGTH')
        })
        break

      case SHAPE_KIND.CUBE:
        shapes.set(id, {
          id,
          shapeKind: kind,
          edgeLength: measurement('EDGE_LENGTH')
        })
        break

      case SHAPE_KIND.CYLINDER:
        shapes.set(id, {
          id,
          shapeKind: kind,
          radius: measurement('RADIUS'),
          height: measurement('HEIGHT')
        })
        break

      case SHAPE_KIND.SPHERE:
      case SHAPE_KIND.CIRCLE:
      case SHAPE_KIND.DOME:
        shapes.set(id, {
          id,
          shapeKind: kind,
          radius: measurement('RADIUS')
        })
        break

      case SHAPE_KIND.WALL:
        shapes.set(id, {
          id,
          shapeKind: kind,
          length: measurement('LENGTH'),
          height: measurement('HEIGHT'),
          thickness: dimensions.has('THICKNESS') ? measurement('THICKNESS') : undefined
        })
        break

      default:
        kind satisfies never
    }
  }

  return shapes
}

async function hydrateSavingThrowsByIds(
  db: DBLike,
  ids: readonly string[]
): Promise<Map<string, SavingThrowAuthored>> {
  const distinctIds = uniqueIds(ids)
  const [rows, bonusesBySavingThrowId] =
    distinctIds.length > 0
      ? await Promise.all([
          db
            .selectFrom('saving_throws')
            .select(['id', 'dc_method', 'ability_code', 'base_dc'])
            .where('id', 'in', distinctIds)
            .execute(),
          hydrateSavingThrowBonusesBySavingThrowIds(db, distinctIds)
        ])
      : ([[], new Map<string, SavingThrowDcBonusAuthored[]>()] as const)
  const savingThrows = new Map<string, SavingThrowAuthored>()

  for (const id of distinctIds) {
    const row = requireLinkedRecord(
      rows.find((savingThrow) => savingThrow.id === id),
      `Saving throw "${id}" is missing.`
    )
    const dcMethod = requireSavingThrowDcMethod(id, row.dc_method)
    const bonuses = bonusesBySavingThrowId.get(id) ?? []

    savingThrows.set(
      id,
      dcMethod === SAVING_THROW_DC_METHOD.SOURCE_SAVE_DC
        ? {
            id,
            dcMethod,
            ability: requireAbilityCode(
              id,
              requireLinkedRecord(row.ability_code, `Saving throw "${id}" is missing ability_code.`)
            )
          }
        : ({
            id,
            dcMethod,
            ability: requireAbilityCode(
              id,
              requireLinkedRecord(row.ability_code, `Saving throw "${id}" is missing ability_code.`)
            ),
            baseDc: requireLinkedRecord(row.base_dc, `Saving throw "${id}" is missing base_dc.`),
            bonuses:
              dcMethod === SAVING_THROW_DC_METHOD.DERIVED_DC
                ? bonuses
                : bonuses.length > 0
                  ? bonuses
                  : undefined
          } as SavingThrowAuthored)
    )
  }

  return savingThrows
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
  const payload = typeof json_data === 'string' ? (JSON.parse(json_data) as unknown) : json_data

  if (!payload || typeof payload !== 'object') {
    throw new Error(
      `Effect "${effectId}" entry "${entryId}" is missing valid generic outcome payload.`
    )
  }

  const outcome = payload as OutcomeAuthored

  if (outcome.id !== entryId) {
    throw new Error(
      `Effect "${effectId}" entry "${entryId}" generic payload is linked to "${outcome.id}" instead of sharing the owned id.`
    )
  }

  if (outcome.effectKind !== effectKind) {
    throw new Error(
      `Effect "${effectId}" entry "${entryId}" generic payload kind "${outcome.effectKind}" does not match "${effectKind}".`
    )
  }

  return outcome
}

async function hydrateDamageById(db: DBLike, id: string): Promise<DamageAuthored | null> {
  const row = await db
    .selectFrom('damages')
    .select([
      'id',
      'damage_type_id',
      'value_kind',
      'scaling_kind',
      'amount_kind',
      'amount_multiplier',
      'scaling_source',
      'class_id'
    ])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!row) return null

  const [valueRow, scalingRows, bonusRows] = await Promise.all([
    db
      .selectFrom('damage_values')
      .select(['amount', 'dice', 'multiplier', 'min', 'max'])
      .where('damage_id', '=', id)
      .executeTakeFirst(),
    db
      .selectFrom('damage_scaling_levels')
      .select(['id', 'level', 'sort_order', 'amount', 'dice'])
      .where('damage_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('damage_bonuses')
      .select([
        'id',
        'bonus_kind',
        'ability_code',
        'skill_id',
        'multiplier',
        'min',
        'max',
        'sort_order'
      ])
      .where('damage_id', '=', id)
      .orderBy('sort_order')
      .execute()
  ])

  const bonuses: DamageAuthored['bonuses'] =
    bonusRows.length > 0
      ? bonusRows.map((bonus) => {
          const kind = requireDamageBonusKind(id, bonus.bonus_kind)

          switch (kind) {
            case DAMAGE_BONUS_KIND.ABILITY_BONUS:
              return {
                id: bonus.id,
                bonusKind: kind,
                ability: requireAbilityCode(
                  bonus.id,
                  requireLinkedRecord(
                    bonus.ability_code,
                    `Damage bonus "${bonus.id}" is missing ability_code.`
                  )
                ),
                multiplier: readOptionalNumericValue(
                  bonus.id,
                  bonus.multiplier,
                  'damage_bonus.multiplier'
                ),
                min: readOptionalNumericValue(bonus.id, bonus.min, 'damage_bonus.min'),
                max: readOptionalNumericValue(bonus.id, bonus.max, 'damage_bonus.max'),
                order: bonus.sort_order
              } satisfies DamageBonus

            case DAMAGE_BONUS_KIND.SKILL_BONUS:
              return {
                id: bonus.id,
                bonusKind: kind,
                skillId: requireLinkedRecord(
                  bonus.skill_id,
                  `Damage bonus "${bonus.id}" is missing skill_id.`
                ),
                multiplier: readOptionalNumericValue(
                  bonus.id,
                  bonus.multiplier,
                  'damage_bonus.multiplier'
                ),
                min: readOptionalNumericValue(bonus.id, bonus.min, 'damage_bonus.min'),
                max: readOptionalNumericValue(bonus.id, bonus.max, 'damage_bonus.max'),
                order: bonus.sort_order
              } satisfies DamageBonus

            case DAMAGE_BONUS_KIND.PROFICIENCY_BONUS:
              return {
                id: bonus.id,
                bonusKind: kind,
                multiplier: readOptionalNumericValue(
                  bonus.id,
                  bonus.multiplier,
                  'damage_bonus.multiplier'
                ),
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
  const amountMetadata = hydrateDamageAmountMetadata(id, row)

  if (scalingKind === SCALING.NONE) {
    const value = requireLinkedRecord(valueRow, `Damage "${id}" is missing damage_values row.`)

    switch (valueKind) {
      case DAMAGE_VALUE_KIND.FIXED:
        return {
          id,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: row.damage_type_id,
          bonuses,
          ...amountMetadata,
          valueKind,
          scalingKind: SCALING.NONE,
          amount: requireNumericValue(
            id,
            value.amount,
            'damage_values.amount',
            `Damage "${id}" FIXED payload is missing amount.`
          )
        }

      case DAMAGE_VALUE_KIND.DICE:
        return {
          id,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: row.damage_type_id,
          bonuses,
          ...amountMetadata,
          valueKind,
          scalingKind: SCALING.NONE,
          diceConfig: requireLinkedRecord(
            value.dice,
            `Damage "${id}" DICE payload is missing dice.`
          )
        }

      case DAMAGE_VALUE_KIND.POOL:
        return {
          id,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: row.damage_type_id,
          bonuses,
          ...amountMetadata,
          valueKind,
          scalingKind: SCALING.NONE,
          amount: requireNumericValue(
            id,
            value.amount,
            'damage_values.amount',
            `Damage "${id}" POOL payload is missing amount.`
          )
        }

      default:
        return valueKind satisfies never
    }
  }

  const scalingSource = requireScalingSource(
    id,
    requireLinkedRecord(row.scaling_source, `Damage "${id}" is missing scaling_source.`)
  )

  if (valueKind === DAMAGE_VALUE_KIND.POOL) {
    const value = requireLinkedRecord(
      valueRow,
      `Damage "${id}" POOL PER_LEVEL payload is missing damage_values row.`
    )

    if (scalingKind === SCALABLE_SCALING_KIND.BREAKPOINTS) {
      throw new Error(`Damage "${id}" POOL BREAKPOINTS payload is not supported.`)
    }

    if (scalingSource === SCALING_SOURCE.CLASS_LEVEL) {
      return {
        id,
        effectKind: EFFECT_KIND.DAMAGE,
        damageTypeId: row.damage_type_id,
        bonuses,
        ...amountMetadata,
        valueKind,
        scalingKind: SCALING.PER_LEVEL,
        scalingSource,
        classId: requireLinkedRecord(
          row.class_id,
          `Damage "${id}" CLASS_LEVEL scaling is missing class_id.`
        ),
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
      ...amountMetadata,
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
          ...amountMetadata,
          valueKind,
          scalingKind: SCALABLE_SCALING_KIND.BREAKPOINTS,
          scalingSource,
          classId: requireLinkedRecord(
            row.class_id,
            `Damage "${id}" CLASS_LEVEL scaling is missing class_id.`
          ),
          breakpoints: scalingRows.map((level) => ({
            id: level.id,
            level: level.level,
            order: level.sort_order,
            value: {
              amount: requireNumericValue(
                level.id,
                level.amount,
                'damage_scaling_levels.amount',
                `Damage level "${level.id}" is missing amount.`
              )
            }
          }))
        }
      }

      return {
        id,
        effectKind: EFFECT_KIND.DAMAGE,
        damageTypeId: row.damage_type_id,
        bonuses,
        ...amountMetadata,
        valueKind,
        scalingKind: SCALABLE_SCALING_KIND.BREAKPOINTS,
        scalingSource,
        breakpoints: scalingRows.map((level) => ({
          id: level.id,
          level: level.level,
          order: level.sort_order,
          value: {
            amount: requireNumericValue(
              level.id,
              level.amount,
              'damage_scaling_levels.amount',
              `Damage level "${level.id}" is missing amount.`
            )
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
        ...amountMetadata,
        valueKind,
        scalingKind: SCALING.PER_LEVEL,
        scalingSource,
        classId: requireLinkedRecord(
          row.class_id,
          `Damage "${id}" CLASS_LEVEL scaling is missing class_id.`
        ),
        levels: scalingRows.map((level) => ({
          id: level.id,
          level: level.level,
          order: level.sort_order,
          amount: requireNumericValue(
            level.id,
            level.amount,
            'damage_scaling_levels.amount',
            `Damage level "${level.id}" is missing amount.`
          )
        }))
      }
    }

    return {
      id,
      effectKind: EFFECT_KIND.DAMAGE,
      damageTypeId: row.damage_type_id,
      bonuses,
      ...amountMetadata,
      valueKind,
      scalingKind: SCALING.PER_LEVEL,
      scalingSource,
      levels: scalingRows.map((level) => ({
        id: level.id,
        level: level.level,
        order: level.sort_order,
        amount: requireNumericValue(
          level.id,
          level.amount,
          'damage_scaling_levels.amount',
          `Damage level "${level.id}" is missing amount.`
        )
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
        ...amountMetadata,
        valueKind,
        scalingKind: SCALABLE_SCALING_KIND.BREAKPOINTS,
        scalingSource,
        classId: requireLinkedRecord(
          row.class_id,
          `Damage "${id}" CLASS_LEVEL scaling is missing class_id.`
        ),
        breakpoints: scalingRows.map((level) => ({
          id: level.id,
          level: level.level,
          order: level.sort_order,
          value: {
            diceConfig: requireLinkedRecord(
              level.dice,
              `Damage level "${level.id}" is missing dice.`
            )
          }
        }))
      }
    }

    return {
      id,
      effectKind: EFFECT_KIND.DAMAGE,
      damageTypeId: row.damage_type_id,
      bonuses,
      ...amountMetadata,
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
      ...amountMetadata,
      valueKind,
      scalingKind: SCALING.PER_LEVEL,
      scalingSource,
      classId: requireLinkedRecord(
        row.class_id,
        `Damage "${id}" CLASS_LEVEL scaling is missing class_id.`
      ),
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
    ...amountMetadata,
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

function hydrateDamageBonus(row: DamageBonusRow): DamageBonus {
  const kind = requireDamageBonusKind(row.damage_id, row.bonus_kind)

  switch (kind) {
    case DAMAGE_BONUS_KIND.ABILITY_BONUS:
      return {
        id: row.id,
        bonusKind: kind,
        ability: requireAbilityCode(
          row.id,
          requireLinkedRecord(row.ability_code, `Damage bonus "${row.id}" is missing ability_code.`)
        ),
        multiplier: readOptionalNumericValue(row.id, row.multiplier, 'damage_bonus.multiplier'),
        min: readOptionalNumericValue(row.id, row.min, 'damage_bonus.min'),
        max: readOptionalNumericValue(row.id, row.max, 'damage_bonus.max'),
        order: row.sort_order
      }

    case DAMAGE_BONUS_KIND.SKILL_BONUS:
      return {
        id: row.id,
        bonusKind: kind,
        skillId: requireLinkedRecord(row.skill_id, `Damage bonus "${row.id}" is missing skill_id.`),
        multiplier: readOptionalNumericValue(row.id, row.multiplier, 'damage_bonus.multiplier'),
        min: readOptionalNumericValue(row.id, row.min, 'damage_bonus.min'),
        max: readOptionalNumericValue(row.id, row.max, 'damage_bonus.max'),
        order: row.sort_order
      }

    case DAMAGE_BONUS_KIND.PROFICIENCY_BONUS:
      return {
        id: row.id,
        bonusKind: kind,
        multiplier: readOptionalNumericValue(row.id, row.multiplier, 'damage_bonus.multiplier'),
        min: readOptionalNumericValue(row.id, row.min, 'damage_bonus.min'),
        max: readOptionalNumericValue(row.id, row.max, 'damage_bonus.max'),
        order: row.sort_order
      }

    default:
      return kind satisfies never
  }
}

async function hydratePerLevelDiceDamagesByIds(
  db: DBLike,
  ids: readonly string[]
): Promise<Map<string, DamageAuthored> | null> {
  const distinctIds = uniqueIds(ids)

  if (distinctIds.length === 0) {
    return new Map()
  }

  const [damageRows, scalingRows, bonusRows] = await Promise.all([
    db
      .selectFrom('damages')
      .select([
        'id',
        'damage_type_id',
        'value_kind',
        'scaling_kind',
        'amount_kind',
        'amount_multiplier',
        'scaling_source',
        'class_id'
      ])
      .where('id', 'in', distinctIds)
      .execute() as Promise<DamageRow[]>,
    db
      .selectFrom('damage_scaling_levels')
      .select(['id', 'damage_id', 'level', 'sort_order', 'amount', 'dice'])
      .where('damage_id', 'in', distinctIds)
      .orderBy('sort_order')
      .execute() as Promise<DamageScalingLevelRow[]>,
    db
      .selectFrom('damage_bonuses')
      .select([
        'id',
        'damage_id',
        'bonus_kind',
        'ability_code',
        'skill_id',
        'multiplier',
        'min',
        'max',
        'sort_order'
      ])
      .where('damage_id', 'in', distinctIds)
      .orderBy('sort_order')
      .execute() as Promise<DamageBonusRow[]>
  ])
  const damageRowsById = indexRowsById(damageRows)
  const scalingRowsByDamageId = groupRowsByKey(scalingRows, (row) => row.damage_id)
  const bonusRowsByDamageId = groupRowsByKey(bonusRows, (row) => row.damage_id)
  const damages = new Map<string, DamageAuthored>()

  for (const id of distinctIds) {
    const row = damageRowsById.get(id)

    if (!row) {
      return null
    }

    if (
      requireDamageValueKind(id, row.value_kind) !== DAMAGE_VALUE_KIND.DICE ||
      requireScalingKind(id, row.scaling_kind) !== SCALING.PER_LEVEL ||
      requireScalingSource(
        id,
        requireLinkedRecord(row.scaling_source, `Damage "${id}" is missing scaling_source.`)
      ) !== SCALING_SOURCE.CHARACTER_LEVEL ||
      row.class_id !== null
    ) {
      return null
    }

    const levels = scalingRowsByDamageId.get(id) ?? []

    if (levels.length === 0) {
      return null
    }

    const bonuses = (bonusRowsByDamageId.get(id) ?? []).map(hydrateDamageBonus)
    damages.set(id, {
      id,
      effectKind: EFFECT_KIND.DAMAGE,
      damageTypeId: row.damage_type_id,
      bonuses: bonuses.length > 0 ? bonuses : undefined,
      ...hydrateDamageAmountMetadata(id, row),
      valueKind: DAMAGE_VALUE_KIND.DICE,
      scalingKind: SCALING.PER_LEVEL,
      scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
      levels: levels.map((level) => ({
        id: level.id,
        level: level.level,
        order: level.sort_order,
        diceConfig: requireLinkedRecord(level.dice, `Damage level "${level.id}" is missing dice.`)
      }))
    })
  }

  return damages
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

  const genericOutcome = requireLinkedRecord(
    row,
    `Effect "${effectId}" outcome "${outcomeId}" is missing generic payload.`
  )

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
    db
      .selectFrom('effect_result_blocks')
      .select([
        'result_kind',
        'duration_id',
        'lifecycle_recurring_kind',
        'lifecycle_consume_on_first_event',
        'lifecycle_end_on_events'
      ])
      .where('id', '=', resultBlockId)
      .executeTakeFirst(),
    db
      .selectFrom('effect_result_block_outcomes')
      .select(['outcome_id', 'effect_kind', 'sort_order'])
      .where('result_block_id', '=', resultBlockId)
      .orderBy('sort_order')
      .execute()
  ])

  const resultBlock = requireLinkedRecord(
    resultBlockRow,
    `Effect "${effectId}" is missing result block "${resultBlockId}".`
  )
  const [duration, outcomes] = await Promise.all([
    resultBlock.duration_id
      ? hydrateDurationById(db, resultBlock.duration_id)
      : Promise.resolve(undefined),
    Promise.all(
      outcomeRows.map((row) => hydrateOutcomeById(db, effectId, row.outcome_id, row.effect_kind))
    )
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
      'resolution_count',
      'resolution_count_scaling',
      'allow_repeated_targets',
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
    const targetingOverride = buildTargeting(
      pathRow.id,
      pathRow.target_selection_kind,
      pathRow.target_disposition_kind,
      pathRow.max_targets,
      pathRow.max_targets_scaling,
      pathRow.resolution_count,
      pathRow.resolution_count_scaling,
      pathRow.allow_repeated_targets,
      pathRow.excluded_creature_type_ids
    )
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
        resultBlock: await hydrateResultBlockById(
          db,
          effectId,
          requireLinkedRecord(
            pathRow.result_block_id,
            `Effect "${effectId}" fixed path "${pathRow.id}" is missing result_block_id.`
          )
        ),
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
        options: await Promise.all(
          optionRows.map(async (option) => ({
            id: option.id,
            order: option.sort_order,
            ...(option.label !== null ? { label: option.label } : {}),
            ...(option.description !== null ? { description: option.description } : {}),
            resultBlock: await hydrateResultBlockById(db, effectId, option.result_block_id)
          }))
        ),
        ...(originKind ? { originKind } : {}),
        ...(rangeOverride ? { rangeOverride } : {}),
        ...(targetingOverride ? { targetingOverride } : {})
      })
      continue
    }

    const rollTableKind = requirePathRollTableKind(
      effectId,
      requireLinkedRecord(
        pathRow.roll_table_kind,
        `Effect "${effectId}" roll-table path "${pathRow.id}" is missing roll_table_kind.`
      )
    )
    const dieConfig = requireLinkedRecord(
      pathRow.die,
      `Effect "${effectId}" roll-table path "${pathRow.id}" is missing die.`
    )
    const rowRows = await db
      .selectFrom('effect_path_roll_table_rows')
      .select([
        'id',
        'sort_order',
        'roll_value',
        'roll_min',
        'roll_max',
        'resolution_kind',
        'result_block_id',
        'repeat_config'
      ])
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
      rows: await Promise.all(
        rowRows.map(async (row) => {
          const roll =
            row.roll_value !== null
              ? { rollValue: row.roll_value }
              : {
                  rollRange: [
                    requireLinkedRecord(
                      row.roll_min,
                      `Effect "${effectId}" roll row "${row.id}" is missing roll_min.`
                    ),
                    requireLinkedRecord(
                      row.roll_max,
                      `Effect "${effectId}" roll row "${row.id}" is missing roll_max.`
                    )
                  ] as [number, number]
                }

          if (row.resolution_kind === 'REPEAT_TABLE') {
            return {
              id: row.id,
              order: row.sort_order,
              ...roll,
              resolutionKind: 'REPEAT_TABLE' as const,
              repeat: readRollTableRepeatConfig(effectId, row.id, row.repeat_config)
            }
          }
          if (row.resolution_kind !== 'RESULT') {
            throw new Error(
              `Effect "${effectId}" roll row "${row.id}" has invalid resolution_kind "${row.resolution_kind}".`
            )
          }

          return {
            id: row.id,
            order: row.sort_order,
            ...roll,
            resolutionKind: 'RESULT' as const,
            resultBlock: await hydrateResultBlockById(
              db,
              effectId,
              requireLinkedRecord(
                row.result_block_id,
                `Effect "${effectId}" roll row "${row.id}" is missing result_block_id.`
              )
            )
          }
        })
      ),
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
      'resource_charge_id',
      'resource_cost',
      'range_characteristic_id',
      'shape_characteristic_id',
      'saving_throw_id',
      'target_selection_kind',
      'target_disposition_kind',
      'max_targets',
      'max_targets_scaling',
      'resolution_count',
      'resolution_count_scaling',
      'allow_repeated_targets',
      'excluded_creature_type_ids'
    ])
    .where('effect_id', '=', id)
    .executeTakeFirst()

  const invocation = requireLinkedRecord(invocationRow, `Effect "${id}" is missing invocation row.`)
  const triggerCode = requireTriggerCode(id, invocation.trigger_code)
  const [range, shape, hydratedSavingThrow, nativePaths] = await Promise.all([
    hydrateRangeById(db, invocation.range_characteristic_id),
    invocation.shape_characteristic_id
      ? hydrateShapeById(db, invocation.shape_characteristic_id)
      : Promise.resolve(undefined),
    invocation.saving_throw_id
      ? hydrateSavingThrowById(db, invocation.saving_throw_id)
      : Promise.resolve(undefined),
    hydrateNativePaths(db, id, triggerCode)
  ])

  const targeting = buildTargeting(
    id,
    invocation.target_selection_kind,
    invocation.target_disposition_kind,
    invocation.max_targets,
    invocation.max_targets_scaling,
    invocation.resolution_count,
    invocation.resolution_count_scaling,
    invocation.allow_repeated_targets,
    invocation.excluded_creature_type_ids
  )
  const passive = isPassiveInvocation(invocation.activation_type, invocation.activation_value)
  const activation = passive
    ? undefined
    : buildActivation(id, invocation.activation_type, invocation.activation_value)

  const authoredInvocation: EffectAuthored['invocation'] = passive
    ? triggerCode === TRIGGER.SAVING_THROW
      ? {
          kind: EFFECT_INVOCATION_KIND.PASSIVE,
          triggerCode,
          savingThrow: requireLinkedRecord(
            hydratedSavingThrow,
            `Effect "${id}" passive SAVING_THROW invocation is missing saving throw "${invocation.saving_throw_id}".`
          ) as SavingThrowAuthored,
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
          savingThrow: requireLinkedRecord(
            hydratedSavingThrow,
            `Effect "${id}" SAVING_THROW invocation is missing saving throw "${invocation.saving_throw_id}".`
          ) as SavingThrowAuthored,
          activation: requireLinkedRecord(
            activation,
            `Effect "${id}" is missing activation payload.`
          ),
          ...(invocation.resource_charge_id && invocation.resource_cost
            ? {
                resourceUse: {
                  chargeId: invocation.resource_charge_id,
                  cost: invocation.resource_cost
                }
              }
            : {}),
          range,
          ...(shape ? { shape } : {}),
          ...(targeting ? { targeting } : {})
        }
      : {
          kind: EFFECT_INVOCATION_KIND.ACTION,
          triggerCode,
          activation: requireLinkedRecord(
            activation,
            `Effect "${id}" is missing activation payload.`
          ),
          ...(invocation.resource_charge_id && invocation.resource_cost
            ? {
                resourceUse: {
                  chargeId: invocation.resource_charge_id,
                  cost: invocation.resource_cost
                }
              }
            : {}),
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

async function hydrateSimpleFixedEffectsByIds(
  db: DBLike,
  ids: readonly string[]
): Promise<Map<string, EffectAuthored> | null> {
  const distinctIds = uniqueIds(ids)

  if (distinctIds.length === 0) {
    return new Map()
  }

  const [effectRows, invocationRows, pathRows] = await Promise.all([
    db.selectFrom('effects').select(['id', 'sort_order']).where('id', 'in', distinctIds).execute(),
    db
      .selectFrom('effect_invocations')
      .select([
        'effect_id',
        'trigger_code',
        'activation_type',
        'activation_value',
        'resource_charge_id',
        'resource_cost',
        'range_characteristic_id',
        'shape_characteristic_id',
        'saving_throw_id',
        'target_selection_kind',
        'target_disposition_kind',
        'max_targets',
        'max_targets_scaling',
        'resolution_count',
        'resolution_count_scaling',
        'allow_repeated_targets',
        'excluded_creature_type_ids'
      ])
      .where('effect_id', 'in', distinctIds)
      .execute(),
    db
      .selectFrom('effect_paths')
      .select([
        'effect_id',
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
        'resolution_count',
        'resolution_count_scaling',
        'allow_repeated_targets',
        'excluded_creature_type_ids',
        'result_block_id',
        'roll_table_kind',
        'die'
      ])
      .where('effect_id', 'in', distinctIds)
      .orderBy('sort_order')
      .execute()
  ])
  const effectRowsById = indexRowsById(effectRows)
  const invocationRowsByEffectId = new Map(invocationRows.map((row) => [row.effect_id, row]))
  const pathRowsByEffectId = groupRowsByKey(pathRows, (row) => row.effect_id)

  if (
    effectRows.length !== distinctIds.length ||
    invocationRows.length !== distinctIds.length ||
    pathRows.some((row) => row.selection_kind !== 'FIXED')
  ) {
    return null
  }

  const resultBlockIds = uniqueIds(
    pathRows.flatMap((row) => (row.result_block_id ? [row.result_block_id] : []))
  )
  const [resultBlockRows, outcomeRows] =
    resultBlockIds.length > 0
      ? await Promise.all([
          db
            .selectFrom('effect_result_blocks')
            .select([
              'id',
              'result_kind',
              'duration_id',
              'lifecycle_recurring_kind',
              'lifecycle_consume_on_first_event',
              'lifecycle_end_on_events'
            ])
            .where('id', 'in', resultBlockIds)
            .execute(),
          db
            .selectFrom('effect_result_block_outcomes')
            .select(['result_block_id', 'outcome_id', 'effect_kind', 'sort_order'])
            .where('result_block_id', 'in', resultBlockIds)
            .orderBy('sort_order')
            .execute()
        ])
      : [[], []]

  if (
    resultBlockRows.length !== resultBlockIds.length ||
    outcomeRows.some((row) => row.effect_kind !== EFFECT_KIND.DAMAGE)
  ) {
    return null
  }

  const damageIds = outcomeRows.map((row) => row.outcome_id)
  const damagesById = await hydratePerLevelDiceDamagesByIds(db, damageIds)

  if (!damagesById) {
    return null
  }

  const durationIds = resultBlockRows.flatMap((row) => (row.duration_id ? [row.duration_id] : []))
  const rangeIds = [
    ...invocationRows.map((row) => row.range_characteristic_id),
    ...pathRows.flatMap((row) =>
      row.range_override_characteristic_id ? [row.range_override_characteristic_id] : []
    )
  ]
  const [durationsById, rangesById, shapesById, savingThrowsById] = await Promise.all([
    hydrateDurationsByIds(db, durationIds),
    hydrateRangesByIds(db, rangeIds),
    hydrateShapesByIds(
      db,
      invocationRows.flatMap((row) =>
        row.shape_characteristic_id ? [row.shape_characteristic_id] : []
      )
    ),
    hydrateSavingThrowsByIds(
      db,
      invocationRows.flatMap((row) => (row.saving_throw_id ? [row.saving_throw_id] : []))
    )
  ])
  const outcomeRowsByResultBlockId = groupRowsByKey(outcomeRows, (row) => row.result_block_id)
  const resultBlocksById = new Map<string, ResultBlock>()

  for (const row of resultBlockRows) {
    const outcomes = (outcomeRowsByResultBlockId.get(row.id) ?? []).map((outcomeRow) =>
      requireLinkedRecord(
        damagesById.get(outcomeRow.outcome_id),
        `Effect result block "${row.id}" is linked to missing damage "${outcomeRow.outcome_id}".`
      )
    )
    const lifecycle = buildLifecycle(
      row.id,
      row.lifecycle_recurring_kind,
      row.lifecycle_consume_on_first_event,
      row.lifecycle_end_on_events
    )

    resultBlocksById.set(row.id, {
      id: row.id,
      resultKind: requireResultKind(row.id, row.result_kind),
      ...(row.duration_id
        ? {
            duration: requireLinkedRecord(
              durationsById.get(row.duration_id),
              `Effect result block "${row.id}" is missing duration "${row.duration_id}".`
            )
          }
        : {}),
      ...(lifecycle ? { lifecycle } : {}),
      outcomes
    })
  }

  const effects = new Map<string, EffectAuthored>()

  for (const id of distinctIds) {
    const row = requireLinkedRecord(effectRowsById.get(id), `Effect "${id}" is missing.`)
    const invocation = requireLinkedRecord(
      invocationRowsByEffectId.get(id),
      `Effect "${id}" is missing invocation row.`
    )
    const triggerCode = requireTriggerCode(id, invocation.trigger_code)
    const range = requireLinkedRecord(
      rangesById.get(invocation.range_characteristic_id),
      `Effect "${id}" is missing range "${invocation.range_characteristic_id}".`
    )
    const shape = invocation.shape_characteristic_id
      ? requireLinkedRecord(
          shapesById.get(invocation.shape_characteristic_id),
          `Effect "${id}" is missing shape "${invocation.shape_characteristic_id}".`
        )
      : undefined
    const hydratedSavingThrow = invocation.saving_throw_id
      ? requireLinkedRecord(
          savingThrowsById.get(invocation.saving_throw_id),
          `Effect "${id}" is missing saving throw "${invocation.saving_throw_id}".`
        )
      : undefined
    const targeting = buildTargeting(
      id,
      invocation.target_selection_kind,
      invocation.target_disposition_kind,
      invocation.max_targets,
      invocation.max_targets_scaling,
      invocation.resolution_count,
      invocation.resolution_count_scaling,
      invocation.allow_repeated_targets,
      invocation.excluded_creature_type_ids
    )
    const passive = isPassiveInvocation(invocation.activation_type, invocation.activation_value)
    const activation = passive
      ? undefined
      : buildActivation(id, invocation.activation_type, invocation.activation_value)
    const authoredInvocation: EffectAuthored['invocation'] = passive
      ? triggerCode === TRIGGER.SAVING_THROW
        ? {
            kind: EFFECT_INVOCATION_KIND.PASSIVE,
            triggerCode,
            savingThrow: requireLinkedRecord(
              hydratedSavingThrow,
              `Effect "${id}" passive SAVING_THROW invocation is missing saving throw "${invocation.saving_throw_id}".`
            ),
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
            savingThrow: requireLinkedRecord(
              hydratedSavingThrow,
              `Effect "${id}" SAVING_THROW invocation is missing saving throw "${invocation.saving_throw_id}".`
            ),
            activation: requireLinkedRecord(
              activation,
              `Effect "${id}" is missing activation payload.`
            ),
            ...(invocation.resource_charge_id && invocation.resource_cost
              ? {
                  resourceUse: {
                    chargeId: invocation.resource_charge_id,
                    cost: invocation.resource_cost
                  }
                }
              : {}),
            range,
            ...(shape ? { shape } : {}),
            ...(targeting ? { targeting } : {})
          }
        : {
            kind: EFFECT_INVOCATION_KIND.ACTION,
            triggerCode,
            activation: requireLinkedRecord(
              activation,
              `Effect "${id}" is missing activation payload.`
            ),
            ...(invocation.resource_charge_id && invocation.resource_cost
              ? {
                  resourceUse: {
                    chargeId: invocation.resource_charge_id,
                    cost: invocation.resource_cost
                  }
                }
              : {}),
            range,
            ...(shape ? { shape } : {}),
            ...(targeting ? { targeting } : {})
          }
    const paths = (pathRowsByEffectId.get(id) ?? []).map((pathRow) => {
      const pathCode = requirePathCode(id, triggerCode, pathRow.path_code)
      const groupType = requirePathGroupType(id, pathRow.group_type)
      const selectionKind = requireSelectionKind(id, pathRow.selection_kind)
      const targetingOverride = buildTargeting(
        pathRow.id,
        pathRow.target_selection_kind,
        pathRow.target_disposition_kind,
        pathRow.max_targets,
        pathRow.max_targets_scaling,
        pathRow.resolution_count,
        pathRow.resolution_count_scaling,
        pathRow.allow_repeated_targets,
        pathRow.excluded_creature_type_ids
      )
      const originKind = pathRow.origin_kind
        ? requirePathOriginKind(id, pathRow.origin_kind)
        : undefined
      const rangeOverride = pathRow.range_override_characteristic_id
        ? requireLinkedRecord(
            rangesById.get(pathRow.range_override_characteristic_id),
            `Effect "${id}" path "${pathRow.id}" is missing range override "${pathRow.range_override_characteristic_id}".`
          )
        : undefined

      if (selectionKind !== 'FIXED') {
        throw new Error(`Effect "${id}" batch hydration only supports fixed paths.`)
      }

      return {
        id: pathRow.id,
        order: pathRow.sort_order,
        pathCode,
        groupType,
        selectionKind,
        resultBlock: requireLinkedRecord(
          resultBlocksById.get(
            requireLinkedRecord(
              pathRow.result_block_id,
              `Effect "${id}" fixed path "${pathRow.id}" is missing result_block_id.`
            )
          ),
          `Effect "${id}" fixed path "${pathRow.id}" is linked to missing result block "${pathRow.result_block_id}".`
        ),
        ...(originKind ? { originKind } : {}),
        ...(rangeOverride ? { rangeOverride } : {}),
        ...(targetingOverride ? { targetingOverride } : {})
      } satisfies EffectPath
    })

    if (paths.length === 0) {
      throw new Error(`Effect "${id}" is missing native paths.`)
    }

    effects.set(id, {
      id: row.id,
      order: row.sort_order,
      invocation: authoredInvocation,
      paths
    })
  }

  return effects
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
      return (
        (await hydrateSimpleFixedEffectsByIds(db, ids)) ??
        hydrateByIds(ids, (id) => hydrateEffectById(db, id))
      )
    },

    async findAll() {
      const rows = await db.selectFrom('effects').select('id').orderBy('sort_order').execute()

      return orderedHydratedRecords(
        rows.map((row) => row.id),
        await hydrateByIds(
          rows.map((row) => row.id),
          (id) => hydrateEffectById(db, id)
        )
      )
    }
  }
}
