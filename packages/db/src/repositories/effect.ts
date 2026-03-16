import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  DAMAGE_BONUS_KIND,
  DAMAGE_VALUE_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  MOMENT,
  MOMENT_GROUP_TYPE,
  MOMENT_RESOLUTION_KIND,
  MOMENT_ROLL_TABLE_KIND,
  MOMENTS_BY_TRIGGER,
  RANGE_KIND,
  SAVING_THROW_KIND,
  SCALING,
  SCALING_SOURCE,
  SHAPE_KIND,
  TRIGGER,
  type ConditionAuthored,
  type DamageAuthored,
  type DurationAuthored,
  type EffectAuthored,
  type MomentAuthored,
  type SavingThrowAuthored,
  type Trigger,
  type ShapeAuthored
} from '@artificer-toolkit/shared'
import type { DBLike } from '../types/index.js'
import { upsertEffect } from '../domains/effects/upserts/effect.js'
import type { EffectRepository } from './contracts.js'

type EffectMoment = EffectAuthored['moments'][number]
type DirectMoment = Extract<EffectMoment, { resolutionKind: typeof MOMENT_RESOLUTION_KIND.DIRECT }>
type ExactRollTableMoment = Extract<
  EffectMoment,
  { resolutionKind: typeof MOMENT_RESOLUTION_KIND.ROLL_TABLE, rollTableKind: typeof MOMENT_ROLL_TABLE_KIND.EXACT }
>
type RangeRollTableMoment = Extract<
  EffectMoment,
  { resolutionKind: typeof MOMENT_RESOLUTION_KIND.ROLL_TABLE, rollTableKind: typeof MOMENT_ROLL_TABLE_KIND.RANGE }
>
type DamageBonus = NonNullable<DamageAuthored['bonuses']>[number]

function requireLinkedRecord<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message)
  }

  return value
}

function requireActivationCode(effectId: string, value: string): EffectAuthored['invocation']['activation']['code'] {
  if (!(value in ACTIVATION_CODE)) {
    throw new Error(`Effect "${effectId}" has invalid activation_type "${value}".`)
  }

  return value as EffectAuthored['invocation']['activation']['code']
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

function requireMomentCode(effectId: string, triggerCode: Trigger, value: string) {
  if (!(value in MOMENT)) {
    throw new Error(`Effect "${effectId}" has invalid moment_code "${value}".`)
  }

  if (!MOMENTS_BY_TRIGGER[triggerCode].includes(value as (typeof MOMENTS_BY_TRIGGER)[Trigger][number])) {
    throw new Error(`Effect "${effectId}" has invalid moment_code "${value}" for trigger "${triggerCode}".`)
  }

  return value as MomentAuthored<typeof triggerCode>['moment']
}

function requireMomentGroupType(effectId: string, value: string) {
  if (!(value in MOMENT_GROUP_TYPE)) {
    throw new Error(`Effect "${effectId}" has invalid group_type "${value}".`)
  }

  return value as keyof typeof MOMENT_GROUP_TYPE
}

function requireMomentResolutionKind(effectId: string, value: string) {
  if (!(value in MOMENT_RESOLUTION_KIND)) {
    throw new Error(`Effect "${effectId}" has invalid resolution_kind "${value}".`)
  }

  return value as keyof typeof MOMENT_RESOLUTION_KIND
}

function requireMomentRollTableKind(effectId: string, value: string) {
  if (!(value in MOMENT_ROLL_TABLE_KIND)) {
    throw new Error(`Effect "${effectId}" has invalid roll_table_kind "${value}".`)
  }

  return value as keyof typeof MOMENT_ROLL_TABLE_KIND
}

function requireDamageValueKind(damageId: string, value: string) {
  if (!(value in DAMAGE_VALUE_KIND)) {
    throw new Error(`Damage "${damageId}" has invalid value_kind "${value}".`)
  }

  return value as keyof typeof DAMAGE_VALUE_KIND
}

function requireScalingKind(damageId: string, value: string) {
  if (!(value in SCALING)) {
    throw new Error(`Damage "${damageId}" has invalid scaling_kind "${value}".`)
  }

  return value as keyof typeof SCALING
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

async function hydrateRangeById(db: DBLike, id: string) {
  const row = await db
    .selectFrom('characteristic_ranges')
    .select(['kind', 'min', 'unit_code'])
    .where('characteristic_id', '=', id)
    .executeTakeFirst()

  const range = requireLinkedRecord(row, `Range characteristic "${id}" is missing.`)
  const kind = requireRangeKind(id, range.kind)

  if (kind === RANGE_KIND.DISTANCE) {
    return {
      id,
      rangeKind: kind,
      amount: requireLinkedRecord(range.min, `Range characteristic "${id}" is missing amount.`),
      unit: requireMeasurementUnit(id, requireLinkedRecord(range.unit_code, `Range characteristic "${id}" is missing unit_code.`))
    }
  }

  return {
    id,
    rangeKind: kind
  }
}

async function hydrateDurationById(db: DBLike, id: string): Promise<DurationAuthored> {
  const row = await db
    .selectFrom('characteristic_durations')
    .select(['kind', 'amount'])
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
    amount: requireLinkedRecord(duration.amount, `Duration characteristic "${id}" is missing amount.`)
  }
}

async function hydrateShapeById(db: DBLike, id: string): Promise<ShapeAuthored> {
  const [shapeRow, dimensionRows] = await Promise.all([
    db.selectFrom('characteristic_shapes')
      .select(['kind'])
      .where('characteristic_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('characteristic_shape_dimensions')
      .select(['dimension', 'amount', 'unit_code'])
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
      amount: row.amount,
      unit: requireMeasurementUnit(id, row.unit_code)
    }
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
      savingThrowKind: kind
    }
  }

  return {
    id,
    savingThrowKind: kind,
    ability: requireAbilityCode(id, requireLinkedRecord(savingThrow.ability_code, `Saving throw "${id}" is missing ability_code.`)),
    dc: requireLinkedRecord(savingThrow.dc, `Saving throw "${id}" is missing dc.`)
  }
}

function requireAbilityCode(ownerId: string, value: string) {
  if (!(value in ABILITY_CODE)) {
    throw new Error(`Owned row "${ownerId}" has invalid ability_code "${value}".`)
  }

  return value as keyof typeof ABILITY_CODE
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
      .select(['amount', 'dice', 'multiplier', 'min', 'max'])
      .where('damage_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('damage_scaling_levels')
      .select(['id', 'level', 'sort_order', 'amount', 'dice'])
      .where('damage_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('damage_bonuses')
      .select(['id', 'bonus_kind', 'ability_code', 'skill_id', 'multiplier', 'min', 'max', 'sort_order'])
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
              multiplier: bonus.multiplier ?? undefined,
              min: bonus.min ?? undefined,
              max: bonus.max ?? undefined,
              order: bonus.sort_order
            } satisfies DamageBonus

          case DAMAGE_BONUS_KIND.SKILL_BONUS:
            return {
              id: bonus.id,
              bonusKind: kind,
              skillId: requireLinkedRecord(bonus.skill_id, `Damage bonus "${bonus.id}" is missing skill_id.`),
              multiplier: bonus.multiplier ?? undefined,
              min: bonus.min ?? undefined,
              max: bonus.max ?? undefined,
              order: bonus.sort_order
            } satisfies DamageBonus

          case DAMAGE_BONUS_KIND.PROFICIENCY_BONUS:
            return {
              id: bonus.id,
              bonusKind: kind,
              multiplier: bonus.multiplier ?? undefined,
              min: bonus.min ?? undefined,
              max: bonus.max ?? undefined,
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
          scalingKind,
          amount: requireLinkedRecord(value.amount, `Damage "${id}" FIXED payload is missing amount.`)
        }

      case DAMAGE_VALUE_KIND.DICE:
        return {
          id,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: row.damage_type_id,
          bonuses,
          valueKind,
          scalingKind,
          diceConfig: requireLinkedRecord(value.dice, `Damage "${id}" DICE payload is missing dice.`)
        }

      case DAMAGE_VALUE_KIND.POOL:
        return {
          id,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: row.damage_type_id,
          bonuses,
          valueKind,
          scalingKind,
          amount: requireLinkedRecord(value.amount, `Damage "${id}" POOL payload is missing amount.`)
        }

      default:
        return valueKind satisfies never
    }
  }

  const scalingSource = requireScalingSource(id, requireLinkedRecord(row.scaling_source, `Damage "${id}" is missing scaling_source.`))

  if (valueKind === DAMAGE_VALUE_KIND.POOL) {
    const value = requireLinkedRecord(valueRow, `Damage "${id}" POOL PER_LEVEL payload is missing damage_values row.`)

    if (scalingSource === SCALING_SOURCE.CLASS_LEVEL) {
      return {
        id,
        effectKind: EFFECT_KIND.DAMAGE,
        damageTypeId: row.damage_type_id,
        bonuses,
        valueKind,
        scalingKind,
        scalingSource,
        classId: requireLinkedRecord(row.class_id, `Damage "${id}" CLASS_LEVEL scaling is missing class_id.`),
        amount: value.amount ?? undefined,
        multiplier: value.multiplier ?? undefined,
        min: value.min ?? undefined,
        max: value.max ?? undefined
      }
    }

    return {
      id,
      effectKind: EFFECT_KIND.DAMAGE,
      damageTypeId: row.damage_type_id,
      bonuses,
      valueKind,
      scalingKind,
      scalingSource,
      amount: value.amount ?? undefined,
      multiplier: value.multiplier ?? undefined,
      min: value.min ?? undefined,
      max: value.max ?? undefined
    }
  }

  if (scalingRows.length === 0) {
    throw new Error(`Damage "${id}" ${valueKind} PER_LEVEL payload is missing scaling levels.`)
  }

  if (valueKind === DAMAGE_VALUE_KIND.FIXED) {
    if (scalingSource === SCALING_SOURCE.CLASS_LEVEL) {
      return {
        id,
        effectKind: EFFECT_KIND.DAMAGE,
        damageTypeId: row.damage_type_id,
        bonuses,
        valueKind,
        scalingKind,
        scalingSource,
        classId: requireLinkedRecord(row.class_id, `Damage "${id}" CLASS_LEVEL scaling is missing class_id.`),
        levels: scalingRows.map((level) => ({
          id: level.id,
          level: level.level,
          order: level.sort_order,
          amount: requireLinkedRecord(level.amount, `Damage level "${level.id}" is missing amount.`)
        }))
      }
    }

    return {
      id,
      effectKind: EFFECT_KIND.DAMAGE,
      damageTypeId: row.damage_type_id,
      bonuses,
      valueKind,
      scalingKind,
      scalingSource,
      levels: scalingRows.map((level) => ({
        id: level.id,
        level: level.level,
        order: level.sort_order,
        amount: requireLinkedRecord(level.amount, `Damage level "${level.id}" is missing amount.`)
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
      scalingKind,
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
    scalingKind,
    scalingSource,
    levels: scalingRows.map((level) => ({
      id: level.id,
      level: level.level,
      order: level.sort_order,
      diceConfig: requireLinkedRecord(level.dice, `Damage level "${level.id}" is missing dice.`)
    }))
  }
}

async function hydrateEffectPayloadForMoment(
  db: DBLike,
  effectId: string,
  triggerCode: string,
  momentCode: string
): Promise<ConditionAuthored | DamageAuthored> {
  const [directDamageRow, directConditionRow] = await Promise.all([
    db.selectFrom('moment_direct_damages')
      .select(['damage_id'])
      .where('effect_id', '=', effectId)
      .where('trigger_code', '=', triggerCode)
      .where('moment_code', '=', momentCode)
      .executeTakeFirst(),
    db.selectFrom('moment_direct_conditions')
      .select(['condition_id'])
      .where('effect_id', '=', effectId)
      .where('trigger_code', '=', triggerCode)
      .where('moment_code', '=', momentCode)
      .executeTakeFirst()
  ])

  if (directDamageRow && directConditionRow) {
    throw new Error(`Effect "${effectId}" direct moment "${momentCode}" has both damage and condition payloads.`)
  }

  if (directDamageRow) {
    return requireLinkedRecord(
      await hydrateDamageById(db, directDamageRow.damage_id),
      `Effect "${effectId}" direct moment "${momentCode}" is linked to missing damage "${directDamageRow.damage_id}".`
    )
  }

  if (directConditionRow) {
    return requireLinkedRecord(
      await hydrateConditionById(db, directConditionRow.condition_id),
      `Effect "${effectId}" direct moment "${momentCode}" is linked to missing condition "${directConditionRow.condition_id}".`
    )
  }

  throw new Error(`Effect "${effectId}" direct moment "${momentCode}" is missing payload.`)
}

async function hydrateRollTablePayload(
  db: DBLike,
  effectId: string,
  entryId: string
): Promise<ConditionAuthored | DamageAuthored> {
  const [damageRow, conditionRow] = await Promise.all([
    db.selectFrom('moment_roll_table_damages')
      .select(['damage_id'])
      .where('entry_id', '=', entryId)
      .executeTakeFirst(),
    db.selectFrom('moment_roll_table_conditions')
      .select(['condition_id'])
      .where('entry_id', '=', entryId)
      .executeTakeFirst()
  ])

  if (damageRow && conditionRow) {
    throw new Error(`Effect "${effectId}" roll-table entry "${entryId}" has both damage and condition payloads.`)
  }

  if (damageRow) {
    return requireLinkedRecord(
      await hydrateDamageById(db, damageRow.damage_id),
      `Effect "${effectId}" roll-table entry "${entryId}" is linked to missing damage "${damageRow.damage_id}".`
    )
  }

  if (conditionRow) {
    return requireLinkedRecord(
      await hydrateConditionById(db, conditionRow.condition_id),
      `Effect "${effectId}" roll-table entry "${entryId}" is linked to missing condition "${conditionRow.condition_id}".`
    )
  }

  throw new Error(`Effect "${effectId}" roll-table entry "${entryId}" is missing payload.`)
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
      'saving_throw_id'
    ])
    .where('effect_id', '=', id)
    .executeTakeFirst()

  const invocation = requireLinkedRecord(invocationRow, `Effect "${id}" is missing invocation row.`)
  const triggerCode = requireTriggerCode(id, invocation.trigger_code)
  const activationCode = requireActivationCode(id, invocation.activation_type)
  const [range, shape, hydratedSavingThrow, momentRows] = await Promise.all([
    hydrateRangeById(db, invocation.range_characteristic_id),
    invocation.shape_characteristic_id ? hydrateShapeById(db, invocation.shape_characteristic_id) : Promise.resolve(undefined),
    invocation.saving_throw_id ? hydrateSavingThrowById(db, invocation.saving_throw_id) : Promise.resolve(undefined),
    db.selectFrom('effect_moments')
      .select(['id', 'trigger_code', 'moment_code', 'group_type', 'resolution_kind', 'duration_id', 'roll_table_kind', 'die'])
      .where('effect_id', '=', id)
      .orderBy('moment_code')
      .execute()
  ])

  const moments: EffectAuthored['moments'] = []

  for (const momentRow of momentRows) {
    const momentTriggerCode = requireTriggerCode(id, momentRow.trigger_code)
    if (momentTriggerCode !== triggerCode) {
      throw new Error(`Effect "${id}" has moment "${momentRow.id}" stored under mismatched trigger "${momentTriggerCode}".`)
    }

    const momentCode = requireMomentCode(id, triggerCode, momentRow.moment_code)
    const groupType = requireMomentGroupType(id, momentRow.group_type)
    const resolutionKind = requireMomentResolutionKind(id, momentRow.resolution_kind)

    if (resolutionKind === MOMENT_RESOLUTION_KIND.DIRECT) {
      const [payload, duration] = await Promise.all([
        hydrateEffectPayloadForMoment(db, id, momentRow.trigger_code, momentRow.moment_code),
        momentRow.duration_id ? hydrateDurationById(db, momentRow.duration_id) : Promise.resolve(undefined)
      ])

      if (payload.id !== momentRow.id) {
        throw new Error(`Effect "${id}" direct moment "${momentRow.id}" is linked to payload "${payload.id}" instead of sharing the owned id.`)
      }

      const directMoment: DirectMoment = {
        ...payload,
        moment: momentCode,
        groupType,
        resolutionKind,
        duration,
      }

      moments.push(directMoment)
      continue
    }

    const rollTableKind = requireMomentRollTableKind(id, requireLinkedRecord(momentRow.roll_table_kind, `Effect "${id}" roll-table moment "${momentCode}" is missing roll_table_kind.`))
    const dieConfig = requireLinkedRecord(momentRow.die, `Effect "${id}" roll-table moment "${momentCode}" is missing die.`)
    const entries = await db
      .selectFrom('moment_roll_table_entries')
      .select(['id', 'description', 'duration_id', 'roll_value', 'roll_min', 'roll_max', 'sort_order'])
      .where('effect_id', '=', id)
      .where('trigger_code', '=', momentRow.trigger_code)
      .where('moment_code', '=', momentRow.moment_code)
      .orderBy('sort_order')
      .execute()

    if (rollTableKind === MOMENT_ROLL_TABLE_KIND.EXACT) {
      const table: ExactRollTableMoment['table'] = []

      for (const entry of entries) {
        const [payload, duration] = await Promise.all([
          hydrateRollTablePayload(db, id, entry.id),
          entry.duration_id ? hydrateDurationById(db, entry.duration_id) : Promise.resolve(undefined)
        ])

        if (payload.id !== entry.id) {
          throw new Error(`Effect "${id}" roll-table entry "${entry.id}" is linked to payload "${payload.id}" instead of sharing the owned id.`)
        }

        table.push({
          ...payload,
          description: entry.description ?? undefined,
          duration,
          rollValue: requireLinkedRecord(entry.roll_value, `Effect "${id}" roll-table entry "${entry.id}" is missing roll_value.`)
        })
      }

      const exactMoment: ExactRollTableMoment = {
        id: momentRow.id,
        moment: momentCode,
        groupType,
        resolutionKind,
        rollTableKind,
        dieConfig,
        table
      }

      moments.push(exactMoment)
      continue
    }

    const table: RangeRollTableMoment['table'] = []

    for (const entry of entries) {
      const [payload, duration] = await Promise.all([
        hydrateRollTablePayload(db, id, entry.id),
        entry.duration_id ? hydrateDurationById(db, entry.duration_id) : Promise.resolve(undefined)
      ])

      if (payload.id !== entry.id) {
        throw new Error(`Effect "${id}" roll-table entry "${entry.id}" is linked to payload "${payload.id}" instead of sharing the owned id.`)
      }

      table.push({
        ...payload,
        description: entry.description ?? undefined,
        duration,
        rollRange: [
          requireLinkedRecord(entry.roll_min, `Effect "${id}" roll-table entry "${entry.id}" is missing roll_min.`),
          requireLinkedRecord(entry.roll_max, `Effect "${id}" roll-table entry "${entry.id}" is missing roll_max.`)
        ] as [number, number]
      })
    }

    const rangeMoment: RangeRollTableMoment = {
      id: momentRow.id,
      moment: momentCode,
      groupType,
      resolutionKind,
      rollTableKind,
      dieConfig,
      table
    }

    moments.push(rangeMoment)
  }

  const activation: EffectAuthored['invocation']['activation'] = activationCode === ACTIVATION_CODE.FREE
    ? { code: activationCode }
    : {
        code: activationCode,
        amount: requireLinkedRecord(invocation.activation_value, `Effect "${id}" activation "${activationCode}" is missing amount.`)
      }

  const authoredInvocation: EffectAuthored['invocation'] = triggerCode === TRIGGER.SAVING_THROW
    ? {
        triggerCode,
        savingThrow: requireLinkedRecord(
          hydratedSavingThrow,
          `Effect "${id}" SAVING_THROW invocation is missing saving throw "${invocation.saving_throw_id}".`
        ) as SavingThrowAuthored,
        activation,
        range,
        shape
      }
    : {
        triggerCode,
        activation,
        range,
        shape
      }

  return {
    id: row.id,
    order: row.sort_order,
    invocation: authoredInvocation,
    moments
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

    async findAll() {
      const rows = await db
        .selectFrom('effects')
        .select('id')
        .orderBy('sort_order')
        .execute()

      const records = await Promise.all(rows.map((row) => hydrateEffectById(db, row.id)))
      return records.filter((record): record is EffectAuthored => record !== null)
    }
  }
}
