import type { DBLike } from '#types'
import type { CharacterAuthored } from '@artificer-toolkit/shared'
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

export function serializeSelectionValue(value: CharacterFeatureSelectionValue) {
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

export function mapTiming(
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

export function mapFeatureSource(
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

export function mapSpellSelectionSource(
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

export function mapResourceGrantSource(
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

export function sortByDependency<T>(
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

export function countRolls(rolls: Array<{ die: number, value: number }>) {
  const counts = new Map<string, number>()

  for (const roll of rolls) {
    const key = `${roll.die}:${roll.value}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return counts
}

export async function insertRows(db: DBLike, table: string, rows: RowLike[]) {
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

export async function deleteExistingCharacterChildren(db: DBLike, characterId: string) {
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
  await db.deleteFrom('character_creature_equipment').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_vehicle_equipment').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_creatures').where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_vehicles').where('character_id', '=', characterId)
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
  await db.deleteFrom('character_profile').where('character_id', '=', characterId)
    .execute()
}
