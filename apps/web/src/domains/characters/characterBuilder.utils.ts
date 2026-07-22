import {
  ABILITY_OPTIONS,
  ADVANCEMENT_METHOD_CODE,
  ADVANCEMENT_METHOD_OPTIONS,
  AUTHORED_RECORD_STATUS,
  CHARACTER_ABILITY_GENERATION_METHOD_OPTIONS,
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALC_METHOD_OPTIONS,
  HITPOINT_CALCULATION_METHOD_CODE,
  POINT_BUY_SCORE_REGISTRY,
  POINT_BUY_SCORE_OPTIONS,
  POINT_BUY_TOTAL_POINTS,
  STANDARD_ARRAY_SCORE_OPTIONS,
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
  CharacterBuilderChosenGrantChoiceViewDto,
  CharacterBuilderDraftSaveRequestDto,
  CharacterBuilderFormDto,
  CharacterBuilderIntentCacheDto,
  CharacterBuilderPayloadDto,
  CharacterBuilderReferencesDto,
  CharacterBuilderResolutionDto
} from '@artificer-toolkit/schema/api/characters'
import type { SelectOption } from '#forms/utils/formUtils'

export type CharacterFormValues = CharacterBuilderFormDto
export type CharacterStartingEquipmentDecision = CharacterStartingEquipmentDecisionDto
type AbilityIntentCache = NonNullable<CharacterBuilderIntentCacheDto['abilities']>
export type CharacterAbilityGenerationMethod = CharacterFormValues['intent']['abilities']['method']
type StandardArrayAbilities = Extract<
  CharacterFormValues['intent']['abilities'],
  { method: typeof CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY}
>
type PointBuyAbilities = Extract<
  CharacterFormValues['intent']['abilities'],
  { method: typeof CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY}
>
type AbilityAssignment = (StandardArrayAbilities | PointBuyAbilities)['assignments'][number]
type AbilityAssignmentCode = AbilityCode
export type CharacterAbilityFormAssignments = Array<AbilityAssignment>
export type CharacterAbilityDraftSlot = {
  ability?: AbilityCode
  option?: string
  score?: number
}
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
  { id: 'RACE', label: 'Race', description: 'Choose your race and any race-specific options.' },
  { id: 'CLASSES', label: 'Classes', description: 'Choose class levels and class-specific options.' },
  { id: 'BACKGROUND', label: 'Background', description: 'Choose a background and any background options.' },
  { id: 'ABILITIES', label: 'Abilities & HP', description: 'Assign abilities and starting hit point intent.' },
  { id: 'EQUIPMENT', label: 'Equipment & Currency', description: 'Resolve starting equipment and manual starting inventory.' },
  { id: 'DETAILS', label: 'Personality & Appearance', description: 'Set alignment, faith, appearance, and other profile details.' },
  { id: 'NOTES', label: 'Notes', description: 'Track backstory, relationships, and table notes.' },
  { id: 'REVIEW', label: 'Review', description: 'Check concrete blockers before activating the character.' }
]

type CharacterBuilderIssue = CharacterBuilderPayloadDto['resolution']['outstandingChoices'][number]
type CharacterBuilderValidation = CharacterBuilderPayloadDto['resolution']['validations'][number]

export function getCharacterBuilderIssueStepId(
  issue: CharacterBuilderIssue
): CharacterBuilderStepId {
  return issueStepByCode[issue.code] ?? getCharacterBuilderSourceStepId(issue.source) ?? 'REVIEW'
}

export function getCharacterBuilderValidationStepId(
  validation: CharacterBuilderValidation
): CharacterBuilderStepId {
  return validationStepByCode[validation.code]
    ?? getCharacterBuilderSourceStepId(validation.source)
    ?? 'REVIEW'
}

const issueStepByCode: Partial<Record<string, CharacterBuilderStepId>> = {
  ANCESTRY_SELECTION_REQUIRED: 'RACE',
  BACKGROUND_STARTING_EQUIPMENT_REQUIRED: 'EQUIPMENT',
  CLASS_STARTING_EQUIPMENT_REQUIRED: 'EQUIPMENT',
  SPECIALIZATION_REQUIRED: 'CLASSES',
  SPELL_SELECTION_INCOMPLETE: 'CLASSES',
  SPELL_SELECTION_INVALID: 'CLASSES',
  SPELL_SELECTION_OVER_LIMIT: 'CLASSES',
  SPELL_SELECTION_REQUIRED: 'CLASSES',
  SUBCLASS_SELECTION_REQUIRED: 'CLASSES'
}

const validationStepByCode: Partial<Record<string, CharacterBuilderStepId>> = {
  ANCESTRY_OPTION_NOT_FOUND: 'RACE',
  ANCESTRY_SOURCE_MISMATCH: 'RACE',
  BACKGROUND_NOT_FOUND: 'BACKGROUND',
  BACKGROUND_STARTING_EQUIPMENT_UNAVAILABLE: 'EQUIPMENT',
  CLASS_NOT_FOUND: 'CLASSES',
  CLASS_STARTING_EQUIPMENT_UNAVAILABLE: 'EQUIPMENT',
  DUPLICATE_SPELL_SELECTION: 'CLASSES',
  EXPERTISE_REQUIRES_PROFICIENCY: 'CLASSES',
  INVALID_HITPOINT_PROGRESSION: 'ABILITIES',
  INVALID_MANUAL_HITPOINT_ROLL: 'ABILITIES',
  MALFORMED_ABILITY_ASSIGNMENTS: 'ABILITIES',
  MISSING_MANUAL_HITPOINT_ROLL: 'ABILITIES',
  MULTICLASS_PREREQUISITE_UNMET: 'CLASSES',
  POINT_BUY_OVERSPEND: 'ABILITIES',
  RACE_NOT_FOUND: 'RACE',
  REDUNDANT_PROFICIENCY_SELECTION: 'CLASSES',
  SPELL_SELECTION_INVALID: 'CLASSES',
  STALE_ANCESTRY_SELECTION: 'RACE',
  STALE_RESOURCE_GRANT: 'CLASSES',
  STALE_SPELL_SELECTION: 'CLASSES',
  STANDARD_ARRAY_SCORE_REUSE: 'ABILITIES',
  SUBCLASS_NOT_FOUND: 'CLASSES',
  SUBCLASS_PARENT_MISMATCH: 'CLASSES',
  SUBCLASS_SELECTION_UNAVAILABLE: 'CLASSES',
  SUBRACE_NOT_FOUND: 'RACE',
  SUBRACE_PARENT_MISMATCH: 'RACE'
}

function getCharacterBuilderSourceStepId(
  source: CharacterBuilderIssue['source']
): CharacterBuilderStepId | undefined {
  if (!source) return undefined

  switch (source.kind) {
    case 'RACE':
    case 'SUBRACE':
    case 'ANCESTRY':
      return 'RACE'
    case 'CLASS':
    case 'SUBCLASS':
      return 'CLASSES'
    case 'BACKGROUND':
      return 'BACKGROUND'
    default:
      return undefined
  }
}

const abilityOptionDefinitions = ABILITY_OPTIONS.map((option) => ({
  value: option.code,
  label: option.label
})) satisfies { value: AbilityAssignmentCode, label: string }[]

export const abilityOptions: SelectOption[] = abilityOptionDefinitions

export const abilityCodes = abilityOptionDefinitions.map((option) => option.value)
const abilityCodeSet = new Set<AbilityAssignmentCode>(abilityCodes)

export function isCharacterAbilityCode(value: string): value is AbilityAssignmentCode {
  return abilityCodeSet.has(value as AbilityAssignmentCode)
}

export const advancementMethodOptions: SelectOption[] = ADVANCEMENT_METHOD_OPTIONS.map(
  (option) => ({ value: option.code, label: option.label })
)

export const abilityMethodOptions: SelectOption[] = CHARACTER_ABILITY_GENERATION_METHOD_OPTIONS.map(
  (option) => ({ value: option.code, label: option.label })
)

const abilityMethodLabelByValue = new Map(abilityMethodOptions.map((option) => [option.value, option.label]))

export const hitpointMethodOptions: SelectOption[] = HITPOINT_CALC_METHOD_OPTIONS.map(
  (option) => ({ value: option.code, label: option.label })
)

export const standardArrayOptions: SelectOption[] = STANDARD_ARRAY_SCORE_OPTIONS
  .map((option): SelectOption => ({ value: option.code, label: option.label }))
export const pointBuyOptions: SelectOption[] = POINT_BUY_SCORE_OPTIONS
  .map((option): SelectOption => ({ value: option.code, label: option.label }))

const standardArrayOptionValues = new Set<string>(STANDARD_ARRAY_SCORE_OPTIONS.map((option) => option.code))
const pointBuyOptionValues = new Set<string>(POINT_BUY_SCORE_OPTIONS.map((option) => option.code))
const allAbilityOptionValues = new Set<string>([...standardArrayOptionValues, ...pointBuyOptionValues])

export { POINT_BUY_TOTAL_POINTS }

export function getPointBuyCost(option: string | undefined): number {
  return option && pointBuyOptionValues.has(option)
    ? POINT_BUY_SCORE_REGISTRY[option as keyof typeof POINT_BUY_SCORE_REGISTRY].cost
    : 0
}

export function getAllChosenGrantChoices(
  view: CharacterBuilderPayloadDto['view']
): CharacterBuilderChosenGrantChoiceViewDto[] {
  return [
    ...view.race.grantChoices,
    ...view.classes.selectedClasses.flatMap((selectedClass) => selectedClass.grantChoices),
    ...view.background.grantChoices
  ]
}

export function isAbilityAssignmentOption(value: string): value is CharacterAbilityFormAssignments[number]['option'] {
  return allAbilityOptionValues.has(value)
}

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

export function getCharacterBuilderResolutionFingerprint(
  character: CharacterFormValues
): string {
  return JSON.stringify({
    immediate: getCharacterBuilderImmediateResolutionFingerprint(character),
    deferred: getCharacterBuilderDeferredResolutionFingerprint(character)
  })
}

export function getCharacterBuilderImmediateResolutionFingerprint(
  character: CharacterFormValues
): string {
  const { abilities, hitpoints, ...immediateIntent } = character.intent
  const immediateAbilities = abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
    ? {
        method: abilities.method,
        assignedAbilities: abilities.state.assignments.map((assignment) => assignment.ability)
      }
    : abilities

  return JSON.stringify({
    hasCurrency: character.state.currency.length > 0,
    hasInventory: character.state.equipment.inventory.length > 0,
    intent: {
      ...immediateIntent,
      abilities: immediateAbilities,
      hitpoints: { method: hitpoints.method }
    },
    systemId: character.systemId
  })
}

export function getCharacterBuilderDeferredResolutionFingerprint(
  character: CharacterFormValues
): string {
  const abilities = character.intent.abilities

  return JSON.stringify({
    manualAbilities:
      abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
        ? abilities.state
        : null,
    hitpointLevels: character.intent.hitpoints.levels
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
  method: CharacterAbilityGenerationMethod
): CharacterFormValues['intent']['abilities'] {
  return cache?.methods[method] ?? createEmptyAbilityIntent(method)
}

export function getAbilityDraftSlots(
  cache: AbilityIntentCache | undefined,
  abilities: CharacterFormValues['intent']['abilities'],
  method: CharacterAbilityGenerationMethod = abilities.method
): CharacterAbilityDraftSlot[] {
  const cachedDraft = cache?.drafts?.[method]
  if (cachedDraft) return toSixAbilitySlots(cachedDraft.slots)

  const cachedIntent = cache?.methods[method] ?? (abilities.method === method ? abilities : createEmptyAbilityIntent(method))
  if (cachedIntent.method === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED) {
    return toSixAbilitySlots(cachedIntent.state.assignments)
  }

  return toSixAbilitySlots(cachedIntent.assignments)
}

export function setAbilityDraftSlots(
  cache: AbilityIntentCache | undefined,
  currentAbilities: CharacterFormValues['intent']['abilities'],
  method: CharacterAbilityGenerationMethod,
  slots: CharacterAbilityDraftSlot[]
): {
  abilities: CharacterFormValues['intent']['abilities']
  cache: AbilityIntentCache
} {
  const normalizedSlots = toSixAbilitySlots(slots)
  const activeCache = mergeAbilityIntentCache(cache, currentAbilities)

  if (method === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED) {
    const abilities: CharacterFormValues['intent']['abilities'] = {
      method,
      state: {
        assignments: normalizedSlots.flatMap((slot) => slot.ability !== undefined && slot.score !== undefined
          ? [{ ability: slot.ability, score: slot.score }]
          : []),
        rollGroups: activeCache.methods[method]?.method === method
          ? activeCache.methods[method].state.rollGroups
          : []
      }
    }

    return {
      abilities,
      cache: {
        ...activeCache,
        activeMethod: method,
        drafts: {
          ...activeCache.drafts,
          [method]: { method, slots: normalizedSlots.map(({ ability, score }) => ({ ability, score })) }
        },
        methods: { ...activeCache.methods, [method]: abilities }
      }
    }
  }

  if (method === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY) {
    const abilities: CharacterFormValues['intent']['abilities'] = {
      method,
      assignments: normalizedSlots.flatMap((slot) => slot.ability !== undefined && slot.option !== undefined && pointBuyOptionValues.has(slot.option)
        ? [{ ability: slot.ability, option: slot.option as PointBuyAbilities['assignments'][number]['option'] }]
        : [])
    }

    return {
      abilities,
      cache: {
        ...activeCache,
        activeMethod: method,
        drafts: {
          ...activeCache.drafts,
          [method]: { method, slots: normalizedSlots.map(({ ability, option }) => ({
            ability,
            option: option && pointBuyOptionValues.has(option)
              ? option as PointBuyAbilities['assignments'][number]['option']
              : undefined
          })) }
        },
        methods: { ...activeCache.methods, [method]: abilities }
      }
    }
  }

  const abilities: CharacterFormValues['intent']['abilities'] = {
    method,
    assignments: normalizedSlots.flatMap((slot) => slot.ability !== undefined && slot.option !== undefined && standardArrayOptionValues.has(slot.option)
      ? [{ ability: slot.ability, option: slot.option as StandardArrayAbilities['assignments'][number]['option'] }]
      : [])
  }

  return {
    abilities,
    cache: {
      ...activeCache,
      activeMethod: method,
      drafts: {
        ...activeCache.drafts,
        [method]: { method, slots: normalizedSlots.map(({ ability, option }) => ({
          ability,
          option: option && standardArrayOptionValues.has(option)
            ? option as StandardArrayAbilities['assignments'][number]['option']
            : undefined
        })) }
      },
      methods: { ...activeCache.methods, [method]: abilities }
    }
  }
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
    ...cache,
    activeMethod: abilities.method,
    methods: {
      ...cache?.methods,
      [abilities.method]: abilities
    }
  }
}

function toSixAbilitySlots(
  slots: ReadonlyArray<CharacterAbilityDraftSlot>
): CharacterAbilityDraftSlot[] {
  return Array.from({ length: 6 }, (_, index) => ({ ...slots[index] }))
}

function toAbilityFormValues(
  abilities: CharacterAuthoredDto['intent']['abilities']
): CharacterFormValues['intent']['abilities'] {
  if (abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED) {
    return {
      method: abilities.method,
      state: abilities.state
    }
  }

  return abilities
}

function createEmptyAbilityIntent(method: CharacterAbilityGenerationMethod): CharacterFormValues['intent']['abilities'] {
  if (method === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED) {
    return {
      method,
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
    const manualRolledAssignments = abilities.state?.assignments ?? []

    return {
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      state: {
        assignments: manualRolledAssignments.map((assignment) => ({
          ability: assignment.ability,
          score: assignment.score
        }))
      }
    }
  }

  if (abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY) {
    const pointBuyAbilities = abilities as PointBuyAbilities

    return {
      method: CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY,
      assignments: pointBuyAbilities.assignments.map((assignment) => ({
        ability: assignment.ability,
        option: assignment.option
      }))
    }
  }

  const standardArrayAbilities = abilities as StandardArrayAbilities

  return {
    method: CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY,
    assignments: standardArrayAbilities.assignments.map((assignment) => ({
      ability: assignment.ability,
      option: assignment.option
    }))
  }
}

export function getAssignedAbilityCodes(
  abilities: CharacterFormValues['intent']['abilities']
): AbilityCode[] {
  if (abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY) {
    return abilities.assignments.map((assignment) => assignment.ability)
  }

  if (abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY) {
    return abilities.assignments.map((assignment) => assignment.ability)
  }

  return abilities.state.assignments.map((assignment) => assignment.ability)
}

export function getAssignedAbilityScores(
  abilities: CharacterFormValues['intent']['abilities']
): Partial<Record<AbilityCode, number>> {
  if (abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED) {
    return Object.fromEntries(
      abilities.state.assignments.map((assignment) => [assignment.ability, assignment.score])
    )
  }

  return Object.fromEntries(
    abilities.assignments.map((assignment) => [assignment.ability, Number(assignment.option)])
  )
}

export function getAbilityGenerationMethod(
  value: string
): CharacterAbilityGenerationMethod | undefined {
  if (
    value === CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY
    || value === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY
    || value === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
  ) return value

  return undefined
}

export function selectOptions(items: { id: string, label: string }[]): SelectOption[] {
  return items
    .map((item) => ({
      value: item.id,
      label: item.label
    }))
    .sort((left, right) => compareCharacterBuilderLabels(left.label, right.label))
}

export function choiceOptions(items: CharacterBuilderChoiceOptionDto[]): SelectOption[] {
  return items
    .map((item) => ({
      value: item.id,
      label: item.disabledReason ? `${item.label} (${item.disabledReason})` : item.label,
      disabled: item.disabled
    }))
    .sort((left, right) => compareCharacterBuilderLabels(left.label, right.label))
}

const characterBuilderLabelCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base'
})

export function compareCharacterBuilderLabels(left: string, right: string): number {
  return characterBuilderLabelCollator.compare(left, right)
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
      ),
      chosenGrantSelections: filterOptionalIntentRows(
        character.intent.chosenGrantSelections,
        (selection) => !isRaceOwnedFeatureSource(selection.source)
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
      ),
      chosenGrantSelections: filterOptionalIntentRows(
        character.intent.chosenGrantSelections,
        (selection) => !isSubraceOwnedFeatureSource(selection.source)
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
      chosenGrantSelections: filterOptionalIntentRows(
        character.intent.chosenGrantSelections,
        (selection) => getSourceKind(selection.source) !== 'BACKGROUND'
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
      chosenGrantSelections: filterOptionalIntentRows(character.intent.chosenGrantSelections, (selection) => !isClassOwnedSource(selection.source, previousRow)),
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
      chosenGrantSelections: filterOptionalIntentRows(character.intent.chosenGrantSelections, (selection) => !isSubclassOwnedSource(selection.source, previousRow)),
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
