import type { ValueDomainCode } from '../../core/valueDomain.js'
import type { CharacterBuildSnapshot } from '../snapshot.js'
import type { RulesSystem } from '../contracts/rulesSystem.js'
import type { EngineAccumulatedState } from './grantApplicator.js'
import type { EngineProficiency } from '../contracts/engineState.js'
import { normalizeAbilityKey, resolveAbilityRecordKey } from './abilityKey.js'
import { parseModifierDomainKey } from './modifierDomainKey.js'

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
  const effectiveAbilityScores = resolveEffectiveAbilityScores(modifierEntries, rules, context.snapshot)

  const groups = new Map<string, { modifierKind: string; valueDomainCode: string; values: number[] }>()

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
      groups.get(entry.domainKey)!.values.push(value)
    }
  }

  const resolved: Record<string, number> = {}

  for (const [key, group] of groups) {
    const config = rules.stackingConfig(group.valueDomainCode as ValueDomainCode, group.modifierKind)

    switch (config.rule) {
      case 'additive':
        resolved[key] = group.values.reduce((sum, value) => sum + value, 0)
        break
      case 'highest':
        resolved[key] = group.values.length ? Math.max(...group.values) : 0
        break
      case 'last':
        resolved[key] = group.values[group.values.length - 1] ?? 0
        break
      case 'boolean':
        resolved[key] = group.values.some((value) => value !== 0) ? 1 : 0
        break
      case 'exclusive':
        resolved[key] = group.values[0] ?? 0
        break
    }
  }

  return resolved
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
    resolvedScores[ability] = (resolvedScores[ability] ?? 10) + values.reduce((sum, value) => sum + value, 0)
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
      return resolveOptionalAbilityModifierBonus(g.payload?.abilities, rules, effectiveAbilityScores)
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

  const raw = rules.abilityModifier(effectiveAbilityScores[normalizedAbility] ?? 10) * (multiplier ?? 1)
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
