import { z } from 'zod'
import { abilityCodeSchema, sizeCodeSchema } from '../shared/enums.js'
import { diceExpressionDtoSchema } from '../shared/dice.js'

const identifierSchema = z.string().trim().min(1)
const uuidSchema = z.string().uuid()

export const characterSheetSourceNoteDtoSchema = z
  .string()
  .trim()
  .max(240)
  .refine((value) => !/[\r\n]/u.test(value), 'Source notes must use one line.')

export const characterSheetSourceLabelDtoSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((value) => !/[\r\n]/u.test(value), 'Source labels must use one line.')

export const characterSheetAdjustmentSourceCategoryDtoSchema = z.enum([
  'MAGIC',
  'MANUAL',
  'MISCELLANEOUS',
  'OTHER'
])

export const characterProficiencyLevelDtoSchema = z.enum(['NONE', 'HALF', 'FULL', 'DOUBLE'])

export const characterMechanicSourceRefDtoSchema = z.union([
  z.object({
    kind: z.literal('AUTHORED'),
    sourceKind: z.enum([
      'ANCESTRY',
      'BACKGROUND',
      'CLASS',
      'FEAT',
      'FEATURE',
      'OPTION',
      'RACE',
      'SPELL',
      'SUBRACE',
      'SUBCLASS'
    ]),
    definitionId: uuidSchema,
    sourceInstanceId: identifierSchema
  }),
  z.object({
    kind: z.literal('EQUIPMENT_INSTANCE'),
    equipmentId: uuidSchema,
    itemInstanceId: uuidSchema
  }),
  z.object({
    kind: z.literal('COMPANION_INSTANCE'),
    creatureId: uuidSchema,
    companionInstanceId: uuidSchema
  }),
  z.object({
    kind: z.literal('SYSTEM'),
    systemId: uuidSchema
  }),
  z.object({
    kind: z.literal('MANUAL_ADJUSTMENT'),
    adjustmentId: uuidSchema
  })
])

export const characterSpellSourceRefDtoSchema = z.object({
  spellId: uuidSchema,
  sourceKind: z.enum([
    'BACKGROUND',
    'CLASS',
    'FEAT',
    'FEATURE',
    'ITEM',
    'OPTION',
    'RACE',
    'SUBCLASS'
  ]),
  sourceInstanceId: identifierSchema
})

const abilityOtherModifierAdjustmentDtoSchema = z.object({
  family: z.literal('ABILITY'),
  ability: abilityCodeSchema,
  field: z.literal('OTHER_MODIFIER'),
  value: z.number().int()
})

const abilityScoreOverrideAdjustmentDtoSchema = z.object({
  family: z.literal('ABILITY'),
  ability: abilityCodeSchema,
  field: z.literal('SCORE_OVERRIDE'),
  value: z.number().int().nonnegative()
})

const savingThrowNumericAdjustmentDtoSchema = z.object({
  family: z.literal('SAVING_THROW'),
  ability: abilityCodeSchema,
  field: z.enum(['MAGIC_BONUS', 'MISC_BONUS', 'TOTAL_OVERRIDE']),
  value: z.number().int()
})

const savingThrowProficiencyAdjustmentDtoSchema = z.object({
  family: z.literal('SAVING_THROW'),
  ability: abilityCodeSchema,
  field: z.literal('PROFICIENCY_OVERRIDE'),
  value: characterProficiencyLevelDtoSchema
})

const skillNumericAdjustmentDtoSchema = z.object({
  family: z.literal('SKILL'),
  skillId: uuidSchema,
  field: z.enum(['MAGIC_BONUS', 'MISC_BONUS', 'TOTAL_OVERRIDE']),
  value: z.number().int()
})

const skillProficiencyAdjustmentDtoSchema = z.object({
  family: z.literal('SKILL'),
  skillId: uuidSchema,
  field: z.literal('PROFICIENCY_OVERRIDE'),
  value: characterProficiencyLevelDtoSchema
})

const skillAbilityAdjustmentDtoSchema = z.object({
  family: z.literal('SKILL'),
  skillId: uuidSchema,
  field: z.literal('GOVERNING_ABILITY_OVERRIDE'),
  value: abilityCodeSchema
})

const passiveAdjustmentDtoSchema = z.object({
  family: z.literal('PASSIVE'),
  skillId: uuidSchema,
  field: z.literal('TOTAL_OVERRIDE'),
  value: z.number().int()
})

const senseAdjustmentDtoSchema = z.object({
  family: z.literal('SENSE'),
  senseId: uuidSchema,
  field: z.literal('RANGE_OVERRIDE'),
  value: z.number().int().nonnegative()
})

const movementAdjustmentDtoSchema = z.object({
  family: z.literal('MOVEMENT'),
  speedId: uuidSchema,
  field: z.literal('SPEED_OVERRIDE'),
  value: z.number().int().nonnegative()
})

const hitPointAdjustmentDtoSchema = z.union([
  z.object({
    family: z.literal('HIT_POINTS'),
    field: z.literal('MAXIMUM_MODIFIER'),
    value: z.number().int()
  }),
  z.object({
    family: z.literal('HIT_POINTS'),
    field: z.literal('MAXIMUM_OVERRIDE'),
    value: z.number().int().nonnegative()
  })
])

const spellAdjustmentDtoSchema = z.object({
  family: z.literal('SPELL'),
  source: characterSpellSourceRefDtoSchema,
  field: z.enum(['ATTACK_BONUS', 'ATTACK_OVERRIDE', 'DAMAGE_BONUS', 'DC_BONUS', 'DC_OVERRIDE']),
  value: z.number().int()
})

const itemNumericAdjustmentDtoSchema = z.object({
  family: z.literal('ITEM'),
  itemInstanceId: uuidSchema,
  field: z.enum(['ATTACK_BONUS', 'ATTACK_OVERRIDE', 'DAMAGE_BONUS']),
  value: z.number()
})

const itemWeightAdjustmentDtoSchema = z.object({
  family: z.literal('ITEM'),
  itemInstanceId: uuidSchema,
  field: z.literal('WEIGHT_OVERRIDE'),
  value: z.number().nonnegative()
})

const itemPropertyAdjustmentDtoSchema = z.object({
  family: z.literal('ITEM'),
  itemInstanceId: uuidSchema,
  field: z.enum(['ADAMANTINE', 'DUAL_WIELD', 'SILVERED']),
  value: z.literal(true)
})

const companionNumericAdjustmentDtoSchema = z.object({
  family: z.literal('COMPANION'),
  companionInstanceId: uuidSchema,
  field: z.enum(['ARMOR_CLASS_OVERRIDE', 'MAXIMUM_HIT_POINTS_OVERRIDE']),
  value: z.number().int().nonnegative()
})

const companionReferenceAdjustmentDtoSchema = z.object({
  family: z.literal('COMPANION'),
  companionInstanceId: uuidSchema,
  field: z.enum(['ALIGNMENT_OVERRIDE', 'CREATURE_TYPE_OVERRIDE']),
  value: uuidSchema
})

const companionSizeAdjustmentDtoSchema = z.object({
  family: z.literal('COMPANION'),
  companionInstanceId: uuidSchema,
  field: z.literal('SIZE_OVERRIDE'),
  value: sizeCodeSchema
})

const defenseAdditionDtoSchema = z.object({
  family: z.literal('DEFENSE'),
  defenseKind: z.enum(['IMMUNITY', 'RESISTANCE', 'VULNERABILITY']),
  damageTypeId: uuidSchema,
  field: z.literal('ADDITION'),
  value: z.literal(true)
})

const proficiencyAdditionDtoSchema = z.object({
  family: z.literal('PROFICIENCY'),
  proficiencyKind: z.enum(['ARMOR', 'LANGUAGE', 'TOOL', 'WEAPON']),
  targetId: uuidSchema,
  field: z.literal('ADDITION'),
  value: z.literal(true)
})

export const characterSheetCoreAdjustmentValueDtoSchema = z.union([
  abilityOtherModifierAdjustmentDtoSchema,
  abilityScoreOverrideAdjustmentDtoSchema,
  savingThrowNumericAdjustmentDtoSchema,
  savingThrowProficiencyAdjustmentDtoSchema,
  skillNumericAdjustmentDtoSchema,
  skillProficiencyAdjustmentDtoSchema,
  skillAbilityAdjustmentDtoSchema,
  passiveAdjustmentDtoSchema,
  senseAdjustmentDtoSchema,
  movementAdjustmentDtoSchema,
  defenseAdditionDtoSchema,
  proficiencyAdditionDtoSchema
])

export const characterSheetAdjustmentValueDtoSchema = z.union([
  abilityOtherModifierAdjustmentDtoSchema,
  abilityScoreOverrideAdjustmentDtoSchema,
  savingThrowNumericAdjustmentDtoSchema,
  savingThrowProficiencyAdjustmentDtoSchema,
  skillNumericAdjustmentDtoSchema,
  skillProficiencyAdjustmentDtoSchema,
  skillAbilityAdjustmentDtoSchema,
  passiveAdjustmentDtoSchema,
  senseAdjustmentDtoSchema,
  movementAdjustmentDtoSchema,
  hitPointAdjustmentDtoSchema,
  spellAdjustmentDtoSchema,
  itemNumericAdjustmentDtoSchema,
  itemWeightAdjustmentDtoSchema,
  itemPropertyAdjustmentDtoSchema,
  companionNumericAdjustmentDtoSchema,
  companionReferenceAdjustmentDtoSchema,
  companionSizeAdjustmentDtoSchema,
  defenseAdditionDtoSchema,
  proficiencyAdditionDtoSchema
])

export const characterSheetCoreAdjustmentCommandDtoSchema = z
  .object({
    id: uuidSchema.optional(),
    sourceCategory: characterSheetAdjustmentSourceCategoryDtoSchema.default('MANUAL'),
    sourceLabel: characterSheetSourceLabelDtoSchema.optional(),
    sourceNote: characterSheetSourceNoteDtoSchema.optional()
  })
  .and(characterSheetCoreAdjustmentValueDtoSchema)

export const characterSheetAdjustmentMetadataDtoSchema = z.object({
  id: uuidSchema,
  characterId: uuidSchema,
  sourceCategory: characterSheetAdjustmentSourceCategoryDtoSchema,
  sourceLabel: characterSheetSourceLabelDtoSchema.optional(),
  sourceNote: characterSheetSourceNoteDtoSchema.optional(),
  createdBy: uuidSchema,
  updatedBy: uuidSchema,
  createdAt: z.string(),
  updatedAt: z.string()
})

export const characterSheetAdjustmentDtoSchema = characterSheetAdjustmentMetadataDtoSchema.and(
  characterSheetAdjustmentValueDtoSchema
)

export const characterSheetAdjustmentWriteDtoSchema = z
  .object({
    id: uuidSchema,
    characterId: uuidSchema,
    sourceCategory: characterSheetAdjustmentSourceCategoryDtoSchema.optional(),
    sourceLabel: characterSheetSourceLabelDtoSchema.optional(),
    sourceNote: characterSheetSourceNoteDtoSchema.optional(),
    actorId: uuidSchema
  })
  .and(characterSheetAdjustmentValueDtoSchema)

export const characterMovementDisplayPreferenceDtoSchema = z.union([
  z.object({ mode: z.literal('AUTO') }),
  z.object({
    mode: z.literal('EXPLICIT'),
    speedId: uuidSchema
  })
])

export const characterSheetAdjustmentStateDtoSchema = z.enum(['DEFAULT', 'ADJUSTED', 'OVERRIDDEN'])

export const characterCalculationContributionDtoSchema = z.object({
  id: identifierSchema,
  source: characterMechanicSourceRefDtoSchema,
  value: z.number(),
  state: z.enum(['APPLIED', 'SUPPRESSED'])
})

export const characterNumericCalculationDtoSchema = z.object({
  base: z.number(),
  contributions: z.array(characterCalculationContributionDtoSchema),
  override: z
    .object({
      adjustmentId: uuidSchema,
      value: z.number()
    })
    .optional(),
  effective: z.number()
})

export const characterDiceRollSpecDtoSchema = diceExpressionDtoSchema

export const characterDiceRollResultDtoSchema = z.object({
  spec: characterDiceRollSpecDtoSchema,
  rolls: z.array(z.number().int().positive()),
  total: z.number().int()
})

export const characterResourceRecoveryAmountDtoSchema = z.union([
  z.object({ kind: z.literal('ALL') }),
  z.object({
    kind: z.literal('FIXED'),
    amount: z.number().int().positive()
  }),
  z.object({
    kind: z.literal('DICE'),
    dice: characterDiceRollSpecDtoSchema
  })
])

export const characterResourceRecoveryDtoSchema = z.object({
  trigger: z.enum(['SHORT_REST', 'LONG_REST', 'DAWN', 'DUSK', 'DAILY', 'MANUAL']),
  amount: characterResourceRecoveryAmountDtoSchema
})

export const characterResourceOwnerRefDtoSchema = z.union([
  z.object({
    kind: z.literal('AUTHORED_GRANT'),
    resourceGrantId: identifierSchema,
    source: characterMechanicSourceRefDtoSchema
  }),
  z.object({
    kind: z.literal('SPELL_SOURCE'),
    resourceGrantId: identifierSchema,
    source: characterSpellSourceRefDtoSchema
  }),
  z.object({
    kind: z.literal('ITEM_INSTANCE'),
    chargeId: identifierSchema,
    itemInstanceId: uuidSchema
  }),
  z.object({
    kind: z.literal('SENSE_GRANT'),
    senseGrantId: identifierSchema,
    source: characterMechanicSourceRefDtoSchema
  }),
  z.object({
    kind: z.literal('COMPANION_FEATURE'),
    chargeId: identifierSchema,
    companionInstanceId: uuidSchema,
    featureId: uuidSchema
  })
])

export type CharacterSheetAdjustmentDto = z.infer<typeof characterSheetAdjustmentDtoSchema>
export type CharacterSheetCoreAdjustmentCommandDto = z.infer<
  typeof characterSheetCoreAdjustmentCommandDtoSchema
>
export type CharacterSheetAdjustmentWriteDto = z.infer<
  typeof characterSheetAdjustmentWriteDtoSchema
>
export type CharacterNumericCalculationDto = z.infer<typeof characterNumericCalculationDtoSchema>
export type CharacterResourceOwnerRefDto = z.infer<typeof characterResourceOwnerRefDtoSchema>
export type CharacterMovementDisplayPreferenceDto = z.infer<
  typeof characterMovementDisplayPreferenceDtoSchema
>
export type CharacterDiceRollResultDto = z.infer<typeof characterDiceRollResultDtoSchema>
