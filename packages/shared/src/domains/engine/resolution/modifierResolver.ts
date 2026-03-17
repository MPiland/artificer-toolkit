import type { ValueDomainCode } from '../../core/valueDomain.js'
import type { RulesSystem } from '../contracts/rulesSystem.js'
import type { EngineAccumulatedState } from './grantApplicator.js'

/**
 * Collapses all raw modifier entries into a flat resolved map.
 *
 * For each `domainKey` group, applies the stacking rule from `rules.stackingConfig()`.
 * Returns a map of `domainKey → resolved numeric value`.
 *
 * Stacking rules are defined in `dnd5e2014/RULE_ORDER.md` §3.
 */
export function resolveModifiers(
  modifierEntries: EngineAccumulatedState['modifierEntries'],
  rules: RulesSystem
): Record<string, number> {
  // Group entries by domainKey
  const groups = new Map<string, { modifierKind: string; domain: string; values: number[] }>()

  for (const entry of modifierEntries) {
    const [domain] = entry.domainKey.split(':')
    if (!groups.has(entry.domainKey)) {
      groups.set(entry.domainKey, { modifierKind: entry.modifierKind, domain, values: [] })
    }

    const value = extractNumericValue(entry.grant)
    if (value !== undefined) {
      groups.get(entry.domainKey)!.values.push(value)
    }
  }

  const resolved: Record<string, number> = {}

  for (const [key, group] of groups) {
    const config = rules.stackingConfig(group.domain as ValueDomainCode, group.modifierKind)

    switch (config.rule) {
      case 'additive':
        resolved[key] = group.values.reduce((sum, v) => sum + v, 0)
        break
      case 'highest':
        resolved[key] = Math.max(...group.values)
        break
      case 'last':
        resolved[key] = group.values[group.values.length - 1] ?? 0
        break
      case 'boolean':
        // Boolean modifiers: any truthy = 1, none = 0
        resolved[key] = group.values.some((v) => v !== 0) ? 1 : 0
        break
      case 'exclusive':
        // First value only; multiple sources on same exclusive domain is a content error
        resolved[key] = group.values[0] ?? 0
        break
    }
  }

  return resolved
}

/**
 * Extracts a numeric value from a compiled modifier grant.
 * Only BONUS/PENALTY/SET_VALUE modifier kinds carry a simple numeric value.
 * Other kinds (ADVANTAGE, ADD_OPTION, etc.) use `1` as a presence flag.
 */
function extractNumericValue(
  grant: { modifierKind?: string; payload?: unknown }
): number | undefined {
  const g = grant as {
    modifierKind?: string
    payload?: { value?: number; amount?: number }
  }

  switch (g.modifierKind) {
    case 'BONUS':
    case 'PENALTY':
    case 'SET_VALUE':
    case 'MODIFY_CHARGE_LIMIT':
      return g.payload?.value ?? g.payload?.amount ?? 0
    case 'ADVANTAGE':
    case 'DISADVANTAGE':
    case 'ADD_OPTION':
    case 'REMOVE_OPTION':
    case 'ADD_BONUS_DIE':
    case 'OPTIONAL_ABILITY_MODIFIER':
      // Presence flag — 1 means "this modifier exists"
      return 1
    default:
      return 0
  }
}
