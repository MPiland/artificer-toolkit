import type { ValueDomainCode } from '../../core/valueDomain.js'
import type { CharacterBuildSnapshot } from '../snapshot.js'
import type { RulesSystem } from '../contracts/rulesSystem.js'
import type { EngineAccumulatedState } from './grantApplication.js'
import type { EngineProficiency } from '../contracts/engineState.js'
import type {
  CharacterCalculation,
  CharacterCalculationContribution
} from '../../character/sheetCalculation.js'
import {
  CHARACTER_CALCULATION_CONTRIBUTION_STATE,
  createCharacterMechanicSourceKey
} from '../../character/sheetCalculation.js'
import { resolveAbilityRecordKey } from './abilityKey.js'
import { parseModifierDomainKey } from './modifierDomainKey.js'
import { resolveNumericCalculation } from './calculationResolver.js'

type ModifierResolutionContext = {
  snapshot?: CharacterBuildSnapshot
  proficiencies?: EngineProficiency[]
}

/**
 * Collapses raw modifier entries into a flat resolved map.
 *
 * Parameterized domains are grouped by a stable domain key so melee/ranged,
 * per-skill, and per-ability modifiers do not collapse together.
 */
export function resolveModifiers(
  modifierEntries: EngineAccumulatedState['modifierEntries'],
  rules: RulesSystem,
  context: ModifierResolutionContext = {}
): Record<string, number> {
  return resolveModifierState(modifierEntries, rules, context).values
}

export interface ResolvedModifierState {
  values: Record<string, number>
  calculations: Record<string, CharacterCalculation<number>>
}

export function modifierContributions(
  state: ResolvedModifierState,
  predicate: (parsed: ReturnType<typeof parseModifierDomainKey>) => boolean
): CharacterCalculationContribution<number>[] {
  return Object.entries(state.calculations).flatMap(([domainKey, calculation]) => {
    const parsed = parseModifierDomainKey(domainKey)
    return predicate(parsed) &&
      [
        'BONUS',
        'PENALTY',
        'SET_VALUE',
        'ABILITY_MODIFIER_BONUS',
        'OPTIONAL_ABILITY_MODIFIER_BONUS'
      ].includes(parsed.modifierKind)
      ? calculation.contributions.map((contribution) => ({ ...contribution }))
      : []
  })
}

export function resolveModifierState(
  modifierEntries: EngineAccumulatedState['modifierEntries'],
  rules: RulesSystem,
  context: ModifierResolutionContext = {}
): ResolvedModifierState {
  const effectiveAbilityScores = resolveEffectiveAbilityScores(
    modifierEntries,
    rules,
    context.snapshot
  )

  const groups = new Map<
    string,
    {
      modifierKind: string
      valueDomainCode: string
      values: Array<{
        id: string
        source: EngineAccumulatedState['modifierEntries'][number]['source']
        value: number
      }>
    }
  >()

  for (const entry of modifierEntries) {
    const parsed = parseModifierDomainKey(entry.domainKey)
    if (!groups.has(entry.domainKey)) {
      groups.set(entry.domainKey, {
        modifierKind: entry.modifierKind,
        valueDomainCode: parsed.valueDomainCode,
        values: []
      })
    }

    const value = extractNumericValue(entry.grant, parsed, rules, context, effectiveAbilityScores)
    if (value !== undefined) {
      groups.get(entry.domainKey)!.values.push({
        id: `${createCharacterMechanicSourceKey(entry.source)}:${entry.grant.id}:${entry.domainKey}`,
        source: entry.source,
        value
      })
    }
  }

  const resolved: Record<string, number> = {}
  const calculations: Record<string, CharacterCalculation<number>> = {}

  for (const [key, group] of groups) {
    const config = rules.stackingConfig(
      group.valueDomainCode as ValueDomainCode,
      group.modifierKind
    )

    let appliedIndexes: ReadonlySet<number>

    switch (config.rule) {
      case 'additive':
        appliedIndexes = new Set(group.values.map((_, index) => index))
        break
      case 'highest': {
        const highest = group.values.length
          ? Math.max(...group.values.map((entry) => entry.value))
          : undefined
        const index = group.values.findIndex((entry) => entry.value === highest)
        appliedIndexes = new Set(index < 0 ? [] : [index])
        break
      }
      case 'last':
        appliedIndexes = new Set(group.values.length ? [group.values.length - 1] : [])
        break
      case 'boolean':
        appliedIndexes = new Set(
          group.values
            .map((entry, index) => (entry.value !== 0 ? index : -1))
            .filter((index) => index >= 0)
            .slice(0, 1)
        )
        break
      case 'exclusive':
        appliedIndexes = new Set(group.values.length ? [0] : [])
        break
    }

    const calculation = resolveNumericCalculation(
      0,
      group.values.map((entry, index) => ({
        ...entry,
        state: appliedIndexes.has(index)
          ? CHARACTER_CALCULATION_CONTRIBUTION_STATE.APPLIED
          : CHARACTER_CALCULATION_CONTRIBUTION_STATE.SUPPRESSED
      }))
    )
    calculations[key] = calculation
    resolved[key] = calculation.effective
  }

  return { values: resolved, calculations }
}

function resolveEffectiveAbilityScores(
  modifierEntries: EngineAccumulatedState['modifierEntries'],
  rules: RulesSystem,
  snapshot?: CharacterBuildSnapshot
): Record<string, number> {
  const baseScores = { ...(snapshot?.abilities ?? {}) }
  const abilityScoreBonuses = new Map<string, number[]>()
  const abilityScoreSetValues = new Map<string, number>()

  for (const entry of modifierEntries) {
    const parsed = parseModifierDomainKey(entry.domainKey)
    if (parsed.valueDomainCode !== 'ABILITY_SCORE') continue

    const ability = resolveAbilityRecordKey(baseScores, parsed.params.ability)
    if (!ability) continue

    const value = extractNumericValue(entry.grant, parsed, rules, { snapshot }, baseScores)
    if (value === undefined) continue

    if (entry.modifierKind === 'SET_VALUE') {
      abilityScoreSetValues.set(ability, value)
      continue
    }

    const list = abilityScoreBonuses.get(ability) ?? []
    list.push(value)
    abilityScoreBonuses.set(ability, list)
  }

  const resolvedScores = { ...baseScores }

  for (const [ability, setValue] of abilityScoreSetValues) {
    resolvedScores[ability] = setValue
  }

  for (const [ability, values] of abilityScoreBonuses) {
    resolvedScores[ability] =
      (resolvedScores[ability] ?? 10) + values.reduce((sum, value) => sum + value, 0)
  }

  return resolvedScores
}

function extractNumericValue(
  grant: { modifierKind?: string; payload?: unknown },
  parsedKey: ReturnType<typeof parseModifierDomainKey>,
  rules: RulesSystem,
  context: ModifierResolutionContext,
  effectiveAbilityScores: Record<string, number>
): number | undefined {
  const g = grant as {
    modifierKind?: string
    payload?: {
      amount?: number
      value?: number
      valueKind?: string
      multiplier?: number
      classId?: string
      skillId?: string
      ability?: string
      abilities?: string[]
      min?: number
      max?: number
    }
  }

  switch (g.modifierKind) {
    case 'BONUS':
    case 'PENALTY':
      return resolveScalarModifierValue(g.payload, rules, context)
    case 'SET_VALUE':
    case 'MODIFY_CHARGE_LIMIT':
      return g.payload?.value ?? g.payload?.amount ?? 0
    case 'ABILITY_MODIFIER_BONUS':
      return resolveAbilityModifierBonus(
        g.payload?.ability,
        g.payload?.multiplier,
        g.payload?.min,
        g.payload?.max,
        rules,
        effectiveAbilityScores
      )
    case 'OPTIONAL_ABILITY_MODIFIER_BONUS':
      return resolveOptionalAbilityModifierBonus(
        g.payload?.abilities,
        rules,
        effectiveAbilityScores
      )
    case 'ADVANTAGE':
    case 'DISADVANTAGE':
    case 'ADD_OPTION':
    case 'REMOVE_OPTION':
    case 'ADD_BONUS_DIE':
      return 1
    case 'REPLACE_DAMAGE_TYPE':
      return 0
    default:
      return parsedKey.valueDomainCode === 'ABILITY_SCORE' ? 0 : undefined
  }
}

function resolveScalarModifierValue(
  payload:
    | {
        amount?: number
        value?: number
        valueKind?: string
        multiplier?: number
        subtractLevels?: number
        classId?: string
        skillId?: string
      }
    | undefined,
  rules: RulesSystem,
  context: ModifierResolutionContext
): number {
  if (!payload?.valueKind) {
    return payload?.value ?? payload?.amount ?? 0
  }

  const multiplier = payload.multiplier ?? 1
  const snapshot = context.snapshot

  switch (payload.valueKind) {
    case 'FIXED':
      return payload.amount ?? payload.value ?? 0
    case 'PROFICIENCY_BONUS':
      return rules.proficiencyBonus(Math.max(snapshot?.totalLevel ?? 1, 1)) * multiplier
    case 'CHARACTER_LEVEL':
      return (snapshot?.totalLevel ?? 0) * multiplier
    case 'CLASS_LEVEL': {
      const level = snapshot?.classes.find((klass) => klass.classId === payload.classId)?.level ?? 0
      return level * multiplier
    }
    case 'SKILL_BONUS':
    case 'SPELL_SLOT_LEVEL':
      return 0
    default:
      return payload.value ?? payload.amount ?? 0
  }
}

function resolveAbilityModifierBonus(
  ability: string | undefined,
  multiplier: number | undefined,
  min: number | undefined,
  max: number | undefined,
  rules: RulesSystem,
  effectiveAbilityScores: Record<string, number>
): number {
  const normalizedAbility = resolveAbilityRecordKey(effectiveAbilityScores, ability)
  if (!normalizedAbility) return 0

  const raw =
    rules.abilityModifier(effectiveAbilityScores[normalizedAbility] ?? 10) * (multiplier ?? 1)
  return clamp(raw, min, max)
}

function resolveOptionalAbilityModifierBonus(
  abilities: string[] | undefined,
  rules: RulesSystem,
  effectiveAbilityScores: Record<string, number>
): number {
  if (!abilities?.length) return 0

  return Math.max(
    ...abilities.map((ability) => {
      const normalizedAbility = resolveAbilityRecordKey(effectiveAbilityScores, ability)
      return rules.abilityModifier(effectiveAbilityScores[normalizedAbility ?? ability] ?? 10)
    })
  )
}

function clamp(value: number, min?: number, max?: number): number {
  if (min !== undefined && value < min) return min
  if (max !== undefined && value > max) return max
  return value
}
