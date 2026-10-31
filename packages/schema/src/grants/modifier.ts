import { z, lazySchema } from '../zod.js'

import { staticGrantBaseDtoSchema } from './grant.js'
import {
  authoredFractionSchema,
  authoredIdentifierSchema,
  authoredLengthSchema,
  speedEqualsPayloadSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema
} from '../shared/authoredLimits.js'
import { durationDtoSchema } from '../shared/duration.js'
import { savingThrowDtoSchema } from '../shared/savingThrow.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'
import { rolledDieShape } from '../shared/d20AddedDice.js'
import { MAX_ROLLED_DIE_COUNT, ROLLED_DIE_FACES } from '@artificer-toolkit/shared/core'
import { amountBonusDtoSchema } from '../effects/heal.js'
import {
  chargeLimitKindSchema,
  chargeResetKindSchema,
  damageDefenseBypassCodeSchema,
  durationKindSchema,
  attackDomainCodeSchema,
  attackOccasionCodeSchema,
  modifierKindSchema,
  modifierScopeKindSchema,
  modifierValueKindSchema,
  rangeKindSchema,
  scalingAmountKindSchema,
  scalingKindSchema,
  shapeKindSchema
} from '../shared/enums.js'

const emptyDomainDtoSchema = lazySchema(() => z.strictObject({}))

const attackDomainParamDtoSchema = lazySchema(() =>
  z.object({
    attackDomain: attackDomainCodeSchema
  })
)

/** One attack domain's damage, or every damage when absent (attacks and spells alike). */
const optionalAttackDomainParamDtoSchema = lazySchema(() =>
  z.object({
    attackDomain: z.optional(attackDomainCodeSchema)
  })
)

/** An attack roll advantage or disadvantage that names an ability covers only attacks made with it. */
const attackRollRollModeParamDtoSchema = lazySchema(() =>
  z.object({
    attackDomain: attackDomainCodeSchema,
    ability: z.optional(systemCoreCodeSchema),
    /** Only attacks against the source of the effect holding the grant (Bestow Curse). */
    againstEffectSource: z.optional(z.boolean())
  })
)

const attacksAgainstParamDtoSchema = lazySchema(() =>
  z.object({
    attackDomain: attackDomainCodeSchema,
    requiresHolderSeesAttacker: z.boolean(),
    /** System Senses that free an attacker perceiving the holder through one of them (Blur). */
    exemptAttackerSenseDefinitionIds: z.optional(z.array(postgresUuidSchema)),
    /** Only attacks made on this occasion (Escape the Horde: opportunity attacks). */
    attackOccasion: z.optional(attackOccasionCodeSchema)
  })
)

/** The trait an attack gains, which overcomes a defense "from attacks" without it. */
const attackTraitParamDtoSchema = lazySchema(() =>
  z.object({
    trait: damageDefenseBypassCodeSchema,
    attackDomain: z.optional(attackDomainCodeSchema)
  })
)

const abilityParamDtoSchema = lazySchema(() =>
  z.object({
    ability: systemCoreCodeSchema
  })
)

/** One ability's tests, or every ability's when absent (a rolled die on every save covers death saves). */
const optionalAbilityParamDtoSchema = lazySchema(() =>
  z.object({
    ability: z.optional(systemCoreCodeSchema)
  })
)

/**
 * A d20 floor's ability checks: one ability's or every ability's, and only those adding the
 * holder's full proficiency bonus or more when `proficientOnly` (Reliable Talent).
 */
const abilityCheckFloorParamDtoSchema = lazySchema(() =>
  z.object({
    ability: z.optional(systemCoreCodeSchema),
    proficientOnly: z.optional(z.boolean())
  })
)

const savingThrowParamDtoSchema = lazySchema(() =>
  z.object({
    ability: systemCoreCodeSchema,
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

const healingDealtParamDtoSchema = lazySchema(() =>
  z.object({
    addsSpellLevel: z.optional(z.boolean())
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
      valueKind: z.literal(modifierValueKindSchema._zod.def.entries.ABILITY_MODIFIER),
      ...abilityModifierBonusPayloadDtoSchema.shape
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
      subtractLevels: z.optional(z.number().check(z.int()).check(z.nonnegative())),
      levelsPerStep: z.optional(z.number().check(z.int()).check(z.gte(1))),
      maximum: z.optional(z.number())
    })
  ])
)

const abilityModifierBonusPayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    ability: systemCoreCodeSchema,
    multiplier: z.optional(z.number()),
    min: z.optional(z.number()),
    max: z.optional(z.number())
  })
)

/** The best of several ability modifiers; `SPELLCASTING` is the holder's spellcasting ability. */
const optionalAbilityModifierBonusPayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    abilities: authoredReferenceCollectionSchema(systemCoreCodeSchema),
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
      ability: systemCoreCodeSchema,
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

/** The d20 face a test treats a lower roll as (Glibness's 15): above 1, within a d20. */
const minimumRollPayloadDtoSchema = lazySchema(() =>
  z.strictObject({ amount: z.number().check(z.int()).check(z.gte(2)).check(z.lte(20)) })
)

/** A weapon damage die by its faces: a d4 through a d12. */
const weaponDamageDiePayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    amount: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12)])
  })
)

/** An armor class formula: the amount plus each listed ability modifier ("10 + DEX + CON"). */
const armorClassFormulaPayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    amount: z.number(),
    abilities: authoredReferenceCollectionSchema(systemCoreCodeSchema)
  })
)

const attackDecoyThresholdDtoSchema = lazySchema(() =>
  z.strictObject({
    id: authoredIdentifierSchema,
    /** The decoys left for which this row applies. */
    remaining: z.number().check(z.int()).check(z.gte(1)).check(z.lte(20)),
    /** The d20 roll an attack needs to target a decoy while that many remain. */
    minimumRoll: z.number().check(z.int()).check(z.gte(1)).check(z.lte(21))
  })
)

/** Decoys an attack against the holder may target instead: their armor class and roll thresholds. */
export const attackDecoysPayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    armorClass: armorClassFormulaPayloadDtoSchema,
    thresholds: authoredNestedCollectionSchema(attackDecoyThresholdDtoSchema),
    /** System Senses that free an attacker perceiving the holder through one of them (Mirror Image). */
    exemptAttackerSenseDefinitionIds: z.optional(z.array(postgresUuidSchema))
  })
)

/** The holder's creature summoned with one of these authored effect ids can attack in place of one of its attacks. */
export const delegatedAttackPayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    effectIds: z.array(postgresUuidSchema).check(z.minLength(1))
  })
)

/** The holder's own active effects with these authored ids do not end on these lifecycle events. */
export const endEventExemptionPayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    events: z.array(systemCoreCodeSchema).check(z.minLength(1)),
    effectIds: z.array(postgresUuidSchema).check(z.minLength(1))
  })
)

/** Damage that would drop the holder to 0 hit points leaves it at `dropToHitPoints` instead. */
export type DamageInterceptionPayloadDto = {
  dropToHitPoints: number
  negatesKill: boolean
  save?: {
    ability: z.infer<typeof systemCoreCodeSchema>
    dc: { base: number; plusDamageTaken: boolean; plusPerChargeUsed: number }
    /** A pass always spends a use; when set, a failed save spends one too. */
    spendsUseOnFailure: boolean
  }
  excludes?: { damageTypeIds: string[]; critical: boolean }
  maxDamageTaken?: number
}

/** Typed explicitly so the projections embedding the payload stay within the declaration size limit (TS7056). */
export const damageInterceptionPayloadDtoSchema: z.ZodMiniType<DamageInterceptionPayloadDto> =
  lazySchema(() =>
    z.strictObject({
      dropToHitPoints: z.number().check(z.int()).check(z.gte(1)).check(z.lte(1000)),
      negatesKill: z.boolean(),
      save: z.optional(
        z.strictObject({
          ability: systemCoreCodeSchema,
          dc: z.strictObject({
            base: z.number().check(z.int()).check(z.gte(0)).check(z.lte(100)),
            plusDamageTaken: z.boolean(),
            plusPerChargeUsed: z.number().check(z.int()).check(z.gte(0)).check(z.lte(100))
          }),
          spendsUseOnFailure: z.boolean()
        })
      ),
      excludes: z.optional(
        z.strictObject({
          damageTypeIds: authoredReferenceCollectionSchema(authoredIdentifierSchema),
          critical: z.boolean()
        })
      ),
      maxDamageTaken: z.optional(z.number().check(z.int()).check(z.gte(1)).check(z.lte(1000)))
    })
  )

/**
 * How the holder takes damage. `HALVE` halves every damage application before its defenses,
 * rounding down (Uncanny Dodge). `SAVE_FOR_HALF` replaces what an effect that deals half its damage
 * on a successful save deals the holder on a save of one of `saveAbilities` (Evasion: none on a
 * success, half on a failure); any other save is untouched. `REDUCE` takes a rolled die plus the
 * holder's `bonuses` from the primary damage of each attack that hits it, floored at 0, before halving
 * and its defenses (Deflect Missiles).
 */
const incomingDamageDieShape = () => ({
  count: z.number().check(z.int()).check(z.gte(1)).check(z.lte(MAX_ROLLED_DIE_COUNT)),
  faces: z.literal(ROLLED_DIE_FACES)
})
const incomingSaveForHalfPayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    incomingDamageKind: z.literal('SAVE_FOR_HALF'),
    saveAbilities: z.array(systemCoreCodeSchema).check(z.minLength(1)).check(z.maxLength(6)),
    onSaveSuccess: z.enum(['NONE', 'HALF']),
    onSaveFailure: z.enum(['HALF', 'FULL'])
  })
)
export const incomingDamagePayloadDtoSchema = lazySchema(() =>
  z.union([
    z.strictObject({ incomingDamageKind: z.literal('HALVE') }),
    incomingSaveForHalfPayloadDtoSchema,
    z
      .strictObject({
        incomingDamageKind: z.literal('REDUCE'),
        count: z.optional(incomingDamageDieShape().count),
        faces: z.optional(incomingDamageDieShape().faces),
        bonuses: authoredNestedCollectionSchema(amountBonusDtoSchema)
      })
      .check(
        z.refine(
          ({ count, faces }) => (count === undefined) === (faces === undefined),
          'A reduction die names both its count and its faces.'
        )
      )
  ])
)
export type IncomingDamagePayloadDto = z.infer<typeof incomingDamagePayloadDtoSchema>

/**
 * A holder's `INCOMING_DAMAGE` grants, folded: whether it halves damage, its save-for-half
 * replacements, and its attack damage reductions, each a die and the flat amount its bonuses resolve
 * to for the holder.
 */
export const incomingDamageReductionsDtoSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        die: z.nullable(z.strictObject(incomingDamageDieShape())),
        flat: z.number().check(z.int()).check(z.gte(0))
      })
    )
    .check(z.maxLength(16))
)
export type IncomingDamageReductionsDto = z.infer<typeof incomingDamageReductionsDtoSchema>

export const incomingDamageProfileDtoSchema = lazySchema(() =>
  z.strictObject({
    halved: z.boolean(),
    saveForHalf: z.array(incomingSaveForHalfPayloadDtoSchema),
    reductions: incomingDamageReductionsDtoSchema
  })
)
export type IncomingDamageProfileDto = z.infer<typeof incomingDamageProfileDtoSchema>

/**
 * The save an attacker makes against the holder's source before a single-target attack or harmful spell lands.
 * `attackerCreatureTypeIds` narrows the ward to attackers of those Creature types; `successImmunity` frees an
 * attacker who passes from the ward for that long.
 */
export const incomingAttackGatePayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    savingThrow: savingThrowDtoSchema,
    attackerCreatureTypeIds: z.optional(
      authoredReferenceCollectionSchema(authoredIdentifierSchema)
    ),
    successImmunity: z.optional(z.strictObject({ duration: durationDtoSchema }))
  })
)

/** A code from the Game System's roll-influence vocabulary; the System checks it at ingress. */
export const rollInfluencePayloadDtoSchema = lazySchema(() =>
  z.strictObject({ influence: systemCoreCodeSchema })
)

/**
 * Dice rolled with a d20 test and added to or subtracted from its total (Bless, Bane). An
 * `AFTER_ROLL` die is offered in the roll's window once the d20 is seen, never rolled with it.
 */
export const rolledDiePayloadDtoSchema = lazySchema(() =>
  z.strictObject({ ...rolledDieShape(), timing: z.optional(z.literal('AFTER_ROLL')) })
)

const damageTypePayloadDtoSchema = lazySchema(() =>
  z.strictObject({ damageTypeId: authoredIdentifierSchema })
)

const saveSuccessDamagePayloadDtoSchema = lazySchema(() =>
  z.strictObject({ amountKind: z.literal(scalingAmountKindSchema._zod.def.entries.HALF) })
)

const damageDieShape = () => ({
  ...rolledDieShape(),
  recipient: z.enum(['HOLDER_DEALS', 'SOURCE_DEALS_TO_HOLDER']),
  countPerCastLevelAbove: z.optional(
    z.strictObject({
      level: z.number().check(z.int()).check(z.gte(1)).check(z.lte(9)),
      count: z.number().check(z.int()).check(z.gte(1)).check(z.lte(MAX_ROLLED_DIE_COUNT))
    })
  )
})

/**
 * Dice a damage roll adds or subtracts (D156): an added die names its damage type or takes the
 * attack's; a subtracted die always lowers the attack's own damage.
 */
export const damageDiePayloadDtoSchema = lazySchema(() =>
  z.union([
    z.strictObject({
      ...damageDieShape(),
      sign: z.literal('ADD'),
      damageTypeId: authoredIdentifierSchema
    }),
    z.strictObject({ ...damageDieShape(), damageTypeSource: z.literal('ATTACK') })
  ])
)

/** A defense limited to attacks without any of these traits ("from nonmagical attacks"). */
const bypassedByShape = () => ({
  bypassedBy: z.optional(
    z.array(damageDefenseBypassCodeSchema).check(z.minLength(1)).check(z.maxLength(3))
  )
})

/** An immunity can be limited to damage from actions owned by the named authored content. */
const damageImmunityPayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    damageTypeId: authoredIdentifierSchema,
    sourceEffectIds: z.optional(z.array(authoredIdentifierSchema).check(z.maxLength(100))),
    ...bypassedByShape()
  })
)

/** A resistance names its damage type, or takes the type of the damage that triggered it. */
const damageResistancePayloadDtoSchema = lazySchema(() =>
  z.union([
    z.strictObject({ damageTypeId: authoredIdentifierSchema, ...bypassedByShape() }),
    z.strictObject({ damageTypeSource: z.literal('TRIGGER') })
  ])
)

const conditionTypePayloadDtoSchema = lazySchema(() =>
  z.strictObject({ conditionTypeId: authoredIdentifierSchema })
)

const magicSchoolPayloadDtoSchema = lazySchema(() =>
  z.strictObject({ magicSchoolId: authoredIdentifierSchema })
)

const skillPayloadDtoSchema = lazySchema(() =>
  z.strictObject({ skillId: authoredIdentifierSchema })
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

const rangeReplacementPayloadDtoSchema = lazySchema(() =>
  z.union([
    z.strictObject({
      rangeKind: z.enum([
        rangeKindSchema._zod.def.entries.SELF,
        rangeKindSchema._zod.def.entries.TOUCH,
        rangeKindSchema._zod.def.entries.SIGHT,
        rangeKindSchema._zod.def.entries.SPECIAL,
        rangeKindSchema._zod.def.entries.UNLIMITED
      ])
    }),
    z.extend(authoredLengthSchema, {
      rangeKind: z.literal(rangeKindSchema._zod.def.entries.DISTANCE)
    })
  ])
)

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
      ...attackTraitParamDtoSchema.shape,
      ...abilityCheckFloorParamDtoSchema.shape,
      ...savingThrowParamDtoSchema.shape,
      ...skillParamDtoSchema.shape,
      ...speedParamDtoSchema.shape,
      ...senseParamDtoSchema.shape,
      ...spellLevelParamDtoSchema.shape,
      ...healingDealtParamDtoSchema.shape
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
    speedEqualsPayloadSchema,
    authoredFractionSchema,
    amountPayloadDtoSchema,
    armorClassFormulaPayloadDtoSchema,
    attackDecoysPayloadDtoSchema,
    damageInterceptionPayloadDtoSchema,
    delegatedAttackPayloadDtoSchema,
    endEventExemptionPayloadDtoSchema,
    incomingDamagePayloadDtoSchema,
    incomingAttackGatePayloadDtoSchema,
    abilityModifierBonusPayloadDtoSchema,
    optionalAbilityModifierBonusPayloadDtoSchema,
    rollInfluencePayloadDtoSchema,
    rolledDiePayloadDtoSchema,
    damageDiePayloadDtoSchema,
    damageResistancePayloadDtoSchema,
    damageImmunityPayloadDtoSchema,
    conditionTypePayloadDtoSchema,
    magicSchoolPayloadDtoSchema,
    skillPayloadDtoSchema,
    attributePayloadDtoSchema,
    movementModePayloadDtoSchema,
    movementPassagePayloadDtoSchema,
    rangeReplacementPayloadDtoSchema,
    saveSuccessDamagePayloadDtoSchema,
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
    buildModifierGrantVariant(
      'INITIATIVE',
      'ROLL_INFLUENCE',
      emptyDomainDtoSchema,
      rollInfluencePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'ABILITY_CHECK',
      'ROLL_INFLUENCE',
      optionalAbilityParamDtoSchema,
      rollInfluencePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'ABILITY_CHECK',
      'MINIMUM_ROLL',
      abilityCheckFloorParamDtoSchema,
      minimumRollPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'ABILITY_CHECK',
      'ADD_BONUS_DIE',
      optionalAbilityParamDtoSchema,
      rolledDiePayloadDtoSchema
    ),
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
    buildModifierGrantVariant(
      'SAVING_THROW_MODIFIER',
      'ROLL_INFLUENCE',
      savingThrowParamDtoSchema,
      rollInfluencePayloadDtoSchema
    ),
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
    buildModifierGrantVariant(
      'ATTACK_ROLL',
      'ROLL_INFLUENCE',
      attackRollRollModeParamDtoSchema,
      rollInfluencePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'ATTACK_ROLL',
      'ADD_BONUS_DIE',
      attackRollRollModeParamDtoSchema,
      rolledDiePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'CRITICAL_HIT_THRESHOLD',
      'CAP_VALUE',
      attackDomainParamDtoSchema,
      z.object({ amount: z.number() })
    ),
    buildModifierGrantVariant(
      'CRITICAL_EXTRA_DICE',
      'BONUS',
      attackDomainParamDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'ATTACKS_AGAINST',
      'ROLL_INFLUENCE',
      attacksAgainstParamDtoSchema,
      rollInfluencePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'ATTACKS_AGAINST',
      'SUPPRESS_ROLL_INFLUENCE',
      attacksAgainstParamDtoSchema,
      rollInfluencePayloadDtoSchema
    ),
    buildModifierGrantVariant('ATTACK_TRAIT', 'ENABLE', attackTraitParamDtoSchema),
    buildModifierGrantVariant(
      'WEAPON_DAMAGE_DIE',
      'SET_VALUE',
      emptyDomainDtoSchema,
      weaponDamageDiePayloadDtoSchema
    ),
    buildModifierGrantVariant('WEAPON_PROFICIENCY', 'ENABLE', emptyDomainDtoSchema),
    buildModifierGrantVariant('OPPORTUNITY_ATTACK_IMMUNITY', 'ENABLE', emptyDomainDtoSchema),
    buildModifierGrantVariant('FREE_OPPORTUNITY_REACTION', 'ENABLE', emptyDomainDtoSchema),
    buildModifierGrantVariant('SPELLCASTING_LOCK', 'ENABLE', emptyDomainDtoSchema),
    buildModifierGrantVariant('HEALING_RECEIVED', 'ENABLE', emptyDomainDtoSchema),
    buildModifierGrantVariant(
      'HEALING_DEALT',
      'BONUS',
      healingDealtParamDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant('ACTION_BONUS_ACTION_EXCLUSIVITY', 'ENABLE', emptyDomainDtoSchema),
    buildModifierGrantVariant(
      'ATTACK_DECOYS',
      'ENABLE',
      emptyDomainDtoSchema,
      attackDecoysPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'DAMAGE_INTERCEPTION',
      'ENABLE',
      emptyDomainDtoSchema,
      damageInterceptionPayloadDtoSchema
    ),
    buildModifierGrantVariant('DAMAGE_MIRROR', 'ENABLE', emptyDomainDtoSchema),
    buildModifierGrantVariant(
      'DELEGATED_ATTACK',
      'ENABLE',
      emptyDomainDtoSchema,
      delegatedAttackPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'END_EVENT_EXEMPTION',
      'ENABLE',
      emptyDomainDtoSchema,
      endEventExemptionPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'INCOMING_DAMAGE',
      'ENABLE',
      emptyDomainDtoSchema,
      incomingDamagePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'INCOMING_ATTACK_GATE',
      'ENABLE',
      emptyDomainDtoSchema,
      incomingAttackGatePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'SKILL_MODIFIER',
      'BONUS',
      skillParamDtoSchema,
      modifierScalarValueDtoSchema
    ),
    buildModifierGrantVariant(
      'SKILL_MODIFIER',
      'ROLL_INFLUENCE',
      skillParamDtoSchema,
      rollInfluencePayloadDtoSchema
    ),
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
      'ADD_BONUS_DIE',
      optionalAttackDomainParamDtoSchema,
      damageDiePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'DAMAGE',
      'REPLACE_DAMAGE_TYPE',
      attackDomainParamDtoSchema,
      damageTypePayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'DAMAGE',
      'SAVE_SUCCESS_DAMAGE',
      attackDomainParamDtoSchema,
      saveSuccessDamagePayloadDtoSchema
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
    buildModifierGrantVariant(
      'SPEED',
      'SET_VALUE',
      speedParamDtoSchema,
      z.union([authoredLengthSchema, speedEqualsPayloadSchema])
    ),
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
      rangeReplacementPayloadDtoSchema
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
      'SPELL_SCHOOL_IMMUNITY',
      'ADD_OPTION',
      emptyDomainDtoSchema,
      magicSchoolPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'SPELL_SCHOOL_IMMUNITY',
      'REMOVE_OPTION',
      emptyDomainDtoSchema,
      magicSchoolPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'CHECKS_AGAINST_HOLDER',
      'ADD_OPTION',
      emptyDomainDtoSchema,
      skillPayloadDtoSchema
    ),
    buildModifierGrantVariant(
      'CHECKS_AGAINST_HOLDER',
      'REMOVE_OPTION',
      emptyDomainDtoSchema,
      skillPayloadDtoSchema
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
 * holder's Action maximum for the turn, which the action economy reads. `BONUS_ACTION_COUNT SET_VALUE`
 * stays authorable too: SRD Haste's lethargy zeroes the Bonus Action the same way.
 */
const UNSUPPORTED_MODIFIERS = new Set([
  'SAVE_DC SET_VALUE',
  'PROFICIENCY_BONUS BONUS',
  'PROFICIENCY_BONUS SET_VALUE',
  'CHARGE_LIMIT MODIFY_CHARGE_LIMIT',
  'CHARGE_LIMIT SET_VALUE',
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
    (value.valueDomainCode === 'CONDITION' && value.modifierKind === 'REMOVE_OPTION')
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
      value.valueDomainCode === 'RANGE' ||
      ((value.valueDomainCode === 'ATTACK_ROLL' || value.valueDomainCode === 'DAMAGE') &&
        attackDomain === 'SPELL')
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
              'Spell-scoped modifiers are supported only for spell attack rolls, damage and ranges.',
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
