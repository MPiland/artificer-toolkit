import type {
  AbilityCode,
  ChargeLimitKind,
  ChargeResetKind,
  DurationKind,
  RangeKind,
  ShapeKind,
  CoreMeta
} from '#core'
import { type EmptyObject, valuesOf } from '#utils'

export const VALUE_DOMAIN_CODE = {
  SPEED: 'SPEED',
  ATTACK_ROLL: 'ATTACK_ROLL',
  ARMOR_CLASS: 'ARMOR_CLASS',
  SAVE_DC: 'SAVE_DC',
  SAVING_THROW_MODIFIER: 'SAVING_THROW_MODIFIER',
  DAMAGE: 'DAMAGE',
  CONDITION: 'CONDITION',
  HIT_POINTS_MAX: 'HIT_POINTS_MAX',
  TEMPORARY_HIT_POINTS: 'TEMPORARY_HIT_POINTS',
  RANGE: 'RANGE',
  DURATION: 'DURATION',
  SHAPE: 'SHAPE',
  CHARGE_LIMIT: 'CHARGE_LIMIT',
  CHARGE_RESET: 'CHARGE_RESET',
  INITIATIVE: 'INITIATIVE',
  ABILITY_CHECK: 'ABILITY_CHECK',
  ABILITY_SCORE: 'ABILITY_SCORE',
  SKILL_MODIFIER: 'SKILL_MODIFIER',
  PROFICIENCY_BONUS: 'PROFICIENCY_BONUS',
  MOVEMENT_MODE: 'MOVEMENT_MODE',
  SENSE_RANGE: 'SENSE_RANGE',
  SPELL_SLOT_COUNT: 'SPELL_SLOT_COUNT',
  SPELL_SLOT_LEVEL_MAX: 'SPELL_SLOT_LEVEL_MAX',
  SPELLS_KNOWN: 'SPELLS_KNOWN',
  SPELLS_PREPARED: 'SPELLS_PREPARED',
  ACTION_COUNT: 'ACTION_COUNT',
  BONUS_ACTION_COUNT: 'BONUS_ACTION_COUNT',
  REACTION_COUNT: 'REACTION_COUNT',
  ATTACKS_PER_ATTACK_ACTION: 'ATTACKS_PER_ATTACK_ACTION',
  DAMAGE_RESISTANCE: 'DAMAGE_RESISTANCE',
  DAMAGE_IMMUNITY: 'DAMAGE_IMMUNITY',
  DAMAGE_VULNERABILITY: 'DAMAGE_VULNERABILITY',
  CONDITION_IMMUNITY: 'CONDITION_IMMUNITY',
  ATTRIBUTE: 'ATTRIBUTE'
} as const

export type ValueDomainCode = keyof typeof VALUE_DOMAIN_CODE

export type ValueDomainOption<V extends ValueDomainCode = ValueDomainCode> = CoreMeta<V>

export const VALUE_DOMAIN_REGISTRY: Record<ValueDomainCode, ValueDomainOption> = {
  [VALUE_DOMAIN_CODE.HIT_POINTS_MAX]: {
    code: VALUE_DOMAIN_CODE.HIT_POINTS_MAX,
    label: 'Maximum Hit Points',
    tooltip: "The character's maximum health.",
    description: 'Determines the maximum number of hit points the character can have.'
  },

  [VALUE_DOMAIN_CODE.TEMPORARY_HIT_POINTS]: {
    code: VALUE_DOMAIN_CODE.TEMPORARY_HIT_POINTS,
    label: 'Temporary Hit Points',
    tooltip: 'Temporary hit points granted by spells, features, or equipment.',
    description:
      'Represents temporary hit points that absorb damage before normal hit points are lost.'
  },

  [VALUE_DOMAIN_CODE.ARMOR_CLASS]: {
    code: VALUE_DOMAIN_CODE.ARMOR_CLASS,
    label: 'Armor Class',
    tooltip: 'How difficult the character is to hit.',
    description:
      "Determines the character's Armor Class, which is used to resolve whether attacks hit or miss."
  },

  [VALUE_DOMAIN_CODE.INITIATIVE]: {
    code: VALUE_DOMAIN_CODE.INITIATIVE,
    label: 'Initiative',
    tooltip: 'Bonus applied to initiative rolls.',
    description: 'Modifies the bonus added when rolling initiative.'
  },

  [VALUE_DOMAIN_CODE.ABILITY_CHECK]: {
    code: VALUE_DOMAIN_CODE.ABILITY_CHECK,
    label: 'Ability Check',
    tooltip: 'Advantage or disadvantage applied to ability checks.',
    description: 'Changes how ability checks are rolled, globally or for a specific ability.'
  },

  [VALUE_DOMAIN_CODE.ATTACK_ROLL]: {
    code: VALUE_DOMAIN_CODE.ATTACK_ROLL,
    label: 'Attack Roll',
    tooltip: 'Bonuses or penalties applied to attack rolls.',
    description:
      'Modifies the total bonus added to an attack roll, such as melee, ranged, spell, or unarmed attacks.'
  },

  [VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER]: {
    code: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
    label: 'Saving Throw Modifier',
    tooltip: 'Bonuses or penalties applied to saving throws.',
    description: "Modifies the bonus added to a character's saving throws for a specific ability."
  },

  [VALUE_DOMAIN_CODE.SAVE_DC]: {
    code: VALUE_DOMAIN_CODE.SAVE_DC,
    label: 'Saving Throw DC',
    tooltip: 'The difficulty class for saving throws.',
    description:
      'Sets or modifies the difficulty class that Targets must meet or exceed when making saving throws.'
  },

  [VALUE_DOMAIN_CODE.SKILL_MODIFIER]: {
    code: VALUE_DOMAIN_CODE.SKILL_MODIFIER,
    label: 'Skill Modifier',
    tooltip: 'Bonuses or penalties applied to skill checks.',
    description: 'Modifies the bonus applied when making a check with a specific skill.'
  },

  [VALUE_DOMAIN_CODE.PROFICIENCY_BONUS]: {
    code: VALUE_DOMAIN_CODE.PROFICIENCY_BONUS,
    label: 'Proficiency Bonus',
    tooltip: "The character's proficiency bonus.",
    description:
      'Represents the proficiency bonus used for attacks, skills, and saving throws. This may be modified by homebrew or campaign rules.'
  },

  [VALUE_DOMAIN_CODE.ABILITY_SCORE]: {
    code: VALUE_DOMAIN_CODE.ABILITY_SCORE,
    label: 'Ability Score',
    tooltip: 'An ability score value.',
    description: 'Represents an ability score such as Strength, Dexterity, or Intelligence.'
  },

  [VALUE_DOMAIN_CODE.SPEED]: {
    code: VALUE_DOMAIN_CODE.SPEED,
    label: 'Speed',
    tooltip: 'How fast the character can move.',
    description:
      "Determines the character's movement speed for a given movement type, such as walking, flying, or swimming."
  },

  [VALUE_DOMAIN_CODE.MOVEMENT_MODE]: {
    code: VALUE_DOMAIN_CODE.MOVEMENT_MODE,
    label: 'Movement Mode',
    tooltip: 'A type of movement.',
    description: 'Represents a movement mode such as walking, flying, climbing, or swimming.'
  },

  [VALUE_DOMAIN_CODE.SENSE_RANGE]: {
    code: VALUE_DOMAIN_CODE.SENSE_RANGE,
    label: 'Sense Range',
    tooltip: 'The range of a special sense.',
    description:
      'Determines the distance at which a sense such as darkvision, blindsight, or tremorsense is effective.'
  },

  [VALUE_DOMAIN_CODE.DAMAGE]: {
    code: VALUE_DOMAIN_CODE.DAMAGE,
    label: 'Damage',
    tooltip: 'The amount of damage dealt.',
    description: 'Represents damage dealt by attacks, spells, or other effects.'
  },

  [VALUE_DOMAIN_CODE.DAMAGE_RESISTANCE]: {
    code: VALUE_DOMAIN_CODE.DAMAGE_RESISTANCE,
    label: 'Damage Resistance',
    tooltip: 'Resistance to a type of damage.',
    description: 'Represents resistance that reduces damage of a specific type.'
  },

  [VALUE_DOMAIN_CODE.DAMAGE_IMMUNITY]: {
    code: VALUE_DOMAIN_CODE.DAMAGE_IMMUNITY,
    label: 'Damage Immunity',
    tooltip: 'Immunity to a type of damage.',
    description: 'Represents immunity that prevents damage of a specific type.'
  },

  [VALUE_DOMAIN_CODE.DAMAGE_VULNERABILITY]: {
    code: VALUE_DOMAIN_CODE.DAMAGE_VULNERABILITY,
    label: 'Damage Vulnerability',
    tooltip: 'Vulnerability to a type of damage.',
    description: 'Represents vulnerability that increases damage of a specific type.'
  },

  [VALUE_DOMAIN_CODE.CONDITION_IMMUNITY]: {
    code: VALUE_DOMAIN_CODE.CONDITION_IMMUNITY,
    label: 'Condition Immunity',
    tooltip: 'Immunity to a condition.',
    description:
      'Represents immunity that prevents a specific condition from being applied to the creature.'
  },

  [VALUE_DOMAIN_CODE.RANGE]: {
    code: VALUE_DOMAIN_CODE.RANGE,
    label: 'Range',
    tooltip: 'How far an action, attack, or spell can reach.',
    description:
      "Determines the effective distance for an action or spell, such as a weapon's range or a spell's casting range."
  },

  [VALUE_DOMAIN_CODE.DURATION]: {
    code: VALUE_DOMAIN_CODE.DURATION,
    label: 'Duration',
    tooltip: 'How long an effect or spell lasts.',
    description:
      'Determines the length of time an effect remains active, such as 1 minute, 10 minutes, or 1 hour.'
  },

  [VALUE_DOMAIN_CODE.SHAPE]: {
    code: VALUE_DOMAIN_CODE.SHAPE,
    label: 'Shape',
    tooltip: 'The area or geometry affected by an effect.',
    description:
      'Determines the spatial form of an effect, such as cone, line, sphere, cube, or radius-based areas.'
  },

  [VALUE_DOMAIN_CODE.SPELL_SLOT_COUNT]: {
    code: VALUE_DOMAIN_CODE.SPELL_SLOT_COUNT,
    label: 'Spell Slot Count',
    tooltip: 'Number of available spell slots.',
    description: 'Represents how many spell slots are available at a given level.'
  },

  [VALUE_DOMAIN_CODE.SPELL_SLOT_LEVEL_MAX]: {
    code: VALUE_DOMAIN_CODE.SPELL_SLOT_LEVEL_MAX,
    label: 'Maximum Spell Slot Level',
    tooltip: 'Highest spell slot level available.',
    description: 'Determines the highest spell level the character can cast.'
  },

  [VALUE_DOMAIN_CODE.SPELLS_KNOWN]: {
    code: VALUE_DOMAIN_CODE.SPELLS_KNOWN,
    label: 'Spells Known',
    tooltip: 'Number of spells the character knows.',
    description: 'Represents how many spells the character knows.'
  },

  [VALUE_DOMAIN_CODE.SPELLS_PREPARED]: {
    code: VALUE_DOMAIN_CODE.SPELLS_PREPARED,
    label: 'Spells Prepared',
    tooltip: 'Number of spells the character can prepare.',
    description: 'Represents how many spells the character can have prepared at one time.'
  },

  [VALUE_DOMAIN_CODE.CHARGE_LIMIT]: {
    code: VALUE_DOMAIN_CODE.CHARGE_LIMIT,
    label: 'Charge Limit',
    tooltip: 'Maximum number of uses.',
    description:
      'Determines how many times a feature or resource can be used before it must be recharged.'
  },

  [VALUE_DOMAIN_CODE.CHARGE_RESET]: {
    code: VALUE_DOMAIN_CODE.CHARGE_RESET,
    label: 'Charge Reset',
    tooltip: 'When charges are restored.',
    description:
      'Determines when expended charges are restored, such as on a short rest, long rest, or at dawn.'
  },

  [VALUE_DOMAIN_CODE.ACTION_COUNT]: {
    code: VALUE_DOMAIN_CODE.ACTION_COUNT,
    label: 'Action Count',
    tooltip: 'How many actions can be taken.',
    description: 'Determines how many actions the character can take during their turn.'
  },

  [VALUE_DOMAIN_CODE.BONUS_ACTION_COUNT]: {
    code: VALUE_DOMAIN_CODE.BONUS_ACTION_COUNT,
    label: 'Bonus Action Count',
    tooltip: 'How many bonus actions can be taken.',
    description: 'Determines how many bonus actions the character can take during their turn.'
  },

  [VALUE_DOMAIN_CODE.REACTION_COUNT]: {
    code: VALUE_DOMAIN_CODE.REACTION_COUNT,
    label: 'Reaction Count',
    tooltip: 'How many reactions can be taken.',
    description:
      'Determines how many reactions the character can take before the start of their next turn.'
  },

  [VALUE_DOMAIN_CODE.ATTACKS_PER_ATTACK_ACTION]: {
    code: VALUE_DOMAIN_CODE.ATTACKS_PER_ATTACK_ACTION,
    label: 'Attacks Per Attack Action',
    tooltip: 'How many attacks the Attack action makes.',
    description:
      'Determines how many attacks the character makes when they take the Attack action. Several sources do not add together: the highest one applies.'
  },

  [VALUE_DOMAIN_CODE.CONDITION]: {
    code: VALUE_DOMAIN_CODE.CONDITION,
    label: 'Condition',
    tooltip: 'A status effect applied to a creature.',
    description:
      'Represents a condition applied to a creature, such as Blinded, Charmed, Frightened, Poisoned, or Restrained. Conditions may have durations, saving throws, and other mechanical effects.'
  },

  [VALUE_DOMAIN_CODE.ATTRIBUTE]: {
    code: VALUE_DOMAIN_CODE.ATTRIBUTE,
    label: 'Attribute',
    tooltip: 'A attribute such as ritual, concentration, etc.',
    description: 'Represents a attribute that would be applied to an item, spell, or creature.'
  }
} as const

export const VALUE_DOMAIN_OPTIONS = valuesOf(VALUE_DOMAIN_REGISTRY) as readonly ValueDomainOption[]

export const ATTACK_DOMAIN_CODE = {
  MELEE: 'MELEE',
  RANGED: 'RANGED',
  SPELL: 'SPELL',
  UNARMED: 'UNARMED'
} as const

export type AttackDomainCode = keyof typeof ATTACK_DOMAIN_CODE

export type AttackDomainOption = CoreMeta<AttackDomainCode>

export const ATTACK_DOMAIN_REGISTRY: Record<AttackDomainCode, AttackDomainOption> = {
  [ATTACK_DOMAIN_CODE.MELEE]: {
    code: ATTACK_DOMAIN_CODE.MELEE,
    label: 'Melee',
    tooltip: 'A melee attack.',
    description: 'Represents a melee attack using a weapon such as a sword or halbred.'
  },

  [ATTACK_DOMAIN_CODE.RANGED]: {
    code: ATTACK_DOMAIN_CODE.RANGED,
    label: 'Ranged',
    tooltip: 'A ranged attack.',
    description: 'Represents a ranged attack using a weapon such as a bow or crossbow.'
  },

  [ATTACK_DOMAIN_CODE.SPELL]: {
    code: ATTACK_DOMAIN_CODE.SPELL,
    label: 'Spell',
    tooltip: 'A spell attack.',
    description: 'Represents a spell attack using a spell such as a fireball or lightning bolt.'
  },

  [ATTACK_DOMAIN_CODE.UNARMED]: {
    code: ATTACK_DOMAIN_CODE.UNARMED,
    label: 'Unarmed',
    tooltip: 'An unarmed attack.',
    description: 'Represents an unarmed attack using fists with or without gloves or claws.'
  }
}

export const ATTACK_DOMAIN_OPTIONS = valuesOf(
  ATTACK_DOMAIN_REGISTRY
) as readonly AttackDomainOption[]

export type ValueDomainParamByCode = {
  /* ──────────────────────────────────────────────
   * CORE NUMERIC VALUES
   * ────────────────────────────────────────────── */

  HIT_POINTS_MAX: EmptyObject
  ARMOR_CLASS: EmptyObject
  INITIATIVE: EmptyObject
  PROFICIENCY_BONUS: EmptyObject

  /* ──────────────────────────────────────────────
   * ROLL SURFACES (parameterized)
   * ────────────────────────────────────────────── */

  // Attack bonus is usually different for melee/ranged/spell/unarmed
  ATTACK_ROLL: { attackDomain: AttackDomainCode }

  // Ability checks may apply globally or to one ability.
  ABILITY_CHECK: { ability?: AbilityCode }

  // Save bonus is per ability (STR/DEX/etc); conditionTypeId scopes advantage/disadvantage to a specific condition.
  SAVING_THROW_MODIFIER: {
    ability: AbilityCode
    conditionTypeId?: string
    ruleDefinitionId?: string
  }

  // Skill bonus is per skill
  SKILL_MODIFIER: { skillId: string }

  // Save DC is often contextual; if you want per-spellcasting ability later,
  // keep it global for MVP:
  SAVE_DC: EmptyObject

  /* ──────────────────────────────────────────────
   * ABILITIES / SCORES
   * ────────────────────────────────────────────── */

  ABILITY_SCORE: { ability: AbilityCode }

  /* ──────────────────────────────────────────────
   * MOVEMENT & SENSES
   * ────────────────────────────────────────────── */

  // Speed is per speed type (walk/fly/climb). Use id/code consistent with your vocab.
  SPEED: { speedId: string }

  // Set-like: movement modes (fly, swim...). Treat as per-mode set, no param needed.
  MOVEMENT_MODE: EmptyObject

  // Sense range is per UUID-backed sense definition.
  SENSE_RANGE: { senseDefinitionId: string }

  /* ──────────────────────────────────────────────
   * DAMAGE (parameterized by “attack domain” for sheet-style bonuses)
   * ────────────────────────────────────────────── */

  // For MVP, mirror ATTACK_ROLL and keep it by attackDomain.
  // If you want “spell damage” separate from “weapon damage”, this works.
  DAMAGE: { attackDomain: AttackDomainCode }
  DAMAGE_RESISTANCE: EmptyObject
  DAMAGE_IMMUNITY: EmptyObject
  DAMAGE_VULNERABILITY: EmptyObject

  /* ──────────────────────────────────────────────
   * SPELL STRUCTURE
   * ────────────────────────────────────────────── */

  RANGE: EmptyObject
  DURATION: EmptyObject
  SHAPE: EmptyObject

  /* ──────────────────────────────────────────────
   * SPELLCASTING LIMITS (parameterized by spell slot level)
   * ────────────────────────────────────────────── */

  SPELL_SLOT_COUNT: { spellLevel: number } // 1..9
  SPELL_SLOT_LEVEL_MAX: EmptyObject
  SPELLS_KNOWN: EmptyObject
  SPELLS_PREPARED: EmptyObject

  /* ──────────────────────────────────────────────
   * ACTION ECONOMY
   * ────────────────────────────────────────────── */

  ACTION_COUNT: EmptyObject
  BONUS_ACTION_COUNT: EmptyObject
  REACTION_COUNT: EmptyObject
  ATTACKS_PER_ATTACK_ACTION: EmptyObject

  /* ──────────────────────────────────────────────
   * CHARGES / RESOURCES
   * ────────────────────────────────────────────── */

  CHARGE_LIMIT: EmptyObject
  CHARGE_RESET: EmptyObject

  /* ──────────────────────────────────────────────
   * CONDITIONS / ATTRIBUTES (set-like)
   * ────────────────────────────────────────────── */

  CONDITION: EmptyObject
  CONDITION_IMMUNITY: EmptyObject
  ATTRIBUTE: EmptyObject
}

export type ValueDomainParam<V extends ValueDomainCode> = V extends keyof ValueDomainParamByCode
  ? ValueDomainParamByCode[V]
  : EmptyObject

/* ============================================================================
 * 2) Domain-correlated payloads for option-like modifier kinds
 * ============================================================================
 *
 * Goal:
 * - Replace `{ optionId: string }` with domain-specific payloads.
 * - Keep modifier kinds the same.
 */

export type ValueDomainOptionPayloadByDomain = {
  DAMAGE_RESISTANCE: { damageTypeId: string }
  DAMAGE_IMMUNITY: { damageTypeId: string }
  DAMAGE_VULNERABILITY: { damageTypeId: string }

  // Your CONDITION domain is “applied conditions on character”.
  // If you model as conditionTypeId, use that. If you model as conditionId, switch.
  CONDITION: { conditionTypeId: string }

  // Condition immunity: prevents a specific condition from being applied
  CONDITION_IMMUNITY: { conditionTypeId: string }

  // Attribute is likely from a registry (ritual, concentration, etc.)
  ATTRIBUTE: { attributeId: string }

  // Movement mode is a registry
  MOVEMENT_MODE: { movementModeId: string }

  // Replace option for charge reset should use the actual enum/kind, not a random id
  CHARGE_RESET: { resetKind: ChargeResetKind }
  CHARGE_LIMIT: { chargeLimitKind: ChargeLimitKind }

  // Replace option for duration/shape/range should use the actual enum/kind.
  RANGE: { rangeKind: RangeKind }
  DURATION: { durationKind: DurationKind }
  SHAPE: { shapeKind: ShapeKind }
}
