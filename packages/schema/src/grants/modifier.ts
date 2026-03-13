import { z } from 'zod'

import { staticGrantBaseDtoSchema } from './grant.js'
import {
  chargeLimitKindSchema,
  chargeResetKindSchema,
  durationKindSchema,
  attackDomainCodeSchema,
  abilityCodeSchema,
  authoringSelectionKindSchema,
  modifierKindSchema,
  modifierScopeKindSchema,
  modifierValueKindSchema,
  proficiencyKindSchema,
  rangeKindSchema,
  scalingKindSchema,
  shapeKindSchema
} from '../shared/enums.js'

const emptyDomainDtoSchema = z.object({}).strict()

const attackDomainParamDtoSchema = z.object({
  attackDomain: attackDomainCodeSchema
})

const abilityParamDtoSchema = z.object({
  ability: abilityCodeSchema
})

const skillParamDtoSchema = z.object({
  skillId: z.string()
})

const speedParamDtoSchema = z.object({
  speedId: z.string()
})

const senseParamDtoSchema = z.object({
  senseCode: z.string()
})

const spellLevelParamDtoSchema = z.object({
  spellLevel: z.number().int()
})

const modifierScalarValueDtoSchema = z.discriminatedUnion('valueKind', [
  z.object({
    valueKind: z.literal(modifierValueKindSchema.enum.FIXED),
    amount: z.number()
  }),
  z.object({
    valueKind: z.literal(modifierValueKindSchema.enum.PROFICIENCY_BONUS),
    multiplier: z.number().optional()
  }),
  z.object({
    valueKind: z.literal(modifierValueKindSchema.enum.ABILITY_MODIFIER),
    ability: abilityCodeSchema,
    multiplier: z.number().optional()
  }),
  z.object({
    valueKind: z.literal(modifierValueKindSchema.enum.SKILL_BONUS),
    skillId: z.string(),
    multiplier: z.number().optional()
  }),
  z.object({
    valueKind: z.literal(modifierValueKindSchema.enum.CHARACTER_LEVEL),
    multiplier: z.number().optional()
  }),
  z.object({
    valueKind: z.literal(modifierValueKindSchema.enum.CLASS_LEVEL),
    classId: z.string(),
    multiplier: z.number().optional()
  }),
  z.object({
    valueKind: z.literal(modifierValueKindSchema.enum.SPELL_SLOT_LEVEL),
    multiplier: z.number().optional()
  })
])

const chargeLimitLevelDtoSchema = z.object({
  id: z.string(),
  level: z.number().int(),
  amount: z.number()
})

const modifyChargeLimitPayloadDtoSchema = z.union([
  z.object({
    limitKind: z.enum([
      chargeLimitKindSchema.enum.CHARACTER_LEVEL,
      chargeLimitKindSchema.enum.SOURCE_LEVEL
    ]),
    scalingKind: z.literal(scalingKindSchema.enum.NONE),
    multiplier: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional()
  }),
  z.object({
    limitKind: z.literal(chargeLimitKindSchema.enum.FIXED_AMOUNT),
    scalingKind: z.literal(scalingKindSchema.enum.NONE),
    amount: z.number()
  }),
  z.object({
    limitKind: z.literal(chargeLimitKindSchema.enum.FIXED_AMOUNT),
    scalingKind: z.literal(scalingKindSchema.enum.PER_LEVEL),
    levels: z.array(chargeLimitLevelDtoSchema)
  })
])

const optionPayloadByDomainDtoSchema = {
  DAMAGE_RESISTANCE: z.object({ damageTypeId: z.string() }),
  DAMAGE_IMMUNITY: z.object({ damageTypeId: z.string() }),
  DAMAGE_VULNERABILITY: z.object({ damageTypeId: z.string() }),
  CONDITION: z.object({ conditionTypeId: z.string() }),
  ATTRIBUTE: z.object({ attributeId: z.string() }),
  MOVEMENT_MODE: z.object({ movementModeId: z.string() })
} as const

const modifierGrantBaseDtoSchema = staticGrantBaseDtoSchema.extend({
  grantKind: z.literal('MODIFIER_GRANT'),
  scope: modifierScopeKindSchema,
  selectionKind: authoringSelectionKindSchema,
  count: z.number().int().optional()
}).superRefine((value, ctx) => {
  if (value.selectionKind === 'CHOSEN' && value.count === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'count is required when selectionKind is CHOSEN'
    })
  }
})

const buildModifierGrantVariant = <
  V extends string,
  K extends z.infer<typeof modifierKindSchema>
>(
  valueDomainCode: V,
  modifierKind: K,
  domain: z.ZodTypeAny,
  payload?: z.ZodTypeAny
) =>
  modifierGrantBaseDtoSchema.extend({
    valueDomainCode: z.literal(valueDomainCode),
    modifierKind: z.literal(modifierKind),
    domain,
    ...(payload ? { payload } : { payload: z.undefined().optional() })
  })

const modifierGrantVariants = [
  buildModifierGrantVariant('HIT_POINTS_MAX', 'BONUS', emptyDomainDtoSchema.optional(), modifierScalarValueDtoSchema),
  buildModifierGrantVariant('HIT_POINTS_MAX', 'PENALTY', emptyDomainDtoSchema.optional(), modifierScalarValueDtoSchema),
  buildModifierGrantVariant('HIT_POINTS_MAX', 'SET_VALUE', emptyDomainDtoSchema.optional(), z.object({ amount: z.number() })),
  buildModifierGrantVariant('ARMOR_CLASS', 'BONUS', emptyDomainDtoSchema.optional(), modifierScalarValueDtoSchema),
  buildModifierGrantVariant('ARMOR_CLASS', 'PENALTY', emptyDomainDtoSchema.optional(), modifierScalarValueDtoSchema),
  buildModifierGrantVariant('ARMOR_CLASS', 'SET_VALUE', emptyDomainDtoSchema.optional(), z.object({ amount: z.number() })),
  buildModifierGrantVariant('INITIATIVE_BONUS', 'BONUS', emptyDomainDtoSchema.optional(), modifierScalarValueDtoSchema),
  buildModifierGrantVariant('INITIATIVE_BONUS', 'PENALTY', emptyDomainDtoSchema.optional(), modifierScalarValueDtoSchema),
  buildModifierGrantVariant('SAVE_DC', 'BONUS', emptyDomainDtoSchema.optional(), modifierScalarValueDtoSchema),
  buildModifierGrantVariant('SAVE_DC', 'PENALTY', emptyDomainDtoSchema.optional(), modifierScalarValueDtoSchema),
  buildModifierGrantVariant('SAVE_DC', 'SET_VALUE', emptyDomainDtoSchema.optional(), z.object({ amount: z.number() })),
  buildModifierGrantVariant('SAVING_THROW_BONUS', 'BONUS', abilityParamDtoSchema, modifierScalarValueDtoSchema),
  buildModifierGrantVariant('SAVING_THROW_BONUS', 'PENALTY', abilityParamDtoSchema, modifierScalarValueDtoSchema),
  buildModifierGrantVariant('ATTACK_ROLL_BONUS', 'BONUS', attackDomainParamDtoSchema, modifierScalarValueDtoSchema),
  buildModifierGrantVariant('ATTACK_ROLL_BONUS', 'PENALTY', attackDomainParamDtoSchema, modifierScalarValueDtoSchema),
  buildModifierGrantVariant('ATTACK_ROLL_BONUS', 'OPTIONAL_ABILITY_MODIFIER', attackDomainParamDtoSchema, z.object({
    abilities: z.array(abilityCodeSchema)
  })),
  buildModifierGrantVariant('SKILL_BONUS', 'BONUS', skillParamDtoSchema, modifierScalarValueDtoSchema),
  buildModifierGrantVariant('SKILL_BONUS', 'PENALTY', skillParamDtoSchema, modifierScalarValueDtoSchema),
  buildModifierGrantVariant('ABILITY_SCORE', 'BONUS', abilityParamDtoSchema, modifierScalarValueDtoSchema),
  buildModifierGrantVariant('ABILITY_SCORE', 'PENALTY', abilityParamDtoSchema, modifierScalarValueDtoSchema),
  buildModifierGrantVariant('ABILITY_SCORE', 'SET_VALUE', abilityParamDtoSchema, z.object({ amount: z.number() })),
  buildModifierGrantVariant('PROFICIENCY_BONUS', 'BONUS', emptyDomainDtoSchema.optional(), modifierScalarValueDtoSchema),
  buildModifierGrantVariant('PROFICIENCY_BONUS', 'SET_VALUE', emptyDomainDtoSchema.optional(), z.object({ amount: z.number() })),
  buildModifierGrantVariant('DAMAGE', 'BONUS', attackDomainParamDtoSchema, modifierScalarValueDtoSchema),
  buildModifierGrantVariant('DAMAGE', 'ADD_BONUS_DIE', attackDomainParamDtoSchema, z.object({ dice: z.string() })),
  buildModifierGrantVariant('DAMAGE', 'REPLACE_DAMAGE_TYPE', attackDomainParamDtoSchema, z.object({ damageTypeId: z.string() })),
  buildModifierGrantVariant('DAMAGE_RESISTANCE', 'ADD_OPTION', emptyDomainDtoSchema.optional(), optionPayloadByDomainDtoSchema.DAMAGE_RESISTANCE),
  buildModifierGrantVariant('DAMAGE_RESISTANCE', 'REMOVE_OPTION', emptyDomainDtoSchema.optional(), optionPayloadByDomainDtoSchema.DAMAGE_RESISTANCE),
  buildModifierGrantVariant('DAMAGE_IMMUNITY', 'ADD_OPTION', emptyDomainDtoSchema.optional(), optionPayloadByDomainDtoSchema.DAMAGE_IMMUNITY),
  buildModifierGrantVariant('DAMAGE_IMMUNITY', 'REMOVE_OPTION', emptyDomainDtoSchema.optional(), optionPayloadByDomainDtoSchema.DAMAGE_IMMUNITY),
  buildModifierGrantVariant('DAMAGE_VULNERABILITY', 'ADD_OPTION', emptyDomainDtoSchema.optional(), optionPayloadByDomainDtoSchema.DAMAGE_VULNERABILITY),
  buildModifierGrantVariant('DAMAGE_VULNERABILITY', 'REMOVE_OPTION', emptyDomainDtoSchema.optional(), optionPayloadByDomainDtoSchema.DAMAGE_VULNERABILITY),
  buildModifierGrantVariant('SPEED', 'BONUS', speedParamDtoSchema, modifierScalarValueDtoSchema),
  buildModifierGrantVariant('SPEED', 'PENALTY', speedParamDtoSchema, modifierScalarValueDtoSchema),
  buildModifierGrantVariant('SPEED', 'SET_VALUE', speedParamDtoSchema, z.object({ amount: z.number() })),
  buildModifierGrantVariant('MOVEMENT_MODE', 'ADD_OPTION', emptyDomainDtoSchema.optional(), optionPayloadByDomainDtoSchema.MOVEMENT_MODE),
  buildModifierGrantVariant('MOVEMENT_MODE', 'REMOVE_OPTION', emptyDomainDtoSchema.optional(), optionPayloadByDomainDtoSchema.MOVEMENT_MODE),
  buildModifierGrantVariant('SENSE_RANGE', 'BONUS', senseParamDtoSchema, modifierScalarValueDtoSchema),
  buildModifierGrantVariant('SENSE_RANGE', 'SET_VALUE', senseParamDtoSchema, z.object({ amount: z.number() })),
  buildModifierGrantVariant('RANGE', 'SET_VALUE', emptyDomainDtoSchema.optional(), z.object({
    amount: z.number(),
    unit: z.string(),
    rangeKind: z.literal(rangeKindSchema.enum.DISTANCE)
  }).or(z.object({
    rangeKind: z.enum([
      rangeKindSchema.enum.SELF,
      rangeKindSchema.enum.TOUCH,
      rangeKindSchema.enum.SIGHT,
      rangeKindSchema.enum.UNLIMITED
    ])
  }))),
  buildModifierGrantVariant('RANGE', 'REPLACE_RANGE_KIND', emptyDomainDtoSchema.optional(), z.object({
    rangeKind: rangeKindSchema
  })),
  buildModifierGrantVariant('DURATION', 'SET_VALUE', emptyDomainDtoSchema.optional(), z.object({
    durationKind: z.literal(durationKindSchema.enum.INSTANTANEOUS)
  }).or(z.object({
    durationKind: durationKindSchema.exclude([durationKindSchema.enum.INSTANTANEOUS]),
    amount: z.number()
  }))),
  buildModifierGrantVariant('DURATION', 'REPLACE_DURATION_KIND', emptyDomainDtoSchema.optional(), z.object({
    durationKind: durationKindSchema
  })),
  buildModifierGrantVariant('SHAPE', 'REPLACE_SHAPE_KIND', emptyDomainDtoSchema.optional(), z.object({
    shapeKind: shapeKindSchema
  })),
  buildModifierGrantVariant('SPELL_SLOT_COUNT', 'BONUS', spellLevelParamDtoSchema, modifierScalarValueDtoSchema),
  buildModifierGrantVariant('SPELL_SLOT_COUNT', 'SET_VALUE', spellLevelParamDtoSchema, z.object({ amount: z.number() })),
  buildModifierGrantVariant('SPELL_SLOT_LEVEL_MAX', 'SET_VALUE', emptyDomainDtoSchema.optional(), z.object({ amount: z.number() })),
  buildModifierGrantVariant('SPELLS_KNOWN', 'BONUS', emptyDomainDtoSchema.optional(), modifierScalarValueDtoSchema),
  buildModifierGrantVariant('SPELLS_KNOWN', 'SET_VALUE', emptyDomainDtoSchema.optional(), z.object({ amount: z.number() })),
  buildModifierGrantVariant('SPELLS_PREPARED', 'BONUS', emptyDomainDtoSchema.optional(), modifierScalarValueDtoSchema),
  buildModifierGrantVariant('SPELLS_PREPARED', 'SET_VALUE', emptyDomainDtoSchema.optional(), z.object({ amount: z.number() })),
  buildModifierGrantVariant('ACTION_COUNT', 'BONUS', emptyDomainDtoSchema.optional(), modifierScalarValueDtoSchema),
  buildModifierGrantVariant('ACTION_COUNT', 'SET_VALUE', emptyDomainDtoSchema.optional(), z.object({ amount: z.number() })),
  buildModifierGrantVariant('BONUS_ACTION_COUNT', 'BONUS', emptyDomainDtoSchema.optional(), modifierScalarValueDtoSchema),
  buildModifierGrantVariant('BONUS_ACTION_COUNT', 'SET_VALUE', emptyDomainDtoSchema.optional(), z.object({ amount: z.number() })),
  buildModifierGrantVariant('REACTION_COUNT', 'BONUS', emptyDomainDtoSchema.optional(), modifierScalarValueDtoSchema),
  buildModifierGrantVariant('REACTION_COUNT', 'SET_VALUE', emptyDomainDtoSchema.optional(), z.object({ amount: z.number() })),
  buildModifierGrantVariant('CHARGE_LIMIT', 'MODIFY_CHARGE_LIMIT', emptyDomainDtoSchema.optional(), modifyChargeLimitPayloadDtoSchema),
  buildModifierGrantVariant('CHARGE_LIMIT', 'SET_VALUE', emptyDomainDtoSchema.optional(), z.object({ amount: z.number() })),
  buildModifierGrantVariant('CHARGE_RESET', 'REPLACE_CHARGE_RESET_KIND', emptyDomainDtoSchema.optional(), z.object({
    resetKind: chargeResetKindSchema
  })),
  buildModifierGrantVariant('CONDITION', 'ADD_OPTION', emptyDomainDtoSchema.optional(), optionPayloadByDomainDtoSchema.CONDITION),
  buildModifierGrantVariant('CONDITION', 'REMOVE_OPTION', emptyDomainDtoSchema.optional(), optionPayloadByDomainDtoSchema.CONDITION),
  buildModifierGrantVariant('ATTRIBUTE', 'ADD_OPTION', emptyDomainDtoSchema.optional(), optionPayloadByDomainDtoSchema.ATTRIBUTE),
  buildModifierGrantVariant('ATTRIBUTE', 'REMOVE_OPTION', emptyDomainDtoSchema.optional(), optionPayloadByDomainDtoSchema.ATTRIBUTE)
] as const

/**
 * Modifier grants are one of the highest-risk authored payloads because the
 * valid domain and payload shape both depend on `valueDomainCode` and
 * `modifierKind`. We keep the schema explicit here so later API and seed data
 * validation catches drift early instead of accepting opaque objects.
 */
export const modifierGrantDtoSchema = z.union(modifierGrantVariants)

export type ModifierGrantDto = z.infer<typeof modifierGrantDtoSchema>
