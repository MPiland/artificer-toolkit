import {
  ABILITY_OPTIONS,
  ADVANCEMENT_METHOD_OPTIONS,
  CHARACTER_ABILITY_GENERATION_METHOD_OPTIONS,
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALC_METHOD_OPTIONS,
  POINT_BUY_SCORE_REGISTRY,
  POINT_BUY_SCORE_OPTIONS,
  POINT_BUY_TOTAL_POINTS,
  STANDARD_ARRAY_SCORE_OPTIONS,
  type AbilityCode
} from '@artificer-toolkit/shared/core'
import type { CharacterAuthoredDto } from '@artificer-toolkit/schema/subjects/character'
import type { CharacterBuilderIntentCacheDto } from '@artificer-toolkit/schema/api/characters'
import type { SelectOption } from '#forms/utils/formUtils'
import type { CharacterFormValues } from '../../core/characterBuilder.types'

type AbilityIntentCache = NonNullable<CharacterBuilderIntentCacheDto['abilities']>
export type CharacterAbilityGenerationMethod = CharacterFormValues['intent']['abilities']['method']
type StandardArrayAbilities = Extract<
  CharacterFormValues['intent']['abilities'],
  { method: typeof CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY }
>
type PointBuyAbilities = Extract<
  CharacterFormValues['intent']['abilities'],
  { method: typeof CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY }
>
type AbilityAssignment = (StandardArrayAbilities | PointBuyAbilities)['assignments'][number]
type AbilityAssignmentCode = AbilityCode
export type CharacterAbilityFormAssignments = Array<AbilityAssignment>
export type CharacterAbilityDraftSlot = {
  ability?: AbilityCode
  option?: string
  score?: number
}
const abilityOptionDefinitions = ABILITY_OPTIONS.map((option) => ({
  value: option.code,
  label: option.label
})) satisfies { value: AbilityAssignmentCode; label: string }[]

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

const abilityMethodLabelByValue = new Map(
  abilityMethodOptions.map((option) => [option.value, option.label])
)

export const hitpointMethodOptions: SelectOption[] = HITPOINT_CALC_METHOD_OPTIONS.map((option) => ({
  value: option.code,
  label: option.label
}))

export const standardArrayOptions: SelectOption[] = STANDARD_ARRAY_SCORE_OPTIONS.map(
  (option): SelectOption => ({ value: option.code, label: option.label })
)
export const pointBuyOptions: SelectOption[] = POINT_BUY_SCORE_OPTIONS.map(
  (option): SelectOption => ({ value: option.code, label: option.label })
)

const standardArrayOptionValues = new Set<string>(
  STANDARD_ARRAY_SCORE_OPTIONS.map((option) => option.code)
)
const pointBuyOptionValues = new Set<string>(POINT_BUY_SCORE_OPTIONS.map((option) => option.code))
const allAbilityOptionValues = new Set<string>([
  ...standardArrayOptionValues,
  ...pointBuyOptionValues
])

export { POINT_BUY_TOTAL_POINTS }

export function getPointBuyCost(option: string | undefined): number {
  return option && pointBuyOptionValues.has(option)
    ? POINT_BUY_SCORE_REGISTRY[option as keyof typeof POINT_BUY_SCORE_REGISTRY].cost
    : 0
}

export function isAbilityAssignmentOption(
  value: string
): value is CharacterAbilityFormAssignments[number]['option'] {
  return allAbilityOptionValues.has(value)
}

export function getInactiveAbilityIntentMethodLabels(character: CharacterFormValues): string[] {
  const abilities = normalizeBuilderIntent(character).abilities
  if (!abilities) return []

  return Object.keys(abilities.methods)
    .filter((method) => method !== abilities.activeMethod)
    .map((method) => abilityMethodLabelByValue.get(method) ?? method)
}

export function normalizeBuilderIntent(
  character: CharacterFormValues
): CharacterBuilderIntentCacheDto {
  return {
    ...character.builderIntent,
    abilities: mergeAbilityIntentCache(
      character.builderIntent?.abilities,
      character.intent.abilities
    )
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

  const cachedIntent =
    cache?.methods[method] ??
    (abilities.method === method ? abilities : createEmptyAbilityIntent(method))
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
        assignments: normalizedSlots.flatMap((slot) =>
          slot.ability !== undefined && slot.score !== undefined
            ? [{ ability: slot.ability, score: slot.score }]
            : []
        ),
        rollGroups:
          activeCache.methods[method]?.method === method
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
          [method]: {
            method,
            slots: normalizedSlots.map(({ ability, score }) => ({ ability, score }))
          }
        },
        methods: { ...activeCache.methods, [method]: abilities }
      }
    }
  }

  if (method === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY) {
    const abilities: CharacterFormValues['intent']['abilities'] = {
      method,
      assignments: normalizedSlots.flatMap((slot) =>
        slot.ability !== undefined &&
        slot.option !== undefined &&
        pointBuyOptionValues.has(slot.option)
          ? [
              {
                ability: slot.ability,
                option: slot.option as PointBuyAbilities['assignments'][number]['option']
              }
            ]
          : []
      )
    }

    return {
      abilities,
      cache: {
        ...activeCache,
        activeMethod: method,
        drafts: {
          ...activeCache.drafts,
          [method]: {
            method,
            slots: normalizedSlots.map(({ ability, option }) => ({
              ability,
              option:
                option && pointBuyOptionValues.has(option)
                  ? (option as PointBuyAbilities['assignments'][number]['option'])
                  : undefined
            }))
          }
        },
        methods: { ...activeCache.methods, [method]: abilities }
      }
    }
  }

  const abilities: CharacterFormValues['intent']['abilities'] = {
    method,
    assignments: normalizedSlots.flatMap((slot) =>
      slot.ability !== undefined &&
      slot.option !== undefined &&
      standardArrayOptionValues.has(slot.option)
        ? [
            {
              ability: slot.ability,
              option: slot.option as StandardArrayAbilities['assignments'][number]['option']
            }
          ]
        : []
    )
  }

  return {
    abilities,
    cache: {
      ...activeCache,
      activeMethod: method,
      drafts: {
        ...activeCache.drafts,
        [method]: {
          method,
          slots: normalizedSlots.map(({ ability, option }) => ({
            ability,
            option:
              option && standardArrayOptionValues.has(option)
                ? (option as StandardArrayAbilities['assignments'][number]['option'])
                : undefined
          }))
        }
      },
      methods: { ...activeCache.methods, [method]: abilities }
    }
  }
}

export function mergeActiveAbilityIntentCache(
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

export function toAbilityFormValues(
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

function createEmptyAbilityIntent(
  method: CharacterAbilityGenerationMethod
): CharacterFormValues['intent']['abilities'] {
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

export function normalizeAbilityIntent(
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
    value === CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY ||
    value === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY ||
    value === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
  )
    return value

  return undefined
}
