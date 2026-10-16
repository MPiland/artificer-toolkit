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

const abilityCheckParamDtoSchema = lazySchema(() =>
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
  z.object({
    ability: abilityCodeSchema,
    multiplier: z.optional(z.number()),
    min: z.optional(z.number()),
    max: z.optional(z.number())
  })
)

const optionalAbilityModifierBonusPayloadDtoSchema = lazySchema(() =>
  z.object({
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
const buildModifierGrantVariants = () => {
  const optionPayloadByDomainDtoSchema = {
    DAMAGE_RESISTANCE: z.union([
      z.strictObject({ damageTypeId: authoredIdentifierSchema }),
      z.strictObject({ damageTypeSource: z.literal('TRIGGER') })
    ]),
    DAMAGE_IMMUNITY: z.object({ damageTypeId: authoredIdentifierSchema }),
    DAMAGE_VULNERABILITY: z.object({ damageTypeId: authoredIdentifierSchema }),
    CONDITION: z.object({ conditionTypeId: authoredIdentifierSchema }),
    CONDITION_IMMUNITY: z.object({ conditionTypeId: authoredIdentifierSchema }),
    ATTRIBUTE: z.object({ attributeId: authoredIdentifierSchema }),
    MOVEMENT_MODE: z.object({ movementModeId: authoredIdentifierSchema })
  } as const
  return [
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
      z.object({ amount: z.number() })
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
    // An armor class formula: the amount plus each listed ability modifier ("10 + DEX + CON").
    buildModifierGrantVariant(
      'ARMOR_CLASS',
      'SET_VALUE',
      emptyDomainDtoSchema,
      z.object({
        amount: z.number(),
        abilities: authoredReferenceCollectionSchema(abilityCodeSchema)
      })
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
    buildModifierGrantVariant('ABILITY_CHECK', 'ADVANTAGE', abilityCheckParamDtoSchema),
    buildModifierGrantVariant('ABILITY_CHECK', 'DISADVANTAGE', abilityCheckParamDtoSchema),
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
    buildModifierGrantVariant(
      'SAVE_DC',
      'SET_VALUE',
      emptyDomainDtoSchema,
      z.object({ amount: z.number() })
    ),
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
    buildModifierGrantVariant('ATTACKS_AGAINST', 'ADVANTAGE', attacksAgainstParamDtoSchema),
    buildModifierGrantVariant('ATTACKS_AGAINST', 'DISADVANTAGE', attacksAgainstParamDtoSchema),
    buildModifierGrantVariant('OPPORTUNITY_ATTACK_IMMUNITY', 'ENABLE', emptyDomainDtoSchema),
    buildModifierGrantVariant('SPELLCASTING_LOCK', 'ENABLE', emptyDomainDtoSchema),
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
      z.object({ amount: z.number() })
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
      z.object({ amount: z.number() })
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
      attackDomainParamDtoSchema,
      z.object({ dice: authoredIdentifierSchema })
    ),
    buildModifierGrantVariant(
      'DAMAGE',
      'REPLACE_DAMAGE_TYPE',
      attackDomainParamDtoSchema,
      z.object({ damageTypeId: authoredIdentifierSchema })
    ),
    buildModifierGrantVariant(
      'DAMAGE_RESISTANCE',
      'ADD_OPTION',
      emptyDomainDtoSchema,
      optionPayloadByDomainDtoSchema.DAMAGE_RESISTANCE
    ),
    buildModifierGrantVariant(
      'DAMAGE_RESISTANCE',
      'REMOVE_OPTION',
      emptyDomainDtoSchema,
      optionPayloadByDomainDtoSchema.DAMAGE_RESISTANCE
    ),
    buildModifierGrantVariant(
      'DAMAGE_IMMUNITY',
      'ADD_OPTION',
      emptyDomainDtoSchema,
      optionPayloadByDomainDtoSchema.DAMAGE_IMMUNITY
    ),
    buildModifierGrantVariant(
      'DAMAGE_IMMUNITY',
      'REMOVE_OPTION',
      emptyDomainDtoSchema,
      optionPayloadByDomainDtoSchema.DAMAGE_IMMUNITY
    ),
    buildModifierGrantVariant(
      'DAMAGE_VULNERABILITY',
      'ADD_OPTION',
      emptyDomainDtoSchema,
      optionPayloadByDomainDtoSchema.DAMAGE_VULNERABILITY
    ),
    buildModifierGrantVariant(
      'DAMAGE_VULNERABILITY',
      'REMOVE_OPTION',
      emptyDomainDtoSchema,
      optionPayloadByDomainDtoSchema.DAMAGE_VULNERABILITY
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
      optionPayloadByDomainDtoSchema.MOVEMENT_MODE
    ),
    buildModifierGrantVariant(
      'MOVEMENT_MODE',
      'REMOVE_OPTION',
      emptyDomainDtoSchema,
      optionPayloadByDomainDtoSchema.MOVEMENT_MODE
    ),
    buildModifierGrantVariant('SENSE_RANGE', 'BONUS', senseParamDtoSchema, authoredLengthSchema),
    buildModifierGrantVariant(
      'SENSE_RANGE',
      'SET_VALUE',
      senseParamDtoSchema,
      authoredLengthSchema
    ),
    buildModifierGrantVariant(
      'RANGE',
      'REPLACE_RANGE_KIND',
      emptyDomainDtoSchema,
      z.object({
        rangeKind: rangeKindSchema
      })
    ),
    buildModifierGrantVariant(
      'DURATION',
      'SET_VALUE',
      emptyDomainDtoSchema,
      z.union([
        z.object({
          durationKind: z.literal(durationKindSchema._zod.def.entries.INSTANTANEOUS)
        }),
        z.object({
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
    ),
    buildModifierGrantVariant(
      'DURATION',
      'REPLACE_DURATION_KIND',
      emptyDomainDtoSchema,
      z.object({
        durationKind: durationKindSchema
      })
    ),
    buildModifierGrantVariant(
      'SHAPE',
      'REPLACE_SHAPE_KIND',
      emptyDomainDtoSchema,
      z.object({
        shapeKind: shapeKindSchema
      })
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
      z.object({ amount: z.number() })
    ),
    buildModifierGrantVariant(
      'SPELL_SLOT_LEVEL_MAX',
      'SET_VALUE',
      emptyDomainDtoSchema,
      z.object({ amount: z.number() })
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
      z.object({ amount: z.number() })
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
      z.object({ amount: z.number() })
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
      z.object({ amount: z.number() })
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
      z.object({ amount: z.number() })
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
      z.object({ amount: z.number() })
    ),
    buildModifierGrantVariant(
      'ATTACKS_PER_ATTACK_ACTION',
      'SET_VALUE',
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
      z.object({ amount: z.number() })
    ),
    buildModifierGrantVariant(
      'CHARGE_RESET',
      'REPLACE_CHARGE_RESET_KIND',
      emptyDomainDtoSchema,
      z.object({
        resetKind: chargeResetKindSchema
      })
    ),
    buildModifierGrantVariant(
      'CONDITION',
      'ADD_OPTION',
      emptyDomainDtoSchema,
      optionPayloadByDomainDtoSchema.CONDITION
    ),
    buildModifierGrantVariant(
      'CONDITION',
      'REMOVE_OPTION',
      emptyDomainDtoSchema,
      optionPayloadByDomainDtoSchema.CONDITION
    ),
    buildModifierGrantVariant(
      'CONDITION_IMMUNITY',
      'ADD_OPTION',
      emptyDomainDtoSchema,
      optionPayloadByDomainDtoSchema.CONDITION_IMMUNITY
    ),
    buildModifierGrantVariant(
      'CONDITION_IMMUNITY',
      'REMOVE_OPTION',
      emptyDomainDtoSchema,
      optionPayloadByDomainDtoSchema.CONDITION_IMMUNITY
    ),
    buildModifierGrantVariant(
      'ATTRIBUTE',
      'ADD_OPTION',
      emptyDomainDtoSchema,
      optionPayloadByDomainDtoSchema.ATTRIBUTE
    ),
    buildModifierGrantVariant(
      'ATTRIBUTE',
      'REMOVE_OPTION',
      emptyDomainDtoSchema,
      optionPayloadByDomainDtoSchema.ATTRIBUTE
    )
  ] as const
}
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
    z.discriminatedUnion('modifierKind', variants)
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
    value.modifierKind === 'ADD_BONUS_DIE' ||
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
