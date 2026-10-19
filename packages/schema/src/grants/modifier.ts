import { z, lazySchema } from '../zod.js'

import { staticGrantBaseDtoSchema } from './grant.js'
import {
  authoredFractionSchema,
  authoredIdentifierSchema,
  authoredLengthSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema
} from '../shared/authoredLimits.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { rolledDieShape } from '../shared/d20AddedDice.js'
import {
  chargeLimitKindSchema,
  chargeResetKindSchema,
  durationKindSchema,
  attackDomainCodeSchema,
  abilityCodeSchema,
  modifierKindSchema,
  modifierScopeKindSchema,
  modifierValueKindSchema,
  rangeKindSchema,
  scalingKindSchema,
  shapeKindSchema
} from '../shared/enums.js'

const emptyDomainDtoSchema = lazySchema(() => z.strictObject({}))

const attackDomainParamDtoSchema = lazySchema(() =>
  z.object({
    attackDomain: attackDomainCodeSchema
  })
)

/** An attack roll advantage or disadvantage that names an ability covers only attacks made with it. */
const attackRollRollModeParamDtoSchema = lazySchema(() =>
  z.object({
    attackDomain: attackDomainCodeSchema,
    ability: z.optional(abilityCodeSchema)
  })
)

const attacksAgainstParamDtoSchema = lazySchema(() =>
  z.object({
    attackDomain: attackDomainCodeSchema,
    requiresHolderSeesAttacker: z.boolean()
  })
)

const abilityParamDtoSchema = lazySchema(() =>
  z.object({
    ability: abilityCodeSchema
  })
)

/** One ability's tests, or every ability's when absent (a rolled die on every save covers death saves). */
const optionalAbilityParamDtoSchema = lazySchema(() =>
  z.object({
    ability: z.optional(abilityCodeSchema)
  })
)

const savingThrowParamDtoSchema = lazySchema(() =>
  z.object({
    ability: abilityCodeSchema,
    conditionTypeId: z.optional(authoredIdentifierSchema),
    ruleDefinitionId: z.optional(postgresUuidSchema),
    requiresHolderSeesSource: z.optional(z.boolean())
  })
)

const skillParamDtoSchema = lazySchema(() =>
  z.object({
    skillId: authoredIdentifierSchema
  })
)

const speedParamDtoSchema = lazySchema(() =>
  z.object({
    speedId: authoredIdentifierSchema
  })
)

/** A speed fraction names one speed, or every speed of its holder when `speedId` is omitted. */
const speedFractionParamDtoSchema = lazySchema(() =>
  z.object({
    speedId: z.optional(authoredIdentifierSchema)
  })
)

const senseParamDtoSchema = lazySchema(() =>
  z.object({
    senseDefinitionId: postgresUuidSchema
  })
)

const spellLevelParamDtoSchema = lazySchema(() =>
  z.object({
    spellLevel: z.number().check(z.int())
  })
)

const modifierScalarValueDtoSchema = lazySchema(() =>
  z.discriminatedUnion('valueKind', [
    z.object({
      valueKind: z.literal(modifierValueKindSchema._zod.def.entries.FIXED),
      amount: z.number()
    }),
    z.object({
      valueKind: z.literal(modifierValueKindSchema._zod.def.entries.PROFICIENCY_BONUS),
      multiplier: z.optional(z.number())
    }),
    z.object({
      valueKind: z.literal(modifierValueKindSchema._zod.def.entries.SKILL_BONUS),
      skillId: authoredIdentifierSchema,
      multiplier: z.optional(z.number())
    }),
    z.object({
      valueKind: z.literal(modifierValueKindSchema._zod.def.entries.CHARACTER_LEVEL),
      multiplier: z.optional(z.number())
    }),
    z.object({
      valueKind: z.literal(modifierValueKindSchema._zod.def.entries.CLASS_LEVEL),
      classId: authoredIdentifierSchema,
      multiplier: z.optional(z.number())
    }),
    z.object({
      valueKind: z.literal(modifierValueKindSchema._zod.def.entries.SPELL_SLOT_LEVEL),
      multiplier: z.optional(z.number()),
      subtractLevels: z.optional(z.number().check(z.int()).check(z.nonnegative()))
    })
  ])
)

const abilityModifierBonusPayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    ability: abilityCodeSchema,
    multiplier: z.optional(z.number()),
    min: z.optional(z.number()),
    max: z.optional(z.number())
  })
)

const optionalAbilityModifierBonusPayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    abilities: authoredReferenceCollectionSchema(abilityCodeSchema),
    min: z.optional(z.number()),
    max: z.optional(z.number())
  })
)

const chargeLimitLevelDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    level: z.number().check(z.int()),
    amount: z.number()
  })
)

const modifyChargeLimitPayloadDtoSchema = lazySchema(() =>
  z.union([
    z.object({
      limitKind: z.literal(chargeLimitKindSchema._zod.def.entries.CHARACTER_LEVEL),
      scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE),
      multiplier: z.optional(z.number()),
      min: z.optional(z.number()),
      max: z.optional(z.number())
    }),
    z.object({
      limitKind: z.enum([
        chargeLimitKindSchema._zod.def.entries.PARENT_CLASS_LEVEL,
        chargeLimitKindSchema._zod.def.entries.SPELL_CAST_LEVEL
      ]),
      scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE),
      multiplier: z.optional(z.number()),
      min: z.optional(z.number()),
      max: z.optional(z.number())
    }),
    z.object({
      limitKind: z.literal(chargeLimitKindSchema._zod.def.entries.CLASS_LEVEL),
      scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE),
      classId: authoredIdentifierSchema,
      multiplier: z.optional(z.number()),
      min: z.optional(z.number()),
      max: z.optional(z.number())
    }),
    z.object({
      limitKind: z.literal(chargeLimitKindSchema._zod.def.entries.ABILITY_MODIFIER),
      scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE),
      ability: abilityCodeSchema,
      multiplier: z.optional(z.number()),
      min: z.optional(z.number()),
      max: z.optional(z.number())
    }),
    z.object({
      limitKind: z.literal(chargeLimitKindSchema._zod.def.entries.FIXED_AMOUNT),
      scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE),
      amount: z.number()
    }),
    z.object({
      limitKind: z.literal(chargeLimitKindSchema._zod.def.entries.FIXED_AMOUNT),
      scalingKind: z.literal(scalingKindSchema._zod.def.entries.PER_LEVEL),
      levels: authoredNestedCollectionSchema(chargeLimitLevelDtoSchema)
    })
  ])
)

const amountPayloadDtoSchema = lazySchema(() => z.strictObject({ amount: z.number() }))

/** An armor class formula: the amount plus each listed ability modifier ("10 + DEX + CON"). */
const armorClassFormulaPayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    amount: z.number(),
    abilities: authoredReferenceCollectionSchema(abilityCodeSchema)
  })
)

/** Dice rolled with a d20 test and added to or subtracted from its total (Bless, Bane). */
export const rolledDiePayloadDtoSchema = lazySchema(() => z.strictObject(rolledDieShape()))

const damageTypePayloadDtoSchema = lazySchema(() =>
  z.strictObject({ damageTypeId: authoredIdentifierSchema })
)

/** An immunity can be limited to damage from actions owned by the named authored content. */
const damageImmunityPayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    damageTypeId: authoredIdentifierSchema,
    sourceEffectIds: z.optional(z.array(authoredIdentifierSchema).check(z.maxLength(100)))
  })
)

/** A resistance names its damage type, or takes the type of the damage that triggered it. */
const damageResistancePayloadDtoSchema = lazySchema(() =>
  z.union([damageTypePayloadDtoSchema, z.strictObject({ damageTypeSource: z.literal('TRIGGER') })])
)

const conditionTypePayloadDtoSchema = lazySchema(() =>
  z.strictObject({ conditionTypeId: authoredIdentifierSchema })
)

const attributePayloadDtoSchema = lazySchema(() =>
  z.strictObject({ attributeId: authoredIdentifierSchema })
)

const movementModePayloadDtoSchema = lazySchema(() =>
  z.strictObject({ movementModeId: authoredIdentifierSchema })
)

/**
 * Where the holder's voluntary movement may pass: through hostile creatures (any, or only those
 * larger than itself), ending inside them, through blocking barriers, and what each foot inside a
 * passed creature or object costs. Several grants combine as a union; the highest multiplier wins.
 */
const movementPassagePayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    creatures: z.enum(['NONE', 'ANY', 'LARGER_THAN_SELF']),
    mayEndInCreature: z.boolean(),
    blockingBarriers: z.boolean(),
    costMultiplier: z.union([z.literal(1), z.literal(2)])
  })
)

const rangeKindPayloadDtoSchema = lazySchema(() => z.strictObject({ rangeKind: rangeKindSchema }))

const durationSetValuePayloadDtoSchema = lazySchema(() =>
  z.union([
    z.strictObject({
      durationKind: z.literal(durationKindSchema._zod.def.entries.INSTANTANEOUS)
    }),
    z.strictObject({
      durationKind: z.enum([
        durationKindSchema._zod.def.entries.UNTIL_DISPELLED,
        durationKindSchema._zod.def.entries.TURN,
        durationKindSchema._zod.def.entries.ROUND,
        durationKindSchema._zod.def.entries.MINUTE,
        durationKindSchema._zod.def.entries.HOUR,
        durationKindSchema._zod.def.entries.DAY,
        durationKindSchema._zod.def.entries.WEEK,
        durationKindSchema._zod.def.entries.MONTH,
        durationKindSchema._zod.def.entries.YEAR
      ]),
      amount: z.number()
    })
  ])
)

const durationKindPayloadDtoSchema = lazySchema(() =>
  z.strictObject({ durationKind: durationKindSchema })
)

const shapeKindPayloadDtoSchema = lazySchema(() => z.strictObject({ shapeKind: shapeKindSchema }))

const chargeResetKindPayloadDtoSchema = lazySchema(() =>
  z.strictObject({ resetKind: chargeResetKindSchema })
)

/**
 * Every value-domain parameter, each optional. The grant fold carries a modifier's domain in this
 * one shape beside `valueDomainCode`, which decides the fields that are set.
 */
export const modifierDomainParamsDtoSchema = lazySchema(() =>
  z.partial(
    z.strictObject({
      ...attacksAgainstParamDtoSchema.shape,
      ...attackRollRollModeParamDtoSchema.shape,
      ...savingThrowParamDtoSchema.shape,
      ...skillParamDtoSchema.shape,
      ...speedParamDtoSchema.shape,
      ...senseParamDtoSchema.shape,
      ...spellLevelParamDtoSchema.shape
    })
  )
)

/**
 * Every modifier payload shape. The grant fold carries a payload in this union beside
 * `valueDomainCode` and `modifierKind`; each member is keyed or strict, so a payload parses to the
 * one member it is.
 */
export const modifierPayloadDtoSchema = lazySchema(() =>
  z.union([
    modifierScalarValueDtoSchema,
    modifyChargeLimitPayloadDtoSchema,
    authoredLengthSchema,
    authoredFractionSchema,
    amountPayloadDtoSchema,
    armorClassFormulaPayloadDtoSchema,
    abilityModifierBonusPayloadDtoSchema,
    optionalAbilityModifierBonusPayloadDtoSchema,
    rolledDiePayloadDtoSchema,
    damageResistancePayloadDtoSchema,
    damageImmunityPayloadDtoSchema,
    conditionTypePayloadDtoSchema,
    attributePayloadDtoSchema,
    movementModePayloadDtoSchema,
    movementPassagePayloadDtoSchema,
    rangeKindPayloadDtoSchema,
    durationSetValuePayloadDtoSchema,
    durationKindPayloadDtoSchema,
    shapeKindPayloadDtoSchema,
    chargeResetKindPayloadDtoSchema
  ])
)

export type ModifierDomainParamsDto = z.infer<typeof modifierDomainParamsDtoSchema>
export type ModifierPayloadDto = z.infer<typeof modifierPayloadDtoSchema>

const modifierGrantBaseDtoSchema = lazySchema(() =>
  z.extend(staticGrantBaseDtoSchema, {
    grantKind: z.literal('MODIFIER_GRANT'),
    scope: modifierScopeKindSchema,
    selectionKind: z.literal('GRANTED')
  })
)

const noPayloadDtoSchema = lazySchema(() => z.optional(z.undefined()))

function buildModifierGrantVariant<
  V extends string,
  K extends z.infer<typeof modifierKindSchema>,
  D extends z.ZodMiniType
>(
  valueDomainCode: V,
  modifierKind: K,
  domain: D
): ReturnType<typeof extendModifierGrantVariant<V, K, D, typeof noPayloadDtoSchema>>
function buildModifierGrantVariant<
  V extends string,
  K extends z.infer<typeof modifierKindSchema>,
  D extends z.ZodMiniType,
  P extends z.ZodMiniType
>(
  valueDomainCode: V,
  modifierKind: K,
  domain: D,
  payload: P
): ReturnType<typeof extendModifierGrantVariant<V, K, D, P>>
function buildModifierGrantVariant(
  valueDomainCode: string,
  modifierKind: z.infer<typeof modifierKindSchema>,
  domain: z.ZodMiniType,
  payload: z.ZodMiniType = noPayloadDtoSchema
) {
  return extendModifierGrantVariant(valueDomainCode, modifierKind, domain, payload)
}

const extendModifierGrantVariant = <
  V extends string,
  K extends z.infer<typeof modifierKindSchema>,
  D extends z.ZodMiniType,
  P extends z.ZodMiniType
>(
  valueDomainCode: V,
  modifierKind: K,
  domain: D,
  payload: P
) =>
  z.extend(modifierGrantBaseDtoSchema, {
    valueDomainCode: z.literal(valueDomainCode),
    modifierKind: z.literal(modifierKind),
    domain,
    payload
  })
const buildModifierGrantVariants = () =>
  [
    buildModifierGrantVariant(
      'HIT_POINTS_MAX',
      'BONUS',
      emptyDomainDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'HIT_POINTS_MAX',
      'PENALTY',
      emptyDomainDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'HIT_POINTS_MAX',
      'SET_VALUE',
      emptyDomainDtoSchema,
      amountPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'ARMOR_CLASS',
      'BONUS',
      emptyDomainDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'ARMOR_CLASS',
      'PENALTY',
      emptyDomainDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'ARMOR_CLASS',
      'SET_VALUE',
      emptyDomainDtoSchema,
      armorClassFormulaPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'ARMOR_CLASS',
      'ABILITY_MODIFIER_BONUS',
      emptyDomainDtoSchema,
      abilityModifierBonusPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'ARMOR_CLASS',
      'OPTIONAL_ABILITY_MODIFIER_BONUS',
      emptyDomainDtoSchema,
      optionalAbilityModifierBonusPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'INITIATIVE',
      'BONUS',
      emptyDomainDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'INITIATIVE',
      'PENALTY',
      emptyDomainDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant('INITIATIVE', 'ADVANTAGE', emptyDomainDtoSchema),
    buildModifierGrantVariant('INITIATIVE', 'DISADVANTAGE', emptyDomainDtoSchema),
    buildModifierGrantVariant('ABILITY_CHECK', 'ADVANTAGE', optionalAbilityParamDtoSchema),
    buildModifierGrantVariant('ABILITY_CHECK', 'DISADVANTAGE', optionalAbilityParamDtoSchema),
    buildModifierGrantVariant(
      'SAVE_DC',
      'BONUS',
      emptyDomainDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'SAVE_DC',
      'PENALTY',
      emptyDomainDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant('SAVE_DC', 'SET_VALUE', emptyDomainDtoSchema, amountPayloadDtoSchema),
    buildModifierGrantVariant(
      'SAVING_THROW_MODIFIER',
      'BONUS',
      savingThrowParamDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'SAVING_THROW_MODIFIER',
      'PENALTY',
      savingThrowParamDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant('SAVING_THROW_MODIFIER', 'ADVANTAGE', savingThrowParamDtoSchema),
    buildModifierGrantVariant('SAVING_THROW_MODIFIER', 'DISADVANTAGE', savingThrowParamDtoSchema),
    buildModifierGrantVariant(
      'SAVING_THROW_MODIFIER',
      'ADD_BONUS_DIE',
      optionalAbilityParamDtoSchema,
      rolledDiePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'ATTACK_ROLL',
      'BONUS',
      attackDomainParamDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'ATTACK_ROLL',
      'PENALTY',
      attackDomainParamDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'ATTACK_ROLL',
      'ABILITY_MODIFIER_BONUS',
      attackDomainParamDtoSchema,
      abilityModifierBonusPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'ATTACK_ROLL',
      'OPTIONAL_ABILITY_MODIFIER_BONUS',
      attackDomainParamDtoSchema,
      optionalAbilityModifierBonusPayloadDtoSchema
    ),
    buildModifierGrantVariant('ATTACK_ROLL', 'ADVANTAGE', attackRollRollModeParamDtoSchema),
    buildModifierGrantVariant('ATTACK_ROLL', 'DISADVANTAGE', attackRollRollModeParamDtoSchema),
    buildModifierGrantVariant(
      'ATTACK_ROLL',
      'ADD_BONUS_DIE',
      attackRollRollModeParamDtoSchema,
      rolledDiePayloadDtoSchema
    ),
    buildModifierGrantVariant('ATTACKS_AGAINST', 'ADVANTAGE', attacksAgainstParamDtoSchema),
    buildModifierGrantVariant('ATTACKS_AGAINST', 'DISADVANTAGE', attacksAgainstParamDtoSchema),
    buildModifierGrantVariant('OPPORTUNITY_ATTACK_IMMUNITY', 'ENABLE', emptyDomainDtoSchema),
    buildModifierGrantVariant('SPELLCASTING_LOCK', 'ENABLE', emptyDomainDtoSchema),
    buildModifierGrantVariant('ACTION_BONUS_ACTION_EXCLUSIVITY', 'ENABLE', emptyDomainDtoSchema),
    buildModifierGrantVariant(
      'SKILL_MODIFIER',
      'BONUS',
      skillParamDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant('SKILL_MODIFIER', 'ADVANTAGE', skillParamDtoSchema),
    buildModifierGrantVariant('SKILL_MODIFIER', 'DISADVANTAGE', skillParamDtoSchema),
    buildModifierGrantVariant(
      'SKILL_MODIFIER',
      'PENALTY',
      skillParamDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'ABILITY_SCORE',
      'BONUS',
      abilityParamDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'ABILITY_SCORE',
      'PENALTY',
      abilityParamDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'ABILITY_SCORE',
      'SET_VALUE',
      abilityParamDtoSchema,
      amountPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'PROFICIENCY_BONUS',
      'BONUS',
      emptyDomainDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'PROFICIENCY_BONUS',
      'SET_VALUE',
      emptyDomainDtoSchema,
      amountPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'DAMAGE',
      'BONUS',
      attackDomainParamDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'DAMAGE',
      'PENALTY',
      attackDomainParamDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'DAMAGE',
      'ABILITY_MODIFIER_BONUS',
      attackDomainParamDtoSchema,
      abilityModifierBonusPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'DAMAGE',
      'OPTIONAL_ABILITY_MODIFIER_BONUS',
      attackDomainParamDtoSchema,
      optionalAbilityModifierBonusPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'DAMAGE',
      'REPLACE_DAMAGE_TYPE',
      attackDomainParamDtoSchema,
      damageTypePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'DAMAGE_RESISTANCE',
      'ADD_OPTION',
      emptyDomainDtoSchema,
      damageResistancePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'DAMAGE_RESISTANCE',
      'REMOVE_OPTION',
      emptyDomainDtoSchema,
      damageResistancePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'DAMAGE_IMMUNITY',
      'ADD_OPTION',
      emptyDomainDtoSchema,
      damageImmunityPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'DAMAGE_IMMUNITY',
      'REMOVE_OPTION',
      emptyDomainDtoSchema,
      damageImmunityPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'DAMAGE_VULNERABILITY',
      'ADD_OPTION',
      emptyDomainDtoSchema,
      damageTypePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'DAMAGE_VULNERABILITY',
      'REMOVE_OPTION',
      emptyDomainDtoSchema,
      damageTypePayloadDtoSchema
    ),
    buildModifierGrantVariant('SPEED', 'BONUS', speedParamDtoSchema, authoredLengthSchema),
    buildModifierGrantVariant('SPEED', 'PENALTY', speedParamDtoSchema, authoredLengthSchema),
    buildModifierGrantVariant('SPEED', 'SET_VALUE', speedParamDtoSchema, authoredLengthSchema),
    buildModifierGrantVariant(
      'SPEED',
      'MULTIPLY',
      speedFractionParamDtoSchema,
      authoredFractionSchema
    ),
    buildModifierGrantVariant(
      'MOVEMENT_MODE',
      'ADD_OPTION',
      emptyDomainDtoSchema,
      movementModePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'MOVEMENT_MODE',
      'REMOVE_OPTION',
      emptyDomainDtoSchema,
      movementModePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'MOVEMENT_PASSAGE',
      'ADD_OPTION',
      emptyDomainDtoSchema,
      movementPassagePayloadDtoSchema
    ),
    buildModifierGrantVariant('SENSE_RANGE', 'BONUS', senseParamDtoSchema, authoredLengthSchema),
    buildModifierGrantVariant(
      'RANGE',
      'REPLACE_RANGE_KIND',
      emptyDomainDtoSchema,
      rangeKindPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'DURATION',
      'SET_VALUE',
      emptyDomainDtoSchema,
      durationSetValuePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'DURATION',
      'REPLACE_DURATION_KIND',
      emptyDomainDtoSchema,
      durationKindPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'SHAPE',
      'REPLACE_SHAPE_KIND',
      emptyDomainDtoSchema,
      shapeKindPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'SPELL_SLOT_COUNT',
      'BONUS',
      spellLevelParamDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'SPELL_SLOT_COUNT',
      'SET_VALUE',
      spellLevelParamDtoSchema,
      amountPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'SPELL_SLOT_LEVEL_MAX',
      'SET_VALUE',
      emptyDomainDtoSchema,
      amountPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'SPELLS_KNOWN',
      'BONUS',
      emptyDomainDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'SPELLS_KNOWN',
      'SET_VALUE',
      emptyDomainDtoSchema,
      amountPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'SPELLS_PREPARED',
      'BONUS',
      emptyDomainDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'SPELLS_PREPARED',
      'SET_VALUE',
      emptyDomainDtoSchema,
      amountPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'ACTION_COUNT',
      'BONUS',
      emptyDomainDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'ACTION_COUNT',
      'SET_VALUE',
      emptyDomainDtoSchema,
      amountPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'BONUS_ACTION_COUNT',
      'BONUS',
      emptyDomainDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'BONUS_ACTION_COUNT',
      'SET_VALUE',
      emptyDomainDtoSchema,
      amountPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'REACTION_COUNT',
      'BONUS',
      emptyDomainDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'REACTION_COUNT',
      'SET_VALUE',
      emptyDomainDtoSchema,
      amountPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'ATTACKS_PER_ATTACK_ACTION',
      'SET_VALUE',
      emptyDomainDtoSchema,
      amountPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'ATTACKS_PER_ATTACK_ACTION',
      'CAP_VALUE',
      emptyDomainDtoSchema,
      z.object({ amount: z.number() })
    ),
    buildModifierGrantVariant(
      'CHARGE_LIMIT',
      'MODIFY_CHARGE_LIMIT',
      emptyDomainDtoSchema,
      modifyChargeLimitPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'CHARGE_LIMIT',
      'SET_VALUE',
      emptyDomainDtoSchema,
      amountPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'CHARGE_RESET',
      'REPLACE_CHARGE_RESET_KIND',
      emptyDomainDtoSchema,
      chargeResetKindPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'CONDITION',
      'ADD_OPTION',
      emptyDomainDtoSchema,
      conditionTypePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'CONDITION',
      'REMOVE_OPTION',
      emptyDomainDtoSchema,
      conditionTypePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'CONDITION_IMMUNITY',
      'ADD_OPTION',
      emptyDomainDtoSchema,
      conditionTypePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'CONDITION_IMMUNITY',
      'REMOVE_OPTION',
      emptyDomainDtoSchema,
      conditionTypePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'ATTRIBUTE',
      'ADD_OPTION',
      emptyDomainDtoSchema,
      attributePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'ATTRIBUTE',
      'REMOVE_OPTION',
      emptyDomainDtoSchema,
      attributePayloadDtoSchema
    )
  ] as const
type ModifierGrantVariant = ReturnType<typeof buildModifierGrantVariants>[number]

const buildModifierDomainUnions = () => {
  const modifierVariantsByDomain = new Map<
    string,
    [ModifierGrantVariant, ...ModifierGrantVariant[]]
  >()
  for (const variant of buildModifierGrantVariants()) {
    const domain = variant.shape.valueDomainCode._zod.def.values[0]
    const variants = modifierVariantsByDomain.get(domain)
    if (variants) variants.push(variant)
    else modifierVariantsByDomain.set(domain, [variant])
  }
  return [...modifierVariantsByDomain.values()].map((variants) =>
    z.discriminatedUnion('modifierKind', variants, { error: unsupportedModifierKindError })
  )
}

/** A kind with no variant, such as SENSE_RANGE SET_VALUE, still gets the "not supported yet" message. */
function unsupportedModifierKindError(issue: { input?: unknown }): string | undefined {
  const { input } = issue
  if (
    typeof input !== 'object' ||
    input === null ||
    !('valueDomainCode' in input) ||
    !('modifierKind' in input) ||
    typeof input.valueDomainCode !== 'string' ||
    typeof input.modifierKind !== 'string'
  )
    return undefined
  return (
    unsupportedModifierMessage({
      valueDomainCode: input.valueDomainCode,
      modifierKind: input.modifierKind
    }) ?? undefined
  )
}

/**
 * Authorable modifiers that no System consumer applies yet and the SRD does not use. Publication
 * and import reject them rather than store a mechanic that silently does nothing.
 * `REACTION_COUNT SET_VALUE` stays authorable: SRD Shocking Grasp applies it through a granted
 * effect, which Phase 8.3 applies. So does `ACTION_COUNT SET_VALUE`: SRD Fighter Action Surge sets the
 * holder's Action maximum for the turn, which the action economy reads.
 */
const UNSUPPORTED_MODIFIERS = new Set([
  'SAVE_DC SET_VALUE',
  'PROFICIENCY_BONUS BONUS',
  'PROFICIENCY_BONUS SET_VALUE',
  'CHARGE_LIMIT MODIFY_CHARGE_LIMIT',
  'CHARGE_LIMIT SET_VALUE',
  'RANGE REPLACE_RANGE_KIND',
  'DURATION SET_VALUE',
  'DURATION REPLACE_DURATION_KIND',
  'SHAPE REPLACE_SHAPE_KIND',
  'SPELL_SLOT_COUNT BONUS',
  'SPELL_SLOT_COUNT SET_VALUE',
  'SPELL_SLOT_LEVEL_MAX SET_VALUE',
  'SPELLS_KNOWN BONUS',
  'SPELLS_KNOWN SET_VALUE',
  'SPELLS_PREPARED BONUS',
  'SPELLS_PREPARED SET_VALUE',
  'ACTION_COUNT BONUS',
  'BONUS_ACTION_COUNT BONUS',
  'BONUS_ACTION_COUNT SET_VALUE',
  'REACTION_COUNT BONUS'
])

function unsupportedModifierMessage(value: {
  valueDomainCode: string
  modifierKind: string
}): string | null {
  const label = `${value.valueDomainCode} ${value.modifierKind}`
  if (
    value.modifierKind === 'SET_VALUE' &&
    (value.valueDomainCode === 'HIT_POINTS_MAX' || value.valueDomainCode === 'SENSE_RANGE')
  )
    return `${label} modifiers are not supported yet; use a bonus or penalty.`
  if (
    UNSUPPORTED_MODIFIERS.has(label) ||
    value.modifierKind === 'REPLACE_DAMAGE_TYPE' ||
    value.valueDomainCode === 'MOVEMENT_MODE' ||
    value.valueDomainCode === 'ATTRIBUTE' ||
    value.valueDomainCode === 'CONDITION'
  )
    return `${label} modifiers are not supported yet.`
  return null
}

/** Spell-scoped modifiers are applied only to the attack and damage rolls of those spells. */
function spellScopedOutsideSpellAttacks(value: {
  valueDomainCode: string
  domain?: unknown
  restrictions?: { groups: readonly { contexts: readonly { subject: string }[] }[] }
}): boolean {
  const spellScoped = (value.restrictions?.groups ?? []).some((group) =>
    group.contexts.some((context) => context.subject === 'SPELL')
  )
  const attackDomain =
    typeof value.domain === 'object' && value.domain !== null
      ? (value.domain as { attackDomain?: unknown }).attackDomain
      : undefined
  return (
    spellScoped &&
    !(
      (value.valueDomainCode === 'ATTACK_ROLL' || value.valueDomainCode === 'DAMAGE') &&
      attackDomain === 'SPELL'
    )
  )
}

/**
 * Modifier grants are one of the highest-risk authored payloads because the
 * valid domain and payload shape both depend on `valueDomainCode` and
 * `modifierKind`. We keep the schema explicit here so later API and seed data
 * validation catches drift early instead of accepting opaque objects.
 */
export const modifierGrantDtoSchema = lazySchema(() => {
  const [firstModifierDomain, ...otherModifierDomains] = buildModifierDomainUnions()
  return z
    .discriminatedUnion('valueDomainCode', [firstModifierDomain, ...otherModifierDomains])
    .check(
      z.superRefine((value, ctx) => {
        const unsupported = unsupportedModifierMessage(value)
        if (unsupported !== null)
          ctx.addIssue({ code: 'custom', message: unsupported, path: ['modifierKind'] })
        if (spellScopedOutsideSpellAttacks(value))
          ctx.addIssue({
            code: 'custom',
            message:
              'Spell-scoped modifiers are supported only for spell attack rolls and spell damage.',
            path: ['restrictions']
          })
        if (!value.modifierKind.includes('BONUS')) return
        const payload: unknown = value.payload
        if (typeof payload !== 'object' || payload === null) return

        for (const field of ['amount', 'multiplier', 'min', 'max'] as const) {
          const candidate = (payload as Record<string, unknown>)[field]
          if (typeof candidate !== 'number' || candidate >= 0) continue
          ctx.addIssue({
            code: 'custom',
            message: `${field} must be greater than or equal to 0 for bonus modifiers`,
            path: ['payload', field]
          })
        }
      })
    )
})

export type ModifierGrantDto = z.infer<typeof modifierGrantDtoSchema>
