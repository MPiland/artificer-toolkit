import {
  FORCED_MOVEMENT_DIRECTION,
  LENGTH_UNIT_CODES,
  MODIFIER_KIND,
  VALUE_DOMAIN_CODE
} from '@artificer-toolkit/shared/core'

import { z, lazySchema } from '../zod.js'
import { systemCoreCodeSchema } from './systemCoreCode.js'

export const activationCodeSchema = lazySchema(() =>
  z.enum(['ACTION', 'BONUS_ACTION', 'REACTION', 'FREE'])
)

export const authoredRecordStatusSchema = lazySchema(() => z.enum(['DRAFT', 'ACTIVE']))

/** What an authored manifest blocks; a placed zone carries its rules for consumers such as cover (D154). */
export const manifestBlockingRuleSchema = lazySchema(() =>
  z.enum([
    'NONMAGICAL_RANGED_ATTACKS',
    'MAGICAL_RANGED_ATTACKS',
    'SPELLS',
    'THREE_QUARTERS_COVER',
    'BLOCKS_SIGHT'
  ])
)

/** The sight a zone's occupant must have, between itself and the zone's source, to be put through the zone. */
export const manifestRequiredSightSchema = lazySchema(() =>
  z.enum(['OCCUPANT_SEES_SOURCE', 'SOURCE_SEES_OCCUPANT'])
)

export const creatureCategoryCodeSchema = lazySchema(() =>
  z.enum(['NPC', 'MONSTER', 'BEAST', 'COMPANION', 'SUMMON'])
)

/** Attack traits that ignore a qualified damage defense. */
export const damageDefenseBypassCodeSchema = lazySchema(() =>
  z.enum(['MAGICAL', 'SILVERED', 'ADAMANTINE'])
)

export const vehicleCategoryCodeSchema = lazySchema(() =>
  z.enum(['LAND', 'WATER', 'AIR', 'SPELLJAMMER'])
)

export const classAttributeSchema = lazySchema(() => z.enum(['SPELLCASTER', 'RESOURCE']))

export const subclassAttributeSchema = lazySchema(() =>
  z.enum(['SPELLCASTER', 'RESOURCE', 'SPECIALIZATION'])
)

export const spellcastingAttributeSchema = lazySchema(() =>
  z.enum([
    'LIMIT_KNOWN_SPELL_AMOUNT',
    'PREPARES_SPELLS',
    'CUSTOM_MAGIC_NAME',
    'USES_SPELLBOOK',
    'RITUAL_CASTER'
  ])
)

export const featureAttributeSchema = lazySchema(() =>
  z.enum(['LIMITED_USE', 'HIDDEN_ON_SHEET', 'SUBCLASS_SELECTION'])
)

export const invocationKindSchema = lazySchema(() => z.enum(['ACTION', 'PASSIVE']))

export const triggerCodeSchema = lazySchema(() =>
  z.enum([
    'ACTIVATED',
    'MELEE_WEAPON_ATTACK',
    'RANGED_WEAPON_ATTACK',
    'UNARMED_ATTACK',
    'MELEE_SPELL_ATTACK',
    'RANGED_SPELL_ATTACK',
    'INCOMING_SAVING_THROW',
    'SAVING_THROW',
    'CHECK',
    'ENTER_AREA',
    'INCOMING_DAMAGE',
    'HP_ZERO',
    'INCOMING_WEAPON_HIT',
    'ROLL_INITIATIVE',
    'START_OF_TURN'
  ])
)

export const nodeSubjectCodeSchema = lazySchema(() =>
  z.enum([
    'CLASS',
    'FEATURE',
    'SPELL',
    'EQUIPMENT',
    'FEAT',
    'RACE',
    'BACKGROUND',
    'CREATURE',
    'VEHICLE',
    'PROFICIENCY_GRANT',
    'OPTION',
    'SUBRACE',
    'SUBCLASS',
    'RESOURCE',
    'RACE_ANCESTRY_OPTION',
    'CHARACTER'
  ])
)

export const relationCodeSchema = lazySchema(() =>
  z.enum([
    'FEATURE',
    'SUBCLASS',
    'RESOURCE',
    'PROFICIENCY_GRANT',
    'OPTION',
    'SUBRACE',
    'RACE_ANCESTRY_OPTION',
    'CREATURE',
    'VEHICLE'
  ])
)

export const predicateCodeSchema = lazySchema(() =>
  z.enum([
    'SUBCLASS_SPECIALIZATION',
    'SPELLCASTING',
    'RANGE',
    'DURATION',
    'CONCENTRATION',
    'RITUAL',
    'SIZE',
    'MAGIC_SCHOOL',
    'SPELLCASTING_ABILITY',
    'SPELL_LEVEL',
    'SAVING_THROW_ABILITY',
    'SAVING_THROW_DC',
    'EQUIPMENT_CATEGORY',
    'EQUIPMENT_PROPERTY',
    'SOLE_WIELDED_WEAPON',
    'ATTACK_ABILITY',
    'ATTACK_ACTIVATION',
    'ATTACK_ROLL_MODE',
    'ENEMY_NEAR_TARGET',
    'TARGET_HAS_NOT_TAKEN_TURN',
    'MOVED_TOWARD_TARGET',
    'HOLDER_IN_BRIGHT_LIGHT',
    'ARMOR_CLASS',
    'DAMAGE_TYPE',
    'CONDITION_TYPE',
    'CHARGE_LIMIT_KIND',
    'CHARGE_RESET_KIND',
    'CAN_CAST_SPELL',
    'CAN_ACT',
    'SPEED_ABOVE_ZERO',
    'FREE_HAND',
    'TURN_MOVEMENT',
    'ATTACK_ACTION_OTHER_WEAPON',
    'CHARACTER_LEVEL',
    'CLASS_LEVEL',
    'SPELL_OBTAINED',
    'FEAT_OBTAINED',
    'HERITAGE',
    'FEATURE_OBTAINED',
    'OPTION_OBTAINED',
    'EQUIPMENT_PROFICIENCY',
    'EQUIPMENT_PROPERTY_PROFICIENCY',
    'LANGUAGE_PROFICIENCY',
    'SAVE_ABILITY_PROFICIENCY',
    'SKILL_PROFICIENCY',
    'EQUIPMENT_EQUIPPED',
    'SKILL_SCORE',
    'ABILITY_SCORE',
    'SAVING_THROW_ABILITY_BONUS',
    'WHILE_SOURCE_CARRIED',
    'WHILE_SOURCE_EQUIPPED',
    'WHILE_SOURCE_ATTUNED',
    'CREATURE_CATEGORY',
    'CREATURE_TYPE',
    'SOURCE_CREATURE_TYPE',
    'SOURCE_TRAIT',
    'CREATURE_SIZE',
    'CREATURE_IS_MOUNT',
    'CREATURE_IS_COMPANION',
    'VEHICLE_CATEGORY',
    'VEHICLE_SIZE'
  ])
)

export const rangeKindSchema = lazySchema(() =>
  z.enum(['SELF', 'TOUCH', 'SIGHT', 'SPECIAL', 'UNLIMITED', 'DISTANCE'])
)

export const durationKindSchema = lazySchema(() =>
  z.enum([
    'INSTANTANEOUS',
    'UNTIL_DISPELLED',
    'TURN',
    'ROUND',
    'MINUTE',
    'HOUR',
    'DAY',
    'WEEK',
    'MONTH',
    'YEAR'
  ])
)

export const shapeKindSchema = lazySchema(() =>
  z.enum(['LINE', 'CONE', 'CUBE', 'CYLINDER', 'SPHERE', 'WALL', 'CIRCLE', 'DOME'])
)

export const measurementUnitCodeSchema = lazySchema(() =>
  z.enum([
    'POUNDS',
    'GALLONS',
    'INCHES',
    'FEET',
    'YARDS',
    'MILES',
    'OUNCES',
    'CUPS',
    'TABLESPOONS',
    'TEASPOONS',
    'LITERS',
    'QUARTS'
  ])
)

/** The units a distance is authored in; a Scene converts exactly these. */
export const lengthUnitCodeSchema = lazySchema(() => z.enum(LENGTH_UNIT_CODES))

export const scalingKindSchema = lazySchema(() => z.enum(['NONE', 'PER_LEVEL']))
export const scalingSourceSchema = lazySchema(() =>
  z.enum(['CHARACTER_LEVEL', 'CLASS_LEVEL', 'PARENT_CLASS_LEVEL', 'SPELL_CAST_LEVEL'])
)
export const scalingAmountKindSchema = lazySchema(() => z.enum(['FULL', 'HALF', 'DOUBLE']))

export const chargeResetKindSchema = lazySchema(() =>
  z.enum(['DAILY', 'DAWN', 'DUSK', 'LONG_REST', 'SHORT_REST', 'MANUAL'])
)
export const chargeLimitKindSchema = lazySchema(() =>
  z.enum([
    'FIXED_AMOUNT',
    'CHARACTER_LEVEL',
    'CLASS_LEVEL',
    'PARENT_CLASS_LEVEL',
    'SPELL_CAST_LEVEL',
    'ABILITY_MODIFIER',
    'SOURCE_CHARGES'
  ])
)
export const chargeBonusKindSchema = lazySchema(() =>
  z.enum(['PROFICIENCY_BONUS', 'ABILITY_MODIFIER', 'SKILL_BONUS'])
)
export const attackDomainCodeSchema = lazySchema(() =>
  z.enum(['MELEE', 'RANGED', 'SPELL', 'UNARMED'])
)
/** The occasion an attack is made on, which a grant can limit itself to. */
export const attackOccasionCodeSchema = lazySchema(() => z.enum(['OPPORTUNITY']))
/** An attack's kind: melee and ranged spell attacks both read SPELL modifiers. */
export const attackKindSchema = lazySchema(() =>
  z.enum(['MELEE', 'RANGED', 'UNARMED', 'MELEE_SPELL', 'RANGED_SPELL'])
)
export type AttackKind = z.infer<typeof attackKindSchema>

export const savingThrowDcMethodSchema = lazySchema(() =>
  z.enum(['SOURCE_SAVE_DC', 'FIXED_DC', 'DERIVED_DC'])
)
export const savingThrowDcBonusKindSchema = lazySchema(() =>
  z.enum(['ABILITY_MODIFIER', 'PROFICIENCY_BONUS', 'STATIC_BONUS'])
)

export const grantKindSchema = lazySchema(() =>
  z.enum(['MODIFIER_GRANT', 'PROFICIENCY_GRANT', 'SENSE_GRANT', 'FEAT_GRANT', 'SPELL_GRANT'])
)

export const authoringModeKindSchema = lazySchema(() => z.enum(['ALL', 'SELECTED']))
export const authoringSelectionKindSchema = lazySchema(() => z.enum(['GRANTED', 'CHOSEN']))
export const authoringSelectionDuplicatePolicySchema = lazySchema(() =>
  z.enum(['UNIQUE', 'REPEATABLE'])
)
export const authoringConstraintCodeSchema = lazySchema(() => z.enum(['INCLUDE', 'EXCLUDE']))

export const proficiencyKindSchema = lazySchema(() =>
  z.enum(['SKILL', 'SAVE_ABILITY', 'EQUIPMENT', 'EQUIPMENT_PROPERTY', 'LANGUAGE'])
)

export const roundingCodeSchema = lazySchema(() => z.enum(['UP', 'DOWN', 'NEAREST']))

export const spellGrantAttributeSchema = lazySchema(() =>
  z.enum([
    'CONCENTRATION',
    'RITUAL',
    'LIMITED_USE',
    'PREPARED',
    'KNOWN',
    'CAST_AT_WILL',
    'CAST_AT_LEVEL',
    'SELF_ONLY'
  ])
)

export const spellGrantAccessSchema = lazySchema(() => z.enum(['CAST', 'CLASS_LIST_ONLY']))

export const effectKindSchema = lazySchema(() =>
  z.enum([
    'DAMAGE',
    'HIT_POINT_MAXIMUM_REDUCTION',
    'SCALAR_REDUCTION',
    'CONDITION',
    'HEAL',
    'APPLY_GRANT',
    'FORCED_MOVEMENT',
    'TELEPORT',
    'MANIFEST',
    'FOLLOW_UP_SAVE',
    'FOLLOW_UP_CHECK',
    'MOVEMENT_RULE',
    'ACTION_ECONOMY_RULE',
    'STABILIZE',
    'KILL',
    'MANUAL_ADJUDICATION'
  ])
)
export const pathCodeSchema = lazySchema(() =>
  z.enum([
    'PASSIVE',
    'ON_USE',
    'ON_CAST',
    'ON_ATTACK',
    'ON_HIT',
    'ON_CRIT',
    'ON_SAVE_FAIL',
    'ON_SAVE_SUCCESS',
    'ON_CHECK_SUCCESS',
    'START_OF_TURN',
    'END_OF_TURN',
    'ON_MOVE',
    'ON_HP_ZERO',
    'ON_MISS'
  ])
)
export const pathGroupTypeSchema = lazySchema(() => z.enum(['SINGLE', 'CHOICE', 'SEQUENTIAL']))
export const pathOriginKindSchema = lazySchema(() =>
  z.enum(['SOURCE', 'PRIMARY_TARGET', 'PREVIOUS_ENTRY_TARGET'])
)
export const pathUsageSchema = lazySchema(() => z.enum(['ONCE_PER_TURN']))
export const pathResolutionKindSchema = lazySchema(() => z.enum(['DIRECT', 'ROLL_TABLE']))
export const pathRollTableKindSchema = lazySchema(() => z.enum(['RANGE', 'EXACT']))
export const pathLifecycleRecurringKindSchema = lazySchema(() =>
  z.enum(['NONE', 'START_OF_TURN', 'END_OF_TURN'])
)
export const pathLifecycleTurnActorSchema = lazySchema(() => z.enum(['TARGET', 'SOURCE']))
export const pathLifecycleTurnBoundarySchema = lazySchema(() =>
  z.enum(['START_OF_TURN', 'END_OF_TURN'])
)
/** The turn boundary an effect is counted or recurs at, on its target's or its source's turns. */
export const pathLifecycleTurnAnchorDtoSchema = lazySchema(() =>
  z.strictObject({
    actor: pathLifecycleTurnActorSchema,
    boundary: pathLifecycleTurnBoundarySchema
  })
)
/**
 * A lifecycle code that uses an effect or timed grant up (consume) or ends it (end) is a System code
 * (ADR 0039): the wire checks its shape, and the System's `effectConsumeEvent` and `effectEndEvent`
 * lists decide membership wherever the `gameSystemId` is known.
 */
export const pathLifecycleConsumeEventSchema = lazySchema(() => systemCoreCodeSchema)
export const pathLifecycleEndEventSchema = lazySchema(() => systemCoreCodeSchema)
/** Whose damage ends an effect: anyone's, or only that of the effect source and its allies. */
export const pathLifecycleEndTriggerBySchema = lazySchema(() => z.enum(['ANYONE', 'SOURCE_SIDE']))
/** Whom an action must be aimed at to end an effect: only enemies of its holder (Sanctuary). */
export const pathLifecycleEndTriggerAgainstSchema = lazySchema(() => z.enum(['ENEMY']))
/** Whose incapacitation ends an effect: that of the creature that applied it (Knight Leadership). */
export const pathLifecycleEndTriggerOfSchema = lazySchema(() => z.enum(['SOURCE']))
export const forcedMovementDirectionSchema = lazySchema(() => z.enum(FORCED_MOVEMENT_DIRECTION))
export const forcedMovementDistanceModeSchema = lazySchema(() =>
  z.enum(['UP_TO_SPEED', 'EXACT', 'UP_TO'])
)
export const forcedMovementActionEconomySchema = lazySchema(() => z.enum(['NONE', 'REACTION']))

export const valueDomainCodeSchema = lazySchema(() => z.enum(VALUE_DOMAIN_CODE))

export const modifierKindSchema = lazySchema(() => z.enum(MODIFIER_KIND))

export const modifierScopeKindSchema = lazySchema(() => z.enum(['GLOBAL', 'SOURCE']))
export const modifierValueKindSchema = lazySchema(() =>
  z.enum([
    'FIXED',
    'PROFICIENCY_BONUS',
    'ABILITY_MODIFIER',
    'SKILL_BONUS',
    'CHARACTER_LEVEL',
    'CLASS_LEVEL',
    'SPELL_SLOT_LEVEL'
  ])
)
export const operationCodeSchema = lazySchema(() =>
  z.enum(['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE', 'SET', 'REPLACE'])
)

export const equipmentCategoryCodeSchema = lazySchema(() =>
  z.enum(['WEAPON', 'ARMOR', 'ADVENTURING_GEAR', 'TOOL', 'SHIELD', 'VARIANT'])
)

export const equipmentPropertyCodeSchema = lazySchema(() =>
  z.enum([
    'LIGHT',
    'ONE_HANDED',
    'TWO_HANDED',
    'FINESSE',
    'RANGED',
    'THROWN',
    'HEAVY',
    'LOADING',
    'AMMUNITION',
    'REACH',
    'SPECIAL',
    'VERSATILE',
    'MEDIUM',
    'SIMPLE',
    'MARTIAL',
    'MELEE',
    'FLASK',
    'VIAL',
    'POISON',
    'CONTAINER',
    'POTION',
    'SCROLL',
    'WONDEROUS_ITEM',
    'ARCANE_FOCUS',
    'HOLY_SYMBOL',
    'DRINK',
    'FOOD',
    'ARTISANAL_TOOL',
    'MUSICAL_INSTRUMENT',
    'GAMING_SET',
    'DRUIDIC_FOCUS',
    'PROFESSIONAL_TOOL',
    'WOOD',
    'METAL',
    'MAGIC',
    'VEX',
    'CLOTHING'
  ])
)

export const equipmentAttributeCodeSchema = lazySchema(() =>
  z.enum(['LIMITED_USE', 'STACKABLE', 'CONSUMED_ON_USE'])
)

export const equipmentGripSchema = lazySchema(() => z.enum(['ONE_HANDED', 'TWO_HANDED']))

export const spellAttributeSchema = lazySchema(() =>
  z.enum(['CONCENTRATION', 'RITUAL', 'ADDS_TO_WEAPON_ATTACK'])
)

export const spellComponentSchema = lazySchema(() => z.enum(['VERBAL', 'SOMATIC', 'MATERIAL']))
