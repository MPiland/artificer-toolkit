import type { ChargeLimitPayload } from '#authored'
import type { AbilityCode, ValueDomainCode, CoreMeta } from '#core'

export const MODIFIER_KIND = {
  BONUS: 'BONUS',
  PENALTY: 'PENALTY',
  SET_VALUE: 'SET_VALUE',
  ADD_BONUS_DIE: 'ADD_BONUS_DIE',
  REPLACE_DAMAGE: 'REPLACE_DAMAGE',
  ADVANTAGE: 'ADVANTAGE',
  DISADVANTAGE: 'DISADVANTAGE',
  REPLACE_OPTION: 'REPLACE_OPTION',
  ADD_OPTION: 'ADD_OPTION',
  REMOVE_OPTION: 'REMOVE_OPTION',
  MODIFY_CHARGE_LIMIT: 'MODIFY_CHARGE_LIMIT',
  OPTIONAL_ABILITY_MODIFIER: 'OPTIONAL_ABILITY_MODIFIER'
} as const

export type ModifierKind = keyof typeof MODIFIER_KIND

export type ModifierTypeOption = CoreMeta<ModifierKind>

export const MODIFIER_KIND_REGISTRY: Record<ModifierKind, ModifierTypeOption>
  = {
    BONUS: {
      code: MODIFIER_KIND.BONUS,
      label: 'Bonus',
      tooltip: 'Add a bonus to the selected value.',
      description:
        'Adds a positive bonus to the selected value, such as a flat number, ability modifier, proficiency bonus, or other calculated value.'
    },

    PENALTY: {
      code: MODIFIER_KIND.PENALTY,
      label: 'Penalty',
      tooltip: 'Apply a penalty to the selected value.',
      description:
        'Applies a negative modifier that reduces the selected value.'
    },

    SET_VALUE: {
      code: MODIFIER_KIND.SET_VALUE,
      label: 'Set Value',
      tooltip: 'Set the value to a specific amount.',
      description:
        'Overrides the existing value and sets it to a fixed or calculated value.'
    },

    ADD_BONUS_DIE: {
      code: MODIFIER_KIND.ADD_BONUS_DIE,
      label: 'Add Bonus Die',
      tooltip: 'Add an additional die to the roll.',
      description:
        'Adds one or more bonus dice to a roll, such as adding 1d4 to damage or another roll.'
    },

    REPLACE_DAMAGE: {
      code: MODIFIER_KIND.REPLACE_DAMAGE,
      label: 'Replace Damage',
      tooltip: 'Replace the existing damage.',
      description: 'Replaces the original damage definition with a new one.'
    },

    ADVANTAGE: {
      code: MODIFIER_KIND.ADVANTAGE,
      label: 'Advantage',
      tooltip: 'Grant advantage on the roll.',
      description: 'Causes the affected roll to be made with advantage.'
    },

    DISADVANTAGE: {
      code: MODIFIER_KIND.DISADVANTAGE,
      label: 'Disadvantage',
      tooltip: 'Grant disadvantage on the roll.',
      description: 'Causes the affected roll to be made with disadvantage.'
    },

    REPLACE_OPTION: {
      code: MODIFIER_KIND.REPLACE_OPTION,
      label: 'Replace Option',
      tooltip: 'Replace an existing option.',
      description:
        'Replaces a categorical option such as range type, duration type, shape, or reset timing with a new option.'
    },

    ADD_OPTION: {
      code: MODIFIER_KIND.ADD_OPTION,
      label: 'Add',
      tooltip: 'Add a new property or attribute.',
      description:
        'Adds a new entry to a set-like value, such as a resistance, immunity, sense, movement mode, or attribute.'
    },

    REMOVE_OPTION: {
      code: MODIFIER_KIND.REMOVE_OPTION,
      label: 'Remove',
      tooltip: 'Remove an existing property or attribute.',
      description:
        'Removes an entry from a set-like value, such as a resistance, immunity, sense, movement mode, or attribute.'
    },

    MODIFY_CHARGE_LIMIT: {
      code: MODIFIER_KIND.MODIFY_CHARGE_LIMIT,
      label: 'Modify Charge Limit',
      tooltip: 'Change the number of available uses.',
      description:
        'Modifies the maximum number of charges or uses available, potentially scaling with level or other values.'
    },

    OPTIONAL_ABILITY_MODIFIER: {
      code: MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER,
      label: 'Optional Ability Modifier',
      tooltip: 'Allow an alternate ability modifier.',
      description:
        'Allows the user to choose an alternate ability modifier to use instead of the default one.'
    }
  }

export const MODIFIER_SCOPE_KIND = {
  GLOBAL: 'GLOBAL',
  SOURCE: 'SOURCE'
} as const

export type ModifierScopeKind = keyof typeof MODIFIER_SCOPE_KIND

export type ModifierScopeOption = CoreMeta<ModifierScopeKind>

export const MODIFIER_SCOPE_REGISTRY: Record<
  ModifierScopeKind,
  ModifierScopeOption
> = {
  [MODIFIER_SCOPE_KIND.GLOBAL]: {
    code: MODIFIER_SCOPE_KIND.GLOBAL,
    label: 'Global',
    tooltip: 'Applies to character globally.',
    description: 'Applies to all sources for the character.'
  },

  [MODIFIER_SCOPE_KIND.SOURCE]: {
    code: MODIFIER_SCOPE_KIND.SOURCE,
    label: 'Source',
    tooltip: 'Applies to a specific source.',
    description: 'Applies to only this source for the character.'
  }
}

export const MODIFIER_KINDS_BY_DOMAIN: Record<ValueDomainCode, ModifierKind[]>
  = {
    /* ──────────────────────────────────────────────
     * CORE NUMERIC VALUES
     * ────────────────────────────────────────────── */

    HIT_POINTS_MAX: [
      MODIFIER_KIND.BONUS,
      MODIFIER_KIND.PENALTY,
      MODIFIER_KIND.SET_VALUE
    ],

    ARMOR_CLASS: [
      MODIFIER_KIND.BONUS,
      MODIFIER_KIND.PENALTY,
      MODIFIER_KIND.SET_VALUE
    ],

    INITIATIVE_BONUS: [MODIFIER_KIND.BONUS, MODIFIER_KIND.PENALTY],

    SAVE_DC: [
      MODIFIER_KIND.BONUS,
      MODIFIER_KIND.PENALTY,
      MODIFIER_KIND.SET_VALUE
    ],

    SAVING_THROW_BONUS: [MODIFIER_KIND.BONUS, MODIFIER_KIND.PENALTY],

    ATTACK_ROLL_BONUS: [
      MODIFIER_KIND.BONUS,
      MODIFIER_KIND.PENALTY,
      MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER
    ],

    SKILL_BONUS: [MODIFIER_KIND.BONUS, MODIFIER_KIND.PENALTY],

    ABILITY_SCORE: [
      MODIFIER_KIND.BONUS,
      MODIFIER_KIND.PENALTY,
      MODIFIER_KIND.SET_VALUE
    ],

    PROFICIENCY_BONUS: [MODIFIER_KIND.BONUS, MODIFIER_KIND.SET_VALUE],

    /* ──────────────────────────────────────────────
     * DAMAGE
     * ────────────────────────────────────────────── */

    DAMAGE: [
      MODIFIER_KIND.BONUS,
      MODIFIER_KIND.ADD_BONUS_DIE,
      MODIFIER_KIND.REPLACE_DAMAGE
    ],

    DAMAGE_RESISTANCE: [MODIFIER_KIND.ADD_OPTION, MODIFIER_KIND.REMOVE_OPTION],

    DAMAGE_IMMUNITY: [MODIFIER_KIND.ADD_OPTION, MODIFIER_KIND.REMOVE_OPTION],

    DAMAGE_VULNERABILITY: [
      MODIFIER_KIND.ADD_OPTION,
      MODIFIER_KIND.REMOVE_OPTION
    ],

    /* ──────────────────────────────────────────────
     * MOVEMENT & SENSES
     * ────────────────────────────────────────────── */

    SPEED: [
      MODIFIER_KIND.BONUS,
      MODIFIER_KIND.PENALTY,
      MODIFIER_KIND.SET_VALUE
    ],

    MOVEMENT_MODE: [MODIFIER_KIND.ADD_OPTION, MODIFIER_KIND.REMOVE_OPTION],

    SENSE_RANGE: [MODIFIER_KIND.BONUS, MODIFIER_KIND.SET_VALUE],

    /* ──────────────────────────────────────────────
     * SPELL STRUCTURE
     * ────────────────────────────────────────────── */

    RANGE: [MODIFIER_KIND.SET_VALUE, MODIFIER_KIND.REPLACE_OPTION],

    DURATION: [MODIFIER_KIND.SET_VALUE, MODIFIER_KIND.REPLACE_OPTION],

    SHAPE: [MODIFIER_KIND.REPLACE_OPTION],

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

    /* ──────────────────────────────────────────────
     * CHARGES / RESOURCES
     * ────────────────────────────────────────────── */

    CHARGE_LIMIT: [MODIFIER_KIND.MODIFY_CHARGE_LIMIT, MODIFIER_KIND.SET_VALUE],

    CHARGE_RESET: [MODIFIER_KIND.REPLACE_OPTION],

    /* ──────────────────────────────────────────────
     * CONDITIONS
     * ────────────────────────────────────────────── */
    CONDITION: [MODIFIER_KIND.ADD_OPTION, MODIFIER_KIND.REMOVE_OPTION],

    ATTRIBUTE: [MODIFIER_KIND.ADD_OPTION, MODIFIER_KIND.REMOVE_OPTION]
  } as const

export type ModifierKindsByDomiain<V extends ValueDomainCode>
  = (typeof MODIFIER_KINDS_BY_DOMAIN)[V][number]

export const MODIFIER_VALUE_SOURCE_CODE = {
  FIXED: 'FIXED',
  PROFICIENCY_BONUS: 'PROFICIENCY_BONUS',
  ABILITY_MODIFIER: 'ABILITY_MODIFIER',
  SKILL_BONUS: 'SKILL_BONUS',
  CHARACTER_LEVEL: 'CHARACTER_LEVEL',
  CLASS_LEVEL: 'CLASS_LEVEL',
  SPELL_LEVEL: 'SPELL_LEVEL'
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
    description: 'A constant numeric value that does not change.',
    tooltip: 'Use a fixed number such as 8 or 15.'
  },

  PROFICIENCY_BONUS: {
    code: MODIFIER_VALUE_SOURCE_CODE.PROFICIENCY_BONUS,
    label: 'Proficiency Bonus',
    description: 'Uses the character’s current proficiency bonus.',
    tooltip: 'Automatically scales with character level.'
  },

  ABILITY_MODIFIER: {
    code: MODIFIER_VALUE_SOURCE_CODE.ABILITY_MODIFIER,
    label: 'Ability Modifier',
    description: 'Uses the modifier of a selected ability.',
    tooltip: 'For example: Strength modifier or Spellcasting ability modifier.'
  },

  SKILL_BONUS: {
    code: MODIFIER_VALUE_SOURCE_CODE.SKILL_BONUS,
    label: 'Skill Bonus',
    description: 'Uses the bonus for a selected skill.',
    tooltip: 'Includes proficiency, expertise, and other skill modifiers.'
  },

  CHARACTER_LEVEL: {
    code: MODIFIER_VALUE_SOURCE_CODE.CHARACTER_LEVEL,
    label: 'Character Level',
    description: 'Uses the character\'s total level.',
    tooltip: 'Counts all class levels combined.'
  },

  CLASS_LEVEL: {
    code: MODIFIER_VALUE_SOURCE_CODE.CLASS_LEVEL,
    label: 'Class Level',
    description: 'Uses the level in a specific class.',
    tooltip: 'Optionally select a class to reference.'
  },

  SPELL_LEVEL: {
    code: MODIFIER_VALUE_SOURCE_CODE.SPELL_LEVEL,
    label: 'Spell Level',
    description: 'Uses the level the spell is cast at.',
    tooltip: 'Higher spell slots result in higher values.'
  }
} as const

export type ModifierValuePayloadByValue
  = | {
    valueKind: typeof MODIFIER_VALUE_SOURCE_CODE.FIXED
    amount: number
  } | {
    valueKind: typeof MODIFIER_VALUE_SOURCE_CODE.PROFICIENCY_BONUS
    multipler?: number
  } | {
    valueKind: typeof MODIFIER_VALUE_SOURCE_CODE.ABILITY_MODIFIER
    ability: AbilityCode
    multiplier?: number
  } | {
    valueKind: typeof MODIFIER_VALUE_SOURCE_CODE.SKILL_BONUS
    skillId: string
    multiplier?: number
  } | {
    valueKind: typeof MODIFIER_VALUE_SOURCE_CODE.CHARACTER_LEVEL
    multiplier?: number
  } | {
    valueKind: typeof MODIFIER_VALUE_SOURCE_CODE.CLASS_LEVEL
    classId: string
    multiplier?: number
  } | {
    valueKind: typeof MODIFIER_VALUE_SOURCE_CODE.SPELL_LEVEL
    spellId: string
    multiplier?: number
  }

export type ModifierValueByKind = {
  BONUS: ModifierValuePayloadByValue
  PENALTY: ModifierValuePayloadByValue
  SET_VALUE: { amount: number }
  MODIFY_CHARGE_LIMIT: ChargeLimitPayload
  ADD_BONUS_DIE: { dice: string }
  REPLACE_DAMAGE: { damageTypeId: string }
  ADVANTAGE: undefined
  DISADVANTAGE: undefined
  ADD_OPTION: {
    optionId: string // attributeId, damageTypeId, senseId, movementModeId
  }
  REMOVE_OPTION: {
    optionId: string // attributeId, damageTypeId, senseId, movementModeId
  }
  REPLACE_OPTION: {
    optionId: string // durationId, shapeId, rangeId, resetId, etc
  }
  OPTIONAL_ABILITY_MODIFIER: {
    abilities: AbilityCode[]
  }
}

export type ModifierValuePayload<K extends ModifierKind>
  = ModifierValueByKind[K]
