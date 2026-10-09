import { z, lazySchema } from '../zod.js'
import { validateCharacterHitDiceRollEvidence } from '@artificer-toolkit/shared/character/sheetRest'
import { abilityCodeSchema, sizeCodeSchema } from '../shared/enums.js'
import { diceExpressionDtoSchema } from '../shared/dice.js'

const identifierSchema = lazySchema(() => z.string().check(z.trim()).check(z.minLength(1)))
// PostgreSQL accepts UUID-shaped deterministic SRD IDs whose version bits are zero.
const uuidSchema = lazySchema(() => z.guid())
const adjustmentUuidSchema = lazySchema(() =>
  z.pipe(
    uuidSchema,
    z.transform((value) => value.toLowerCase())
  )
)

export const characterSheetReadInputSchema = lazySchema(() =>
  z.strictObject({
    id: z.string().check(z.minLength(1)).check(z.maxLength(240))
  })
)
export type CharacterSheetReadInput = z.infer<typeof characterSheetReadInputSchema>

export const characterSheetSourceNoteDtoSchema = lazySchema(() =>
  z
    .string()
    .check(z.trim())
    .check(z.maxLength(240))
    .check(z.refine((value) => !/[\r\n]/u.test(value), 'Source notes must use one line.'))
)

export const characterProficiencyLevelDtoSchema = lazySchema(() =>
  z.enum(['NONE', 'HALF', 'FULL', 'DOUBLE'])
)

export const characterMechanicSourceRefDtoSchema = lazySchema(() =>
  z.union([
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
      adjustmentId: adjustmentUuidSchema
    }),
    z.object({
      kind: z.literal('ACTIVE_EFFECT'),
      activeEffectId: uuidSchema
    })
  ])
)

export const characterSpellSourceRefDtoSchema = lazySchema(() =>
  z.object({
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
)

const abilityOtherModifierAdjustmentDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('ABILITY'),
    ability: abilityCodeSchema,
    field: z.literal('OTHER_MODIFIER'),
    value: z.number().check(z.int())
  })
)

const abilityScoreOverrideAdjustmentDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('ABILITY'),
    ability: abilityCodeSchema,
    field: z.literal('SCORE_OVERRIDE'),
    value: z.number().check(z.int()).check(z.nonnegative())
  })
)

const savingThrowNumericAdjustmentDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('SAVING_THROW'),
    ability: abilityCodeSchema,
    field: z.enum(['MAGIC_BONUS', 'MISC_BONUS', 'TOTAL_OVERRIDE']),
    value: z.number().check(z.int())
  })
)

const savingThrowProficiencyAdjustmentDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('SAVING_THROW'),
    ability: abilityCodeSchema,
    field: z.literal('PROFICIENCY_OVERRIDE'),
    value: characterProficiencyLevelDtoSchema
  })
)

const skillNumericAdjustmentDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('SKILL'),
    skillId: uuidSchema,
    field: z.enum(['MAGIC_BONUS', 'MISC_BONUS', 'TOTAL_OVERRIDE']),
    value: z.number().check(z.int())
  })
)

const skillProficiencyAdjustmentDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('SKILL'),
    skillId: uuidSchema,
    field: z.literal('PROFICIENCY_OVERRIDE'),
    value: characterProficiencyLevelDtoSchema
  })
)

const skillAbilityAdjustmentDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('SKILL'),
    skillId: uuidSchema,
    field: z.literal('GOVERNING_ABILITY_OVERRIDE'),
    value: abilityCodeSchema
  })
)

const passiveAdjustmentDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('PASSIVE'),
    skillId: uuidSchema,
    field: z.literal('TOTAL_OVERRIDE'),
    value: z.number().check(z.int())
  })
)

const senseAdjustmentDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('SENSE'),
    senseId: uuidSchema,
    field: z.literal('RANGE_OVERRIDE'),
    value: z.number().check(z.int()).check(z.nonnegative())
  })
)

const movementAdjustmentDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('MOVEMENT'),
    speedId: uuidSchema,
    field: z.literal('SPEED_OVERRIDE'),
    value: z.number().check(z.int()).check(z.nonnegative())
  })
)

const hitPointAdjustmentDtoSchema = lazySchema(() =>
  z.union([
    z.object({
      family: z.literal('HIT_POINTS'),
      field: z.literal('MAXIMUM_MODIFIER'),
      value: z.number().check(z.int())
    }),
    z.object({
      family: z.literal('HIT_POINTS'),
      field: z.literal('MAXIMUM_OVERRIDE'),
      value: z.number().check(z.int()).check(z.nonnegative())
    })
  ])
)

const spellAdjustmentDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('SPELL'),
    source: characterSpellSourceRefDtoSchema,
    field: z.enum(['ATTACK_BONUS', 'ATTACK_OVERRIDE', 'DAMAGE_BONUS', 'DC_BONUS', 'DC_OVERRIDE']),
    value: z.number().check(z.int())
  })
)

const itemNumericAdjustmentDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('ITEM'),
    itemInstanceId: uuidSchema,
    field: z.enum(['ATTACK_BONUS', 'ATTACK_OVERRIDE', 'COST_OVERRIDE', 'DAMAGE_BONUS']),
    value: z.number()
  })
)

const itemWeightAdjustmentDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('ITEM'),
    itemInstanceId: uuidSchema,
    field: z.literal('WEIGHT_OVERRIDE'),
    value: z.number().check(z.nonnegative())
  })
)

const itemPropertyAdjustmentDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('ITEM'),
    itemInstanceId: uuidSchema,
    field: z.enum(['ADAMANTINE', 'DISPLAY_AS_ATTACK', 'DUAL_WIELD', 'SILVERED']),
    value: z.literal(true)
  })
)

const companionNumericAdjustmentDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('COMPANION'),
    companionInstanceId: uuidSchema,
    field: z.enum(['ARMOR_CLASS_OVERRIDE', 'MAXIMUM_HIT_POINTS_OVERRIDE']),
    value: z.number().check(z.int()).check(z.nonnegative())
  })
)

const companionReferenceAdjustmentDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('COMPANION'),
    companionInstanceId: uuidSchema,
    field: z.enum(['ALIGNMENT_OVERRIDE', 'CREATURE_TYPE_OVERRIDE']),
    value: uuidSchema
  })
)

const companionSizeAdjustmentDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('COMPANION'),
    companionInstanceId: uuidSchema,
    field: z.literal('SIZE_OVERRIDE'),
    value: sizeCodeSchema
  })
)

const defenseAdditionDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('DEFENSE'),
    defenseKind: z.enum(['IMMUNITY', 'RESISTANCE', 'VULNERABILITY']),
    damageTypeId: uuidSchema,
    field: z.literal('ADDITION'),
    value: z.literal(true)
  })
)

const proficiencyAdditionDtoSchema = lazySchema(() =>
  z.object({
    family: z.literal('PROFICIENCY'),
    proficiencyKind: z.enum(['ARMOR', 'LANGUAGE', 'TOOL', 'WEAPON']),
    targetId: uuidSchema,
    field: z.literal('ADDITION'),
    value: z.literal(true)
  })
)

export const characterSheetCoreAdjustmentValueDtoSchema = lazySchema(() =>
  z.union([
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
    defenseAdditionDtoSchema,
    proficiencyAdditionDtoSchema
  ])
)

export const characterSheetContentAdjustmentValueDtoSchema = lazySchema(() =>
  z.union([
    spellAdjustmentDtoSchema,
    itemNumericAdjustmentDtoSchema,
    itemWeightAdjustmentDtoSchema,
    itemPropertyAdjustmentDtoSchema
  ])
)

export const characterSheetAdjustmentValueDtoSchema = lazySchema(() =>
  z.union([
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
)

export const characterSheetCoreAdjustmentCommandDtoSchema = lazySchema(() =>
  z.intersection(
    z.object({
      id: z.optional(adjustmentUuidSchema),
      sourceNote: z.optional(characterSheetSourceNoteDtoSchema)
    }),
    characterSheetCoreAdjustmentValueDtoSchema
  )
)

export const characterSheetItemAdjustmentCommandDtoSchema = lazySchema(() =>
  z.intersection(
    z.object({
      id: z.optional(adjustmentUuidSchema),
      sourceNote: z.optional(characterSheetSourceNoteDtoSchema)
    }),
    z.union([
      itemNumericAdjustmentDtoSchema,
      itemWeightAdjustmentDtoSchema,
      itemPropertyAdjustmentDtoSchema
    ])
  )
)

export const characterSheetCompanionAdjustmentCommandDtoSchema = lazySchema(() =>
  z.intersection(
    z.object({
      id: z.optional(adjustmentUuidSchema),
      sourceNote: z.optional(characterSheetSourceNoteDtoSchema)
    }),
    z.union([
      companionNumericAdjustmentDtoSchema,
      companionReferenceAdjustmentDtoSchema,
      companionSizeAdjustmentDtoSchema
    ])
  )
)

export const characterSheetAdjustmentCommandDtoSchema = lazySchema(() =>
  z.intersection(
    z.object({
      id: z.optional(adjustmentUuidSchema),
      sourceNote: z.optional(characterSheetSourceNoteDtoSchema)
    }),
    characterSheetAdjustmentValueDtoSchema
  )
)

export const characterSheetAdjustmentMetadataDtoSchema = lazySchema(() =>
  z.object({
    id: adjustmentUuidSchema,
    characterId: uuidSchema,
    sourceNote: z.optional(characterSheetSourceNoteDtoSchema),
    createdBy: uuidSchema,
    updatedBy: uuidSchema,
    createdAt: z.string(),
    updatedAt: z.string()
  })
)

export const characterSheetAdjustmentDtoSchema = lazySchema(() =>
  z.intersection(characterSheetAdjustmentMetadataDtoSchema, characterSheetAdjustmentValueDtoSchema)
)

export const characterSheetAdjustmentWriteDtoSchema = lazySchema(() =>
  z.intersection(
    z.object({
      id: adjustmentUuidSchema,
      characterId: uuidSchema,
      sourceNote: z.optional(characterSheetSourceNoteDtoSchema),
      actorId: uuidSchema
    }),
    characterSheetAdjustmentValueDtoSchema
  )
)

export const characterMovementDisplayPreferenceDtoSchema = lazySchema(() =>
  z.union([
    z.object({ mode: z.literal('AUTO') }),
    z.object({
      mode: z.literal('EXPLICIT'),
      speedId: uuidSchema
    })
  ])
)

export const characterSheetAdjustmentStateDtoSchema = lazySchema(() =>
  z.enum(['DEFAULT', 'ADJUSTED', 'OVERRIDDEN'])
)

export const characterCalculationContributionDtoSchema = lazySchema(() =>
  z.object({
    id: identifierSchema,
    source: characterMechanicSourceRefDtoSchema,
    value: z.number(),
    state: z.enum(['APPLIED', 'SUPPRESSED'])
  })
)

export const characterNumericCalculationDtoSchema = lazySchema(() =>
  z.object({
    base: z.number(),
    contributions: z.array(characterCalculationContributionDtoSchema),
    override: z.optional(
      z.object({
        adjustmentId: uuidSchema,
        value: z.number()
      })
    ),
    effective: z.number()
  })
)

export const characterDiceRollSpecDtoSchema = diceExpressionDtoSchema

export const characterDiceRollResultDtoSchema = lazySchema(() =>
  z.object({
    spec: characterDiceRollSpecDtoSchema,
    rolls: z.array(z.number().check(z.int()).check(z.positive())),
    total: z.number().check(z.int())
  })
)

export const characterRestKindDtoSchema = lazySchema(() => z.enum(['SHORT', 'LONG']))
export const characterRestHealingModeDtoSchema = lazySchema(() => z.enum(['AUTOMATIC', 'MANUAL']))

export const characterRestHitDieSelectionDtoSchema = lazySchema(() =>
  z.strictObject({
    die: z.number().check(z.int()).check(z.gte(2)),
    count: z.number().check(z.int()).check(z.positive())
  })
)

export const characterRestHitDieSelectionsDtoSchema = lazySchema(() =>
  z.array(characterRestHitDieSelectionDtoSchema).check(
    z.superRefine((selections, context) => {
      const seenDice = new Set<number>()
      selections.forEach((selection, index) => {
        if (seenDice.has(selection.die)) {
          context.addIssue({
            code: 'custom',
            path: [index, 'die'],
            message: `Hit die d${selection.die} may appear only once.`
          })
        }
        seenDice.add(selection.die)
      })
    })
  )
)

export const characterRestHitDiceRollTermDtoSchema = lazySchema(() =>
  z.strictObject({
    die: z.number().check(z.int()).check(z.gte(2)),
    count: z.number().check(z.int()).check(z.positive()),
    modifierPerDie: z.number().check(z.int()),
    rolls: z.array(z.number().check(z.int()).check(z.positive()))
  })
)

export const characterRestHitDiceRollEvidenceDtoSchema = lazySchema(() =>
  z
    .strictObject({
      expression: z.string().check(z.trim()).check(z.minLength(1)),
      terms: z.array(characterRestHitDiceRollTermDtoSchema).check(z.minLength(1)),
      total: z.number().check(z.int())
    })
    .check(
      z.superRefine((evidence, context) => {
        try {
          validateCharacterHitDiceRollEvidence(evidence)
        } catch (error) {
          context.addIssue({
            code: 'custom',
            message: error instanceof Error ? error.message : 'Invalid hit-die roll evidence.'
          })
        }
      })
    )
)

export const characterCompletedRestResultDtoSchema = lazySchema(() =>
  z.strictObject({
    restKind: characterRestKindDtoSchema,
    previewFingerprint: z.string().check(z.trim()).check(z.minLength(1)),
    hitPoints: z.strictObject({
      currentBefore: z.number().check(z.int()).check(z.nonnegative()),
      currentAfter: z.number().check(z.int()).check(z.nonnegative()),
      temporaryBefore: z.number().check(z.int()).check(z.nonnegative()),
      temporaryAfter: z.number().check(z.int()).check(z.nonnegative()),
      healingApplied: z.number().check(z.int()).check(z.nonnegative())
    }),
    exhaustion: z.strictObject({
      before: z.number().check(z.int()).check(z.nonnegative()),
      after: z.number().check(z.int()).check(z.nonnegative())
    }),
    spentHitDice: characterRestHitDieSelectionsDtoSchema,
    recoveredHitDice: characterRestHitDieSelectionsDtoSchema,
    rollEvidence: z.optional(characterRestHitDiceRollEvidenceDtoSchema),
    resetMaximumHitPointModifier: z.boolean(),
    recoveredResourceIds: z.array(identifierSchema),
    recoveredSpellSlotKeys: z.array(identifierSchema),
    companionRecoveries: z.array(
      z.strictObject({
        companionInstanceId: uuidSchema,
        recoveredHitDice: characterRestHitDieSelectionsDtoSchema,
        recoveredResourceIds: z.array(identifierSchema)
      })
    )
  })
)

export const characterSheetCommandResultDtoSchema = lazySchema(() =>
  z.discriminatedUnion('type', [
    z.strictObject({
      type: z.literal('COMPLETE_REST'),
      rest: characterCompletedRestResultDtoSchema
    })
  ])
)

export const characterResourceRecoveryAmountDtoSchema = lazySchema(() =>
  z.union([
    z.object({ kind: z.literal('ALL') }),
    z.object({
      kind: z.literal('FIXED'),
      amount: z.number().check(z.int()).check(z.positive())
    }),
    z.object({
      kind: z.literal('DICE'),
      dice: characterDiceRollSpecDtoSchema
    })
  ])
)

export const characterResourceRecoveryDtoSchema = lazySchema(() =>
  z.object({
    trigger: z.enum(['SHORT_REST', 'LONG_REST', 'DAWN', 'DUSK', 'DAILY', 'MANUAL']),
    amount: characterResourceRecoveryAmountDtoSchema
  })
)

export const characterResourceOwnerRefDtoSchema = lazySchema(() =>
  z.union([
    z.object({
      kind: z.literal('AUTHORED_GRANT'),
      resourceGrantId: identifierSchema,
      source: characterMechanicSourceRefDtoSchema
    }),
    z.object({
      kind: z.literal('AUTHORED_SOURCE'),
      chargeId: identifierSchema,
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
)

export type CharacterSheetAdjustmentDto = z.infer<typeof characterSheetAdjustmentDtoSchema>
export type CharacterSheetCoreAdjustmentCommandDto = z.infer<
  typeof characterSheetCoreAdjustmentCommandDtoSchema
>
export type CharacterSheetItemAdjustmentCommandDto = z.infer<
  typeof characterSheetItemAdjustmentCommandDtoSchema
>
export type CharacterSheetCompanionAdjustmentCommandDto = z.infer<
  typeof characterSheetCompanionAdjustmentCommandDtoSchema
>
export type CharacterSheetAdjustmentCommandDto = z.infer<
  typeof characterSheetAdjustmentCommandDtoSchema
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
export type CharacterRestKindDto = z.infer<typeof characterRestKindDtoSchema>
export type CharacterRestHealingModeDto = z.infer<typeof characterRestHealingModeDtoSchema>
export type CharacterRestHitDieSelectionDto = z.infer<typeof characterRestHitDieSelectionDtoSchema>
export type CharacterRestHitDiceRollEvidenceDto = z.infer<
  typeof characterRestHitDiceRollEvidenceDtoSchema
>
export type CharacterCompletedRestResultDto = z.infer<typeof characterCompletedRestResultDtoSchema>
export type CharacterSheetCommandResultDto = z.infer<typeof characterSheetCommandResultDtoSchema>
