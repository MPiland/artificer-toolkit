import type { ChargeLimitPayload } from '#authored'
import type {
  AbilityCode,
  ValueDomainCode,
  CoreMeta,
  LengthUnitCode,
  ValueDomainOptionPayloadByDomain
} from '#core'
import { valuesOf } from '#utils'

export const MODIFIER_KIND = {
  // Numeric
  BONUS: 'BONUS',
  PENALTY: 'PENALTY',
  SET_VALUE: 'SET_VALUE',
  ABILITY_MODIFIER_BONUS: 'ABILITY_MODIFIER_BONUS',

  // Dice / damage
  ADD_BONUS_DIE: 'ADD_BONUS_DIE',
  REPLACE_DAMAGE_TYPE: 'REPLACE_DAMAGE_TYPE',

  // Roll state
  ADVANTAGE: 'ADVANTAGE',
  DISADVANTAGE: 'DISADVANTAGE',

  // Switches a domain's rule on; the domain says what it enables
  ENABLE: 'ENABLE',

  // Set-like mutations (domain-correlated)
  ADD_OPTION: 'ADD_OPTION',
  REMOVE_OPTION: 'REMOVE_OPTION',

  // Domain-specific replacements
  REPLACE_RANGE_KIND: 'REPLACE_RANGE_KIND',
  REPLACE_DURATION_KIND: 'REPLACE_DURATION_KIND',
  REPLACE_SHAPE_KIND: 'REPLACE_SHAPE_KIND',
  REPLACE_CHARGE_RESET_KIND: 'REPLACE_CHARGE_RESET_KIND',

  // Charges / misc
  MODIFY_CHARGE_LIMIT: 'MODIFY_CHARGE_LIMIT',
  OPTIONAL_ABILITY_MODIFIER_BONUS: 'OPTIONAL_ABILITY_MODIFIER_BONUS'
} as const

export type ModifierKind = keyof typeof MODIFIER_KIND

export type ModifierTypeOption = CoreMeta<ModifierKind>

export const MODIFIER_KIND_REGISTRY: Record<ModifierKind, ModifierTypeOption> = {
  BONUS: {
    code: MODIFIER_KIND.BONUS,
    label: 'Bonus',
    description: 'Add a bonus to the selected value.'
  },

  PENALTY: {
    code: MODIFIER_KIND.PENALTY,
    label: 'Penalty',
    description: 'Apply a penalty to the selected value.'
  },

  SET_VALUE: {
    code: MODIFIER_KIND.SET_VALUE,
    label: 'Set Value',
    description: 'Set the value to a specific amount.'
  },

  ABILITY_MODIFIER_BONUS: {
    code: MODIFIER_KIND.ABILITY_MODIFIER_BONUS,
    label: 'Ability Modifier Bonus',
    description: 'Add a specific ability modifier to the domain.'
  },

  ADD_BONUS_DIE: {
    code: MODIFIER_KIND.ADD_BONUS_DIE,
    label: 'Add Bonus Die',
    description: 'Add an additional die to the roll.'
  },

  REPLACE_DAMAGE_TYPE: {
    code: MODIFIER_KIND.REPLACE_DAMAGE_TYPE,
    label: 'Replace Damage Type',
    description: 'Change the damage type.'
  },

  ADVANTAGE: {
    code: MODIFIER_KIND.ADVANTAGE,
    label: 'Advantage',
    description: 'Grant advantage on the roll.'
  },

  DISADVANTAGE: {
    code: MODIFIER_KIND.DISADVANTAGE,
    label: 'Disadvantage',
    description: 'Grant disadvantage on the roll.'
  },

  ENABLE: {
    code: MODIFIER_KIND.ENABLE,
    label: 'Enable',
    description: 'Switch the selected rule on.'
  },

  ADD_OPTION: {
    code: MODIFIER_KIND.ADD_OPTION,
    label: 'Add',
    description: 'Add a new property or attribute.'
  },

  REMOVE_OPTION: {
    code: MODIFIER_KIND.REMOVE_OPTION,
    label: 'Remove',
    description: 'Remove an existing property or attribute.'
  },

  REPLACE_RANGE_KIND: {
    code: MODIFIER_KIND.REPLACE_RANGE_KIND,
    label: 'Replace Range Kind',
    description: 'Replace the range kind.'
  },

  REPLACE_DURATION_KIND: {
    code: MODIFIER_KIND.REPLACE_DURATION_KIND,
    label: 'Replace Duration Kind',
    description: 'Replace the duration kind.'
  },

  REPLACE_SHAPE_KIND: {
    code: MODIFIER_KIND.REPLACE_SHAPE_KIND,
    label: 'Replace Shape Kind',
    description: 'Replace the shape kind.'
  },

  REPLACE_CHARGE_RESET_KIND: {
    code: MODIFIER_KIND.REPLACE_CHARGE_RESET_KIND,
    label: 'Replace Charge Reset',
    description: 'Replace the reset timing.'
  },

  MODIFY_CHARGE_LIMIT: {
    code: MODIFIER_KIND.MODIFY_CHARGE_LIMIT,
    label: 'Modify Charge Limit',
    description: 'Change the number of available uses.'
  },

  OPTIONAL_ABILITY_MODIFIER_BONUS: {
    code: MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS,
    label: 'Optional Ability Modifier Bonus',
    description: 'Use the highest modifier from a set of allowed abilities.'
  }
} as const

export const MODIFIER_SCOPE_KIND = {
  GLOBAL: 'GLOBAL',
  SOURCE: 'SOURCE'
} as const

export type ModifierScopeKind = keyof typeof MODIFIER_SCOPE_KIND

export type ModifierScopeOption = CoreMeta<ModifierScopeKind>

export const MODIFIER_SCOPE_REGISTRY: Record<ModifierScopeKind, ModifierScopeOption> = {
  [MODIFIER_SCOPE_KIND.GLOBAL]: {
    code: MODIFIER_SCOPE_KIND.GLOBAL,
    label: 'Global',
    description: 'Applies to character globally.'
  },

  [MODIFIER_SCOPE_KIND.SOURCE]: {
    code: MODIFIER_SCOPE_KIND.SOURCE,
    label: 'Source',
    description: 'Applies to a specific source.'
  }
}

export const MODIFIER_SCOPE_OPTIONS = valuesOf(
  MODIFIER_SCOPE_REGISTRY
) as readonly ModifierScopeOption[]

export const MODIFIER_KINDS_BY_DOMAIN: Record<ValueDomainCode, readonly ModifierKind[]> = {
  /* ──────────────────────────────────────────────
   * CORE NUMERIC VALUES
   * ────────────────────────────────────────────── */

  HIT_POINTS_MAX: [MODIFIER_KIND.BONUS, MODIFIER_KIND.PENALTY, MODIFIER_KIND.SET_VALUE],

  TEMPORARY_HIT_POINTS: [MODIFIER_KIND.BONUS, MODIFIER_KIND.PENALTY, MODIFIER_KIND.SET_VALUE],

  ARMOR_CLASS: [
    MODIFIER_KIND.BONUS,
    MODIFIER_KIND.PENALTY,
    MODIFIER_KIND.SET_VALUE,
    MODIFIER_KIND.ABILITY_MODIFIER_BONUS,
    MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS
  ],

  INITIATIVE: [
    MODIFIER_KIND.BONUS,
    MODIFIER_KIND.PENALTY,
    MODIFIER_KIND.ADVANTAGE,
    MODIFIER_KIND.DISADVANTAGE
  ],

  ABILITY_CHECK: [MODIFIER_KIND.ADVANTAGE, MODIFIER_KIND.DISADVANTAGE],

  SAVE_DC: [MODIFIER_KIND.BONUS, MODIFIER_KIND.PENALTY, MODIFIER_KIND.SET_VALUE],

  SAVING_THROW_MODIFIER: [
    MODIFIER_KIND.BONUS,
    MODIFIER_KIND.PENALTY,
    MODIFIER_KIND.ADVANTAGE,
    MODIFIER_KIND.DISADVANTAGE
  ],

  ATTACK_ROLL: [
    MODIFIER_KIND.BONUS,
    MODIFIER_KIND.PENALTY,
    MODIFIER_KIND.ADVANTAGE,
    MODIFIER_KIND.DISADVANTAGE,
    MODIFIER_KIND.ABILITY_MODIFIER_BONUS,
    MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS
  ],

  ATTACKS_AGAINST: [MODIFIER_KIND.ADVANTAGE, MODIFIER_KIND.DISADVANTAGE],

  OPPORTUNITY_ATTACK_IMMUNITY: [MODIFIER_KIND.ENABLE],

  SKILL_MODIFIER: [
    MODIFIER_KIND.BONUS,
    MODIFIER_KIND.PENALTY,
    MODIFIER_KIND.ADVANTAGE,
    MODIFIER_KIND.DISADVANTAGE
  ],

  ABILITY_SCORE: [MODIFIER_KIND.BONUS, MODIFIER_KIND.PENALTY, MODIFIER_KIND.SET_VALUE],

  PROFICIENCY_BONUS: [MODIFIER_KIND.BONUS, MODIFIER_KIND.SET_VALUE],

  /* ──────────────────────────────────────────────
   * DAMAGE
   * ────────────────────────────────────────────── */

  DAMAGE: [
    MODIFIER_KIND.BONUS,
    MODIFIER_KIND.PENALTY,
    MODIFIER_KIND.ADD_BONUS_DIE,
    MODIFIER_KIND.REPLACE_DAMAGE_TYPE,
    MODIFIER_KIND.ABILITY_MODIFIER_BONUS,
    MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS
  ],

  DAMAGE_RESISTANCE: [MODIFIER_KIND.ADD_OPTION, MODIFIER_KIND.REMOVE_OPTION],

  DAMAGE_IMMUNITY: [MODIFIER_KIND.ADD_OPTION, MODIFIER_KIND.REMOVE_OPTION],

  DAMAGE_VULNERABILITY: [MODIFIER_KIND.ADD_OPTION, MODIFIER_KIND.REMOVE_OPTION],

  /* ──────────────────────────────────────────────
   * MOVEMENT & SENSES
   * ────────────────────────────────────────────── */

  SPEED: [MODIFIER_KIND.BONUS, MODIFIER_KIND.PENALTY, MODIFIER_KIND.SET_VALUE],

  MOVEMENT_MODE: [MODIFIER_KIND.ADD_OPTION, MODIFIER_KIND.REMOVE_OPTION],

  SENSE_RANGE: [MODIFIER_KIND.BONUS],

  /* ──────────────────────────────────────────────
   * SPELL STRUCTURE
   * ────────────────────────────────────────────── */

  RANGE: [MODIFIER_KIND.REPLACE_RANGE_KIND],

  DURATION: [MODIFIER_KIND.SET_VALUE, MODIFIER_KIND.REPLACE_DURATION_KIND],

  SHAPE: [MODIFIER_KIND.REPLACE_SHAPE_KIND],

  /* ──────────────────────────────────────────────
   * SPELLCASTING LIMITS
   * ────────────────────────────────────────────── */

  SPELL_SLOT_COUNT: [MODIFIER_KIND.BONUS, MODIFIER_KIND.SET_VALUE],

  SPELL_SLOT_LEVEL_MAX: [MODIFIER_KIND.SET_VALUE],

  SPELLS_KNOWN: [MODIFIER_KIND.BONUS, MODIFIER_KIND.SET_VALUE],

  SPELLS_PREPARED: [MODIFIER_KIND.BONUS, MODIFIER_KIND.SET_VALUE],

  /* ──────────────────────────────────────────────
   * ACTION ECONOMY
   * ────────────────────────────────────────────── */

  ACTION_COUNT: [MODIFIER_KIND.BONUS, MODIFIER_KIND.SET_VALUE],

  BONUS_ACTION_COUNT: [MODIFIER_KIND.BONUS, MODIFIER_KIND.SET_VALUE],

  REACTION_COUNT: [MODIFIER_KIND.BONUS, MODIFIER_KIND.SET_VALUE],

  ATTACKS_PER_ATTACK_ACTION: [MODIFIER_KIND.SET_VALUE],

  /* ──────────────────────────────────────────────
   * CHARGES / RESOURCES
   * ────────────────────────────────────────────── */

  CHARGE_LIMIT: [MODIFIER_KIND.MODIFY_CHARGE_LIMIT, MODIFIER_KIND.SET_VALUE],

  CHARGE_RESET: [MODIFIER_KIND.REPLACE_CHARGE_RESET_KIND],

  /* ──────────────────────────────────────────────
   * CONDITIONS / ATTRIBUTES
   * ────────────────────────────────────────────── */

  CONDITION: [MODIFIER_KIND.ADD_OPTION, MODIFIER_KIND.REMOVE_OPTION],

  CONDITION_IMMUNITY: [MODIFIER_KIND.ADD_OPTION, MODIFIER_KIND.REMOVE_OPTION],

  ATTRIBUTE: [MODIFIER_KIND.ADD_OPTION, MODIFIER_KIND.REMOVE_OPTION]
} as const

export type ModifierKindsByDomain<V extends ValueDomainCode> =
  (typeof MODIFIER_KINDS_BY_DOMAIN)[V][number]

/* ============================================================================
 * Domain-correlated payloads for option-like operations
 * ============================================================================
 *
 * Keep this narrow: only domains that actually support ADD/REMOVE.
 * (No generic "optionId".)
 */

export type ModifierValueDomainOptionPayloadByDomain = {
  DAMAGE_RESISTANCE: { damageTypeId: string }
  DAMAGE_IMMUNITY: { damageTypeId: string }
  DAMAGE_VULNERABILITY: { damageTypeId: string }

  CONDITION: { conditionTypeId: string }

  CONDITION_IMMUNITY: { conditionTypeId: string }

  ATTRIBUTE: { attributeId: string }

  MOVEMENT_MODE: { movementModeId: string }
}

export type ModifierKindsByDomiain<V extends ValueDomainCode> =
  (typeof MODIFIER_KINDS_BY_DOMAIN)[V][number]

export const MODIFIER_VALUE_SOURCE_CODE = {
  FIXED: 'FIXED',
  PROFICIENCY_BONUS: 'PROFICIENCY_BONUS',
  SKILL_BONUS: 'SKILL_BONUS',
  CHARACTER_LEVEL: 'CHARACTER_LEVEL',
  CLASS_LEVEL: 'CLASS_LEVEL',
  SPELL_SLOT_LEVEL: 'SPELL_SLOT_LEVEL'
} as const

export type ModifierValueSource = keyof typeof MODIFIER_VALUE_SOURCE_CODE

export type ModifierValueSourceOption = CoreMeta<ModifierValueSource>

export const MODIFIER_VALUE_SOURCE_REGISTRY: Record<
  ModifierValueSource,
  ModifierValueSourceOption
> = {
  FIXED: {
    code: MODIFIER_VALUE_SOURCE_CODE.FIXED,
    label: 'Fixed value',
    description: 'Use a fixed number such as 8 or 15.'
  },

  PROFICIENCY_BONUS: {
    code: MODIFIER_VALUE_SOURCE_CODE.PROFICIENCY_BONUS,
    label: 'Proficiency Bonus',
    description: 'Automatically scales with character level.'
  },

  SKILL_BONUS: {
    code: MODIFIER_VALUE_SOURCE_CODE.SKILL_BONUS,
    label: 'Skill Bonus',
    description: 'Includes proficiency, expertise, and other skill modifiers.'
  },

  CHARACTER_LEVEL: {
    code: MODIFIER_VALUE_SOURCE_CODE.CHARACTER_LEVEL,
    label: 'Character Level',
    description: 'Counts all class levels combined.'
  },

  CLASS_LEVEL: {
    code: MODIFIER_VALUE_SOURCE_CODE.CLASS_LEVEL,
    label: 'Class Level',
    description: 'Optionally select a class to reference.'
  },

  SPELL_SLOT_LEVEL: {
    code: MODIFIER_VALUE_SOURCE_CODE.SPELL_SLOT_LEVEL,
    label: 'Spell Level',
    description: 'Higher spell slots result in higher values.'
  }
} as const

export const MODIFIER_KIND_OPTIONS = valuesOf(
  MODIFIER_KIND_REGISTRY
) as readonly ModifierTypeOption[]

export const MODIFIER_VALUE_SOURCE_OPTIONS = valuesOf(
  MODIFIER_VALUE_SOURCE_REGISTRY
) as readonly ModifierValueSourceOption[]

export type ModifierScalarValueAuthored =
  | { valueKind: 'FIXED'; amount: number }
  | { valueKind: 'PROFICIENCY_BONUS'; multiplier?: number }
  | { valueKind: 'SKILL_BONUS'; skillId: string; multiplier?: number }
  | { valueKind: 'CHARACTER_LEVEL'; multiplier?: number }
  | { valueKind: 'CLASS_LEVEL'; classId: string; multiplier?: number }
  // NOTE: slot/spell level is contextual; keep it scalar-only if needed
  | { valueKind: 'SPELL_SLOT_LEVEL'; multiplier?: number; subtractLevels?: number }

/** A speed or sense range modifier is a typed length, never a bare number (D112). */
export type ModifierLengthAuthored = { amount: number; unit: LengthUnitCode }

export type ModifierPayloadFor<V extends ValueDomainCode, K extends ModifierKind> =
  // numeric-like
  K extends 'BONUS' | 'PENALTY' | 'SET_VALUE'
    ? V extends 'SPEED' | 'SENSE_RANGE'
      ? ModifierLengthAuthored
      : K extends 'SET_VALUE'
        ? V extends 'ARMOR_CLASS'
          ? // An armor class formula: the amount plus each listed ability modifier.
            { amount: number; abilities: AbilityCode[] }
          : { amount: number }
        : ModifierScalarValueAuthored
    : K extends 'ABILITY_MODIFIER_BONUS'
      ? { ability: AbilityCode; multiplier?: number; min?: number; max?: number }
      : K extends 'MODIFY_CHARGE_LIMIT'
        ? ChargeLimitPayload
        : K extends 'ADD_BONUS_DIE'
          ? { dice: string }
          : K extends 'REPLACE_DAMAGE_TYPE'
            ? { damageTypeId: string } // consider renaming to REPLACE_DAMAGE_TYPE
            : K extends 'ADVANTAGE' | 'DISADVANTAGE' | 'ENABLE'
              ? undefined
              : K extends 'OPTIONAL_ABILITY_MODIFIER_BONUS'
                ? { abilities: AbilityCode[] }
                : // option-like operations must be domain-supported
                  K extends 'ADD_OPTION' | 'REMOVE_OPTION' | 'REPLACE_OPTION'
                  ? V extends keyof ValueDomainOptionPayloadByDomain
                    ? ValueDomainOptionPayloadByDomain[V]
                    : never
                  : never

export type ModifierPayloadByDomain<
  V extends ValueDomainCode,
  K extends ModifierKindsByDomiain<V>
> = ModifierPayloadFor<V, K>
