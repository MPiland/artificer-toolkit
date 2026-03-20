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
  branchDurationIds: string[]
  entryDurationIds: string[]
  damageIds: string[]
  conditionIds: string[]
  entryIds: string[]
}

async function collectExistingEffectIds(db: DBLike, effectId: string): Promise<ExistingEffectIds> {
  const [
    invocationRow,
    branchRows,
    directDamageRows,
    directConditionRows,
    entryRows
  ] = await Promise.all([
    db.selectFrom('effect_invocations')
      .select(['range_characteristic_id', 'shape_characteristic_id', 'saving_throw_id'])
      .where('effect_id', '=', effectId)
      .executeTakeFirst(),
    db.selectFrom('effect_branches')
      .select(['duration_id'])
      .where('effect_id', '=', effectId)
      .execute(),
    db.selectFrom('branch_direct_damages')
      .select(['damage_id'])
      .where('effect_id', '=', effectId)
      .execute(),
    db.selectFrom('branch_direct_conditions')
      .select(['condition_id'])
      .where('effect_id', '=', effectId)
      .execute(),
    db.selectFrom('branch_roll_table_entries')
      .select(['id', 'duration_id'])
      .where('effect_id', '=', effectId)
      .execute()
  ])

  const entryIds = entryRows.map((row) => row.id)
  const rollDamageIds: string[] = []
  const rollConditionIds: string[] = []

  for (const entryId of entryIds) {
    const [rollDamageRow, rollConditionRow] = await Promise.all([
      db.selectFrom('branch_roll_table_damages')
        .select(['damage_id'])
        .where('entry_id', '=', entryId)
        .executeTakeFirst(),
      db.selectFrom('branch_roll_table_conditions')
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
    branchDurationIds: branchRows.flatMap((row) => row.duration_id ? [row.duration_id] : []),
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
    await db.deleteFrom('branch_roll_table_damages').where('entry_id', '=', entryId)
      .execute()
    await db.deleteFrom('branch_roll_table_conditions').where('entry_id', '=', entryId)
      .execute()
  }

  await db.deleteFrom('branch_roll_table_entries').where('effect_id', '=', effectId)
    .execute()
  await db.deleteFrom('branch_direct_damages').where('effect_id', '=', effectId)
    .execute()
  await db.deleteFrom('branch_direct_conditions').where('effect_id', '=', effectId)
    .execute()
  await db.deleteFrom('effect_branches').where('effect_id', '=', effectId)
    .execute()
  await db.deleteFrom('effect_invocations').where('effect_id', '=', effectId)
    .execute()

  for (const durationId of new Set([...existing.branchDurationIds, ...existing.entryDurationIds])) {
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
