import type { DBLike } from '#types'

type RowLike = Record<string, unknown>
type DeleteByCharacterDb = {
  deleteFrom: (table: string) => {
    where: (column: 'character_id', op: '=', value: string) => { execute: () => Promise<unknown> }
  }
}

type ExistingCharacterChildIds = {
  currencyGroupIds: string[]
  featureAcquisitionIds: string[]
  chosenGrantSelectionIds: string[]
  spellSelectionIds: string[]
}

export async function insertRows(db: DBLike, table: string, rows: RowLike[]) {
  if (rows.length === 0) {
    return
  }

  await db
    .insertInto(table as never)
    .values(rows as never)
    .execute()
}

async function collectExistingChildIds(
  db: DBLike,
  characterId: string
): Promise<ExistingCharacterChildIds> {
  const [currencyGroupRows, featureAcquisitionRows, chosenGrantSelectionRows, spellSelectionRows] =
    await Promise.all([
      db
        .selectFrom('character_currency_groups')
        .select(['id'])
        .where('character_id', '=', characterId)
        .execute(),
      db
        .selectFrom('character_feature_acquisitions')
        .select(['id'])
        .where('character_id', '=', characterId)
        .execute(),
      db
        .selectFrom('character_chosen_grant_selections')
        .select(['id'])
        .where('character_id', '=', characterId)
        .execute(),
      db
        .selectFrom('character_spell_selections')
        .select(['id'])
        .where('character_id', '=', characterId)
        .execute()
    ])

  return {
    currencyGroupIds: currencyGroupRows.map((row) => row.id),
    featureAcquisitionIds: featureAcquisitionRows.map((row) => row.id),
    chosenGrantSelectionIds: chosenGrantSelectionRows.map((row) => row.id),
    spellSelectionIds: spellSelectionRows.map((row) => row.id)
  }
}

export async function deleteExistingCharacterChildren(db: DBLike, characterId: string) {
  const existing = await collectExistingChildIds(db, characterId)
  const deleteByCharacterDb = db as unknown as DeleteByCharacterDb

  for (const groupId of existing.currencyGroupIds) {
    await db.deleteFrom('character_currencies').where('group_id', '=', groupId).execute()
  }

  for (const featureAcquisitionId of existing.featureAcquisitionIds) {
    await db
      .deleteFrom('character_feature_selection_values')
      .where('feature_acquisition_id', '=', featureAcquisitionId)
      .execute()
    await db
      .deleteFrom('character_feature_selection_records')
      .where('feature_acquisition_id', '=', featureAcquisitionId)
      .execute()
  }

  for (const selectionId of existing.chosenGrantSelectionIds) {
    await db
      .deleteFrom('character_chosen_grant_selection_targets')
      .where('selection_id', '=', selectionId)
      .execute()
  }

  for (const spellSelectionId of existing.spellSelectionIds) {
    await db
      .deleteFrom('character_spell_selection_spells')
      .where('selection_id', '=', spellSelectionId)
      .execute()
  }

  await db.deleteFrom('character_resources').where('character_id', '=', characterId).execute()
  await deleteByCharacterDb
    .deleteFrom('character_spell_slot_state')
    .where('character_id', '=', characterId)
    .execute()
  await deleteByCharacterDb
    .deleteFrom('character_conditions')
    .where('character_id', '=', characterId)
    .execute()
  await deleteByCharacterDb
    .deleteFrom('character_exhaustion')
    .where('character_id', '=', characterId)
    .execute()
  await deleteByCharacterDb
    .deleteFrom('character_notes')
    .where('character_id', '=', characterId)
    .execute()
  await deleteByCharacterDb
    .deleteFrom('character_note_groups')
    .where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_attuned').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_equipped').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_class_spells').where('character_id', '=', characterId).execute()
  await db
    .deleteFrom('character_class_equipment_items')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_class_equipment_groups')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_class_equipment_session')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_background_equipment_items')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_background_equipment_groups')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_background_equipment_session')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_creature_equipment')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_vehicle_equipment')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_creature_hit_dice_state')
    .where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_creatures').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_vehicles').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_currency_groups').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_equipment').where('character_id', '=', characterId).execute()
  await db
    .deleteFrom('character_chosen_grant_selections')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_feature_acquisitions')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_spell_selections')
    .where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_resource_grants').where('character_id', '=', characterId).execute()
  await db
    .deleteFrom('character_abilities_manual_rolled_rolls')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_abilities_manual_rolled_groups')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_abilities_manual_assignments')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_abilities_manual_rolled')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_abilities_point_buy_distributed')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_abilities_point_buy')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_abilities_standard_array')
    .where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_abilities').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_hit_dice_state').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_hitpoint_state').where('character_id', '=', characterId).execute()
  await db
    .deleteFrom('character_hitpoint_level_rolls')
    .where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_hitpoint_levels').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_hitpoint_intent').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_classes').where('character_id', '=', characterId).execute()
  await db
    .deleteFrom('character_ancestry_acquisitions')
    .where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_background').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_race').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_advancement').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_profile').where('character_id', '=', characterId).execute()
}
