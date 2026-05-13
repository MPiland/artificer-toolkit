import type { DBLike } from '#types'
import type { ConditionAuthored, DamageAuthored } from '@artificer-toolkit/shared'
import {
  mapConditionRow,
  mapDamageBonusKindRows,
  mapDamageBonusRows,
  mapDamageRow,
  mapDamageScalingRows,
  mapDamageValueRow
} from './effect.mappers.js'

async function deleteCharacteristicById(db: DBLike, id: string): Promise<void> {
  await db.deleteFrom('characteristic_shape_dimensions').where('characteristic_id', '=', id)
    .execute()
  await db.deleteFrom('characteristic_shapes').where('characteristic_id', '=', id)
    .execute()
  await db.deleteFrom('characteristic_ranges').where('characteristic_id', '=', id)
    .execute()
  await db.deleteFrom('characteristic_durations').where('characteristic_id', '=', id)
    .execute()
  await db.deleteFrom('characteristics').where('id', '=', id)
    .execute()
}

async function deleteDamageById(db: DBLike, id: string): Promise<void> {
  await db.deleteFrom('damage_bonus_kinds').where('damage_id', '=', id)
    .execute()
  await db.deleteFrom('damage_bonuses').where('damage_id', '=', id)
    .execute()
  await db.deleteFrom('damage_scaling_levels').where('damage_id', '=', id)
    .execute()
  await db.deleteFrom('damage_values').where('damage_id', '=', id)
    .execute()
  await db.deleteFrom('damages').where('id', '=', id)
    .execute()
}

async function deleteConditionById(db: DBLike, id: string): Promise<void> {
  await db.deleteFrom('conditions').where('id', '=', id)
    .execute()
}

async function deleteSavingThrowById(db: DBLike, id: string): Promise<void> {
  await db.deleteFrom('saving_throws').where('id', '=', id)
    .execute()
}

type ExistingEffectIds = {
  rangeCharacteristicId: string | null
  shapeCharacteristicId: string | null
  savingThrowId: string | null
  pathDurationIds: string[]
  pathRangeOverrideIds: string[]
  pathIds: string[]
  resultBlockIds: string[]
  choiceOptionIds: string[]
  rollRowIds: string[]
  genericOutcomeIds: string[]
  damageIds: string[]
  conditionIds: string[]
}

async function collectExistingEffectIds(db: DBLike, effectId: string): Promise<ExistingEffectIds> {
  const invocationRow = await db.selectFrom('effect_invocations')
    .select(['range_characteristic_id', 'shape_characteristic_id', 'saving_throw_id'] as const)
    .where('effect_id', '=', effectId)
    .executeTakeFirst()

  const pathRows = await db.selectFrom('effect_paths')
    .select(['id', 'result_block_id', 'range_override_characteristic_id'] as const)
    .where('effect_id', '=', effectId)
    .execute()

  const pathIds = pathRows.map((row) => row.id)

  const choiceOptions = pathIds.length > 0
    ? await db.selectFrom('effect_path_choice_options')
        .select(['id', 'path_id', 'result_block_id'] as const)
        .where('path_id', 'in', pathIds)
        .execute()
    : []

  const rollRows = pathIds.length > 0
    ? await db.selectFrom('effect_path_roll_table_rows')
        .select(['id', 'path_id', 'result_block_id'] as const)
        .where('path_id', 'in', pathIds)
        .execute()
    : []

  const resultBlockIds = Array.from(new Set([
    ...pathRows.flatMap((row) => row.result_block_id ? [row.result_block_id] : []),
    ...choiceOptions.map((row) => row.result_block_id),
    ...rollRows.map((row) => row.result_block_id)
  ]))

  const resultBlocks = resultBlockIds.length > 0
    ? await db.selectFrom('effect_result_blocks')
        .select(['id', 'duration_id'] as const)
        .where('id', 'in', resultBlockIds)
        .execute()
    : []

  const nativeOutcomeRows = resultBlockIds.length > 0
    ? await db.selectFrom('effect_result_block_outcomes')
        .select(['outcome_id', 'effect_kind'] as const)
        .where('result_block_id', 'in', resultBlockIds)
        .execute()
    : []

  return {
    rangeCharacteristicId: invocationRow?.range_characteristic_id ?? null,
    shapeCharacteristicId: invocationRow?.shape_characteristic_id ?? null,
    savingThrowId: invocationRow?.saving_throw_id ?? null,
    pathDurationIds: resultBlocks.flatMap((row) => row.duration_id ? [row.duration_id] : []),
    pathRangeOverrideIds: pathRows.flatMap((row) => row.range_override_characteristic_id ? [row.range_override_characteristic_id] : []),
    pathIds,
    resultBlockIds,
    choiceOptionIds: choiceOptions.map((row) => row.id),
    rollRowIds: rollRows.map((row) => row.id),
    genericOutcomeIds: nativeOutcomeRows
      .filter((row) => row.effect_kind !== 'DAMAGE' && row.effect_kind !== 'CONDITION')
      .map((row) => row.outcome_id),
    damageIds: [
      ...nativeOutcomeRows
        .filter((row) => row.effect_kind === 'DAMAGE')
        .map((row) => row.outcome_id)
    ],
    conditionIds: [
      ...nativeOutcomeRows
        .filter((row) => row.effect_kind === 'CONDITION')
        .map((row) => row.outcome_id)
    ]
  }
}

export async function deleteEffectById(db: DBLike, effectId: string): Promise<void> {
  const existing = await collectExistingEffectIds(db, effectId)

  if (existing.resultBlockIds.length > 0) {
    await db.deleteFrom('effect_result_block_outcomes').where('result_block_id', 'in', existing.resultBlockIds)
      .execute()
  }

  if (existing.genericOutcomeIds.length > 0) {
    await db.deleteFrom('effect_generic_outcomes').where('id', 'in', existing.genericOutcomeIds)
      .execute()
  }

  if (existing.choiceOptionIds.length > 0) {
    await db.deleteFrom('effect_path_choice_options').where('id', 'in', existing.choiceOptionIds)
      .execute()
  }

  if (existing.rollRowIds.length > 0) {
    await db.deleteFrom('effect_path_roll_table_rows').where('id', 'in', existing.rollRowIds)
      .execute()
  }

  if (existing.pathIds.length > 0) {
    await db.deleteFrom('effect_paths').where('id', 'in', existing.pathIds)
      .execute()
  }

  if (existing.resultBlockIds.length > 0) {
    await db.deleteFrom('effect_result_blocks').where('id', 'in', existing.resultBlockIds)
      .execute()
  }

  await db.deleteFrom('effect_invocations').where('effect_id', '=', effectId)
    .execute()

  for (const durationId of new Set(existing.pathDurationIds)) {
    await deleteCharacteristicById(db, durationId)
  }

  for (const rangeOverrideId of new Set(existing.pathRangeOverrideIds)) {
    await deleteCharacteristicById(db, rangeOverrideId)
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

  await db.deleteFrom('effects').where('id', '=', effectId)
    .execute()
}

export async function upsertDamage(db: DBLike, json_data: DamageAuthored): Promise<void> {
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

  await db.deleteFrom('damage_bonus_kinds').where('damage_id', '=', json_data.id)
    .execute()
  await db.deleteFrom('damage_bonuses').where('damage_id', '=', json_data.id)
    .execute()
  await db.deleteFrom('damage_scaling_levels').where('damage_id', '=', json_data.id)
    .execute()
  await db.deleteFrom('damage_values').where('damage_id', '=', json_data.id)
    .execute()

  const valueRow = mapDamageValueRow(json_data)
  if (valueRow) {
    await db.insertInto('damage_values').values(valueRow)
      .execute()
  }

  const scalingRows = mapDamageScalingRows(json_data)
  if (scalingRows.length > 0) {
    await db.insertInto('damage_scaling_levels').values(scalingRows)
      .execute()
  }

  const bonusKindRows = mapDamageBonusKindRows(json_data)
  if (bonusKindRows.length > 0) {
    await db.insertInto('damage_bonus_kinds').values(bonusKindRows)
      .execute()
  }

  const bonusRows = mapDamageBonusRows(json_data)
  if (bonusRows.length > 0) {
    await db.insertInto('damage_bonuses').values(bonusRows)
      .execute()
  }
}

export async function upsertCondition(db: DBLike, json_data: ConditionAuthored): Promise<void> {
  await db
    .insertInto('conditions')
    .values(mapConditionRow(json_data))
    .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
      condition_type_id: ref('excluded.condition_type_id')
    })))
    .execute()
}


