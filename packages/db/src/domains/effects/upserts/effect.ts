import type { DBLike } from '@db-types'
import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  DAMAGE_BONUS_KIND,
  DAMAGE_VALUE_KIND,
  DURATION_KIND,
  EFFECT_KIND,
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
  type EffectAuthored,
  type MomentAuthored,
  type Trigger
} from '@artificer-toolkit/shared'
import {
  upsertDuration,
  upsertRange,
  upsertSavingThrow,
  upsertShape
} from '../../shared/upserts/index.js'

type EffectRow = {
  id: string
  sort_order: number
}

type EffectInvocationRow = {
  effect_id: string
  trigger_code: string
  activation_type: string
  activation_value: number | null
  range_characteristic_id: string
  shape_characteristic_id: string | null
  saving_throw_id: string | null
}

type EffectMomentRow = {
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

type MomentRollTableEntryRow = {
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

type DamageRow = {
  id: string
  damage_type_id: string
  value_kind: string
  scaling_kind: string
  scaling_source: string | null
  class_id: string | null
  sort_order: number
}

type DamageValueRow = {
  id: string
  damage_id: string
  amount: number | null
  dice: string | null
  multiplier: number | null
  min: number | null
  max: number | null
}

type DamageScalingLevelRow = {
  id: string
  damage_id: string
  level: number
  sort_order: number
  amount: number | null
  dice: string | null
}

type DamageBonusKindRow = {
  damage_id: string
  bonus_kind: string
  sort_order: number
}

type DamageBonusRow = {
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

type ConditionRow = {
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

function mapEffectRow(json_data: EffectAuthored): EffectRow {
  return {
    id: json_data.id,
    sort_order: json_data.order
  }
}

function mapInvocationRow(json_data: EffectAuthored): EffectInvocationRow {
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

function mapMomentRow(
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

function mapRollTableEntryRow(
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

function mapDamageRow(json_data: DamageAuthored): DamageRow {
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

function mapDamageValueRow(json_data: DamageAuthored): DamageValueRow | null {
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

function mapDamageScalingRows(json_data: DamageAuthored): DamageScalingLevelRow[] {
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

function mapDamageBonusRows(json_data: DamageAuthored): DamageBonusRow[] {
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

function mapDamageBonusKindRows(json_data: DamageAuthored): DamageBonusKindRow[] {
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

function mapConditionRow(json_data: ConditionAuthored): ConditionRow {
  return {
    id: json_data.id,
    condition_type_id: json_data.conditionId
  }
}

async function deleteCharacteristicById(db: DBLike, id: string): Promise<void> {
  await db.deleteFrom('characteristic_shape_dimensions').where('characteristic_id', '=', id).execute()
  await db.deleteFrom('characteristic_shapes').where('characteristic_id', '=', id).execute()
  await db.deleteFrom('characteristic_ranges').where('characteristic_id', '=', id).execute()
  await db.deleteFrom('characteristic_durations').where('characteristic_id', '=', id).execute()
  await db.deleteFrom('characteristics').where('id', '=', id).execute()
}

async function deleteDamageById(db: DBLike, id: string): Promise<void> {
  await db.deleteFrom('damage_bonus_kinds').where('damage_id', '=', id).execute()
  await db.deleteFrom('damage_bonuses').where('damage_id', '=', id).execute()
  await db.deleteFrom('damage_scaling_levels').where('damage_id', '=', id).execute()
  await db.deleteFrom('damage_values').where('damage_id', '=', id).execute()
  await db.deleteFrom('damages').where('id', '=', id).execute()
}

async function deleteConditionById(db: DBLike, id: string): Promise<void> {
  await db.deleteFrom('conditions').where('id', '=', id).execute()
}

async function deleteSavingThrowById(db: DBLike, id: string): Promise<void> {
  await db.deleteFrom('saving_throws').where('id', '=', id).execute()
}

type ExistingEffectIds = {
  rangeCharacteristicId: string | null
  shapeCharacteristicId: string | null
  savingThrowId: string | null
  momentDurationIds: string[]
  entryDurationIds: string[]
  damageIds: string[]
  conditionIds: string[]
  entryIds: string[]
}

async function collectExistingEffectIds(db: DBLike, effectId: string): Promise<ExistingEffectIds> {
  const [invocationRow, momentRows, directDamageRows, directConditionRows, entryRows] = await Promise.all([
    db.selectFrom('effect_invocations')
      .select(['range_characteristic_id', 'shape_characteristic_id', 'saving_throw_id'])
      .where('effect_id', '=', effectId)
      .executeTakeFirst(),
    db.selectFrom('effect_moments')
      .select(['duration_id'])
      .where('effect_id', '=', effectId)
      .execute(),
    db.selectFrom('moment_direct_damages')
      .select(['damage_id'])
      .where('effect_id', '=', effectId)
      .execute(),
    db.selectFrom('moment_direct_conditions')
      .select(['condition_id'])
      .where('effect_id', '=', effectId)
      .execute(),
    db.selectFrom('moment_roll_table_entries')
      .select(['id', 'duration_id'])
      .where('effect_id', '=', effectId)
      .execute()
  ])

  const entryIds = entryRows.map((row) => row.id)
  const rollDamageIds: string[] = []
  const rollConditionIds: string[] = []

  for (const entryId of entryIds) {
    const [rollDamageRow, rollConditionRow] = await Promise.all([
      db.selectFrom('moment_roll_table_damages')
        .select(['damage_id'])
        .where('entry_id', '=', entryId)
        .executeTakeFirst(),
      db.selectFrom('moment_roll_table_conditions')
        .select(['condition_id'])
        .where('entry_id', '=', entryId)
        .executeTakeFirst()
    ])

    if (rollDamageRow?.damage_id) {
      rollDamageIds.push(rollDamageRow.damage_id)
    }

    if (rollConditionRow?.condition_id) {
      rollConditionIds.push(rollConditionRow.condition_id)
    }
  }

  return {
    rangeCharacteristicId: invocationRow?.range_characteristic_id ?? null,
    shapeCharacteristicId: invocationRow?.shape_characteristic_id ?? null,
    savingThrowId: invocationRow?.saving_throw_id ?? null,
    momentDurationIds: momentRows.flatMap((row) => row.duration_id ? [row.duration_id] : []),
    entryDurationIds: entryRows.flatMap((row) => row.duration_id ? [row.duration_id] : []),
    damageIds: [
      ...directDamageRows.map((row) => row.damage_id),
      ...rollDamageIds
    ],
    conditionIds: [
      ...directConditionRows.map((row) => row.condition_id),
      ...rollConditionIds
    ],
    entryIds
  }
}

export async function deleteEffectById(db: DBLike, effectId: string): Promise<void> {
  const existing = await collectExistingEffectIds(db, effectId)

  for (const entryId of existing.entryIds) {
    await db.deleteFrom('moment_roll_table_damages').where('entry_id', '=', entryId).execute()
    await db.deleteFrom('moment_roll_table_conditions').where('entry_id', '=', entryId).execute()
  }

  await db.deleteFrom('moment_roll_table_entries').where('effect_id', '=', effectId).execute()
  await db.deleteFrom('moment_direct_damages').where('effect_id', '=', effectId).execute()
  await db.deleteFrom('moment_direct_conditions').where('effect_id', '=', effectId).execute()
  await db.deleteFrom('effect_moments').where('effect_id', '=', effectId).execute()
  await db.deleteFrom('effect_invocations').where('effect_id', '=', effectId).execute()

  for (const durationId of new Set([...existing.momentDurationIds, ...existing.entryDurationIds])) {
    await deleteCharacteristicById(db, durationId)
  }

  for (const damageId of new Set(existing.damageIds)) {
    await deleteDamageById(db, damageId)
  }

  for (const conditionId of new Set(existing.conditionIds)) {
    await deleteConditionById(db, conditionId)
  }

  if (existing.rangeCharacteristicId) {
    await deleteCharacteristicById(db, existing.rangeCharacteristicId)
  }

  if (existing.shapeCharacteristicId) {
    await deleteCharacteristicById(db, existing.shapeCharacteristicId)
  }

  if (existing.savingThrowId) {
    await deleteSavingThrowById(db, existing.savingThrowId)
  }

  await db.deleteFrom('effects').where('id', '=', effectId).execute()
}

async function upsertDamage(db: DBLike, json_data: DamageAuthored): Promise<void> {
  await db
    .insertInto('damages')
    .values(mapDamageRow(json_data))
    .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
      damage_type_id: ref('excluded.damage_type_id'),
      value_kind: ref('excluded.value_kind'),
      scaling_kind: ref('excluded.scaling_kind'),
      scaling_source: ref('excluded.scaling_source'),
      class_id: ref('excluded.class_id'),
      sort_order: ref('excluded.sort_order')
    })))
    .execute()

  await db.deleteFrom('damage_bonus_kinds').where('damage_id', '=', json_data.id).execute()
  await db.deleteFrom('damage_bonuses').where('damage_id', '=', json_data.id).execute()
  await db.deleteFrom('damage_scaling_levels').where('damage_id', '=', json_data.id).execute()
  await db.deleteFrom('damage_values').where('damage_id', '=', json_data.id).execute()

  const valueRow = mapDamageValueRow(json_data)
  if (valueRow) {
    await db.insertInto('damage_values').values(valueRow).execute()
  }

  const scalingRows = mapDamageScalingRows(json_data)
  if (scalingRows.length > 0) {
    await db.insertInto('damage_scaling_levels').values(scalingRows).execute()
  }

  const bonusKindRows = mapDamageBonusKindRows(json_data)
  if (bonusKindRows.length > 0) {
    await db.insertInto('damage_bonus_kinds').values(bonusKindRows).execute()
  }

  const bonusRows = mapDamageBonusRows(json_data)
  if (bonusRows.length > 0) {
    await db.insertInto('damage_bonuses').values(bonusRows).execute()
  }
}

async function upsertCondition(db: DBLike, json_data: ConditionAuthored): Promise<void> {
  await db
    .insertInto('conditions')
    .values(mapConditionRow(json_data))
    .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
      condition_type_id: ref('excluded.condition_type_id')
    })))
    .execute()
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

    for (const moment of json_data.moments) {
      if (moment.resolutionKind === MOMENT_RESOLUTION_KIND.DIRECT && moment.duration) {
        await upsertDuration(trx, moment.duration)
      }

      await trx
        .insertInto('effect_moments')
        .values(mapMomentRow(json_data.id, json_data.invocation.triggerCode, moment))
        .execute()

      if (moment.resolutionKind === MOMENT_RESOLUTION_KIND.DIRECT) {
        if (moment.effectKind === EFFECT_KIND.DAMAGE) {
          await upsertDamage(trx, moment)
          await trx.insertInto('moment_direct_damages').values({
            effect_id: json_data.id,
            trigger_code: json_data.invocation.triggerCode,
            moment_code: moment.moment,
            damage_id: moment.id
          }).execute()
        } else {
          await upsertCondition(trx, moment)
          await trx.insertInto('moment_direct_conditions').values({
            effect_id: json_data.id,
            trigger_code: json_data.invocation.triggerCode,
            moment_code: moment.moment,
            condition_id: moment.id
          }).execute()
        }

        continue
      }

      for (const [index, entry] of moment.table.entries()) {
        if (entry.duration) {
          await upsertDuration(trx, entry.duration)
        }

        await trx
          .insertInto('moment_roll_table_entries')
          .values(mapRollTableEntryRow(
            json_data.id,
            json_data.invocation.triggerCode,
            moment.moment,
            index + 1,
            entry
          ))
          .execute()

        if (entry.effectKind === EFFECT_KIND.DAMAGE) {
          await upsertDamage(trx, entry)
          await trx.insertInto('moment_roll_table_damages').values({
            entry_id: entry.id,
            damage_id: entry.id
          }).execute()
        } else {
          await upsertCondition(trx, entry)
          await trx.insertInto('moment_roll_table_conditions').values({
            entry_id: entry.id,
            condition_id: entry.id
          }).execute()
        }
      }
    }

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
