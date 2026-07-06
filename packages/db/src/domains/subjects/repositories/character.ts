import type { DBLike, Json } from '#types'
import { sql } from 'kysely'
import {
  ADVANCEMENT_METHOD_CODE,
  CHARACTER_ABILITY_GENERATION_METHOD,
  CharacterStartingEquipmentSource,
  type CharacterAuthored,
  type CharacterAbilityScoresIntent,
  type CharacterFeatureSelectionValue,
  type CharacterProfileAuthored
} from '@artificer-toolkit/shared'
import { upsertCharacter } from '../upserts/character.js'
import { hydrateSubjectStatus } from '../status.js'

export interface CharacterRow {
  id: string
  system_id: string
  user_id: string
  label: string
  description: string | null
  status: string
  build_state: Json | null
  stream_version: number
  created_at: string
  updated_at: string
}

export interface CharacterRepository {
  create(params: {
    id: string
    systemId: string
    userId: string
    label: string
    buildState: Json
  }): Promise<void>
  findById(id: string): Promise<CharacterRow | null>
  findUpdatedAtById(id: string): Promise<string | null>
  findUpdatedAtByIdForUpdate(id: string): Promise<string | null>
  findAuthoredById(id: string): Promise<CharacterAuthored | null>
  upsertAuthored(character: CharacterAuthored, options?: {
    expectedStreamVersion?: number
    incrementStreamVersion?: boolean
    afterPersist?: (trx: DBLike, nextStreamVersion: number) => Promise<void>
  }): Promise<number>
  updateBuildState(params: {
    id: string
    buildState: Json
    expectedVersion: number
  }): Promise<void>
  listByUser(userId: string): Promise<Pick<CharacterRow, 'id' | 'label' | 'system_id' | 'stream_version' | 'status'>[]>
}

export class ConcurrencyError extends Error {
  constructor(characterId: string, expected: number) {
    super(`Character "${characterId}" stream_version conflict: expected ${expected}.`)
    this.name = 'ConcurrencyError'
  }
}

type CharacterSourceRow = Record<string, unknown>
type StandardArrayAbilityIntent = Extract<
  CharacterAbilityScoresIntent,
  { method: typeof CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY }
>
type PointBuyAbilityIntent = Extract<
  CharacterAbilityScoresIntent,
  { method: typeof CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY }
>
type ManualRolledAbilityIntent = Extract<
  CharacterAbilityScoresIntent,
  { method: typeof CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED }
>
type CharacterAncestrySelection = NonNullable<CharacterAuthored['intent']['ancestrySelections']>[number]

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function hydrateProfile(row: CharacterSourceRow | undefined): CharacterProfileAuthored {
  if (!row) return {}

  return {
    alignmentId: optionalText(row.alignment_id),
    lifestyleId: optionalText(row.lifestyle_id),
    faith: optionalText(row.faith),
    gender: optionalText(row.gender),
    age: optionalText(row.age),
    eyes: optionalText(row.eyes),
    hair: optionalText(row.hair),
    skin: optionalText(row.skin),
    height: optionalText(row.height),
    weight: optionalText(row.weight),
    physicalCharacteristics: optionalText(row.physical_characteristics),
    personalityTraits: optionalText(row.personality_traits),
    ideals: optionalText(row.ideals),
    bonds: optionalText(row.bonds),
    flaws: optionalText(row.flaws),
    organizations: optionalText(row.organizations),
    allies: optionalText(row.allies),
    enemies: optionalText(row.enemies),
    backstory: optionalText(row.backstory),
    notes: optionalText(row.notes)
  }
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new Error(message)
  return row
}

function hydrateTiming(row: CharacterSourceRow) {
  switch (row.timing_kind) {
    case 'IMMEDIATE':
      return { kind: 'IMMEDIATE' } as const
    case 'CHARACTER_LEVEL':
      return {
        kind: 'CHARACTER_LEVEL',
        level: Number(row.timing_level)
      } as const
    case 'CLASS_LEVEL':
      return {
        kind: 'CLASS_LEVEL',
        classId: String(row.timing_class_id),
        classLevel: Number(row.timing_class_level)
      } as const
    default:
      throw new Error(`Unsupported character timing kind: ${String(row.timing_kind)}`)
  }
}

function hydrateFeatureSource(row: CharacterSourceRow): CharacterAuthored['intent']['featureAcquisitions'][number]['source'] {
  switch (row.source_kind) {
    case 'CLASS':
      return { kind: 'CLASS', classId: String(row.class_id) }
    case 'SUBCLASS':
      return { kind: 'SUBCLASS', subclassId: String(row.subclass_id) }
    case 'RACE':
      return { kind: 'RACE', raceId: String(row.race_id) }
    case 'SUBRACE':
      return { kind: 'SUBRACE', subraceId: String(row.subrace_id) }
    case 'ANCESTRY':
      return {
        kind: 'ANCESTRY',
        ancestryId: String(row.ancestry_id),
        optionId: String(row.option_id)
      }
    case 'BACKGROUND':
      return { kind: 'BACKGROUND', backgroundId: String(row.background_id) }
    case 'FEAT':
      return { kind: 'FEAT', featId: String(row.feat_id) }
    case 'FEATURE':
      return { kind: 'FEATURE', featureId: String(row.feature_id) }
    case 'OPTION':
      return {
        kind: 'OPTION',
        acquiredParentId: String(row.acquired_parent_id),
        optionId: String(row.option_id)
      }
    case 'MANUAL':
      return { kind: 'MANUAL', reason: optionalText(row.reason) }
    default:
      throw new Error(`Unsupported feature source kind: ${String(row.source_kind)}`)
  }
}

function hydrateSpellSelectionSource(
  row: CharacterSourceRow
): NonNullable<CharacterAuthored['intent']['spellSelections']>[number]['source'] {
  switch (row.source_kind) {
    case 'CLASS':
      return { kind: 'CLASS', classId: String(row.class_id) }
    case 'SUBCLASS':
      return { kind: 'SUBCLASS', subclassId: String(row.subclass_id) }
    case 'FEATURE':
      return { kind: 'FEATURE', featureId: String(row.feature_id) }
    case 'OPTION':
      return {
        kind: 'OPTION',
        acquiredParentId: String(row.acquired_parent_id),
        optionId: String(row.option_id)
      }
    default:
      throw new Error(`Unsupported spell selection source kind: ${String(row.source_kind)}`)
  }
}

function hydrateResourceGrantSource(
  row: CharacterSourceRow
): NonNullable<CharacterAuthored['intent']['resourceGrants']>[number]['source'] {
  switch (row.source_kind) {
    case 'CLASS':
      return { kind: 'CLASS', classId: String(row.class_id) }
    case 'SUBCLASS':
      return { kind: 'SUBCLASS', subclassId: String(row.subclass_id) }
    case 'FEATURE':
      return { kind: 'FEATURE', featureId: String(row.feature_id) }
    case 'OPTION':
      return {
        kind: 'OPTION',
        acquiredParentId: String(row.acquired_parent_id),
        optionId: String(row.option_id)
      }
    default:
      throw new Error(`Unsupported resource grant source kind: ${String(row.source_kind)}`)
  }
}

function parseSelectionValue(row: CharacterSourceRow): CharacterFeatureSelectionValue {
  switch (row.value_kind) {
    case 'ID':
      return { kind: 'ID', id: String(row.text_value) }
    case 'IDS':
      return { kind: 'IDS', ids: JSON.parse(String(row.text_value)) as string[] }
    case 'NUMBER':
      return { kind: 'NUMBER', value: Number(row.number_value) }
    case 'BOOLEAN':
      return { kind: 'BOOLEAN', value: Boolean(row.boolean_value) }
    default:
      throw new Error(`Unsupported character feature selection value kind: ${String(row.value_kind)}`)
  }
}

function hydrateAncestrySelectionSource(row: CharacterSourceRow): CharacterAncestrySelection['source'] {
  switch (row.source_kind) {
    case 'RACE':
      return { kind: 'RACE', raceId: String(row.race_id) }
    case 'SUBRACE':
      return { kind: 'SUBRACE', subraceId: String(row.subrace_id) }
    default:
      throw new Error(`Unsupported ancestry source kind: ${String(row.source_kind)}`)
  }
}

function hydrateAncestrySelectionTiming(
  row: CharacterSourceRow
): CharacterAncestrySelection['timing'] {
  switch (row.timing_kind) {
    case 'IMMEDIATE':
      return { kind: 'IMMEDIATE' }
    case 'CLASS_LEVEL':
      return {
        kind: 'CLASS_LEVEL',
        classId: String(row.class_id),
        classLevel: Number(row.class_level)
      }
    default:
      throw new Error(`Unsupported ancestry timing kind: ${String(row.timing_kind)}`)
  }
}

async function hydrateCharacterAuthoredById(
  db: DBLike,
  id: string
): Promise<CharacterAuthored | null> {
  const row = await db
    .selectFrom('characters')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst() as CharacterRow | undefined

  if (!row) return null
  if (!row.user_id) {
    throw new Error(`Character "${id}" is missing user_id and cannot be hydrated.`)
  }

  const [
    profileRow,
    advancementRow,
    raceRow,
    backgroundRow,
    ancestryRows,
    classRows,
    hitpointIntentRow,
    hitpointLevelRows,
    hitpointLevelRollRows,
    hitpointStateRow,
    hitDieRows,
    spellSlotRows,
    conditionRows,
    exhaustionRow,
    abilityRow,
    standardArrayRows,
    pointBuyRows,
    manualRolledRow,
    manualRolledGroupRows,
    manualRolledRollRows,
    manualAssignmentRows,
    featureRows,
    spellSelectionRows,
    resourceGrantRows,
    resourceUsageRows,
    classSpellRows,
    equipmentRows,
    equippedRows,
    attunedRows,
    currencyGroupRows,
    creatureRows,
    vehicleRows,
    creatureEquipmentRows,
    vehicleEquipmentRows,
    classEquipmentSessionRow,
    classEquipmentGroupRows,
    classEquipmentItemRows,
    backgroundEquipmentSessionRow,
    backgroundEquipmentGroupRows,
    backgroundEquipmentItemRows
  ] = await Promise.all([
    db.selectFrom('character_profile').selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('character_advancement').selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('character_race').selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('character_background').selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('character_ancestry_acquisitions').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_classes').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_hitpoint_intent').selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('character_hitpoint_levels').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_hitpoint_level_rolls').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_hitpoint_state').selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('character_hit_dice_state').selectAll()
      .where('character_id', '=', id)
      .execute(),
    sql<CharacterSourceRow>`select * from character_spell_slot_state where character_id = ${id}`.execute(db).then((result) => result.rows),
    sql<CharacterSourceRow>`select * from character_conditions where character_id = ${id}`.execute(db).then((result) => result.rows),
    sql<CharacterSourceRow>`select * from character_exhaustion where character_id = ${id}`.execute(db).then((result) => result.rows[0]),
    db.selectFrom('character_abilities').selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('character_abilities_standard_array').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_abilities_point_buy_distributed').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_abilities_manual_rolled').selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('character_abilities_manual_rolled_groups').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_abilities_manual_rolled_rolls').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_abilities_manual_assignments').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_feature_acquisitions').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_spell_selections').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_resource_grants').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_resources').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_class_spells').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_equipment').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_equipped').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_attuned').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_currency_groups').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_creatures').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_vehicles').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_creature_equipment').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_vehicle_equipment').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_class_equipment_session').selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('character_class_equipment_groups').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_class_equipment_items').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_background_equipment_session').selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('character_background_equipment_groups').selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_background_equipment_items').selectAll()
      .where('character_id', '=', id)
      .execute()
  ])

  const featureIds = featureRows.map((featureRow) => String(featureRow.id))
  const spellSelectionIds = spellSelectionRows.map((selectionRow) => String(selectionRow.id))

  const [
    featureSelectionRowsActual,
    featureSelectionValueRowsActual,
    spellSelectionSpellRowsActual,
    currencyRows
  ] = await Promise.all([
    featureIds.length > 0
      ? db.selectFrom('character_feature_selection_records').selectAll()
          .where('feature_acquisition_id', 'in', featureIds)
          .execute()
      : Promise.resolve([]),
    featureIds.length > 0
      ? db.selectFrom('character_feature_selection_values').selectAll()
          .where('feature_acquisition_id', 'in', featureIds)
          .execute()
      : Promise.resolve([]),
    spellSelectionIds.length > 0
      ? db.selectFrom('character_spell_selection_spells').selectAll()
          .where('selection_id', 'in', spellSelectionIds)
          .execute()
      : Promise.resolve([]),
    currencyGroupRows.length > 0
      ? db.selectFrom('character_currencies').selectAll()
          .where('group_id', 'in', currencyGroupRows.map((groupRow) => String(groupRow.id)))
          .execute()
      : Promise.resolve([])
  ])

  const advancementData = requireRow(advancementRow, `Character "${id}" is missing advancement intent.`) as CharacterSourceRow
  const raceData = requireRow(raceRow, `Character "${id}" is missing race intent.`) as CharacterSourceRow
  const backgroundData = requireRow(backgroundRow, `Character "${id}" is missing background intent.`) as CharacterSourceRow
  const hitpointIntentData = requireRow(hitpointIntentRow, `Character "${id}" is missing hitpoint intent.`) as CharacterSourceRow
  const hitpointStateData = requireRow(hitpointStateRow, `Character "${id}" is missing hitpoint state.`) as CharacterSourceRow
  const abilityData = requireRow(abilityRow, `Character "${id}" is missing ability generation intent.`) as CharacterSourceRow

  const hitpointLevels = hitpointLevelRows
    .map((levelRow) => {
      const levelNumber = Number(levelRow.char_level)
      return {
        level: levelNumber,
        value: Number(levelRow.value),
        rolls: hitpointLevelRollRows
          .filter((rollRow) => Number(rollRow.char_level) === levelNumber)
          .map((rollRow) => ({ die: Number(rollRow.die), value: Number(rollRow.value) })),
        overridden: levelRow.overridden == null ? undefined : Boolean(levelRow.overridden)
      }
    })

  const abilities: CharacterAuthored['intent']['abilities'] = (() => {
    switch (abilityData.method_code) {
      case CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY:
        return {
          method: CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY,
          assignments: standardArrayRows.map((assignmentRow) => ({
            ability: String(assignmentRow.ability_code) as StandardArrayAbilityIntent['assignments'][number]['ability'],
            option: String(assignmentRow.option_code) as StandardArrayAbilityIntent['assignments'][number]['option']
          }))
        }
      case CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY:
        return {
          method: CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY,
          assignments: pointBuyRows.map((assignmentRow) => ({
            ability: String(assignmentRow.ability_code) as PointBuyAbilityIntent['assignments'][number]['ability'],
            option: String(assignmentRow.option_code) as PointBuyAbilityIntent['assignments'][number]['option']
          }))
        }
      case CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED:
        return {
          method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
          state: {
            configuration: manualRolledRow ? optionalText((manualRolledRow as CharacterSourceRow).configuration) : undefined,
            rollGroups: manualRolledGroupRows.map((groupRow) => {
              const groupIndex = Number(groupRow.group_index)
              const rolls = manualRolledRollRows
                .filter((rollRow) => Number(rollRow.group_index) === groupIndex)
                .sort((left, right) => Number(left.roll_index) - Number(right.roll_index))
                .map((rollRow) => ({ die: Number(rollRow.die), value: Number(rollRow.value) }))
              const kept = manualRolledRollRows
                .filter((rollRow) => Number(rollRow.group_index) === groupIndex && Boolean(rollRow.is_kept))
                .sort((left, right) => Number(left.roll_index) - Number(right.roll_index))
                .map((rollRow) => ({ die: Number(rollRow.die), value: Number(rollRow.value) }))

              return {
                id: String(groupRow.id),
                rolls,
                kept,
                assignedAbility: optionalText(groupRow.assigned_ability_code) as NonNullable<ManualRolledAbilityIntent['state']['rollGroups']>[number]['assignedAbility'],
                score: Number(groupRow.score),
                applied: groupRow.applied == null ? undefined : Boolean(groupRow.applied),
                rolling: groupRow.rolling == null ? undefined : Boolean(groupRow.rolling)
              }
            }),
            assignments: manualAssignmentRows.map((assignmentRow) => ({
              ability: String(assignmentRow.ability_code) as ManualRolledAbilityIntent['state']['assignments'][number]['ability'],
              score: Number(assignmentRow.score)
            }))
          }
        }
      default:
        throw new Error(`Unsupported character ability method: ${String(abilityData.method_code)}`)
    }
  })()

  const featureAcquisitions = featureRows.map((featureRow) => {
    const selectionRows = featureSelectionRowsActual
      .filter((selectionRow) => selectionRow.feature_acquisition_id === featureRow.id)

    const selections = selectionRows.length > 0
      ? selectionRows.map((selectionRow) => ({
          selectionKey: String(selectionRow.selection_key),
          values: featureSelectionValueRowsActual
            .filter((valueRow) => valueRow.feature_acquisition_id === featureRow.id && valueRow.selection_key === selectionRow.selection_key)
            .sort((left, right) => Number(left.value_index) - Number(right.value_index))
            .map(parseSelectionValue)
        }))
      : undefined

    return {
      id: String(featureRow.id),
      featureId: String(featureRow.feature_id),
      source: hydrateFeatureSource(featureRow as CharacterSourceRow),
      timing: hydrateTiming(featureRow as CharacterSourceRow),
      selections
    }
  })

  const spellSelections = spellSelectionRows.length > 0
    ? spellSelectionRows.map((selectionRow) => ({
        id: String(selectionRow.id),
        source: hydrateSpellSelectionSource(selectionRow as CharacterSourceRow),
        timing: hydrateTiming(selectionRow as CharacterSourceRow),
        spells: spellSelectionSpellRowsActual
          .filter((spellRow) => spellRow.selection_id === selectionRow.id)
          .map((spellRow) => String(spellRow.spell_id)),
        replacedSelectionId: optionalText(selectionRow.replaced_selection_id)
      }))
    : undefined

  const resourceGrants = resourceGrantRows.length > 0
    ? resourceGrantRows.map((resourceGrantRow) => ({
        id: String(resourceGrantRow.id),
        resourceId: String(resourceGrantRow.resource_id),
        source: hydrateResourceGrantSource(resourceGrantRow as CharacterSourceRow),
        timing: hydrateTiming(resourceGrantRow as CharacterSourceRow)
      }))
    : undefined

  const classEquipmentDecision = classEquipmentSessionRow
    ? {
        source: CharacterStartingEquipmentSource.CLASS,
        tookGold: Boolean((classEquipmentSessionRow as CharacterSourceRow).gold_option),
        groups: classEquipmentGroupRows.length > 0
          ? classEquipmentGroupRows.map((groupRow) => ({
              groupId: String(groupRow.group_id),
              optionId: String(groupRow.option_id),
              selections: classEquipmentItemRows
                .filter((itemRow) => itemRow.group_id === groupRow.group_id)
                .map((itemRow) => ({
                  selectionKey: String(itemRow.selection_item_id ?? itemRow.equipment_id),
                  equipmentId: String(itemRow.equipment_id),
                  quantity: Number(itemRow.quantity)
                }))
            }))
          : undefined,
        gold: (classEquipmentSessionRow as CharacterSourceRow).gold_option
          ? {
              goldOption: String((classEquipmentSessionRow as CharacterSourceRow).gold_option),
              totalGold: Number((classEquipmentSessionRow as CharacterSourceRow).total_gold)
            }
          : undefined,
        applied: (classEquipmentSessionRow as CharacterSourceRow).applied == null
          ? undefined
          : Boolean((classEquipmentSessionRow as CharacterSourceRow).applied)
      }
    : undefined

  const backgroundEquipmentDecision = backgroundEquipmentSessionRow
    ? {
        source: CharacterStartingEquipmentSource.BACKGROUND,
        tookGold: false,
        groups: backgroundEquipmentGroupRows.length > 0
          ? backgroundEquipmentGroupRows.map((groupRow) => ({
              groupId: String(groupRow.group_id),
              optionId: String(groupRow.option_id),
              selections: backgroundEquipmentItemRows
                .filter((itemRow) => itemRow.group_id === groupRow.group_id)
                .map((itemRow) => ({
                  selectionKey: String(itemRow.selection_item_id ?? itemRow.equipment_id),
                  equipmentId: String(itemRow.equipment_id),
                  quantity: Number(itemRow.quantity)
                }))
            }))
          : undefined,
        applied: (backgroundEquipmentSessionRow as CharacterSourceRow).applied == null
          ? undefined
          : Boolean((backgroundEquipmentSessionRow as CharacterSourceRow).applied)
      }
    : undefined

  const classStateMap = new Map<string, { learned?: string[], prepared?: string[] }>()
  for (const spellRow of classSpellRows) {
    const classId = String(spellRow.class_id)
    const existing = classStateMap.get(classId) ?? {}
    if (spellRow.state === 'KNOWN') {
      existing.learned = [...(existing.learned ?? []), String(spellRow.spell_id)]
    }
    if (spellRow.state === 'PREPARED') {
      existing.prepared = [...(existing.prepared ?? []), String(spellRow.spell_id)]
    }
    classStateMap.set(classId, existing)
  }

  const classesState = classStateMap.size > 0
    ? [...classStateMap.entries()].map(([classId, spells]) => ({ classId, spells }))
    : undefined

  const creatureEquipment = creatureEquipmentRows.reduce<Record<string, { equipmentItemId: string }[]>>((acc, assignmentRow) => {
    const creatureId = String(assignmentRow.character_creature_id)
    acc[creatureId] = [...(acc[creatureId] ?? []), { equipmentItemId: String(assignmentRow.equipment_id) }]
    return acc
  }, {})

  const vehicleEquipment = vehicleEquipmentRows.reduce<Record<string, { equipmentItemId: string }[]>>((acc, assignmentRow) => {
    const vehicleId = String(assignmentRow.character_vehicle_id)
    acc[vehicleId] = [...(acc[vehicleId] ?? []), { equipmentItemId: String(assignmentRow.equipment_id) }]
    return acc
  }, {})

  return {
    id: row.id,
    label: row.label,
    description: row.description ?? undefined,
    status: hydrateSubjectStatus(row.status),
    profile: hydrateProfile(profileRow as CharacterSourceRow | undefined),
    intent: {
      advancement: advancementData.method_code === ADVANCEMENT_METHOD_CODE.EXPERIENCE
        ? {
            method: ADVANCEMENT_METHOD_CODE.EXPERIENCE,
            experience: advancementData.experience == null ? undefined : Number(advancementData.experience)
          }
        : { method: ADVANCEMENT_METHOD_CODE.MILESTONE },
      race: {
        raceId: String(raceData.race_id),
        subraceId: optionalText(raceData.subrace_id)
      },
      ancestrySelections: ancestryRows.length > 0
        ? ancestryRows.map((ancestryRow) => ({
            id: String(ancestryRow.id),
            ancestryId: String(ancestryRow.ancestry_id),
            optionId: String(ancestryRow.option_id),
            source: hydrateAncestrySelectionSource(ancestryRow),
            timing: hydrateAncestrySelectionTiming(ancestryRow)
          }))
        : undefined,
      background: {
        backgroundId: String(backgroundData.background_id)
      },
      classes: classRows.map((classRow) => ({
        classId: String(classRow.class_id),
        classLevel: Number(classRow.class_level),
        subclassId: optionalText(classRow.subclass_id),
        specializationId: optionalText(classRow.specialization_id)
      })),
      abilities,
      hitpoints: {
        method: String(hitpointIntentData.method_code) as CharacterAuthored['intent']['hitpoints']['method'],
        levels: hitpointLevels
      },
      startingEquipment: classEquipmentDecision || backgroundEquipmentDecision
        ? {
            class: classEquipmentDecision,
            background: backgroundEquipmentDecision
          }
        : undefined,
      featureAcquisitions,
      spellSelections,
      resourceGrants
    },
    state: {
      equipment: {
        inventory: equipmentRows.map((equipmentRow) => ({
          id: String(equipmentRow.id),
          equipmentId: String(equipmentRow.equipment_id),
          quantity: Number(equipmentRow.quantity),
          containerId: optionalText(equipmentRow.container_id),
          customName: optionalText(equipmentRow.custom_name),
          notes: optionalText(equipmentRow.notes)
        })),
        equipped: equippedRows.map((equippedRow) => String(equippedRow.equipment_id)),
        attuned: attunedRows.map((attunedRow) => String(attunedRow.equipment_id))
      },
      currency: currencyGroupRows.map((groupRow) => ({
        containerId: optionalText(groupRow.container_id),
        currencies: currencyRows
          .filter((currencyRow) => currencyRow.group_id === groupRow.id)
          .map((currencyRow) => ({
            currencyId: String(currencyRow.currency_id),
            amount: Number(currencyRow.amount)
          }))
      })),
      hitpoints: {
        current: Number(hitpointStateData.current),
        temp: hitpointStateData.temp == null ? undefined : Number(hitpointStateData.temp),
        hitDice: hitDieRows.map((hitDieRow) => ({
          die: Number(hitDieRow.die),
          total: Number(hitDieRow.total),
          used: Number(hitDieRow.used)
        })),
        maxOverride: hitpointStateData.max_override == null ? undefined : Number(hitpointStateData.max_override)
      },
      classes: classesState,
      resources: resourceUsageRows.length > 0
        ? resourceUsageRows.map((resourceRow) => ({
            resourceGrantId: String(resourceRow.resource_grant_id),
            used: Number(resourceRow.used)
          }))
        : undefined,
      spellSlots: spellSlotRows.length > 0
        ? spellSlotRows.map((slotRow) => ({
            slotKey: String((slotRow as CharacterSourceRow).slot_key),
            used: Number((slotRow as CharacterSourceRow).used)
          }))
        : undefined,
      conditions: conditionRows.length > 0
        ? conditionRows.map((conditionRow) => ({
            conditionTypeId: String((conditionRow as CharacterSourceRow).condition_type_id),
            notes: optionalText((conditionRow as CharacterSourceRow).notes)
          }))
        : undefined,
      exhaustion: exhaustionRow && Number((exhaustionRow as CharacterSourceRow).level) > 0
        ? {
            level: Number((exhaustionRow as CharacterSourceRow).level),
            notes: optionalText((exhaustionRow as CharacterSourceRow).notes)
          }
        : undefined,
      creatures: creatureRows.length > 0
        ? creatureRows.map((creatureRow) => ({
            id: String(creatureRow.id),
            creatureId: String(creatureRow.creature_id),
            relationshipKind: String(creatureRow.relationship_kind) as NonNullable<CharacterAuthored['state']['creatures']>[number]['relationshipKind'],
            customName: optionalText(creatureRow.custom_name),
            notes: optionalText(creatureRow.notes),
            isActive: creatureRow.is_active == null ? undefined : Boolean(creatureRow.is_active)
          }))
        : undefined,
      vehicles: vehicleRows.length > 0
        ? vehicleRows.map((vehicleRow) => ({
            id: String(vehicleRow.id),
            vehicleId: String(vehicleRow.vehicle_id),
            customName: optionalText(vehicleRow.custom_name),
            notes: optionalText(vehicleRow.notes),
            isActive: vehicleRow.is_active == null ? undefined : Boolean(vehicleRow.is_active)
          }))
        : undefined,
      creatureEquipment: Object.keys(creatureEquipment).length > 0 ? creatureEquipment : undefined,
      vehicleEquipment: Object.keys(vehicleEquipment).length > 0 ? vehicleEquipment : undefined
    },
    systemId: row.system_id,
    userId: row.user_id
  }
}

export function createCharacterRepository(db: DBLike): CharacterRepository {
  return {
    async create({ id, systemId, userId, label, buildState }) {
      await db
        .insertInto('characters')
        .values({
          id,
          system_id: systemId,
          user_id: userId,
          label,
          status: 'DRAFT',
          build_state: buildState as Json,
          stream_version: 1
        })
        .execute()
    },

    async findById(id) {
      const row = await db
        .selectFrom('characters')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst() as CharacterRow | undefined

      return row ?? null
    },

    async findUpdatedAtById(id) {
      const row = await db
        .selectFrom('characters')
        .select(sql<string>`updated_at::text`.as('updated_at'))
        .where('id', '=', id)
        .executeTakeFirst() as Pick<CharacterRow, 'updated_at'> | undefined

      return row?.updated_at ?? null
    },

    async findUpdatedAtByIdForUpdate(id) {
      const result = await sql<Pick<CharacterRow, 'updated_at'>>`
        select updated_at::text as updated_at
        from characters
        where id = ${id}
        for update
      `.execute(db)

      return result.rows[0]?.updated_at ?? null
    },

    async findAuthoredById(id) {
      return hydrateCharacterAuthoredById(db, id)
    },

    async upsertAuthored(character, options) {
      return upsertCharacter(db, character, options)
    },

    async updateBuildState({ id, buildState, expectedVersion }) {
      const result = await db
        .updateTable('characters')
        .set({
          build_state: buildState as Json,
          stream_version: expectedVersion + 1,
          updated_at: new Date().toISOString()
        })
        .where('id', '=', id)
        .where('stream_version', '=', expectedVersion)
        .executeTakeFirst()

      const updated = typeof result?.numUpdatedRows === 'bigint'
        ? result.numUpdatedRows
        : BigInt(result?.numUpdatedRows ?? 0)

      if (updated === 0n) {
        throw new ConcurrencyError(id, expectedVersion)
      }
    },

    async listByUser(userId) {
      const rows = await db
        .selectFrom('characters')
        .select([
          'id', 'label', 'system_id', 'stream_version', 'status'
        ])
        .where('user_id', '=', userId)
        .orderBy('updated_at', 'desc')
        .execute() as Pick<CharacterRow, 'id' | 'label' | 'system_id' | 'stream_version' | 'status'>[]

      return rows
    }
  }
}
