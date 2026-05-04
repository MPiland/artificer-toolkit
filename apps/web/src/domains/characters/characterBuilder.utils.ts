import {
  ABILITY_CODE,
  ADVANCEMENT_METHOD_CODE,
  AUTHORED_RECORD_STATUS,
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE,
  type AbilityCode
} from '@artificer-toolkit/shared/core'
import { CharacterStartingEquipmentSource } from '@artificer-toolkit/shared/subjects/authored'
import {
  characterAuthoredDtoSchema,
  type CharacterAuthoredDto,
  type CharacterStartingEquipmentDecisionDto
} from '@artificer-toolkit/schema/subjects/character'
import type {
  CharacterBuilderChoiceOptionDto,
  CharacterBuilderDraftSaveRequestDto,
  CharacterBuilderFormDto,
  CharacterBuilderIntentCacheDto,
  CharacterBuilderPayloadDto,
  CharacterBuilderReferencesDto,
  CharacterBuilderResolutionDto
} from '@artificer-toolkit/schema/api/characters'
import type { SelectOption } from '#forms'

export type CharacterFormValues = CharacterBuilderFormDto
export type CharacterStartingEquipmentDecision = CharacterStartingEquipmentDecisionDto
type AbilityIntentCache = NonNullable<CharacterBuilderIntentCacheDto['abilities']>
type AbilityAssignmentCode = CharacterFormValues['intent']['abilities']['assignments'][number]['ability']
type CharacterClassRow = CharacterFormValues['intent']['classes'][number]
type CharacterFeatureAcquisition = CharacterFormValues['intent']['featureAcquisitions'][number]
export type CharacterBuilderStepId
  = | 'BASICS'
    | 'RACE'
    | 'CLASSES'
    | 'BACKGROUND'
    | 'DETAILS'
    | 'NOTES'
    | 'ABILITIES'
    | 'EQUIPMENT'
    | 'REVIEW'

export const characterBuilderSteps: { id: CharacterBuilderStepId, label: string, description: string }[] = [
  { id: 'BASICS', label: 'Basics', description: 'Name the character and choose how advancement is tracked.' },
  { id: 'RACE', label: 'Race', description: 'Choose race, subrace, and ancestry choices in source context.' },
  { id: 'CLASSES', label: 'Classes', description: 'Build class levels, subclasses, and class-owned choices.' },
  { id: 'BACKGROUND', label: 'Background', description: 'Select background and resolve background-owned choices.' },
  { id: 'DETAILS', label: 'Details', description: 'Record identity, appearance, and table-facing details.' },
  { id: 'NOTES', label: 'Personality & Notes', description: 'Capture roleplay hooks, backstory, and private notes.' },
  { id: 'ABILITIES', label: 'Abilities & HP', description: 'Assign abilities and starting hit point intent.' },
  { id: 'EQUIPMENT', label: 'Equipment & Currency', description: 'Resolve starting equipment and manual starting inventory.' },
  { id: 'REVIEW', label: 'Review', description: 'Check concrete blockers before finalizing the build.' }
]

const abilityOptionDefinitions = [
  { value: ABILITY_CODE.STRENGTH, label: 'Strength' },
  { value: ABILITY_CODE.DEXTERITY, label: 'Dexterity' },
  { value: ABILITY_CODE.CONSTITUTION, label: 'Constitution' },
  { value: ABILITY_CODE.INTELLIGENCE, label: 'Intelligence' },
  { value: ABILITY_CODE.WISDOM, label: 'Wisdom' },
  { value: ABILITY_CODE.CHARISMA, label: 'Charisma' }
] satisfies { value: AbilityAssignmentCode, label: string }[]

export const abilityOptions: SelectOption[] = abilityOptionDefinitions

export const abilityCodes = abilityOptionDefinitions.map((option) => option.value)
const abilityCodeSet = new Set<AbilityAssignmentCode>(abilityCodes)

export function isCharacterAbilityCode(value: string): value is AbilityAssignmentCode {
  return abilityCodeSet.has(value as AbilityAssignmentCode)
}

export const advancementMethodOptions: SelectOption[] = [
  { value: ADVANCEMENT_METHOD_CODE.MILESTONE, label: 'Milestone' },
  { value: ADVANCEMENT_METHOD_CODE.EXPERIENCE, label: 'Experience' }
]

export const abilityMethodOptions: SelectOption[] = [
  { value: CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY, label: 'Standard Array' },
  { value: CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY, label: 'Point Buy' },
  { value: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED, label: 'Manual / Rolled' }
]

const abilityMethodLabelByValue = new Map(abilityMethodOptions.map((option) => [option.value, option.label]))

export const hitpointMethodOptions: SelectOption[] = [
  { value: HITPOINT_CALCULATION_METHOD_CODE.FIXED, label: 'Fixed' },
  { value: HITPOINT_CALCULATION_METHOD_CODE.MANUAL, label: 'Manual' }
]

export const standardArrayOptions: SelectOption[] = [
  '8', '10', '12', '13', '14', '15'
]
  .map((value) => ({ value, label: value }))

export const pointBuyOptions: SelectOption[] = [
  '8', '9', '10', '11', '12', '13', '14', '15'
]
  .map((value) => ({ value, label: value }))

export function createFallbackCharacterFormValues(systemId = 'pending-system'): CharacterFormValues {
  return {
    id: 'pending-character',
    label: '',
    status: AUTHORED_RECORD_STATUS.DRAFT,
    profile: {},
    intent: {
      advancement: { method: ADVANCEMENT_METHOD_CODE.MILESTONE },
      race: { raceId: '' },
      background: { backgroundId: '' },
      classes: [],
      abilities: {
        method: CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY,
        assignments: []
      },
      hitpoints: {
        method: HITPOINT_CALCULATION_METHOD_CODE.FIXED,
        levels: []
      },
      featureAcquisitions: []
    },
    state: {
      equipment: {
        inventory: [],
        equipped: [],
        attuned: []
      },
      currency: [],
      hitpoints: {
        current: 1,
        hitDice: []
      }
    },
    systemId,
    userId: 'server-owned'
  }
}

export function toCharacterFormValues(payload: CharacterBuilderPayloadDto): CharacterFormValues {
  const abilities = payload.character.intent.abilities
  const formAbilities = toAbilityFormValues(abilities)

  return {
    ...payload.character,
    intent: {
      ...payload.character.intent,
      abilities: formAbilities
    },
    builderIntent: mergeActiveAbilityIntentCache(payload.builderIntent, formAbilities)
  }
}

export function normalizeCharacterForDraft(character: CharacterFormValues): CharacterAuthoredDto {
  return characterAuthoredDtoSchema.parse({
    ...character,
    intent: {
      ...character.intent,
      abilities: normalizeAbilityIntent(character.intent.abilities)
    },
    status: AUTHORED_RECORD_STATUS.DRAFT
  })
}

export function normalizeCharacterForCommit(character: CharacterFormValues): CharacterAuthoredDto {
  return characterAuthoredDtoSchema.parse({
    ...character,
    intent: {
      ...character.intent,
      abilities: normalizeAbilityIntent(character.intent.abilities)
    },
    status: AUTHORED_RECORD_STATUS.ACTIVE
  })
}

export function buildCharacterDraftSaveInput(
  character: CharacterFormValues,
  mode: CharacterBuilderDraftSaveRequestDto['mode'],
  options: {
    baseActiveUpdatedAt?: string | null
  } = {}
): CharacterBuilderDraftSaveRequestDto {
  return {
    character: normalizeCharacterForDraft(character),
    builderIntent: normalizeBuilderIntent(character),
    mode,
    baseActiveUpdatedAt: mode === 'edit'
      ? options.baseActiveUpdatedAt ?? null
      : null
  }
}

export function getInactiveAbilityIntentMethodLabels(character: CharacterFormValues): string[] {
  const abilities = normalizeBuilderIntent(character).abilities
  if (!abilities) return []

  return Object.keys(abilities.methods)
    .filter((method) => method !== abilities.activeMethod)
    .map((method) => abilityMethodLabelByValue.get(method) ?? method)
}

function normalizeBuilderIntent(character: CharacterFormValues): CharacterBuilderIntentCacheDto {
  return {
    ...character.builderIntent,
    abilities: mergeAbilityIntentCache(character.builderIntent?.abilities, character.intent.abilities)
  }
}

export function cacheActiveAbilityIntent(
  cache: AbilityIntentCache | undefined,
  abilities: CharacterFormValues['intent']['abilities']
): AbilityIntentCache {
  return mergeAbilityIntentCache(cache, abilities)
}

export function getCachedAbilityIntent(
  cache: AbilityIntentCache | undefined,
  method: string
): CharacterFormValues['intent']['abilities'] {
  return cache?.methods[method] ?? createEmptyAbilityIntent(method)
}

function mergeActiveAbilityIntentCache(
  cache: CharacterBuilderIntentCacheDto | undefined,
  abilities: CharacterFormValues['intent']['abilities']
): CharacterBuilderIntentCacheDto {
  return {
    ...cache,
    abilities: mergeAbilityIntentCache(cache?.abilities, abilities)
  }
}

function mergeAbilityIntentCache(
  cache: AbilityIntentCache | undefined,
  abilities: CharacterFormValues['intent']['abilities']
): AbilityIntentCache {
  return {
    activeMethod: abilities.method,
    methods: {
      ...cache?.methods,
      [abilities.method]: abilities
    }
  }
}

function toAbilityFormValues(
  abilities: CharacterAuthoredDto['intent']['abilities']
): CharacterFormValues['intent']['abilities'] {
  if (abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED) {
    return {
      method: abilities.method,
      assignments: abilities.state.assignments.map((assignment) => ({
        ability: assignment.ability,
        option: String(assignment.score)
      })),
      state: abilities.state
    }
  }

  return abilities
}

function createEmptyAbilityIntent(method: string): CharacterFormValues['intent']['abilities'] {
  if (method === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED) {
    return {
      method,
      assignments: [],
      state: {
        assignments: [],
        rollGroups: []
      }
    }
  }

  return {
    method,
    assignments: []
  }
}

function normalizeAbilityIntent(
  abilities: CharacterFormValues['intent']['abilities']
): CharacterAuthoredDto['intent']['abilities'] {
  if (abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED) {
    const assignments = abilities.state?.assignments ?? abilities.assignments
      .map((assignment) => ({
        ability: assignment.ability as AbilityCode,
        score: Number(assignment.option)
      }))
      .filter((assignment) => Number.isFinite(assignment.score))

    return {
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      state: {
        assignments: assignments.map((assignment) => ({
          ability: assignment.ability as AbilityCode,
          score: assignment.score
        }))
      }
    }
  }

  if (abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY) {
    return {
      method: CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY,
      assignments: abilities.assignments.map((assignment) => ({
        ability: assignment.ability as AbilityCode,
        option: assignment.option as '8' | '9' | '10' | '11' | '12' | '13' | '14' | '15'
      }))
    }
  }

  return {
    method: CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY,
    assignments: abilities.assignments.map((assignment) => ({
      ability: assignment.ability as AbilityCode,
      option: assignment.option as '8' | '10' | '12' | '13' | '14' | '15'
    }))
  }
}

export function selectOptions(items: { id: string, label: string }[]): SelectOption[] {
  return items.map((item) => ({
    value: item.id,
    label: item.label
  }))
}

export function choiceOptions(items: CharacterBuilderChoiceOptionDto[]): SelectOption[] {
  return items.map((item) => ({
    value: item.id,
    label: item.disabledReason ? `${item.label} (${item.disabledReason})` : item.label,
    disabled: item.disabled
  }))
}

export function isChoiceOptionDisabled(
  items: CharacterBuilderChoiceOptionDto[],
  value: string | null | undefined
): boolean {
  if (!value) return true

  return items.find((item) => item.id === value)?.disabled === true
}

export function clearRaceDependents(character: CharacterFormValues): CharacterFormValues {
  return {
    ...character,
    intent: {
      ...character.intent,
      race: {
        raceId: character.intent.race.raceId
      },
      ancestrySelections: undefined,
      featureAcquisitions: character.intent.featureAcquisitions.filter(
        (acquisition) => !isRaceOwnedFeatureSource(acquisition.source)
      )
    }
  }
}

export function clearSubraceDependents(character: CharacterFormValues): CharacterFormValues {
  return {
    ...character,
    intent: {
      ...character.intent,
      ancestrySelections: undefined,
      featureAcquisitions: character.intent.featureAcquisitions.filter(
        (acquisition) => !isSubraceOwnedFeatureSource(acquisition.source)
      )
    }
  }
}

export function clearClassDependents(row: CharacterClassRow): CharacterClassRow {
  return {
    classId: row.classId,
    classLevel: row.classLevel
  }
}

export function clearSubclassDependents(row: CharacterClassRow): CharacterClassRow {
  return {
    ...row,
    specializationId: undefined
  }
}

export function clearBackgroundDependents(character: CharacterFormValues): CharacterFormValues {
  return {
    ...character,
    intent: {
      ...character.intent,
      featureAcquisitions: character.intent.featureAcquisitions.filter(
        (acquisition) => getSourceKind(acquisition.source) !== 'BACKGROUND'
      ),
      startingEquipment: omitEmptyStartingEquipment({
        ...character.intent.startingEquipment,
        background: undefined
      })
    }
  }
}

export function clearClassOwnedChoices(
  character: CharacterFormValues,
  previousRow: CharacterClassRow
): CharacterFormValues {
  return {
    ...character,
    intent: {
      ...character.intent,
      featureAcquisitions: character.intent.featureAcquisitions.filter(
        (acquisition) => !isClassOwnedFeatureSource(acquisition.source, previousRow)
      ),
      spellSelections: filterOptionalIntentRows(character.intent.spellSelections, (selection) => !isClassOwnedSource(selection.source, previousRow)),
      resourceGrants: filterOptionalIntentRows(character.intent.resourceGrants, (grant) => !isClassOwnedSource(grant.source, previousRow))
    }
  }
}

export function clearSubclassOwnedChoices(
  character: CharacterFormValues,
  previousRow: CharacterClassRow
): CharacterFormValues {
  return {
    ...character,
    intent: {
      ...character.intent,
      featureAcquisitions: character.intent.featureAcquisitions.filter(
        (acquisition) => !isSubclassOwnedSource(acquisition.source, previousRow)
      ),
      spellSelections: filterOptionalIntentRows(character.intent.spellSelections, (selection) => !isSubclassOwnedSource(selection.source, previousRow)),
      resourceGrants: filterOptionalIntentRows(character.intent.resourceGrants, (grant) => !isSubclassOwnedSource(grant.source, previousRow))
    }
  }
}

export function clearPrimaryClassDependents(character: CharacterFormValues): CharacterFormValues {
  return {
    ...character,
    intent: {
      ...character.intent,
      startingEquipment: omitEmptyStartingEquipment({
        ...character.intent.startingEquipment,
        class: undefined
      })
    }
  }
}

export function createStartingEquipmentDecision(
  source: 'CLASS' | 'BACKGROUND'
): CharacterStartingEquipmentDecision {
  return {
    source: source === 'CLASS'
      ? CharacterStartingEquipmentSource.CLASS
      : CharacterStartingEquipmentSource.BACKGROUND,
    tookGold: false,
    groups: []
  }
}

function omitEmptyStartingEquipment(
  startingEquipment: CharacterFormValues['intent']['startingEquipment']
): CharacterFormValues['intent']['startingEquipment'] {
  return startingEquipment?.class || startingEquipment?.background
    ? startingEquipment
    : undefined
}

function isRaceOwnedFeatureSource(source: CharacterFeatureAcquisition['source']): boolean {
  const kind = getSourceKind(source)

  return kind === 'RACE' || kind === 'SUBRACE' || kind === 'ANCESTRY'
}

function isSubraceOwnedFeatureSource(source: CharacterFeatureAcquisition['source']): boolean {
  const kind = getSourceKind(source)

  return kind === 'SUBRACE' || kind === 'ANCESTRY'
}

function isClassOwnedFeatureSource(
  source: CharacterFeatureAcquisition['source'],
  previousRow: CharacterClassRow
): boolean {
  return isClassOwnedSource(source, previousRow)
}

function isClassOwnedSource(
  source: unknown,
  previousRow: CharacterClassRow
): boolean {
  const kind = getSourceKind(source)
  if (kind === 'CLASS') return getSourceString(source, 'classId') === previousRow.classId
  if (kind === 'SUBCLASS') return isSubclassOwnedSource(source, previousRow)

  return false
}

function isSubclassOwnedSource(
  source: unknown,
  previousRow: CharacterClassRow
): boolean {
  if (!previousRow.subclassId) return false
  if (getSourceKind(source) !== 'SUBCLASS') return false

  return getSourceString(source, 'subclassId') === previousRow.subclassId
}

function filterOptionalIntentRows<T>(
  rows: T[] | undefined,
  predicate: (row: T) => boolean
): T[] | undefined {
  const filteredRows = rows?.filter(predicate) ?? []

  return filteredRows.length > 0 ? filteredRows : undefined
}

function getSourceKind(source: unknown): string | undefined {
  if (!source || typeof source !== 'object' || !('kind' in source)) return undefined
  const kind = source.kind

  return typeof kind === 'string' ? kind : undefined
}

function getSourceString(source: unknown, key: string): string | undefined {
  if (!source || typeof source !== 'object' || !(key in source)) return undefined
  const value = source[key as keyof typeof source]

  return typeof value === 'string' ? value : undefined
}

export function baseRaceOptions(references: CharacterBuilderReferencesDto): SelectOption[] {
  return selectOptions(references.races.filter((race) => race.category !== 'SUBRACE'))
}

export function subraceOptions(references: CharacterBuilderReferencesDto, raceId: string | undefined): SelectOption[] {
  if (!raceId) return []
  return selectOptions(references.races.filter((race) => race.parentRaceId === raceId))
}

export function baseClassOptions(references: CharacterBuilderReferencesDto): SelectOption[] {
  return selectOptions(references.classes.filter((classRecord) => classRecord.category !== 'SUBCLASS'))
}

export function subclassOptions(references: CharacterBuilderReferencesDto, classId: string | undefined): SelectOption[] {
  if (!classId) return []
  return selectOptions(references.classes.filter((classRecord) => classRecord.parentClassId === classId))
}

export function selectedRaceAncestryOptions(
  references: CharacterBuilderReferencesDto,
  raceId: string | undefined,
  subraceId: string | undefined
): { ancestryId: string, options: SelectOption[], label: string } | null {
  const selectedRace = references.races.find((race) => race.id === (subraceId || raceId))
  if (!selectedRace?.ancestry) return null

  return {
    ancestryId: selectedRace.ancestry.id,
    label: selectedRace.ancestry.label,
    options: selectOptions(selectedRace.ancestry.options)
  }
}

export function classSpecializationOptions(
  references: CharacterBuilderReferencesDto,
  subclassId: string | undefined
): SelectOption[] {
  if (!subclassId) return []
  return selectOptions(references.classes.find((classRecord) => classRecord.id === subclassId)?.specializations ?? [])
}

export function totalClassLevel(character: CharacterFormValues): number {
  return character.intent.classes.reduce((total, classRecord) => total + classRecord.classLevel, 0)
}

export function getReadinessMessages(resolution: CharacterBuilderResolutionDto): string[] {
  return [
    ...resolution.readiness.blockingIssues,
    ...resolution.readiness.outstandingRequiredChoices,
    ...resolution.validations.map((validation) => validation.message)
  ]
}
