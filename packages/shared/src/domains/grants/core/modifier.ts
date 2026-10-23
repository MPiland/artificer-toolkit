import type { ChargeLimitPayload, DurationAuthored, SavingThrowAuthored } from '#authored'
import type {
  AbilityCode,
  AbilityModifierReference,
  AttackDomainCode,
  ChargeResetKind,
  DurationKind,
  RangeKind,
  ShapeKind,
  ValueDomainCode,
  CoreMeta,
  DamageDefenseBypassCode,
  LengthUnitCode,
  MovementPassageOption,
  ValueDomainOptionPayloadByDomain,
  ValueDomainParam
} from '#core'
import { valuesOf } from '#utils'

export const MODIFIER_KIND = {
  // Numeric
  BONUS: 'BONUS',
  PENALTY: 'PENALTY',
  SET_VALUE: 'SET_VALUE',
  CAP_VALUE: 'CAP_VALUE',
  MULTIPLY: 'MULTIPLY',
  ABILITY_MODIFIER_BONUS: 'ABILITY_MODIFIER_BONUS',

  // Dice / damage
  ADD_BONUS_DIE: 'ADD_BONUS_DIE',
  REPLACE_DAMAGE_TYPE: 'REPLACE_DAMAGE_TYPE',

  // Roll state: the influence is a code from the System's roll-influence vocabulary
  ROLL_INFLUENCE: 'ROLL_INFLUENCE',
  SUPPRESS_ROLL_INFLUENCE: 'SUPPRESS_ROLL_INFLUENCE',
  MINIMUM_ROLL: 'MINIMUM_ROLL',

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

/**
 * The System roll-influence code a `kind` grant carries, or null when the modifier is another kind.
 * Readers never interpret the code; the System's roll-mode policy does.
 */
export function modifierRollInfluence(
  modifier: { readonly modifierKind: string; readonly payload?: unknown },
  kind: 'ROLL_INFLUENCE' | 'SUPPRESS_ROLL_INFLUENCE' = MODIFIER_KIND.ROLL_INFLUENCE
): string | null {
  const { payload } = modifier
  return modifier.modifierKind === kind &&
    typeof payload === 'object' &&
    payload !== null &&
    'influence' in payload &&
    typeof payload.influence === 'string'
    ? payload.influence
    : null
}

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

  CAP_VALUE: {
    code: MODIFIER_KIND.CAP_VALUE,
    label: 'Cap Value',
    description: 'Limit the value to at most a specific amount.'
  },

  MULTIPLY: {
    code: MODIFIER_KIND.MULTIPLY,
    label: 'Multiply',
    description: 'Multiply the value by a fraction, rounded down.'
  },

  ABILITY_MODIFIER_BONUS: {
    code: MODIFIER_KIND.ABILITY_MODIFIER_BONUS,
    label: 'Ability Modifier Bonus',
    description: 'Add a specific ability modifier to the domain.'
  },

  ADD_BONUS_DIE: {
    code: MODIFIER_KIND.ADD_BONUS_DIE,
    label: 'Add Rolled Die',
    description: 'Roll dice and add them to, or subtract them from, the d20 test or the damage.'
  },

  REPLACE_DAMAGE_TYPE: {
    code: MODIFIER_KIND.REPLACE_DAMAGE_TYPE,
    label: 'Replace Damage Type',
    description: 'Change the damage type.'
  },

  ROLL_INFLUENCE: {
    code: MODIFIER_KIND.ROLL_INFLUENCE,
    label: 'Roll Influence',
    description: "Apply one of the Game System's roll influences to the roll."
  },

  SUPPRESS_ROLL_INFLUENCE: {
    code: MODIFIER_KIND.SUPPRESS_ROLL_INFLUENCE,
    label: 'Suppress Roll Influence',
    description: 'The roll cannot have this influence; every other influence still applies.'
  },

  MINIMUM_ROLL: {
    code: MODIFIER_KIND.MINIMUM_ROLL,
    label: 'Minimum Roll',
    description: 'Treat each d20 rolled for the test as at least this number.'
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

export const MODIFIER_KINDS_BY_DOMAIN = {
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

  INITIATIVE: [MODIFIER_KIND.BONUS, MODIFIER_KIND.PENALTY, MODIFIER_KIND.ROLL_INFLUENCE],

  ABILITY_CHECK: [
    MODIFIER_KIND.ROLL_INFLUENCE,
    MODIFIER_KIND.ADD_BONUS_DIE,
    MODIFIER_KIND.MINIMUM_ROLL
  ],

  SAVE_DC: [MODIFIER_KIND.BONUS, MODIFIER_KIND.PENALTY, MODIFIER_KIND.SET_VALUE],

  SAVING_THROW_MODIFIER: [
    MODIFIER_KIND.BONUS,
    MODIFIER_KIND.PENALTY,
    MODIFIER_KIND.ROLL_INFLUENCE,
    MODIFIER_KIND.ADD_BONUS_DIE
  ],

  ATTACK_ROLL: [
    MODIFIER_KIND.BONUS,
    MODIFIER_KIND.PENALTY,
    MODIFIER_KIND.ROLL_INFLUENCE,
    MODIFIER_KIND.ABILITY_MODIFIER_BONUS,
    MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS,
    MODIFIER_KIND.ADD_BONUS_DIE
  ],

  ATTACKS_AGAINST: [MODIFIER_KIND.ROLL_INFLUENCE, MODIFIER_KIND.SUPPRESS_ROLL_INFLUENCE],

  ATTACK_TRAIT: [MODIFIER_KIND.ENABLE],

  WEAPON_DAMAGE_DIE: [MODIFIER_KIND.SET_VALUE],

  CRITICAL_HIT_THRESHOLD: [MODIFIER_KIND.CAP_VALUE],

  CRITICAL_EXTRA_DICE: [MODIFIER_KIND.BONUS],

  OPPORTUNITY_ATTACK_IMMUNITY: [MODIFIER_KIND.ENABLE],

  SPELLCASTING_LOCK: [MODIFIER_KIND.ENABLE],

  ACTION_BONUS_ACTION_EXCLUSIVITY: [MODIFIER_KIND.ENABLE],

  ATTACK_DECOYS: [MODIFIER_KIND.ENABLE],

  DAMAGE_INTERCEPTION: [MODIFIER_KIND.ENABLE],

  INCOMING_ATTACK_GATE: [MODIFIER_KIND.ENABLE],

  HEALING_RECEIVED: [MODIFIER_KIND.ENABLE],

  SKILL_MODIFIER: [MODIFIER_KIND.BONUS, MODIFIER_KIND.PENALTY, MODIFIER_KIND.ROLL_INFLUENCE],

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

  SPEED: [
    MODIFIER_KIND.BONUS,
    MODIFIER_KIND.PENALTY,
    MODIFIER_KIND.SET_VALUE,
    MODIFIER_KIND.MULTIPLY
  ],

  MOVEMENT_MODE: [MODIFIER_KIND.ADD_OPTION, MODIFIER_KIND.REMOVE_OPTION],

  MOVEMENT_PASSAGE: [MODIFIER_KIND.ADD_OPTION],

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

  ATTACKS_PER_ATTACK_ACTION: [MODIFIER_KIND.SET_VALUE, MODIFIER_KIND.CAP_VALUE],

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

  SPELL_SCHOOL_IMMUNITY: [MODIFIER_KIND.ADD_OPTION, MODIFIER_KIND.REMOVE_OPTION],

  CHECKS_AGAINST_HOLDER: [MODIFIER_KIND.ADD_OPTION, MODIFIER_KIND.REMOVE_OPTION],

  ATTRIBUTE: [MODIFIER_KIND.ADD_OPTION, MODIFIER_KIND.REMOVE_OPTION]
} as const satisfies Record<ValueDomainCode, readonly ModifierKind[]>

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
  DAMAGE_RESISTANCE: { damageTypeId: string; bypassedBy?: DamageDefenseBypassCode[] }
  /**
   * `sourceEffectIds` limits the immunity to damage from actions owned by that authored content.
   * `bypassedBy` limits a defense to attacks without any of those traits (nonmagical attacks).
   */
  DAMAGE_IMMUNITY: {
    damageTypeId: string
    sourceEffectIds?: string[]
    bypassedBy?: DamageDefenseBypassCode[]
  }
  DAMAGE_VULNERABILITY: { damageTypeId: string }

  CONDITION: { conditionTypeId: string }

  CONDITION_IMMUNITY: { conditionTypeId: string }

  SPELL_SCHOOL_IMMUNITY: { magicSchoolId: string }

  CHECKS_AGAINST_HOLDER: { skillId: string }

  ATTRIBUTE: { attributeId: string }

  MOVEMENT_MODE: { movementModeId: string }

  MOVEMENT_PASSAGE: MovementPassageOption
}

export const MODIFIER_VALUE_SOURCE_CODE = {
  FIXED: 'FIXED',
  PROFICIENCY_BONUS: 'PROFICIENCY_BONUS',
  ABILITY_MODIFIER: 'ABILITY_MODIFIER',
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

  ABILITY_MODIFIER: {
    code: MODIFIER_VALUE_SOURCE_CODE.ABILITY_MODIFIER,
    label: 'Ability Modifier',
    description: 'Adds an ability modifier, optionally scaled and bounded.'
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
  | {
      valueKind: 'ABILITY_MODIFIER'
      ability: AbilityCode
      multiplier?: number
      min?: number
      max?: number
    }
  | { valueKind: 'SKILL_BONUS'; skillId: string; multiplier?: number }
  | { valueKind: 'CHARACTER_LEVEL'; multiplier?: number }
  | { valueKind: 'CLASS_LEVEL'; classId: string; multiplier?: number }
  // NOTE: slot/spell level is contextual; keep it scalar-only if needed
  | {
      valueKind: 'SPELL_SLOT_LEVEL'
      multiplier?: number
      subtractLevels?: number
      /** Slot levels per step of `multiplier` (Magic Weapon's +1 per two levels); default 1. */
      levelsPerStep?: number
      maximum?: number
    }

/** A speed or sense range modifier is a typed length, never a bare number (D112). */
export type ModifierLengthAuthored = { amount: number; unit: LengthUnitCode }

/** The die sizes a rolled-die modifier rolls. */
export const ROLLED_DIE_FACES = [4, 6, 8, 10, 12] as const

/** The most dice one rolled-die modifier rolls. */
export const MAX_ROLLED_DIE_COUNT = 10

/** Whether a rolled die adds to the d20 test's total or subtracts from it. */
export const ROLLED_DIE_SIGN = { ADD: 'ADD', SUBTRACT: 'SUBTRACT' } as const
export type RolledDieSign = (typeof ROLLED_DIE_SIGN)[keyof typeof ROLLED_DIE_SIGN]

export const ROLLED_DIE_SIGN_OPTIONS: readonly CoreMeta<RolledDieSign>[] = [
  { code: ROLLED_DIE_SIGN.ADD, label: 'Add' },
  { code: ROLLED_DIE_SIGN.SUBTRACT, label: 'Subtract' }
]

/**
 * When a d20 test's rolled die joins it: with the d20 (absent), or only after the d20 is seen, by
 * the roller's choice in the roll's window (D168).
 */
export const ROLLED_DIE_TIMING = { AFTER_ROLL: 'AFTER_ROLL' } as const
export type RolledDieTiming = (typeof ROLLED_DIE_TIMING)[keyof typeof ROLLED_DIE_TIMING]

export const ROLLED_DIE_TIMING_OPTIONS: readonly CoreMeta<RolledDieTiming>[] = [
  {
    code: ROLLED_DIE_TIMING.AFTER_ROLL,
    label: 'After the roll',
    description: 'Offered once the d20 is seen; rolled and added only if the roller chooses it.'
  }
]

/**
 * Dice rolled with a d20 test and added to or subtracted from its total after advantage or
 * disadvantage keeps one d20 (Bless's +1d4, Bane's -1d4). An `AFTER_ROLL` die joins the total only
 * through the roll's window; it is never rolled with the d20.
 */
export type ModifierRolledDieAuthored = {
  count: number
  faces: (typeof ROLLED_DIE_FACES)[number]
  sign: RolledDieSign
  timing?: RolledDieTiming
}

/** Who deals the damage a rolled damage die joins: the holder, or the effect's source to the holder. */
export const DAMAGE_DIE_RECIPIENT = {
  HOLDER_DEALS: 'HOLDER_DEALS',
  SOURCE_DEALS_TO_HOLDER: 'SOURCE_DEALS_TO_HOLDER'
} as const
export type DamageDieRecipient = (typeof DAMAGE_DIE_RECIPIENT)[keyof typeof DAMAGE_DIE_RECIPIENT]

export const DAMAGE_DIE_RECIPIENT_OPTIONS: readonly CoreMeta<DamageDieRecipient>[] = [
  {
    code: DAMAGE_DIE_RECIPIENT.HOLDER_DEALS,
    label: 'Damage the holder deals',
    description: 'Joins the damage of the holder’s attacks (Divine Favor).'
  },
  {
    code: DAMAGE_DIE_RECIPIENT.SOURCE_DEALS_TO_HOLDER,
    label: 'Damage the source deals to the holder',
    description: 'Joins the damage the effect’s source deals to the marked holder (Hunter’s Mark).'
  }
]

/**
 * Dice a damage roll adds (Divine Favor's 1d4 radiant) or subtracts (Reduce's 1d4), doubled on a
 * critical hit. An added die names its damage type or takes the attack's; a subtracted die always
 * lowers the attack's damage. A slot-scaled die adds `countPerCastLevelAbove.count` dice per cast
 * level above `level`, fixed at the cast (Branding Smite).
 */
export type ModifierDamageDieAuthored = Omit<ModifierRolledDieAuthored, 'sign' | 'timing'> & {
  recipient: DamageDieRecipient
  countPerCastLevelAbove?: { level: number; count: number }
} & (
    | { sign: typeof ROLLED_DIE_SIGN.ADD; damageTypeId: string }
    | { sign: RolledDieSign; damageTypeSource: 'ATTACK' }
  )

/**
 * The domain a modifier kind is scoped by. A rolled die on saving throws may omit the ability, so
 * one grant covers every save, death saves included (D156); a rolled damage die may omit the attack
 * domain, so it joins every damage its recipient deals, spells included (Bestow Curse).
 */
export type ModifierDomainFor<
  V extends ValueDomainCode,
  K extends ModifierKind
> = K extends 'ADD_BONUS_DIE'
  ? V extends 'SAVING_THROW_MODIFIER'
    ? { ability?: AbilityCode }
    : V extends 'DAMAGE'
      ? { attackDomain?: AttackDomainCode }
      : ValueDomainParam<V>
  : ValueDomainParam<V>

/** A fraction a value is multiplied by, rounded down (D94): "your speed is halved" is 1/2. */
export type ModifierFractionAuthored = { numerator: number; denominator: number }

/**
 * The decoys an attack against the holder may target instead (Mirror Image): each decoy's armor
 * class formula, and the d20 roll an attack needs to target one while that many remain.
 */
export type ModifierAttackDecoysAuthored = {
  armorClass: { amount: number; abilities: AbilityCode[] }
  thresholds: { id: string; remaining: number; minimumRoll: number }[]
  exemptAttackerSenseDefinitionIds?: string[]
}

/**
 * Damage that would drop the holder to 0 hit points leaves it at `dropToHitPoints` instead (Death
 * Ward, Undead Fortitude, Relentless Endurance). `negatesKill` also negates an instant-death effect
 * (`KILL`) against the holder. The held effect's `uses` count the interceptions it spends.
 */
export type ModifierDamageInterceptionAuthored = {
  dropToHitPoints: number // int, at least 1
  negatesKill: boolean
  /**
   * The holder must pass this save to be intercepted (Undead Fortitude): the DC is `base`, plus the
   * damage taken when `plusDamageTaken`. A failed save lets the damage land and spends no use.
   */
  save?: { ability: AbilityCode; dc: { base: number; plusDamageTaken: boolean } }
  /** Damage this interception does not meet: of these types, or from a critical hit. */
  excludes?: { damageTypeIds: string[]; critical: boolean }
  /** Only damage of at most this many hit points is intercepted (Relentless: 14). */
  maxDamageTaken?: number // int, at least 1
}

/**
 * While held, a creature that targets the holder with a single-target attack or harmful spell must
 * first make this save against the holder's source; on a failure the attack or spell is lost.
 */
export type ModifierIncomingAttackGateAuthored = {
  savingThrow: SavingThrowAuthored
  /** Only attackers of these Creature types owe the save (Nature's Sanctuary: beasts and plants). */
  attackerCreatureTypeIds?: string[]
  /** An attacker who passes is free of this ward for the duration. */
  successImmunity?: { duration: DurationAuthored }
}

export type ModifierPayloadFor<V extends ValueDomainCode, K extends ModifierKind> =
  // numeric-like
  K extends 'ENABLE'
    ? V extends 'ATTACK_DECOYS'
      ? ModifierAttackDecoysAuthored
      : V extends 'DAMAGE_INTERCEPTION'
        ? ModifierDamageInterceptionAuthored
        : V extends 'INCOMING_ATTACK_GATE'
          ? ModifierIncomingAttackGateAuthored
          : undefined
    : K extends 'MULTIPLY'
      ? ModifierFractionAuthored
      : K extends 'BONUS' | 'PENALTY' | 'SET_VALUE' | 'CAP_VALUE'
        ? V extends 'SPEED' | 'SENSE_RANGE'
          ? ModifierLengthAuthored
          : K extends 'SET_VALUE' | 'CAP_VALUE'
            ? V extends 'DURATION'
              ?
                  | { durationKind: Extract<DurationKind, 'INSTANTANEOUS'> }
                  | { durationKind: Exclude<DurationKind, 'INSTANTANEOUS'>; amount: number }
              : V extends 'ARMOR_CLASS'
                ? // An armor class formula: the amount plus each listed ability modifier.
                  { amount: number; abilities: AbilityCode[] }
                : { amount: number }
            : ModifierScalarValueAuthored
        : K extends 'ABILITY_MODIFIER_BONUS'
          ? { ability: AbilityCode; multiplier?: number; min?: number; max?: number }
          : K extends 'MODIFY_CHARGE_LIMIT'
            ? ChargeLimitPayload
            : K extends 'MINIMUM_ROLL'
              ? { amount: number }
              : K extends 'ADD_BONUS_DIE'
                ? V extends 'DAMAGE'
                  ? ModifierDamageDieAuthored
                  : ModifierRolledDieAuthored
                : K extends 'REPLACE_DAMAGE_TYPE'
                  ? { damageTypeId: string } // consider renaming to REPLACE_DAMAGE_TYPE
                  : K extends 'REPLACE_RANGE_KIND'
                    ? { rangeKind: RangeKind }
                    : K extends 'REPLACE_DURATION_KIND'
                      ? { durationKind: DurationKind }
                      : K extends 'REPLACE_SHAPE_KIND'
                        ? { shapeKind: ShapeKind }
                        : K extends 'REPLACE_CHARGE_RESET_KIND'
                          ? { resetKind: ChargeResetKind }
                          : K extends 'ROLL_INFLUENCE' | 'SUPPRESS_ROLL_INFLUENCE'
                            ? { influence: string }
                            : K extends 'ENABLE'
                              ? undefined
                              : K extends 'OPTIONAL_ABILITY_MODIFIER_BONUS'
                                ? {
                                    abilities: AbilityModifierReference[]
                                    min?: number
                                    max?: number
                                  }
                                : // option-like operations must be domain-supported
                                  K extends 'ADD_OPTION' | 'REMOVE_OPTION' | 'REPLACE_OPTION'
                                  ? V extends keyof ValueDomainOptionPayloadByDomain
                                    ? ValueDomainOptionPayloadByDomain[V]
                                    : never
                                  : never
