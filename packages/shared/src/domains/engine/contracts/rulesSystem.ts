import type { ValueDomainCode } from '../../core/valueDomain.js'
import type {
  CharacterMovementDisplayPreference,
  CharacterProficiencyLevel
} from '../../character/sheetAdjustment.js'

export type ModifierStackingRule = 'additive' | 'highest' | 'exclusive' | 'boolean' | 'last'

export interface ModifierStackingConfig {
  rule: ModifierStackingRule
}

export interface RestRulesPolicy {
  hitDiceRecoveredAfterLongRest(totalHitDice: number): number
}

export interface ExhaustionRulesPolicy {
  label: string
  description: string
  minimumLevel: number
  maximumLevel: number
  levelAfterLongRest(currentLevel: number): number
}

/**
 * System-agnostic rules contract.
 *
 * The engine operates against this interface — it never has D&D 5e hardcoded.
 * `dnd5e2014RulesSystem` is the first concrete implementation.
 * See `dnd5e2014/RULE_ORDER.md` for the correctness contract behind that impl.
 */
export interface RulesSystem {
  identity: {
    code: string
    version: string
  }
  label: string
  rest: RestRulesPolicy
  exhaustion: ExhaustionRulesPolicy

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

  /** Converts a Sheet proficiency level into its rules-system multiplier. */
  proficiencyMultiplier(level: CharacterProficiencyLevel): number

  /** Resolves a passive check from the already-adjusted skill bonus. */
  passiveScore(skillBonus: number): number

  /**
   * Selects the primary movement identity from backend-ordered available speeds.
   * An invalid explicit preference falls back through the system's AUTO policy.
   */
  selectPrimaryMovementSpeedId(
    speeds: ReadonlyArray<{ speedId: string; code?: string }>,
    preference: CharacterMovementDisplayPreference
  ): string | undefined

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
