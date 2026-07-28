import type { DBLike } from '#types'
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
import { insertRows, sortByDependency } from '../upserts/character.helpers.js'
import { hydrateSubjectStatus } from '../status.js'
import { withTransaction } from '../../../utils/index.js'

export interface CharacterRow {
  id: string
  system_id: string
  user_id: string
  label: string
  description: string | null
  status: string
  inspiration: boolean
  stream_version: number
  created_at: string
  updated_at: string
}

export interface CharacterRepository {
  findById(id: string): Promise<CharacterRow | null>
  findUpdatedAtById(id: string): Promise<string | null>
  findUpdatedAtByIdForUpdate(id: string): Promise<string | null>
  findAuthoredById(id: string): Promise<CharacterAuthored | null>
  upsertAuthored(
    character: CharacterAuthored,
    options?: {
      expectedStreamVersion?: number
      incrementStreamVersion?: boolean
      afterPersist?: (trx: DBLike, nextStreamVersion: number) => Promise<void>
    }
  ): Promise<number>
  patchSheetState(
    characterId: string,
    patches: CharacterSheetStatePatch[],
    options: {
      expectedStreamVersion: number
      afterPersist?: (trx: DBLike, nextStreamVersion: number) => Promise<void>
    }
  ): Promise<number>
  listByUser(
    userId: string
  ): Promise<Pick<CharacterRow, 'id' | 'label' | 'system_id' | 'stream_version' | 'status'>[]>
}

type CharacterState = CharacterAuthored['state']

/**
 * Internal persistence contract for Sheet-owned play state. Builder writes continue
 * to replace the authored aggregate through upsertAuthored.
 */
export type CharacterSheetStatePatch =
  | { kind: 'INSPIRATION'; value: CharacterState['inspiration'] }
  | { kind: 'HITPOINTS'; value: CharacterState['hitpoints'] }
  | { kind: 'RESOURCES'; value: CharacterState['resources'] }
  | { kind: 'SPELL_SLOTS'; value: CharacterState['spellSlots'] }
  | { kind: 'CLASS_SPELLS'; value: CharacterState['classes'] }
  | { kind: 'CONDITIONS'; value: CharacterState['conditions'] }
  | { kind: 'EXHAUSTION'; value: CharacterState['exhaustion'] }
  | {
      kind: 'EQUIPMENT'
      value: CharacterState['equipment']
      creatureEquipment: CharacterState['creatureEquipment']
      vehicleEquipment: CharacterState['vehicleEquipment']
    }
  | {
      kind: 'EXTRAS'
      creatures: NonNullable<CharacterState['creatures']>
      vehicles: NonNullable<CharacterState['vehicles']>
      creatureEquipment: NonNullable<CharacterState['creatureEquipment']>
      vehicleEquipment: NonNullable<CharacterState['vehicleEquipment']>
    }
  | { kind: 'CURRENCY'; value: CharacterState['currency'] }
  | {
      kind: 'NOTES'
      groups: CharacterState['noteGroups']
      notes: CharacterState['notes']
    }

export class ConcurrencyError extends Error {
  constructor(characterId: string, expected: number) {
    super(`Character "${characterId}" stream_version conflict: expected ${expected}.`)
    this.name = 'ConcurrencyError'
  }
}

type CharacterSourceRow = Record<string, unknown>
type DeleteCharacterRowsDb = {
  deleteFrom: (table: string) => {
    where: (
      column: 'character_id',
      op: '=',
      value: string
    ) => {
      execute: () => Promise<unknown>
    }
  }
}
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
type CharacterAncestrySelection = NonNullable<
  CharacterAuthored['intent']['ancestrySelections']
>[number]
type CharacterChosenGrantSelection = NonNullable<
  CharacterAuthored['intent']['chosenGrantSelections']
>[number]

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function isoTimestamp(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value)
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

function hydrateFeatureSource(
  row: CharacterSourceRow
): CharacterAuthored['intent']['featureAcquisitions'][number]['source'] {
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

function hydrateChosenGrantSelectionSource(
  row: CharacterSourceRow
): CharacterChosenGrantSelection['source'] {
  switch (row.source_kind) {
    case 'CLASS':
      return {
        kind: 'CLASS',
        classId: String(row.class_id),
        classLevel: row.source_class_level == null ? undefined : Number(row.source_class_level)
      }
    case 'SUBCLASS':
      return {
        kind: 'SUBCLASS',
        subclassId: String(row.subclass_id),
        classLevel: row.source_class_level == null ? undefined : Number(row.source_class_level)
      }
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
      throw new Error(`Unsupported chosen grant selection source kind: ${String(row.source_kind)}`)
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
      throw new Error(
        `Unsupported character feature selection value kind: ${String(row.value_kind)}`
      )
  }
}

function hydrateAncestrySelectionSource(
  row: CharacterSourceRow
): CharacterAncestrySelection['source'] {
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
  const row = (await db
    .selectFrom('characters')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()) as CharacterRow | undefined

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
    noteGroupRows,
    noteRows,
    abilityRow,
    standardArrayRows,
    pointBuyRows,
    manualRolledRow,
    manualRolledGroupRows,
    manualRolledRollRows,
    manualAssignmentRows,
    featureRows,
    chosenGrantSelectionRows,
    spellSelectionRows,
    resourceGrantRows,
    resourceUsageRows,
    classSpellRows,
    equipmentRows,
    equippedRows,
    attunedRows,
    currencyGroupRows,
    currencyRows,
    creatureRows,
    vehicleRows,
    creatureHitDiceRows,
    creatureEquipmentRows,
    vehicleEquipmentRows,
    classEquipmentSessionRow,
    classEquipmentGroupRows,
    classEquipmentItemRows,
    backgroundEquipmentSessionRow,
    backgroundEquipmentGroupRows,
    backgroundEquipmentItemRows
  ] = await Promise.all([
    db
      .selectFrom('character_profile')
      .selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db
      .selectFrom('character_advancement')
      .selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('character_race').selectAll().where('character_id', '=', id).executeTakeFirst(),
    db
      .selectFrom('character_background')
      .selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db
      .selectFrom('character_ancestry_acquisitions')
      .selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_classes').selectAll().where('character_id', '=', id).execute(),
    db
      .selectFrom('character_hitpoint_intent')
      .selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db
      .selectFrom('character_hitpoint_levels')
      .selectAll()
      .where('character_id', '=', id)
      .orderBy('char_level')
      .execute(),
    db
      .selectFrom('character_hitpoint_level_rolls')
      .selectAll()
      .where('character_id', '=', id)
      .execute(),
    db
      .selectFrom('character_hitpoint_state')
      .selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('character_hit_dice_state').selectAll().where('character_id', '=', id).execute(),
    sql<CharacterSourceRow>`select * from character_spell_slot_state where character_id = ${id}`
      .execute(db)
      .then((result) => result.rows),
    sql<CharacterSourceRow>`select * from character_conditions where character_id = ${id}`
      .execute(db)
      .then((result) => result.rows),
    sql<CharacterSourceRow>`select * from character_exhaustion where character_id = ${id}`
      .execute(db)
      .then((result) => result.rows[0]),
    db
      .selectFrom('character_note_groups')
      .selectAll()
      .where('character_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('character_notes')
      .selectAll()
      .where('character_id', '=', id)
      .orderBy('created_at')
      .execute(),
    db
      .selectFrom('character_abilities')
      .selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db
      .selectFrom('character_abilities_standard_array')
      .selectAll()
      .where('character_id', '=', id)
      .execute(),
    db
      .selectFrom('character_abilities_point_buy_distributed')
      .selectAll()
      .where('character_id', '=', id)
      .execute(),
    db
      .selectFrom('character_abilities_manual_rolled')
      .selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db
      .selectFrom('character_abilities_manual_rolled_groups')
      .selectAll()
      .where('character_id', '=', id)
      .execute(),
    db
      .selectFrom('character_abilities_manual_rolled_rolls')
      .selectAll()
      .where('character_id', '=', id)
      .execute(),
    db
      .selectFrom('character_abilities_manual_assignments')
      .selectAll()
      .where('character_id', '=', id)
      .execute(),
    db
      .selectFrom('character_feature_acquisitions')
      .selectAll()
      .where('character_id', '=', id)
      .execute(),
    db
      .selectFrom('character_chosen_grant_selections')
      .selectAll()
      .where('character_id', '=', id)
      .execute(),
    db
      .selectFrom('character_spell_selections')
      .selectAll()
      .where('character_id', '=', id)
      .execute(),
    db.selectFrom('character_resource_grants').selectAll().where('character_id', '=', id).execute(),
    db.selectFrom('character_resources').selectAll().where('character_id', '=', id).execute(),
    db.selectFrom('character_class_spells').selectAll().where('character_id', '=', id).execute(),
    db
      .selectFrom('character_equipment')
      .selectAll()
      .where('character_id', '=', id)
      .orderBy('created_at')
      .orderBy('id')
      .execute(),
    db.selectFrom('character_equipped').selectAll().where('character_id', '=', id).execute(),
    db.selectFrom('character_attuned').selectAll().where('character_id', '=', id).execute(),
    db.selectFrom('character_currency_groups').selectAll().where('character_id', '=', id).execute(),
    db.selectFrom('character_currencies').selectAll().where('character_id', '=', id).execute(),
    db.selectFrom('character_creatures').selectAll().where('character_id', '=', id).execute(),
    db.selectFrom('character_vehicles').selectAll().where('character_id', '=', id).execute(),
    db
      .selectFrom('character_creature_hit_dice_state')
      .selectAll()
      .where('character_id', '=', id)
      .execute(),
    db
      .selectFrom('character_creature_equipment')
      .selectAll()
      .where('character_id', '=', id)
      .execute(),
    db
      .selectFrom('character_vehicle_equipment')
      .selectAll()
      .where('character_id', '=', id)
      .execute(),
    db
      .selectFrom('character_class_equipment_session')
      .selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db
      .selectFrom('character_class_equipment_groups')
      .selectAll()
      .where('character_id', '=', id)
      .execute(),
    db
      .selectFrom('character_class_equipment_items')
      .selectAll()
      .where('character_id', '=', id)
      .execute(),
    db
      .selectFrom('character_background_equipment_session')
      .selectAll()
      .where('character_id', '=', id)
      .executeTakeFirst(),
    db
      .selectFrom('character_background_equipment_groups')
      .selectAll()
      .where('character_id', '=', id)
      .execute(),
    db
      .selectFrom('character_background_equipment_items')
      .selectAll()
      .where('character_id', '=', id)
      .execute()
  ])

  const chosenGrantSelectionIds = chosenGrantSelectionRows.map((selectionRow) =>
    String(selectionRow.id)
  )
  const featureIds = featureRows.map((featureRow) => String(featureRow.id))
  const spellSelectionIds = spellSelectionRows.map((selectionRow) => String(selectionRow.id))

  const [
    featureSelectionRowsActual,
    featureSelectionValueRowsActual,
    chosenGrantSelectionTargetRows,
    spellSelectionSpellRowsActual
  ] = await Promise.all([
    featureIds.length > 0
      ? db
          .selectFrom('character_feature_selection_records')
          .selectAll()
          .where('feature_acquisition_id', 'in', featureIds)
          .execute()
      : Promise.resolve([]),
    featureIds.length > 0
      ? db
          .selectFrom('character_feature_selection_values')
          .selectAll()
          .where('feature_acquisition_id', 'in', featureIds)
          .execute()
      : Promise.resolve([]),
    chosenGrantSelectionIds.length > 0
      ? db
          .selectFrom('character_chosen_grant_selection_targets')
          .selectAll()
          .where('selection_id', 'in', chosenGrantSelectionIds)
          .execute()
      : Promise.resolve([]),
    spellSelectionIds.length > 0
      ? db
          .selectFrom('character_spell_selection_spells')
          .selectAll()
          .where('selection_id', 'in', spellSelectionIds)
          .execute()
      : Promise.resolve([])
  ])

  const advancementData = requireRow(
    advancementRow,
    `Character "${id}" is missing advancement intent.`
  ) as CharacterSourceRow
  const raceData = requireRow(
    raceRow,
    `Character "${id}" is missing race intent.`
  ) as CharacterSourceRow
  const backgroundData = requireRow(
    backgroundRow,
    `Character "${id}" is missing background intent.`
  ) as CharacterSourceRow
  const hitpointIntentData = requireRow(
    hitpointIntentRow,
    `Character "${id}" is missing hitpoint intent.`
  ) as CharacterSourceRow
  const hitpointStateData = requireRow(
    hitpointStateRow,
    `Character "${id}" is missing hitpoint state.`
  ) as CharacterSourceRow
  const abilityData = requireRow(
    abilityRow,
    `Character "${id}" is missing ability generation intent.`
  ) as CharacterSourceRow

  const hitpointLevels = hitpointLevelRows.map((levelRow) => {
    const levelNumber = Number(levelRow.char_level)
    return {
      level: levelNumber,
      classId: String(levelRow.class_id),
      classLevel: Number(levelRow.class_level),
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
            ability: String(
              assignmentRow.ability_code
            ) as StandardArrayAbilityIntent['assignments'][number]['ability'],
            option: String(
              assignmentRow.option_code
            ) as StandardArrayAbilityIntent['assignments'][number]['option']
          }))
        }
      case CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY:
        return {
          method: CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY,
          assignments: pointBuyRows.map((assignmentRow) => ({
            ability: String(
              assignmentRow.ability_code
            ) as PointBuyAbilityIntent['assignments'][number]['ability'],
            option: String(
              assignmentRow.option_code
            ) as PointBuyAbilityIntent['assignments'][number]['option']
          }))
        }
      case CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED:
        return {
          method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
          state: {
            configuration: manualRolledRow
              ? optionalText((manualRolledRow as CharacterSourceRow).configuration)
              : undefined,
            rollGroups: manualRolledGroupRows.map((groupRow) => {
              const groupIndex = Number(groupRow.group_index)
              const rolls = manualRolledRollRows
                .filter((rollRow) => Number(rollRow.group_index) === groupIndex)
                .sort((left, right) => Number(left.roll_index) - Number(right.roll_index))
                .map((rollRow) => ({ die: Number(rollRow.die), value: Number(rollRow.value) }))
              const kept = manualRolledRollRows
                .filter(
                  (rollRow) =>
                    Number(rollRow.group_index) === groupIndex && Boolean(rollRow.is_kept)
                )
                .sort((left, right) => Number(left.roll_index) - Number(right.roll_index))
                .map((rollRow) => ({ die: Number(rollRow.die), value: Number(rollRow.value) }))

              return {
                id: String(groupRow.id),
                rolls,
                kept,
                assignedAbility: optionalText(groupRow.assigned_ability_code) as NonNullable<
                  ManualRolledAbilityIntent['state']['rollGroups']
                >[number]['assignedAbility'],
                score: Number(groupRow.score),
                applied: groupRow.applied == null ? undefined : Boolean(groupRow.applied),
                rolling: groupRow.rolling == null ? undefined : Boolean(groupRow.rolling)
              }
            }),
            assignments: manualAssignmentRows.map((assignmentRow) => ({
              ability: String(
                assignmentRow.ability_code
              ) as ManualRolledAbilityIntent['state']['assignments'][number]['ability'],
              score: Number(assignmentRow.score)
            }))
          }
        }
      default:
        throw new Error(`Unsupported character ability method: ${String(abilityData.method_code)}`)
    }
  })()

  const featureAcquisitions = featureRows.map((featureRow) => {
    const selectionRows = featureSelectionRowsActual.filter(
      (selectionRow) => selectionRow.feature_acquisition_id === featureRow.id
    )

    const selections =
      selectionRows.length > 0
        ? selectionRows.map((selectionRow) => ({
            selectionKey: String(selectionRow.selection_key),
            values: featureSelectionValueRowsActual
              .filter(
                (valueRow) =>
                  valueRow.feature_acquisition_id === featureRow.id &&
                  valueRow.selection_key === selectionRow.selection_key
              )
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

  const chosenGrantSelections =
    chosenGrantSelectionRows.length > 0
      ? chosenGrantSelectionRows.map((selectionRow) => ({
          id: String(selectionRow.id),
          grantId: String(selectionRow.grant_id),
          source: hydrateChosenGrantSelectionSource(selectionRow as CharacterSourceRow),
          timing: hydrateTiming(selectionRow as CharacterSourceRow),
          progressionLevel:
            selectionRow.progression_level == null
              ? undefined
              : Number(selectionRow.progression_level),
          targetIds: chosenGrantSelectionTargetRows
            .filter((targetRow) => targetRow.selection_id === selectionRow.id)
            .sort((left, right) => Number(left.slot_index) - Number(right.slot_index))
            .map((targetRow) => String(targetRow.target_id))
        }))
      : undefined

  const spellSelections =
    spellSelectionRows.length > 0
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

  const resourceGrants =
    resourceGrantRows.length > 0
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
        groups:
          classEquipmentGroupRows.length > 0
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
        applied:
          (classEquipmentSessionRow as CharacterSourceRow).applied == null
            ? undefined
            : Boolean((classEquipmentSessionRow as CharacterSourceRow).applied)
      }
    : undefined

  const backgroundEquipmentDecision = backgroundEquipmentSessionRow
    ? {
        source: CharacterStartingEquipmentSource.BACKGROUND,
        tookGold: false,
        groups:
          backgroundEquipmentGroupRows.length > 0
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
        applied:
          (backgroundEquipmentSessionRow as CharacterSourceRow).applied == null
            ? undefined
            : Boolean((backgroundEquipmentSessionRow as CharacterSourceRow).applied)
      }
    : undefined

  const classStateMap = new Map<string, { learned?: string[]; prepared?: string[] }>()
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

  const classesState =
    classStateMap.size > 0
      ? [...classStateMap.entries()].map(([classId, spells]) => ({ classId, spells }))
      : undefined

  const creatureEquipment = creatureEquipmentRows.reduce<
    Record<string, { equipmentItemId: string }[]>
  >((acc, assignmentRow) => {
    const creatureId = String(assignmentRow.character_creature_id)
    acc[creatureId] = [
      ...(acc[creatureId] ?? []),
      { equipmentItemId: String(assignmentRow.equipment_id) }
    ]
    return acc
  }, {})

  const creatureHitDice = creatureHitDiceRows.reduce<
    Record<string, { die: number; total: number; used: number }[]>
  >((acc, hitDieRow) => {
    const creatureId = String(hitDieRow.character_creature_id)
    acc[creatureId] = [
      ...(acc[creatureId] ?? []),
      {
        die: Number(hitDieRow.die),
        total: Number(hitDieRow.total),
        used: Number(hitDieRow.used)
      }
    ]
    return acc
  }, {})

  const vehicleEquipment = vehicleEquipmentRows.reduce<
    Record<string, { equipmentItemId: string }[]>
  >((acc, assignmentRow) => {
    const vehicleId = String(assignmentRow.character_vehicle_id)
    acc[vehicleId] = [
      ...(acc[vehicleId] ?? []),
      { equipmentItemId: String(assignmentRow.equipment_id) }
    ]
    return acc
  }, {})

  return {
    id: row.id,
    label: row.label,
    description: row.description ?? undefined,
    status: hydrateSubjectStatus(row.status),
    profile: hydrateProfile(profileRow as CharacterSourceRow | undefined),
    intent: {
      advancement:
        advancementData.method_code === ADVANCEMENT_METHOD_CODE.EXPERIENCE
          ? {
              method: ADVANCEMENT_METHOD_CODE.EXPERIENCE,
              experience:
                advancementData.experience == null ? undefined : Number(advancementData.experience)
            }
          : { method: ADVANCEMENT_METHOD_CODE.MILESTONE },
      race: {
        raceId: String(raceData.race_id),
        subraceId: optionalText(raceData.subrace_id)
      },
      ancestrySelections:
        ancestryRows.length > 0
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
        method: String(
          hitpointIntentData.method_code
        ) as CharacterAuthored['intent']['hitpoints']['method'],
        levels: hitpointLevels
      },
      startingEquipment:
        classEquipmentDecision || backgroundEquipmentDecision
          ? {
              class: classEquipmentDecision,
              background: backgroundEquipmentDecision
            }
          : undefined,
      featureAcquisitions,
      spellSelections,
      chosenGrantSelections,
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
        id: String(groupRow.id),
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
        }))
      },
      inspiration: row.inspiration,
      classes: classesState,
      resources:
        resourceUsageRows.length > 0
          ? resourceUsageRows.map((resourceRow) => ({
              resourceGrantId: String(resourceRow.resource_grant_id),
              used: Number(resourceRow.used)
            }))
          : undefined,
      spellSlots:
        spellSlotRows.length > 0
          ? spellSlotRows.map((slotRow) => ({
              slotKey: String((slotRow as CharacterSourceRow).slot_key),
              used: Number((slotRow as CharacterSourceRow).used)
            }))
          : undefined,
      conditions:
        conditionRows.length > 0
          ? conditionRows.map((conditionRow) => ({
              conditionTypeId: String((conditionRow as CharacterSourceRow).condition_type_id),
              notes: optionalText((conditionRow as CharacterSourceRow).notes)
            }))
          : undefined,
      exhaustion:
        exhaustionRow && Number((exhaustionRow as CharacterSourceRow).level) > 0
          ? {
              level: Number((exhaustionRow as CharacterSourceRow).level),
              notes: optionalText((exhaustionRow as CharacterSourceRow).notes)
            }
          : undefined,
      noteGroups:
        noteGroupRows.length > 0
          ? noteGroupRows.map((groupRow) => ({
              id: String(groupRow.id),
              label: String(groupRow.label),
              sortOrder: Number(groupRow.sort_order),
              kind: String(groupRow.kind) as NonNullable<
                CharacterAuthored['state']['noteGroups']
              >[number]['kind']
            }))
          : undefined,
      notes:
        noteRows.length > 0
          ? noteRows.map((noteRow) => ({
              id: String(noteRow.id),
              title: String(noteRow.title),
              body: optionalText(noteRow.body),
              groupId: String(noteRow.group_id),
              pinned: Boolean(noteRow.pinned),
              createdAt: isoTimestamp(noteRow.created_at),
              updatedAt: isoTimestamp(noteRow.updated_at)
            }))
          : undefined,
      creatures:
        creatureRows.length > 0
          ? creatureRows.map((creatureRow) => ({
              id: String(creatureRow.id),
              creatureId: String(creatureRow.creature_id),
              relationshipKind: String(creatureRow.relationship_kind) as NonNullable<
                CharacterAuthored['state']['creatures']
              >[number]['relationshipKind'],
              originKind: String(creatureRow.origin_kind) as NonNullable<
                CharacterAuthored['state']['creatures']
              >[number]['originKind'],
              currentHitPoints:
                creatureRow.current_hit_points == null
                  ? undefined
                  : Number(creatureRow.current_hit_points),
              tempHitPoints:
                creatureRow.temp_hit_points == null
                  ? undefined
                  : Number(creatureRow.temp_hit_points),
              hitDice: creatureHitDice[String(creatureRow.id)],
              customName: optionalText(creatureRow.custom_name),
              notes: optionalText(creatureRow.notes),
              isActive: creatureRow.is_active == null ? undefined : Boolean(creatureRow.is_active)
            }))
          : undefined,
      vehicles:
        vehicleRows.length > 0
          ? vehicleRows.map((vehicleRow) => ({
              id: String(vehicleRow.id),
              vehicleId: String(vehicleRow.vehicle_id),
              currentHitPoints:
                vehicleRow.current_hit_points == null
                  ? undefined
                  : Number(vehicleRow.current_hit_points),
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

async function deleteCharacterRows(db: DBLike, table: string, characterId: string): Promise<void> {
  await (db as unknown as DeleteCharacterRowsDb)
    .deleteFrom(table)
    .where('character_id', '=', characterId)
    .execute()
}

async function applyCharacterSheetStatePatch(
  db: DBLike,
  characterId: string,
  patch: CharacterSheetStatePatch
): Promise<void> {
  switch (patch.kind) {
    case 'INSPIRATION':
      return

    case 'HITPOINTS':
      await deleteCharacterRows(db, 'character_hit_dice_state', characterId)
      await deleteCharacterRows(db, 'character_hitpoint_state', characterId)
      await insertRows(db, 'character_hitpoint_state', [
        {
          character_id: characterId,
          current: patch.value.current,
          temp: patch.value.temp ?? null,
          max_override: null
        }
      ])
      await insertRows(
        db,
        'character_hit_dice_state',
        patch.value.hitDice.map((hitDie) => ({
          character_id: characterId,
          die: hitDie.die,
          total: hitDie.total,
          used: hitDie.used
        }))
      )
      return

    case 'RESOURCES':
      await deleteCharacterRows(db, 'character_resources', characterId)
      await insertRows(
        db,
        'character_resources',
        (patch.value ?? []).map((resource) => ({
          character_id: characterId,
          resource_grant_id: resource.resourceGrantId,
          used: resource.used
        }))
      )
      return

    case 'SPELL_SLOTS':
      await deleteCharacterRows(db, 'character_spell_slot_state', characterId)
      await insertRows(
        db,
        'character_spell_slot_state',
        (patch.value ?? []).map((slot) => ({
          character_id: characterId,
          slot_key: slot.slotKey,
          used: slot.used
        }))
      )
      return

    case 'CLASS_SPELLS':
      await deleteCharacterRows(db, 'character_class_spells', characterId)
      await insertRows(
        db,
        'character_class_spells',
        (patch.value ?? []).flatMap((classState) => [
          ...(classState.spells?.learned ?? []).map((spellId) => ({
            character_id: characterId,
            class_id: classState.classId,
            spell_id: spellId,
            state: 'KNOWN'
          })),
          ...(classState.spells?.prepared ?? []).map((spellId) => ({
            character_id: characterId,
            class_id: classState.classId,
            spell_id: spellId,
            state: 'PREPARED'
          }))
        ])
      )
      return

    case 'CONDITIONS':
      await deleteCharacterRows(db, 'character_conditions', characterId)
      await insertRows(
        db,
        'character_conditions',
        (patch.value ?? []).map((condition) => ({
          character_id: characterId,
          condition_type_id: condition.conditionTypeId,
          notes: condition.notes ?? null
        }))
      )
      return

    case 'EXHAUSTION':
      await deleteCharacterRows(db, 'character_exhaustion', characterId)
      if (patch.value && patch.value.level > 0) {
        await insertRows(db, 'character_exhaustion', [
          {
            character_id: characterId,
            level: patch.value.level,
            notes: patch.value.notes ?? null
          }
        ])
      }
      return

    case 'EQUIPMENT': {
      const orderedInventory = sortByDependency(
        patch.value.inventory,
        (item) => item.id,
        (item) => item.containerId,
        `Character equipment for ${characterId}`
      )
      const inventoryIds = new Set(orderedInventory.map((item) => item.id))

      for (const itemId of [...patch.value.equipped, ...patch.value.attuned]) {
        if (!inventoryIds.has(itemId)) {
          throw new Error(`Character ${characterId} references missing inventory item ${itemId}.`)
        }
      }

      await deleteCharacterRows(db, 'character_creature_equipment', characterId)
      await deleteCharacterRows(db, 'character_vehicle_equipment', characterId)
      await deleteCharacterRows(db, 'character_attuned', characterId)
      await deleteCharacterRows(db, 'character_equipped', characterId)

      for (const item of orderedInventory) {
        await db
          .insertInto('character_equipment')
          .values({
            id: item.id,
            character_id: characterId,
            equipment_id: item.equipmentId,
            quantity: item.quantity,
            container_id: item.containerId ?? null,
            container_path: null,
            custom_name: item.customName ?? null,
            notes: item.notes ?? null
          })
          .onConflict((oc) =>
            oc.column('id').doUpdateSet((eb) => ({
              equipment_id: eb.ref('excluded.equipment_id'),
              quantity: eb.ref('excluded.quantity'),
              container_id: eb.ref('excluded.container_id'),
              container_path: eb.ref('excluded.container_path'),
              custom_name: eb.ref('excluded.custom_name'),
              notes: eb.ref('excluded.notes')
            }))
          )
          .execute()
      }

      const existingItems = await db
        .selectFrom('character_equipment')
        .select('id')
        .where('character_id', '=', characterId)
        .execute()
      for (const existingItem of existingItems) {
        if (!inventoryIds.has(existingItem.id)) {
          await db.deleteFrom('character_equipment').where('id', '=', existingItem.id).execute()
        }
      }

      await insertRows(
        db,
        'character_equipped',
        patch.value.equipped.map((equipmentId) => ({
          character_id: characterId,
          equipment_id: equipmentId
        }))
      )
      await insertRows(
        db,
        'character_attuned',
        patch.value.attuned.map((equipmentId) => ({
          character_id: characterId,
          equipment_id: equipmentId
        }))
      )

      const creatureAssignments = Object.entries(patch.creatureEquipment ?? {}).flatMap(
        ([creatureId, assignments]) =>
          assignments.map((assignment) => {
            if (!inventoryIds.has(assignment.equipmentItemId)) {
              throw new Error(
                `Character ${characterId} creature equipment references missing inventory item ${assignment.equipmentItemId}.`
              )
            }
            return {
              character_id: characterId,
              character_creature_id: creatureId,
              equipment_id: assignment.equipmentItemId
            }
          })
      )
      const vehicleAssignments = Object.entries(patch.vehicleEquipment ?? {}).flatMap(
        ([vehicleId, assignments]) =>
          assignments.map((assignment) => {
            if (!inventoryIds.has(assignment.equipmentItemId)) {
              throw new Error(
                `Character ${characterId} vehicle equipment references missing inventory item ${assignment.equipmentItemId}.`
              )
            }
            return {
              character_id: characterId,
              character_vehicle_id: vehicleId,
              equipment_id: assignment.equipmentItemId
            }
          })
      )
      await insertRows(db, 'character_creature_equipment', creatureAssignments)
      await insertRows(db, 'character_vehicle_equipment', vehicleAssignments)
      return
    }

    case 'EXTRAS': {
      const creatureIds = new Set<string>()
      for (const creature of patch.creatures) {
        if (creatureIds.has(creature.id)) {
          throw new Error(
            `Character ${characterId} has duplicate creature instance ${creature.id}.`
          )
        }
        creatureIds.add(creature.id)
      }

      const vehicleIds = new Set<string>()
      for (const vehicle of patch.vehicles) {
        if (vehicleIds.has(vehicle.id)) {
          throw new Error(`Character ${characterId} has duplicate vehicle instance ${vehicle.id}.`)
        }
        vehicleIds.add(vehicle.id)
      }

      const inventoryRows = await db
        .selectFrom('character_equipment')
        .select('id')
        .where('character_id', '=', characterId)
        .execute()
      const inventoryIds = new Set(inventoryRows.map((row) => row.id))

      const creatureAssignments = Object.entries(patch.creatureEquipment).flatMap(
        ([creatureId, assignments]) => {
          if (!creatureIds.has(creatureId)) {
            throw new Error(
              `Character ${characterId} creature equipment references missing creature instance ${creatureId}.`
            )
          }
          return assignments.map((assignment) => {
            if (!inventoryIds.has(assignment.equipmentItemId)) {
              throw new Error(
                `Character ${characterId} creature equipment references missing inventory item ${assignment.equipmentItemId}.`
              )
            }
            return {
              character_id: characterId,
              character_creature_id: creatureId,
              equipment_id: assignment.equipmentItemId
            }
          })
        }
      )
      const vehicleAssignments = Object.entries(patch.vehicleEquipment).flatMap(
        ([vehicleId, assignments]) => {
          if (!vehicleIds.has(vehicleId)) {
            throw new Error(
              `Character ${characterId} vehicle equipment references missing vehicle instance ${vehicleId}.`
            )
          }
          return assignments.map((assignment) => {
            if (!inventoryIds.has(assignment.equipmentItemId)) {
              throw new Error(
                `Character ${characterId} vehicle equipment references missing inventory item ${assignment.equipmentItemId}.`
              )
            }
            return {
              character_id: characterId,
              character_vehicle_id: vehicleId,
              equipment_id: assignment.equipmentItemId
            }
          })
        }
      )

      const existingCreatureRows = await db
        .selectFrom('character_creatures')
        .select('id')
        .where('character_id', '=', characterId)
        .execute()
      const existingCreatureIds = new Set(existingCreatureRows.map((row) => row.id))
      const existingVehicleRows = await db
        .selectFrom('character_vehicles')
        .select('id')
        .where('character_id', '=', characterId)
        .execute()
      const existingVehicleIds = new Set(existingVehicleRows.map((row) => row.id))

      await deleteCharacterRows(db, 'character_creature_equipment', characterId)
      await deleteCharacterRows(db, 'character_vehicle_equipment', characterId)
      await deleteCharacterRows(db, 'character_creature_hit_dice_state', characterId)

      for (const creatureId of existingCreatureIds) {
        if (!creatureIds.has(creatureId)) {
          await db
            .deleteFrom('character_creatures')
            .where('character_id', '=', characterId)
            .where('id', '=', creatureId)
            .execute()
        }
      }
      for (const vehicleId of existingVehicleIds) {
        if (!vehicleIds.has(vehicleId)) {
          await db
            .deleteFrom('character_vehicles')
            .where('character_id', '=', characterId)
            .where('id', '=', vehicleId)
            .execute()
        }
      }

      for (const creature of patch.creatures) {
        const values = {
          creature_id: creature.creatureId,
          relationship_kind: creature.relationshipKind,
          origin_kind: creature.originKind,
          current_hit_points: creature.currentHitPoints ?? null,
          temp_hit_points: creature.tempHitPoints ?? null,
          custom_name: creature.customName ?? null,
          notes: creature.notes ?? null,
          is_active: creature.isActive ?? null
        }
        if (existingCreatureIds.has(creature.id)) {
          await db
            .updateTable('character_creatures')
            .set(values)
            .where('character_id', '=', characterId)
            .where('id', '=', creature.id)
            .execute()
        } else {
          await db
            .insertInto('character_creatures')
            .values({ id: creature.id, character_id: characterId, ...values })
            .execute()
        }
      }
      for (const vehicle of patch.vehicles) {
        const values = {
          vehicle_id: vehicle.vehicleId,
          current_hit_points: vehicle.currentHitPoints ?? null,
          custom_name: vehicle.customName ?? null,
          notes: vehicle.notes ?? null,
          is_active: vehicle.isActive ?? null
        }
        if (existingVehicleIds.has(vehicle.id)) {
          await db
            .updateTable('character_vehicles')
            .set(values)
            .where('character_id', '=', characterId)
            .where('id', '=', vehicle.id)
            .execute()
        } else {
          await db
            .insertInto('character_vehicles')
            .values({ id: vehicle.id, character_id: characterId, ...values })
            .execute()
        }
      }

      await insertRows(db, 'character_creature_equipment', creatureAssignments)
      await insertRows(db, 'character_vehicle_equipment', vehicleAssignments)
      await insertRows(
        db,
        'character_creature_hit_dice_state',
        patch.creatures.flatMap((creature) =>
          (creature.hitDice ?? []).map((hitDie) => ({
            character_id: characterId,
            character_creature_id: creature.id,
            die: hitDie.die,
            total: hitDie.total,
            used: hitDie.used
          }))
        )
      )
      return
    }

    case 'CURRENCY': {
      await deleteCharacterRows(db, 'character_currencies', characterId)
      await deleteCharacterRows(db, 'character_currency_groups', characterId)
      const groupIds = new Set<string>()
      for (const group of patch.value) {
        if (!group.id || groupIds.has(group.id)) {
          throw new Error(
            `Character ${characterId} has an invalid or duplicate currency group ${group.id ?? ''}.`
          )
        }
        groupIds.add(group.id)
      }
      await insertRows(
        db,
        'character_currency_groups',
        patch.value.map((group) => ({
          id: group.id,
          character_id: characterId,
          container_id: group.containerId ?? null
        }))
      )
      await insertRows(
        db,
        'character_currencies',
        patch.value.flatMap((group) =>
          group.currencies.map((currency) => ({
            character_id: characterId,
            group_id: group.id,
            currency_id: currency.currencyId,
            amount: currency.amount
          }))
        )
      )
      return
    }

    case 'NOTES': {
      const groups = patch.groups ?? []
      const notes = patch.notes ?? []
      const groupIds = new Set(groups.map((group) => group.id))
      if (groupIds.size !== groups.length) {
        throw new Error(`Character ${characterId} has duplicate note groups.`)
      }
      const noteIds = new Set<string>()
      for (const note of notes) {
        if (noteIds.has(note.id))
          throw new Error(`Character ${characterId} has duplicate note ${note.id}.`)
        if (!groupIds.has(note.groupId)) {
          throw new Error(
            `Character ${characterId} note ${note.id} references missing note group ${note.groupId}.`
          )
        }
        noteIds.add(note.id)
      }
      await deleteCharacterRows(db, 'character_notes', characterId)
      await deleteCharacterRows(db, 'character_note_groups', characterId)
      await insertRows(
        db,
        'character_note_groups',
        groups.map((group) => ({
          id: group.id,
          character_id: characterId,
          label: group.label,
          sort_order: group.sortOrder,
          kind: group.kind
        }))
      )
      await insertRows(
        db,
        'character_notes',
        notes.map((note) => ({
          id: note.id,
          character_id: characterId,
          group_id: note.groupId,
          title: note.title,
          body: note.body ?? null,
          pinned: note.pinned ?? false,
          created_at: note.createdAt,
          updated_at: note.updatedAt
        }))
      )
      return
    }

    default:
      return patch satisfies never
  }
}

async function patchCharacterSheetState(
  db: DBLike,
  characterId: string,
  patches: CharacterSheetStatePatch[],
  options: {
    expectedStreamVersion: number
    afterPersist?: (trx: DBLike, nextStreamVersion: number) => Promise<void>
  }
): Promise<number> {
  return withTransaction(db, async (trx) => {
    const row = (await trx
      .selectFrom('characters')
      .selectAll()
      .where('id', '=', characterId)
      .forUpdate()
      .executeTakeFirst()) as CharacterRow | undefined
    if (!row) throw new Error(`Character "${characterId}" was not found.`)
    if (row.stream_version !== options.expectedStreamVersion) {
      throw new ConcurrencyError(characterId, options.expectedStreamVersion)
    }

    const inspirationPatch = patches.find(
      (patch): patch is Extract<CharacterSheetStatePatch, { kind: 'INSPIRATION' }> =>
        patch.kind === 'INSPIRATION'
    )
    const nextStreamVersion = row.stream_version + 1
    await trx
      .insertInto('characters')
      .values({
        id: row.id,
        system_id: row.system_id,
        user_id: row.user_id,
        label: row.label,
        description: row.description,
        status: row.status,
        inspiration: inspirationPatch?.value ?? row.inspiration,
        stream_version: nextStreamVersion
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet((eb) => ({
          inspiration: eb.ref('excluded.inspiration'),
          stream_version: eb.ref('excluded.stream_version')
        }))
      )
      .execute()

    for (const patch of patches) {
      await applyCharacterSheetStatePatch(trx, characterId, patch)
    }
    await options.afterPersist?.(trx, nextStreamVersion)
    return nextStreamVersion
  })
}

export function createCharacterRepository(db: DBLike): CharacterRepository {
  return {
    async findById(id) {
      const row = (await db
        .selectFrom('characters')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst()) as CharacterRow | undefined

      return row ?? null
    },

    async findUpdatedAtById(id) {
      const row = (await db
        .selectFrom('characters')
        .select(sql<string>`updated_at::text`.as('updated_at'))
        .where('id', '=', id)
        .executeTakeFirst()) as Pick<CharacterRow, 'updated_at'> | undefined

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

    async patchSheetState(characterId, patches, options) {
      return patchCharacterSheetState(db, characterId, patches, options)
    },

    async listByUser(userId) {
      const rows = (await db
        .selectFrom('characters')
        .select(['id', 'label', 'system_id', 'stream_version', 'status'])
        .where('user_id', '=', userId)
        .orderBy('updated_at', 'desc')
        .execute()) as Pick<
        CharacterRow,
        'id' | 'label' | 'system_id' | 'stream_version' | 'status'
      >[]

      return rows
    }
  }
}
