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
  ATTACKS_AGAINST: 'ATTACKS_AGAINST',
  OPPORTUNITY_ATTACK_IMMUNITY: 'OPPORTUNITY_ATTACK_IMMUNITY',
  SPELLCASTING_LOCK: 'SPELLCASTING_LOCK',
  ACTION_BONUS_ACTION_EXCLUSIVITY: 'ACTION_BONUS_ACTION_EXCLUSIVITY',
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
    description: "The character's maximum health."
  },

  [VALUE_DOMAIN_CODE.TEMPORARY_HIT_POINTS]: {
    code: VALUE_DOMAIN_CODE.TEMPORARY_HIT_POINTS,
    label: 'Temporary Hit Points',
    description: 'Temporary hit points granted by spells, features, or equipment.'
  },

  [VALUE_DOMAIN_CODE.ARMOR_CLASS]: {
    code: VALUE_DOMAIN_CODE.ARMOR_CLASS,
    label: 'Armor Class',
    description: 'How difficult the character is to hit.'
  },

  [VALUE_DOMAIN_CODE.INITIATIVE]: {
    code: VALUE_DOMAIN_CODE.INITIATIVE,
    label: 'Initiative',
    description: 'Bonus applied to initiative rolls.'
  },

  [VALUE_DOMAIN_CODE.ABILITY_CHECK]: {
    code: VALUE_DOMAIN_CODE.ABILITY_CHECK,
    label: 'Ability Check',
    description: 'Advantage or disadvantage applied to ability checks.'
  },

  [VALUE_DOMAIN_CODE.ATTACK_ROLL]: {
    code: VALUE_DOMAIN_CODE.ATTACK_ROLL,
    label: 'Attack Roll',
    description: 'Bonuses or penalties applied to attack rolls.'
  },

  [VALUE_DOMAIN_CODE.ATTACKS_AGAINST]: {
    code: VALUE_DOMAIN_CODE.ATTACKS_AGAINST,
    label: 'Attacks Against',
    description: 'Advantage or disadvantage on attack rolls made against the holder.'
  },

  [VALUE_DOMAIN_CODE.OPPORTUNITY_ATTACK_IMMUNITY]: {
    code: VALUE_DOMAIN_CODE.OPPORTUNITY_ATTACK_IMMUNITY,
    label: 'Opportunity Attack Immunity',
    description: "The holder's movement provokes no opportunity attacks."
  },

  [VALUE_DOMAIN_CODE.SPELLCASTING_LOCK]: {
    code: VALUE_DOMAIN_CODE.SPELLCASTING_LOCK,
    label: 'Spellcasting Lock',
    description:
      "The holder can't cast spells or hold Concentration; gaining the grant ends any Concentration it holds."
  },

  [VALUE_DOMAIN_CODE.ACTION_BONUS_ACTION_EXCLUSIVITY]: {
    code: VALUE_DOMAIN_CODE.ACTION_BONUS_ACTION_EXCLUSIVITY,
    label: 'Action or Bonus Action Exclusivity',
    description: 'The holder can take an action or a bonus action on its turn, not both.'
  },

  [VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER]: {
    code: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
    label: 'Saving Throw Modifier',
    description: 'Bonuses or penalties applied to saving throws.'
  },

  [VALUE_DOMAIN_CODE.SAVE_DC]: {
    code: VALUE_DOMAIN_CODE.SAVE_DC,
    label: 'Saving Throw DC',
    description: 'The difficulty class for saving throws.'
  },

  [VALUE_DOMAIN_CODE.SKILL_MODIFIER]: {
    code: VALUE_DOMAIN_CODE.SKILL_MODIFIER,
    label: 'Skill Modifier',
    description: 'Bonuses or penalties applied to skill checks.'
  },

  [VALUE_DOMAIN_CODE.PROFICIENCY_BONUS]: {
    code: VALUE_DOMAIN_CODE.PROFICIENCY_BONUS,
    label: 'Proficiency Bonus',
    description: "The character's proficiency bonus."
  },

  [VALUE_DOMAIN_CODE.ABILITY_SCORE]: {
    code: VALUE_DOMAIN_CODE.ABILITY_SCORE,
    label: 'Ability Score',
    description: 'An ability score value.'
  },

  [VALUE_DOMAIN_CODE.SPEED]: {
    code: VALUE_DOMAIN_CODE.SPEED,
    label: 'Speed',
    description: 'How fast the character can move.'
  },

  [VALUE_DOMAIN_CODE.MOVEMENT_MODE]: {
    code: VALUE_DOMAIN_CODE.MOVEMENT_MODE,
    label: 'Movement Mode',
    description: 'A type of movement.'
  },

  [VALUE_DOMAIN_CODE.SENSE_RANGE]: {
    code: VALUE_DOMAIN_CODE.SENSE_RANGE,
    label: 'Sense Range',
    description: 'The range of a special sense.'
  },

  [VALUE_DOMAIN_CODE.DAMAGE]: {
    code: VALUE_DOMAIN_CODE.DAMAGE,
    label: 'Damage',
    description: 'The amount of damage dealt.'
  },

  [VALUE_DOMAIN_CODE.DAMAGE_RESISTANCE]: {
    code: VALUE_DOMAIN_CODE.DAMAGE_RESISTANCE,
    label: 'Damage Resistance',
    description: 'Resistance to a type of damage.'
  },

  [VALUE_DOMAIN_CODE.DAMAGE_IMMUNITY]: {
    code: VALUE_DOMAIN_CODE.DAMAGE_IMMUNITY,
    label: 'Damage Immunity',
    description: 'Immunity to a type of damage.'
  },

  [VALUE_DOMAIN_CODE.DAMAGE_VULNERABILITY]: {
    code: VALUE_DOMAIN_CODE.DAMAGE_VULNERABILITY,
    label: 'Damage Vulnerability',
    description: 'Vulnerability to a type of damage.'
  },

  [VALUE_DOMAIN_CODE.CONDITION_IMMUNITY]: {
    code: VALUE_DOMAIN_CODE.CONDITION_IMMUNITY,
    label: 'Condition Immunity',
    description: 'Immunity to a condition.'
  },

  [VALUE_DOMAIN_CODE.RANGE]: {
    code: VALUE_DOMAIN_CODE.RANGE,
    label: 'Range',
    description: 'How far an action, attack, or spell can reach.'
  },

  [VALUE_DOMAIN_CODE.DURATION]: {
    code: VALUE_DOMAIN_CODE.DURATION,
    label: 'Duration',
    description: 'How long an effect or spell lasts.'
  },

  [VALUE_DOMAIN_CODE.SHAPE]: {
    code: VALUE_DOMAIN_CODE.SHAPE,
    label: 'Shape',
    description: 'The area or geometry affected by an effect.'
  },

  [VALUE_DOMAIN_CODE.SPELL_SLOT_COUNT]: {
    code: VALUE_DOMAIN_CODE.SPELL_SLOT_COUNT,
    label: 'Spell Slot Count',
    description: 'Number of available spell slots.'
  },

  [VALUE_DOMAIN_CODE.SPELL_SLOT_LEVEL_MAX]: {
    code: VALUE_DOMAIN_CODE.SPELL_SLOT_LEVEL_MAX,
    label: 'Maximum Spell Slot Level',
    description: 'Highest spell slot level available.'
  },

  [VALUE_DOMAIN_CODE.SPELLS_KNOWN]: {
    code: VALUE_DOMAIN_CODE.SPELLS_KNOWN,
    label: 'Spells Known',
    description: 'Number of spells the character knows.'
  },

  [VALUE_DOMAIN_CODE.SPELLS_PREPARED]: {
    code: VALUE_DOMAIN_CODE.SPELLS_PREPARED,
    label: 'Spells Prepared',
    description: 'Number of spells the character can prepare.'
  },

  [VALUE_DOMAIN_CODE.CHARGE_LIMIT]: {
    code: VALUE_DOMAIN_CODE.CHARGE_LIMIT,
    label: 'Charge Limit',
    description: 'Maximum number of uses.'
  },

  [VALUE_DOMAIN_CODE.CHARGE_RESET]: {
    code: VALUE_DOMAIN_CODE.CHARGE_RESET,
    label: 'Charge Reset',
    description: 'When charges are restored.'
  },

  [VALUE_DOMAIN_CODE.ACTION_COUNT]: {
    code: VALUE_DOMAIN_CODE.ACTION_COUNT,
    label: 'Action Count',
    description: 'How many actions can be taken.'
  },

  [VALUE_DOMAIN_CODE.BONUS_ACTION_COUNT]: {
    code: VALUE_DOMAIN_CODE.BONUS_ACTION_COUNT,
    label: 'Bonus Action Count',
    description: 'How many bonus actions can be taken.'
  },

  [VALUE_DOMAIN_CODE.REACTION_COUNT]: {
    code: VALUE_DOMAIN_CODE.REACTION_COUNT,
    label: 'Reaction Count',
    description: 'How many reactions can be taken.'
  },

  [VALUE_DOMAIN_CODE.ATTACKS_PER_ATTACK_ACTION]: {
    code: VALUE_DOMAIN_CODE.ATTACKS_PER_ATTACK_ACTION,
    label: 'Attacks Per Attack Action',
    description: 'How many attacks the Attack action makes.'
  },

  [VALUE_DOMAIN_CODE.CONDITION]: {
    code: VALUE_DOMAIN_CODE.CONDITION,
    label: 'Condition',
    description: 'A status effect applied to a creature.'
  },

  [VALUE_DOMAIN_CODE.ATTRIBUTE]: {
    code: VALUE_DOMAIN_CODE.ATTRIBUTE,
    label: 'Attribute',
    description: 'A attribute such as ritual, concentration, etc.'
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
    description: 'A melee attack.'
  },

  [ATTACK_DOMAIN_CODE.RANGED]: {
    code: ATTACK_DOMAIN_CODE.RANGED,
    label: 'Ranged',
    description: 'A ranged attack.'
  },

  [ATTACK_DOMAIN_CODE.SPELL]: {
    code: ATTACK_DOMAIN_CODE.SPELL,
    label: 'Spell',
    description: 'A spell attack.'
  },

  [ATTACK_DOMAIN_CODE.UNARMED]: {
    code: ATTACK_DOMAIN_CODE.UNARMED,
    label: 'Unarmed',
    description: 'An unarmed attack.'
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

  // Attack bonus is usually different for melee/ranged/spell/unarmed. Only advantage and
  // disadvantage may name the `ability` the attack is made with (Weakening Breath's Strength), or
  // hold only for attacks against the effect's source (`againstEffectSource`, Bestow Curse).
  ATTACK_ROLL: {
    attackDomain: AttackDomainCode
    ability?: AbilityCode
    againstEffectSource?: boolean
  }

  // Attack rolls made against the holder; `requiresHolderSeesAttacker` limits it to attackers the
  // holder can see (D100), and `exemptAttackerSenseDefinitionIds` excludes attackers that see the
  // holder through one of those System Senses (Blur's Blindsight and Truesight).
  ATTACKS_AGAINST: {
    attackDomain: AttackDomainCode
    requiresHolderSeesAttacker: boolean
    exemptAttackerSenseDefinitionIds?: string[]
  }

  // The holder's movement provokes no opportunity attacks (Disengage).
  OPPORTUNITY_ATTACK_IMMUNITY: EmptyObject

  // The holder can't cast spells or hold Concentration.
  SPELLCASTING_LOCK: EmptyObject

  // The holder can take an action or a bonus action on its turn, not both (Slowing Breath).
  ACTION_BONUS_ACTION_EXCLUSIVITY: EmptyObject

  // Ability checks may apply globally or to one ability.
  ABILITY_CHECK: { ability?: AbilityCode }

  // Save bonus is per ability (STR/DEX/etc); conditionTypeId scopes advantage/disadvantage to a specific
  // condition; `requiresHolderSeesSource` limits advantage/disadvantage to effects whose source the
  // holder can see (Danger Sense, D100).
  SAVING_THROW_MODIFIER: {
    ability: AbilityCode
    conditionTypeId?: string
    ruleDefinitionId?: string
    requiresHolderSeesSource?: boolean
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

  // Speed is per speed type (walk/fly/climb). Use id/code consistent with your vocab. A fraction
  // (MULTIPLY) may omit it to cover every speed.
  SPEED: { speedId?: string }

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
  /** A reaction's resistance may name the damage type that triggered it instead of a fixed one. */
  DAMAGE_RESISTANCE: { damageTypeId: string } | { damageTypeSource: 'TRIGGER' }
  /** `sourceEffectIds` limits the immunity to damage from actions owned by that authored content. */
  DAMAGE_IMMUNITY: { damageTypeId: string; sourceEffectIds?: string[] }
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
