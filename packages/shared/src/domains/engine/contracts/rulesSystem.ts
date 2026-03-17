import type { ValueDomainCode } from '../../core/valueDomain.js'

export type ModifierStackingRule = 'additive' | 'highest' | 'exclusive' | 'boolean' | 'last'

export interface ModifierStackingConfig {
  rule: ModifierStackingRule
}

/**
 * System-agnostic rules contract.
 *
 * The engine operates against this interface — it never has D&D 5e hardcoded.
 * `dnd5e2014RulesSystem` is the first concrete implementation.
 * See `dnd5e2014/RULE_ORDER.md` for the correctness contract behind that impl.
 */
export interface RulesSystem {
  id: string
  label: string

  /**
   * Returns the proficiency bonus for a given total character level.
   * D&D 5e 2014: floor((level - 1) / 4) + 2
   */
  proficiencyBonus(level: number): number

  /**
   * Returns the ability score modifier for a given score.
   * D&D 5e 2014: floor((score - 10) / 2)
   */
  abilityModifier(score: number): number

  /**
   * Stacking config for a given value domain + modifier kind combination.
   * Used by the modifier resolver to collapse multiple grants into one value.
   */
  stackingConfig(domain: ValueDomainCode, modifierKind: string): ModifierStackingConfig

  /**
   * Order in which grant kinds are applied within a single feature.
   * Lower index = applied first. Values are GRANT_KIND constants.
   */
  grantApplicationOrder: readonly string[]

  /**
   * Order in which feature sources are processed.
   * Lower index = processed first. Values are CharacterProvenance `kind` strings.
   */
  featureSourceOrder: readonly string[]
}
