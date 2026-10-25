import {
  CHARACTER_ABILITY_GENERATION_METHOD_OPTIONS,
  CHARACTER_ABILITY_GENERATION_METHOD,
  POINT_BUY_SCORE_OPTIONS,
  STANDARD_ARRAY_SCORE_OPTIONS
} from '@artificer-toolkit/shared/core'
import type { CharacterAuthoredDto } from '@artificer-toolkit/schema/subjects/character'
import type { CharacterBuilderIntentCacheDto } from '@artificer-toolkit/schema/api/characters'
import type { RollResultDto } from '@artificer-toolkit/schema/api/rolls'
import type { SelectOption } from '#forms/utils/formUtils'
import type { CharacterFormValues } from '../../core/characterBuilder.types'
import { findOption } from '#app/forms/utils/valueGuards'

type AbilityIntentCache = NonNullable<CharacterBuilderIntentCacheDto['abilities']>
export const DEFAULT_ABILITY_ROLL_CONFIGURATION = '4d6dl1r1'
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
type CharacterAbilityFormAssignments = Array<AbilityAssignment>
export type CharacterAbilityDraftSlot = {
  ability?: string
  option?: string
  score?: number
}
const abilityMethodOptions: SelectOption[] = CHARACTER_ABILITY_GENERATION_METHOD_OPTIONS.map(
  (option) => ({ value: option.code, label: option.label })
)

const abilityMethodLabelByValue = new Map(
  abilityMethodOptions.map((option) => [option.value, option.label])
)

const standardArrayOptionCodes = STANDARD_ARRAY_SCORE_OPTIONS.map((option) => option.code)
const pointBuyOptionCodes = POINT_BUY_SCORE_OPTIONS.map((option) => option.code)
const allAbilityOptionValues = new Set<string>([
  ...standardArrayOptionCodes,
  ...pointBuyOptionCodes
])

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
    const manualState =
      currentAbilities.method === method
        ? currentAbilities.state
        : activeCache.methods[method]?.method === method
          ? activeCache.methods[method].state
          : undefined
    const abilities: CharacterFormValues['intent']['abilities'] = {
      method,
      state: {
        configuration: manualState?.configuration,
        assignments: normalizedSlots.flatMap((slot) =>
          slot.ability !== undefined && slot.score !== undefined
            ? [{ ability: slot.ability, score: slot.score }]
            : []
        ),
        rollGroups: manualState?.rollGroups?.map((group) => {
          const slotIndex = Number(/^assignment-(\d+):/.exec(group.id)?.[1])
          return Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < normalizedSlots.length
            ? { ...group, assignedAbility: normalizedSlots[slotIndex].ability }
            : group
        })
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
      assignments: normalizedSlots.flatMap((slot) => {
        const option = findOption(pointBuyOptionCodes, slot.option)
        return slot.ability !== undefined && option !== undefined
          ? [{ ability: slot.ability, option }]
          : []
      })
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
              option: findOption(pointBuyOptionCodes, option)
            }))
          }
        },
        methods: { ...activeCache.methods, [method]: abilities }
      }
    }
  }

  const abilities: CharacterFormValues['intent']['abilities'] = {
    method,
    assignments: normalizedSlots.flatMap((slot) => {
      const option = findOption(standardArrayOptionCodes, slot.option)
      return slot.ability !== undefined && option !== undefined
        ? [{ ability: slot.ability, option }]
        : []
    })
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
            option: findOption(standardArrayOptionCodes, option)
          }))
        }
      },
      methods: { ...activeCache.methods, [method]: abilities }
    }
  }
}

export function applyManualAbilityRoll(
  cache: AbilityIntentCache | undefined,
  currentAbilities: CharacterFormValues['intent']['abilities'],
  slots: CharacterAbilityDraftSlot[],
  slotIndex: number,
  result: RollResultDto
): {
  abilities: CharacterFormValues['intent']['abilities']
  cache: AbilityIntentCache
  slots: CharacterAbilityDraftSlot[]
} {
  if (currentAbilities.method !== CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED) {
    throw new RangeError('Ability rolls require the Manual / Rolled method.')
  }
  const term = result.evidence.terms[0]
  if (!term) throw new RangeError('Ability roll result contains no dice.')

  const nextSlots = toSixAbilitySlots(slots).map((slot, index) =>
    index === slotIndex ? { ...slot, score: result.evidence.total } : slot
  )
  const next = setAbilityDraftSlots(
    cache,
    currentAbilities,
    CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
    nextSlots
  )
  if (next.abilities.method !== CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED) {
    throw new RangeError('Ability roll result could not be applied.')
  }

  const keptIndexes = term.keptRollIndexes ?? term.rolls.map((_, index) => index)
  const groupIdPrefix = `assignment-${slotIndex}:`
  const rollGroup = {
    id: `${groupIdPrefix}${result.id}`,
    rolls: (term.rollSequences ?? term.rolls.map((value) => [value])).flatMap((sequence) =>
      sequence.map((value) => ({ die: term.die, value }))
    ),
    kept: keptIndexes.flatMap((index) => {
      const value = term.rolls[index]
      return value === undefined ? [] : [{ die: term.die, value }]
    }),
    assignedAbility: nextSlots[slotIndex]?.ability,
    score: result.evidence.total,
    applied: true,
    rolling: false
  }
  const abilities: CharacterFormValues['intent']['abilities'] = {
    ...next.abilities,
    state: {
      ...next.abilities.state,
      configuration: result.normalizedExpression,
      rollGroups: [
        ...(next.abilities.state.rollGroups ?? []).filter(
          (group) => !group.id.startsWith(groupIdPrefix)
        ),
        rollGroup
      ]
    }
  }

  return {
    abilities,
    cache: mergeAbilityIntentCache(next.cache, abilities),
    slots: nextSlots
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
    return {
      method: CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY,
      assignments: abilities.assignments.map((assignment) => ({
        ability: assignment.ability,
        option: assignment.option
      }))
    }
  }

  return {
    method: CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY,
    assignments: abilities.assignments.map((assignment) => ({
      ability: assignment.ability,
      option: assignment.option
    }))
  }
}

export function getAssignedAbilityCodes(
  abilities: CharacterFormValues['intent']['abilities']
): string[] {
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
): Partial<Record<string, number>> {
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
