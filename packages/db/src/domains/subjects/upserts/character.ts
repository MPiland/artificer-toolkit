import type { DBLike } from '@db-types'
import {
  ADVANCEMENT_METHOD_CODE,
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE,
  type CharacterAuthored
} from '@artificer-toolkit/shared'
import { assertNever } from '../../../utils/index.js'

type RowLike = Record<string, unknown>

type ExistingCharacterChildIds = {
  currencyGroupIds: string[]
  featureAcquisitionIds: string[]
  spellSelectionIds: string[]
}

type CharacterFeatureSelectionValue = NonNullable<
  NonNullable<CharacterAuthored['intent']['featureAcquisitions'][number]['selections']>[number]['values']
>[number]

function serializeSelectionValue(value: CharacterFeatureSelectionValue) {
  switch (value.kind) {
    case 'ID':
      return {
        value_kind: 'ID',
        text_value: value.id,
        number_value: null,
        boolean_value: null
      }

    case 'IDS':
      return {
        value_kind: 'IDS',
        text_value: JSON.stringify(value.ids),
        number_value: null,
        boolean_value: null
      }

    case 'NUMBER':
      return {
        value_kind: 'NUMBER',
        text_value: null,
        number_value: value.value,
        boolean_value: null
      }

    case 'BOOLEAN':
      return {
        value_kind: 'BOOLEAN',
        text_value: null,
        number_value: null,
        boolean_value: value.value
      }

    default:
      return assertNever(value)
  }
}

function mapTiming(
  timing: CharacterAuthored['intent']['featureAcquisitions'][number]['timing']
) {
  switch (timing.kind) {
    case 'IMMEDIATE':
      return {
        timing_kind: 'IMMEDIATE',
        timing_level: null,
        timing_class_id: null,
        timing_class_level: null
      }

    case 'CHARACTER_LEVEL':
      return {
        timing_kind: 'CHARACTER_LEVEL',
        timing_level: timing.level,
        timing_class_id: null,
        timing_class_level: null
      }

    case 'CLASS_LEVEL':
      return {
        timing_kind: 'CLASS_LEVEL',
        timing_level: null,
        timing_class_id: timing.classId,
        timing_class_level: timing.classLevel
      }

    default:
      return assertNever(timing)
  }
}

function mapFeatureSource(
  source: CharacterAuthored['intent']['featureAcquisitions'][number]['source']
) {
  switch (source.kind) {
    case 'CLASS':
      return {
        source_kind: 'CLASS',
        class_id: source.classId,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'SUBCLASS':
      return {
        source_kind: 'SUBCLASS',
        class_id: null,
        subclass_id: source.subclassId,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'RACE':
      return {
        source_kind: 'RACE',
        class_id: null,
        subclass_id: null,
        race_id: source.raceId,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'SUBRACE':
      return {
        source_kind: 'SUBRACE',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: source.subraceId,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'ANCESTRY':
      return {
        source_kind: 'ANCESTRY',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: source.ancestryId,
        option_id: source.optionId,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'BACKGROUND':
      return {
        source_kind: 'BACKGROUND',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: source.backgroundId,
        feat_id: null,
        reason: null
      }

    case 'FEAT':
      return {
        source_kind: 'FEAT',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: source.featId,
        reason: null
      }

    case 'FEATURE':
      return {
        source_kind: 'FEATURE',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'OPTION':
      return {
        source_kind: 'OPTION',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: source.optionId,
        acquired_parent_id: source.acquiredParentId,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'MANUAL':
      return {
        source_kind: 'MANUAL',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: source.reason ?? null
      }

    default:
      return assertNever(source)
  }
}

function mapSpellSelectionSource(
  source: NonNullable<CharacterAuthored['intent']['spellSelections']>[number]['source']
) {
  switch (source.kind) {
    case 'CLASS':
      return {
        source_kind: 'CLASS',
        class_id: source.classId,
        subclass_id: null,
        feature_id: null,
        option_id: null,
        acquired_parent_id: null
      }

    case 'SUBCLASS':
      return {
        source_kind: 'SUBCLASS',
        class_id: null,
        subclass_id: source.subclassId,
        feature_id: null,
        option_id: null,
        acquired_parent_id: null
      }

    case 'FEATURE':
      return {
        source_kind: 'FEATURE',
        class_id: null,
        subclass_id: null,
        feature_id: source.featureId,
        option_id: null,
        acquired_parent_id: null
      }

    case 'OPTION':
      return {
        source_kind: 'OPTION',
        class_id: null,
        subclass_id: null,
        feature_id: null,
        option_id: source.optionId,
        acquired_parent_id: source.acquiredParentId
      }

    default:
      return assertNever(source)
  }
}

function mapResourceGrantSource(
  source: NonNullable<CharacterAuthored['intent']['resourceGrants']>[number]['source']
) {
  switch (source.kind) {
    case 'CLASS':
      return {
        source_kind: 'CLASS',
        class_id: source.classId,
        subclass_id: null,
        feature_id: null,
        option_id: null,
        acquired_parent_id: null
      }

    case 'SUBCLASS':
      return {
        source_kind: 'SUBCLASS',
        class_id: null,
        subclass_id: source.subclassId,
        feature_id: null,
        option_id: null,
        acquired_parent_id: null
      }

    case 'FEATURE':
      return {
        source_kind: 'FEATURE',
        class_id: null,
        subclass_id: null,
        feature_id: source.featureId,
        option_id: null,
        acquired_parent_id: null
      }

    case 'OPTION':
      return {
        source_kind: 'OPTION',
        class_id: null,
        subclass_id: null,
        feature_id: null,
        option_id: source.optionId,
        acquired_parent_id: source.acquiredParentId
      }

    default:
      return assertNever(source)
  }
}

function sortByDependency<T>(
  items: T[],
  getId: (item: T) => string,
  getDependencyId: (item: T) => string | undefined,
  label: string
): T[] {
  const knownIds = new Set(items.map(getId))

  for (const item of items) {
    const dependencyId = getDependencyId(item)

    if (dependencyId && !knownIds.has(dependencyId)) {
      throw new Error(`${label} references missing dependency "${dependencyId}".`)
    }
  }

  const pending = [...items]
  const resolvedIds = new Set<string>()
  const ordered: T[] = []

  while (pending.length > 0) {
    let inserted = false

    for (let index = 0; index < pending.length; index += 1) {
      const item = pending[index] as T
      const dependencyId = getDependencyId(item)

      if (!dependencyId || resolvedIds.has(dependencyId)) {
        ordered.push(item)
        resolvedIds.add(getId(item))
        pending.splice(index, 1)
        inserted = true
        break
      }
    }

    if (!inserted) {
      throw new Error(`${label} contains a cyclical dependency chain.`)
    }
  }

  return ordered
}

function countRolls(rolls: Array<{ die: number, value: number }>) {
  const counts = new Map<string, number>()

  for (const roll of rolls) {
    const key = `${roll.die}:${roll.value}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return counts
}

async function insertRows(db: DBLike, table: string, rows: RowLike[]) {
  if (rows.length === 0) {
    return
  }

  await db.insertInto(table as never).values(rows as never)
    .execute()
}

async function collectExistingChildIds(
  db: DBLike,
  characterId: string
): Promise<ExistingCharacterChildIds> {
  const [currencyGroupRows, featureAcquisitionRows, spellSelectionRows] = await Promise.all([
    db.selectFrom('character_currency_groups').select(['id'])
      .where('character_id', '=', characterId)
      .execute(),
    db.selectFrom('character_feature_acquisitions').select(['id'])
      .where('character_id', '=', characterId)
      .execute(),
    db.selectFrom('character_spell_selections').select(['id'])
      .where('character_id', '=', characterId)
      .execute()
  ])

  return {
    currencyGroupIds: currencyGroupRows.map((row) => row.id),
    featureAcquisitionIds: featureAcquisitionRows.map((row) => row.id),
    spellSelectionIds: spellSelectionRows.map((row) => row.id)
  }
}

async function deleteExistingCharacterChildren(db: DBLike, characterId: string) {
  const existing = await collectExistingChildIds(db, characterId)

  for (const groupId of existing.currencyGroupIds) {
    await db.deleteFrom('character_currencies').where('group_id', '=', groupId)
      .execute()
  }

  for (const featureAcquisitionId of existing.featureAcquisitionIds) {
    await db.deleteFrom('character_feature_selection_values').where('feature_acquisition_id', '=', featureAcquisitionId)
      .execute()
    await db.deleteFrom('character_feature_selection_records').where('feature_acquisition_id', '=', featureAcquisitionId)
      .execute()
  }

  for (const spellSelectionId of existing.spellSelectionIds) {
    await db.deleteFrom('character_spell_selection_spells').where('selection_id', '=', spellSelectionId)
      .execute()
  }

  await db.deleteFrom('character_resources').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_attuned').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_equipped').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_class_spells').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_class_equipment_items').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_class_equipment_groups').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_class_equipment_session').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_background_equipment_items').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_background_equipment_groups').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_background_equipment_session').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_equipment').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_currencies').where('group_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_currency_groups').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_feature_acquisitions').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_spell_selections').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_resource_grants').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_abilities_manual_rolled_rolls').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_abilities_manual_rolled_groups').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_abilities_manual_assignments').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_abilities_manual_rolled').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_abilities_point_buy_distributed').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_abilities_point_buy').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_abilities_standard_array').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_abilities').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_hit_dice_state').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_hitpoint_state').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_hitpoint_level_rolls').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_hitpoint_levels').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_hitpoint_intent').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_classes').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_ancestry_acquisitions').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_background').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_race').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_advancement').where('character_id', '=', characterId)
    .execute()
}

export async function upsertCharacter(
  db: DBLike,
  json_data: CharacterAuthored
) {
  const trx = await db.startTransaction().execute()

  try {
    await trx
      .insertInto('characters')
      .values({
        id: json_data.id,
        system_id: json_data.systemId,
        user_id: json_data.userId,
        label: json_data.label,
        description: json_data.description ?? null
      })
      .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
        system_id: ref('excluded.system_id'),
        user_id: ref('excluded.user_id'),
        label: ref('excluded.label'),
        description: ref('excluded.description')
      })))
      .execute()

    await deleteExistingCharacterChildren(trx, json_data.id)

    await trx.insertInto('character_advancement').values({
      character_id: json_data.id,
      method_code: json_data.intent.advancement.method,
      experience: json_data.intent.advancement.method === ADVANCEMENT_METHOD_CODE.EXPERIENCE
        ? json_data.intent.advancement.experience ?? null
        : null
    })
      .execute()

    await trx.insertInto('character_race').values({
      character_id: json_data.id,
      race_id: json_data.intent.race.raceId,
      subrace_id: json_data.intent.race.subraceId ?? null
    })
      .execute()

    await trx.insertInto('character_background').values({
      character_id: json_data.id,
      background_id: json_data.intent.background.backgroundId
    })
      .execute()

    await insertRows(trx, 'character_ancestry_acquisitions', (json_data.intent.ancestrySelections ?? []).map((acquisition) => ({
      id: acquisition.id,
      character_id: json_data.id,
      ancestry_id: acquisition.ancestryId,
      option_id: acquisition.optionId,
      source_kind: acquisition.source.kind,
      race_id: acquisition.source.kind === 'RACE' ? acquisition.source.raceId : null,
      subrace_id: acquisition.source.kind === 'SUBRACE' ? acquisition.source.subraceId : null,
      timing_kind: acquisition.timing.kind,
      class_id: acquisition.timing.kind === 'CLASS_LEVEL' ? acquisition.timing.classId : null,
      class_level: acquisition.timing.kind === 'CLASS_LEVEL' ? acquisition.timing.classLevel : null
    })))

    await insertRows(trx, 'character_classes', json_data.intent.classes.map((characterClass) => ({
      character_id: json_data.id,
      class_id: characterClass.classId,
      subclass_id: characterClass.subclassId ?? null,
      subtype_id: characterClass.subtypeId ?? null,
      class_level: characterClass.classLevel
    })))

    await trx.insertInto('character_hitpoint_intent').values({
      character_id: json_data.id,
      method_code: json_data.intent.hitpoints.method
    })
      .execute()

    await insertRows(trx, 'character_hitpoint_levels', json_data.intent.hitpoints.levels.map((level) => ({
      character_id: json_data.id,
      char_level: level.level,
      value: level.value,
      overridden: level.overridden ?? null
    })))

    await insertRows(trx, 'character_hitpoint_level_rolls', json_data.intent.hitpoints.levels.flatMap((level) => (level.rolls ?? []).map((roll, index) => ({
      character_id: json_data.id,
      char_level: level.level,
      roll_index: index,
      die: roll.die,
      value: roll.value
    }))))

    await trx.insertInto('character_hitpoint_state').values({
      character_id: json_data.id,
      current: json_data.state.hitpoints.current,
      temp: json_data.state.hitpoints.temp ?? null,
      max_override: json_data.state.hitpoints.maxOverride ?? null
    })
      .execute()

    await insertRows(trx, 'character_hit_dice_state', json_data.state.hitpoints.hitDice.map((hitDie) => ({
      character_id: json_data.id,
      die: hitDie.die,
      total: hitDie.total,
      used: hitDie.used
    })))

    await insertRows(trx, 'character_class_spells', (json_data.state.classes ?? []).flatMap((classState) => [
      ...(classState.spells?.learned ?? []).map((spellId) => ({
        character_id: json_data.id,
        class_id: classState.classId,
        spell_id: spellId,
        state: 'KNOWN'
      })),
      ...(classState.spells?.prepared ?? []).map((spellId) => ({
        character_id: json_data.id,
        class_id: classState.classId,
        spell_id: spellId,
        state: 'PREPARED'
      }))
    ]))

    const orderedInventory = sortByDependency(json_data.state.equipment.inventory, (item) => item.id, (item) => item.containerId, `Character equipment for ${json_data.id}`)
    const inventoryIds = new Set(orderedInventory.map((item) => item.id))

    await insertRows(trx, 'character_equipment', orderedInventory.map((item) => ({
      id: item.id,
      character_id: json_data.id,
      equipment_id: item.equipmentId,
      quantity: item.quantity,
      container_id: item.containerId ?? null,
      container_path: null,
      custom_name: item.customName ?? null,
      notes: item.notes ?? null
    })))

    for (const equipmentId of json_data.state.equipment.equipped) {
      if (!inventoryIds.has(equipmentId)) {
        throw new Error(`Character ${json_data.id} equips missing inventory item ${equipmentId}.`)
      }
    }

    for (const equipmentId of json_data.state.equipment.attuned) {
      if (!inventoryIds.has(equipmentId)) {
        throw new Error(`Character ${json_data.id} attunes missing inventory item ${equipmentId}.`)
      }
    }

    await insertRows(trx, 'character_equipped', json_data.state.equipment.equipped.map((equipmentId) => ({
      character_id: json_data.id,
      equipment_id: equipmentId
    })))

    await insertRows(trx, 'character_attuned', json_data.state.equipment.attuned.map((equipmentId) => ({
      character_id: json_data.id,
      equipment_id: equipmentId
    })))

    const currencyGroupRows = json_data.state.currency.map((group, index) => ({
      id: `${json_data.id}::currency-group::${index + 1}`,
      character_id: json_data.id,
      container_id: group.containerId ?? null
    }))

    for (const group of json_data.state.currency) {
      if (group.containerId && !inventoryIds.has(group.containerId)) {
        throw new Error(`Character ${json_data.id} currency group references missing container ${group.containerId}.`)
      }
    }

    await insertRows(trx, 'character_currency_groups', currencyGroupRows)

    await insertRows(trx, 'character_currencies', json_data.state.currency.flatMap((group, index) => group.currencies.map((currency) => ({
      group_id: currencyGroupRows[index]?.id,
      currency_id: currency.currencyId,
      amount: currency.amount
    }))))

    const orderedFeatureAcquisitions = sortByDependency(json_data.intent.featureAcquisitions, (acquisition) => acquisition.id, (acquisition) => acquisition.source.kind === 'OPTION'
      ? acquisition.source.acquiredParentId
      : undefined, `Character feature acquisitions for ${json_data.id}`)
    const featureAcquisitionIds = new Set(orderedFeatureAcquisitions.map((acquisition) => acquisition.id))

    await insertRows(trx, 'character_feature_acquisitions', orderedFeatureAcquisitions.map((acquisition) => ({
      id: acquisition.id,
      character_id: json_data.id,
      feature_id: acquisition.featureId,
      ...mapFeatureSource(acquisition.source),
      ...mapTiming(acquisition.timing)
    })))

    await insertRows(trx, 'character_feature_selection_records', orderedFeatureAcquisitions.flatMap((acquisition) => (acquisition.selections ?? []).map((selection) => ({
      feature_acquisition_id: acquisition.id,
      selection_key: selection.selectionKey
    }))))

    await insertRows(trx, 'character_feature_selection_values', orderedFeatureAcquisitions.flatMap((acquisition) => (acquisition.selections ?? []).flatMap((selection) => selection.values.map((value, index) => ({
      feature_acquisition_id: acquisition.id,
      selection_key: selection.selectionKey,
      value_index: index,
      ...serializeSelectionValue(value)
    })))))

    const orderedSpellSelections = sortByDependency(json_data.intent.spellSelections ?? [], (selection) => selection.id, (selection) => selection.replacedSelectionId, `Character spell selections for ${json_data.id}`)

    for (const selection of orderedSpellSelections) {
      if (selection.source.kind === 'OPTION' && !featureAcquisitionIds.has(selection.source.acquiredParentId)) {
        throw new Error(`Character ${json_data.id} spell selection ${selection.id} references missing feature acquisition ${selection.source.acquiredParentId}.`)
      }
    }

    await insertRows(trx, 'character_spell_selections', orderedSpellSelections.map((selection) => ({
      id: selection.id,
      character_id: json_data.id,
      ...mapSpellSelectionSource(selection.source),
      ...mapTiming(selection.timing),
      replaced_selection_id: selection.replacedSelectionId ?? null
    })))

    await insertRows(trx, 'character_spell_selection_spells', orderedSpellSelections.flatMap((selection) => selection.spells.map((spellId) => ({
      selection_id: selection.id,
      spell_id: spellId
    }))))

    const resourceGrantRows = json_data.intent.resourceGrants ?? []

    for (const resourceGrant of resourceGrantRows) {
      if (resourceGrant.source.kind === 'OPTION' && !featureAcquisitionIds.has(resourceGrant.source.acquiredParentId)) {
        throw new Error(`Character ${json_data.id} resource grant ${resourceGrant.id} references missing feature acquisition ${resourceGrant.source.acquiredParentId}.`)
      }
    }

    await insertRows(trx, 'character_resource_grants', resourceGrantRows.map((resourceGrant) => ({
      id: resourceGrant.id,
      character_id: json_data.id,
      resource_id: resourceGrant.resourceId,
      ...mapResourceGrantSource(resourceGrant.source),
      ...mapTiming(resourceGrant.timing)
    })))

    await insertRows(trx, 'character_resources', (json_data.state.resources ?? []).map((resource) => ({
      character_id: json_data.id,
      resource_grant_id: resource.resourceGrantId,
      used: resource.used
    })))

    await trx.insertInto('character_abilities').values({
      character_id: json_data.id,
      method_code: json_data.intent.abilities.method
    })
      .execute()

    switch (json_data.intent.abilities.method) {
      case CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY:
        await insertRows(trx, 'character_abilities_standard_array', json_data.intent.abilities.assignments.map((assignment) => ({
          character_id: json_data.id,
          ability_code: assignment.ability,
          option_code: assignment.option
        })))
        break

      case CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY:
        await trx.insertInto('character_abilities_point_buy').values({
          character_id: json_data.id
        })
          .execute()

        await insertRows(trx, 'character_abilities_point_buy_distributed', json_data.intent.abilities.assignments.map((assignment) => ({
          character_id: json_data.id,
          ability_code: assignment.ability,
          option_code: assignment.option
        })))
        break

      case CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED: {
        await trx.insertInto('character_abilities_manual_rolled').values({
          character_id: json_data.id,
          configuration: json_data.intent.abilities.state.configuration ?? null
        })
          .execute()

        const groupRows = (json_data.intent.abilities.state.rollGroups ?? []).map((group, index) => ({
          character_id: json_data.id,
          group_index: index,
          id: group.id,
          assigned_ability_code: group.assignedAbility ?? null,
          score: group.score,
          applied: group.applied ?? null,
          rolling: group.rolling ?? null
        }))

        await insertRows(trx, 'character_abilities_manual_rolled_groups', groupRows)

        const manualRollRows = (json_data.intent.abilities.state.rollGroups ?? []).flatMap((group, groupIndex) => {
          const keptCounts = countRolls(group.kept)

          return group.rolls.map((roll, rollIndex) => {
            const key = `${roll.die}:${roll.value}`
            const remaining = keptCounts.get(key) ?? 0
            const isKept = remaining > 0

            if (isKept) {
              keptCounts.set(key, remaining - 1)
            }

            return {
              character_id: json_data.id,
              group_index: groupIndex,
              roll_index: rollIndex,
              die: roll.die,
              value: roll.value,
              is_kept: isKept
            }
          })
        })

        await insertRows(trx, 'character_abilities_manual_rolled_rolls', manualRollRows)

        await insertRows(trx, 'character_abilities_manual_assignments', json_data.intent.abilities.state.assignments.map((assignment) => ({
          character_id: json_data.id,
          ability_code: assignment.ability,
          score: assignment.score
        })))
        break
      }

      default:
        assertNever(json_data.intent.abilities)
    }

    const classEquipmentDecision = json_data.intent.startingEquipment?.class

    if (classEquipmentDecision) {
      await trx.insertInto('character_class_equipment_session').values({
        character_id: json_data.id,
        option: null,
        gold_option: classEquipmentDecision.gold?.goldOption ?? null,
        total_gold: classEquipmentDecision.gold?.totalGold ?? null,
        applied: classEquipmentDecision.applied ?? null
      })
        .execute()

      await insertRows(trx, 'character_class_equipment_groups', (classEquipmentDecision.groups ?? []).map((group) => ({
        character_id: json_data.id,
        group_id: group.groupId,
        option_id: group.optionId
      })))

      await insertRows(trx, 'character_class_equipment_items', (classEquipmentDecision.groups ?? []).flatMap((group) => (group.selections ?? []).map((selection) => ({
        character_id: json_data.id,
        group_id: group.groupId,
        selection_item_id: selection.selectionKey,
        equipment_id: selection.equipmentId,
        quantity: selection.quantity
      }))))
    }

    const backgroundEquipmentDecision = json_data.intent.startingEquipment?.background

    if (backgroundEquipmentDecision) {
      await trx.insertInto('character_background_equipment_session').values({
        character_id: json_data.id,
        applied: backgroundEquipmentDecision.applied ?? null
      })
        .execute()

      await insertRows(trx, 'character_background_equipment_groups', (backgroundEquipmentDecision.groups ?? []).map((group) => ({
        character_id: json_data.id,
        group_id: group.groupId,
        option_id: group.optionId
      })))

      await insertRows(trx, 'character_background_equipment_items', (backgroundEquipmentDecision.groups ?? []).flatMap((group) => (group.selections ?? []).map((selection) => ({
        character_id: json_data.id,
        group_id: group.groupId,
        selection_item_id: selection.selectionKey,
        equipment_id: selection.equipmentId,
        quantity: selection.quantity
      }))))
    }

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
