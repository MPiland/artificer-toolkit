import { z } from 'zod'
import { CHARACTER_ABILITY_GENERATION_METHOD } from '@artificer-toolkit/shared/core'

import {
  abilityCodeSchema,
  activationCodeSchema,
  authoringSelectionDuplicatePolicySchema,
  authoredRecordStatusSchema,
  equipmentPropertyCodeSchema,
  sizeCodeSchema,
  spellAttributeSchema,
  spellComponentSchema
} from '../shared/enums.js'
import { startingEquipmentDtoSchema } from '../shared/startingEquipment.js'
import {
  characterAcquisitionTimingDtoSchema,
  characterAbilityScoresIntentDtoSchema,
  characterAuthoredDtoSchema,
  characterProvenanceDtoSchema
} from '../subjects/index.js'
import {
  capacityDtoSchema,
  castingTimeDtoSchema,
  classHitpointDtoSchema,
  classMulticlassRequirementGroupsDtoSchema,
  classStartingGoldDtoSchema,
  costDtoSchema,
  rangeDtoSchema,
  weightDtoSchema
} from '../subjects/shared.js'
import { listResponseDtoSchema } from './common.js'
import {
  characterResourceOwnerRefDtoSchema,
  characterResourceRecoveryDtoSchema,
  characterRestHealingModeDtoSchema,
  characterRestHitDiceRollEvidenceDtoSchema,
  characterRestHitDieSelectionsDtoSchema,
  characterRestKindDtoSchema,
  characterSheetCommandResultDtoSchema,
  characterSheetCoreAdjustmentCommandDtoSchema,
  characterSheetCompanionAdjustmentCommandDtoSchema,
  characterSheetItemAdjustmentCommandDtoSchema,
  characterMovementDisplayPreferenceDtoSchema,
  characterSheetSourceNoteDtoSchema,
  characterSpellSourceRefDtoSchema
} from './characterSheet.js'
import {
  characterSheetPanelDtoSchema,
  characterSheetPanelTargetDtoSchema
} from './characterSheetPanel.js'

export const characterBuilderModeDtoSchema = z.enum(['create', 'edit'])

export const characterBuilderAbilitiesFormDtoSchema = characterAbilityScoresIntentDtoSchema

const characterBuilderAbilityMethodDtoSchema = z.enum([
  CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY,
  CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY,
  CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
])

const characterBuilderAbilityDraftDtoSchema = z.discriminatedUnion('method', [
  z.strictObject({
    method: z.literal(CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY),
    slots: z
      .array(
        z.strictObject({
          ability: abilityCodeSchema.optional(),
          option: z.enum(['8', '10', '12', '13', '14', '15']).optional()
        })
      )
      .length(6)
  }),
  z.strictObject({
    method: z.literal(CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY),
    slots: z
      .array(
        z.strictObject({
          ability: abilityCodeSchema.optional(),
          option: z.enum(['8', '9', '10', '11', '12', '13', '14', '15']).optional()
        })
      )
      .length(6)
  }),
  z.strictObject({
    method: z.literal(CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED),
    slots: z
      .array(
        z.strictObject({
          ability: abilityCodeSchema.optional(),
          score: z.number().int().optional()
        })
      )
      .length(6)
  })
])

export const characterBuilderAbilitiesIntentCacheDtoSchema = z.strictObject({
  activeMethod: characterBuilderAbilityMethodDtoSchema,
  drafts: z
    .partialRecord(characterBuilderAbilityMethodDtoSchema, characterBuilderAbilityDraftDtoSchema)
    .optional()
    .superRefine((drafts, context) => {
      for (const [method, draft] of Object.entries(drafts ?? {})) {
        if (draft !== undefined && draft.method !== method) {
          context.addIssue({
            code: 'custom',
            path: [method, 'method'],
            message: `Cached ability draft ${method} contains ${draft.method} slots.`
          })
        }
      }
    }),
  methods: z
    .partialRecord(characterBuilderAbilityMethodDtoSchema, characterBuilderAbilitiesFormDtoSchema)
    .superRefine((methods, context) => {
      for (const [method, values] of Object.entries(methods)) {
        if (values !== undefined && values.method !== method) {
          context.addIssue({
            code: 'custom',
            path: [method, 'method'],
            message: `Cached ability method ${method} contains ${values.method} values.`
          })
        }
      }
    })
})

export const characterBuilderIntentCacheDtoSchema = z.strictObject({
  abilities: characterBuilderAbilitiesIntentCacheDtoSchema.optional()
})

export const characterBuilderFormDtoSchema = characterAuthoredDtoSchema.extend({
  builderIntent: characterBuilderIntentCacheDtoSchema.optional()
})

export const characterBuilderDraftStateDtoSchema = z.enum(['DRAFT_ONLY', 'ACTIVE_WITH_DRAFT'])

export const characterBuilderDraftSummaryDtoSchema = z.object({
  characterId: z.string(),
  publicId: z.string(),
  userId: z.string(),
  systemId: z.string(),
  label: z.string(),
  status: z.literal('DRAFT'),
  draftState: characterBuilderDraftStateDtoSchema,
  baseActiveUpdatedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

export const characterListItemDtoSchema = z.object({
  id: z.string(),
  publicId: z.string(),
  label: z.string(),
  status: authoredRecordStatusSchema,
  systemId: z.string(),
  streamVersion: z.number().int(),
  draft: characterBuilderDraftSummaryDtoSchema.nullable().optional()
})

export const characterListResponseDtoSchema = listResponseDtoSchema(characterListItemDtoSchema)

export const characterBuilderClassSummaryDtoSchema = z.object({
  classId: z.string(),
  classLabel: z.string(),
  classLevel: z.number().int(),
  subclassId: z.string().optional(),
  subclassLabel: z.string().optional(),
  specializationId: z.string().optional(),
  specializationLabel: z.string().optional(),
  featureLabels: z.array(z.string()),
  resourceLabels: z.array(z.string()),
  spellcastingLabels: z.array(z.string())
})

export const characterBuilderSummaryDtoSchema = z.object({
  totalLevel: z.number().int(),
  abilities: z.record(z.string(), z.number().int()),
  selectedRace: z
    .object({
      raceId: z.string(),
      raceLabel: z.string(),
      subraceId: z.string().optional(),
      subraceLabel: z.string().optional(),
      ancestryId: z.string().optional(),
      ancestryLabel: z.string().optional(),
      ancestryOptionId: z.string().optional(),
      ancestryOptionLabel: z.string().optional()
    })
    .optional(),
  selectedBackground: z
    .object({
      backgroundId: z.string(),
      label: z.string()
    })
    .optional(),
  classes: z.array(characterBuilderClassSummaryDtoSchema)
})

export const characterBuilderGrantSummaryItemDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  availableAtLevel: z.number().int().positive().optional(),
  details: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        description: z.string()
      })
    )
    .optional(),
  attributes: z.array(z.string()).optional(),
  sourceLabel: z.string(),
  source: characterProvenanceDtoSchema
})

export const characterSheetReferenceFeatureDtoSchema =
  characterBuilderGrantSummaryItemDtoSchema.extend({
    source: z.union([
      characterProvenanceDtoSchema,
      z.object({
        kind: z.literal('EQUIPMENT_INSTANCE'),
        equipmentId: z.string(),
        itemInstanceId: z.string()
      })
    ]),
    resourceCost: z.number().int().positive().optional(),
    resourceGrantId: z.string().min(1).optional()
  })

export const characterBuilderGrantedContentDtoSchema = z.object({
  features: z.array(characterBuilderGrantSummaryItemDtoSchema),
  resources: z.array(characterBuilderGrantSummaryItemDtoSchema),
  spellcasting: z.array(characterBuilderGrantSummaryItemDtoSchema)
})

export const characterBuilderIssueDtoSchema = z.object({
  code: z.string(),
  message: z.string(),
  sourceLabel: z.string(),
  source: characterProvenanceDtoSchema.optional(),
  required: z.boolean()
})

export const characterBuilderValidationDtoSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(['blocking', 'warning']),
  sourceLabel: z.string().optional(),
  source: characterProvenanceDtoSchema.optional()
})

export const characterBuilderReadinessDtoSchema = z.object({
  ready: z.boolean(),
  blockingIssues: z.array(z.string()),
  outstandingRequiredChoices: z.array(z.string())
})

export const characterBuilderSectionIdDtoSchema = z.enum([
  'BASICS',
  'RACE',
  'CLASSES',
  'BACKGROUND',
  'DETAILS',
  'NOTES',
  'ABILITIES',
  'EQUIPMENT',
  'REVIEW'
])

export const characterBuilderResolutionDtoSchema = z.object({
  mode: characterBuilderModeDtoSchema,
  summary: characterBuilderSummaryDtoSchema,
  grants: characterBuilderGrantedContentDtoSchema,
  outstandingChoices: z.array(characterBuilderIssueDtoSchema),
  validations: z.array(characterBuilderValidationDtoSchema),
  readiness: characterBuilderReadinessDtoSchema,
  recommendedSectionId: characterBuilderSectionIdDtoSchema
})

export const characterBuilderReferenceOptionDtoSchema = z.object({
  id: z.string(),
  label: z.string()
})

export const characterBuilderRaceReferenceDtoSchema =
  characterBuilderReferenceOptionDtoSchema.extend({
    category: z.string().optional(),
    description: z.string().optional(),
    parentRaceId: z.string().optional(),
    selectionMode: z.enum(['DIRECT', 'REQUIRES_SUBRACE']).optional(),
    sizeLabel: z.string().optional(),
    speedLabels: z.array(z.string()).optional(),
    abilityScoreIncreaseFacts: z
      .array(z.object({ label: z.string(), value: z.string() }))
      .optional(),
    ancestry: z
      .object({
        id: z.string(),
        label: z.string(),
        options: z.array(
          characterBuilderReferenceOptionDtoSchema.extend({
            description: z.string().optional(),
            features: z.array(characterBuilderGrantSummaryItemDtoSchema)
          })
        )
      })
      .optional()
  })

export const characterBuilderBackgroundReferenceDtoSchema =
  characterBuilderReferenceOptionDtoSchema.extend({
    description: z.string().optional(),
    summary: z.string(),
    grantFacts: z.array(z.object({ label: z.string(), value: z.string() })),
    featureLabels: z.array(z.string()),
    hiddenGrantFactCount: z.number().int().nonnegative(),
    hiddenFeatureCount: z.number().int().nonnegative()
  })

export const characterBuilderClassReferenceDtoSchema =
  characterBuilderReferenceOptionDtoSchema.extend({
    category: z.string().optional(),
    description: z.string().optional(),
    hitpoint: classHitpointDtoSchema.optional(),
    requirementGroups: classMulticlassRequirementGroupsDtoSchema.optional(),
    parentClassId: z.string().optional(),
    savingThrowLabels: z.array(z.string()).optional(),
    proficiencyGroups: z
      .array(
        z.object({
          label: z.string(),
          entries: z.array(z.string())
        })
      )
      .optional(),
    specializations: z.array(characterBuilderReferenceOptionDtoSchema).optional()
  })

export const characterBuilderReferencesDtoSchema = z.object({
  abilities: z.array(characterBuilderReferenceOptionDtoSchema),
  advancementMethods: z.array(characterBuilderReferenceOptionDtoSchema),
  abilityGenerationMethods: z.array(characterBuilderReferenceOptionDtoSchema),
  hitpointCalculationMethods: z.array(characterBuilderReferenceOptionDtoSchema),
  standardArrayScores: z.array(characterBuilderReferenceOptionDtoSchema),
  pointBuyScores: z.array(
    characterBuilderReferenceOptionDtoSchema.extend({
      cost: z.number().int().nonnegative()
    })
  ),
  pointBuyTotalPoints: z.number().int().positive(),
  races: z.array(characterBuilderRaceReferenceDtoSchema),
  classes: z.array(characterBuilderClassReferenceDtoSchema),
  backgrounds: z.array(characterBuilderBackgroundReferenceDtoSchema),
  equipment: z.array(characterBuilderReferenceOptionDtoSchema),
  currencies: z.array(characterBuilderReferenceOptionDtoSchema),
  alignments: z.array(characterBuilderReferenceOptionDtoSchema),
  lifestyles: z.array(characterBuilderReferenceOptionDtoSchema)
})

export const characterBuilderChoiceOptionDtoSchema =
  characterBuilderReferenceOptionDtoSchema.extend({
    category: z.string().optional(),
    disabled: z.boolean().optional(),
    disabledReason: z.string().optional(),
    properties: z.array(z.string()).optional()
  })

export const characterBuilderSpellOptionDtoSchema = characterBuilderChoiceOptionDtoSchema.extend({
  level: z.number().int().nonnegative(),
  schoolLabel: z.string().optional(),
  ritual: z.boolean().optional(),
  concentration: z.boolean().optional()
})

export const characterBuilderFeatureChoiceViewDtoSchema = z.object({
  featureId: z.string(),
  featureLabel: z.string(),
  sourceLabel: z.string(),
  source: characterProvenanceDtoSchema,
  selectionKey: z.string(),
  requiredCount: z.number().int(),
  selectedOptionIds: z.array(z.string()),
  options: z.array(characterBuilderChoiceOptionDtoSchema)
})

export const characterBuilderChosenGrantChoiceViewDtoSchema: z.ZodType<CharacterBuilderChosenGrantChoiceViewDto> =
  z.object({
    id: z.string(),
    grantId: z.string(),
    grantKind: z.enum(['PROFICIENCY_GRANT', 'SPELL_GRANT', 'FEAT_GRANT', 'SENSE_GRANT']),
    label: z.string(),
    ownerFeatureId: z.string().optional(),
    proficiencyKind: z.string().optional(),
    proficiencyLevel: z.enum(['HALF', 'FULL', 'DOUBLE']).optional(),
    displayCategory: z.string().optional(),
    sourceLabel: z.string(),
    source: characterProvenanceDtoSchema,
    timing: characterAcquisitionTimingDtoSchema,
    progressionLevel: z.number().int().positive().optional(),
    requiredCount: z.number().int().positive(),
    duplicatePolicy: authoringSelectionDuplicatePolicySchema,
    selectedTargetIds: z.array(z.string()),
    options: z.array(characterBuilderChoiceOptionDtoSchema)
  })

export const characterBuilderSpellChoiceViewDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  sourceLabel: z.string(),
  source: characterProvenanceDtoSchema,
  cantripLimit: z.number().int(),
  learnedSpellLimit: z.number().int(),
  spellCollectionLabel: z.string(),
  selectedCantripIds: z.array(z.string()),
  selectedSpellIds: z.array(z.string()),
  cantripOptions: z.array(characterBuilderSpellOptionDtoSchema),
  spellOptions: z.array(characterBuilderSpellOptionDtoSchema)
})

export const characterBuilderRaceViewDtoSchema = z.object({
  raceOptions: z.array(characterBuilderChoiceOptionDtoSchema),
  subraceOptions: z.array(characterBuilderChoiceOptionDtoSchema),
  ancestry: z
    .object({
      ancestryId: z.string(),
      label: z.string(),
      selectedOptionId: z.string().optional(),
      options: z.array(characterBuilderChoiceOptionDtoSchema)
    })
    .nullable(),
  grantChoices: z.array(characterBuilderChosenGrantChoiceViewDtoSchema),
  features: z.array(characterBuilderGrantSummaryItemDtoSchema),
  featureChoices: z.array(characterBuilderFeatureChoiceViewDtoSchema)
})

export const characterBuilderClassViewItemDtoSchema = z.object({
  classId: z.string(),
  classLabel: z.string(),
  classLevel: z.number().int(),
  classOptions: z.array(characterBuilderChoiceOptionDtoSchema).optional(),
  subclassOptions: z.array(characterBuilderChoiceOptionDtoSchema),
  specializationOptions: z.array(characterBuilderChoiceOptionDtoSchema),
  subclassSelectionFeatureId: z.string().optional(),
  proficiencyGroups: z.array(
    z.object({
      category: z.string(),
      label: z.string(),
      grantedEntries: z.array(z.string()),
      choiceInstructions: z.array(z.object({ label: z.string(), required: z.boolean() })),
      choiceIds: z.array(z.string())
    })
  ),
  grantChoices: z.array(characterBuilderChosenGrantChoiceViewDtoSchema),
  featureLabels: z.array(z.string()),
  features: z.array(characterBuilderGrantSummaryItemDtoSchema),
  featureChoices: z.array(characterBuilderFeatureChoiceViewDtoSchema),
  spellChoices: z.array(characterBuilderSpellChoiceViewDtoSchema)
})

export const characterBuilderClassViewDtoSchema = z.object({
  classOptions: z.array(characterBuilderChoiceOptionDtoSchema),
  selectedClasses: z.array(characterBuilderClassViewItemDtoSchema)
})

export const characterBuilderBackgroundViewDtoSchema = z.object({
  grantChoices: z.array(characterBuilderChosenGrantChoiceViewDtoSchema),
  backgroundOptions: z.array(characterBuilderChoiceOptionDtoSchema),
  description: z.string().optional(),
  detailSections: z.array(
    z.object({
      label: z.string(),
      details: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          description: z.string()
        })
      )
    })
  ),
  features: z.array(characterBuilderGrantSummaryItemDtoSchema),
  featureChoices: z.array(characterBuilderFeatureChoiceViewDtoSchema)
})

export const characterBuilderStartingEquipmentViewDtoSchema = z.object({
  source: z.enum(['CLASS', 'BACKGROUND']),
  sourceLabel: z.string(),
  startingGold: classStartingGoldDtoSchema.nullable().optional(),
  startingEquipment: startingEquipmentDtoSchema,
  choiceLabels: z.record(z.string(), z.string())
})

export const characterBuilderEquipmentViewDtoSchema = z.object({
  classStartingEquipmentRequired: z.boolean(),
  backgroundStartingEquipmentRequired: z.boolean(),
  classStartingEquipment: characterBuilderStartingEquipmentViewDtoSchema.nullable(),
  backgroundStartingEquipment: characterBuilderStartingEquipmentViewDtoSchema.nullable(),
  equipmentOptions: z.array(characterBuilderChoiceOptionDtoSchema),
  currencyOptions: z.array(characterBuilderChoiceOptionDtoSchema)
})

export const characterBuilderReviewViewDtoSchema = z.object({
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  ready: z.boolean()
})

export const characterBuilderViewDtoSchema: z.ZodType<CharacterBuilderViewDto> = z.object({
  race: characterBuilderRaceViewDtoSchema,
  classes: characterBuilderClassViewDtoSchema,
  background: characterBuilderBackgroundViewDtoSchema,
  equipment: characterBuilderEquipmentViewDtoSchema,
  review: characterBuilderReviewViewDtoSchema
})

export const characterBuilderPayloadDtoSchema: z.ZodType<CharacterBuilderPayloadDto> = z.object({
  publicId: z.string().optional(),
  character: characterAuthoredDtoSchema,
  resolution: characterBuilderResolutionDtoSchema,
  references: characterBuilderReferencesDtoSchema,
  view: characterBuilderViewDtoSchema,
  builderIntent: characterBuilderIntentCacheDtoSchema.optional(),
  baseActiveUpdatedAt: z.string().nullable().optional()
})

export const characterBuilderDraftPayloadDtoSchema = z.strictObject({
  character: characterAuthoredDtoSchema,
  builderIntent: characterBuilderIntentCacheDtoSchema.optional()
})

export const characterBuilderDraftDtoSchema = characterBuilderDraftSummaryDtoSchema.extend({
  id: z.string(),
  payload: characterBuilderDraftPayloadDtoSchema,
  mode: characterBuilderModeDtoSchema
})

export const characterBuilderPreviewEntryDtoSchema = z.object({
  id: z.string(),
  label: z.string()
})

export const characterBuilderChangePreviewDtoSchema = z.object({
  predictedStatus: authoredRecordStatusSchema,
  downgradesStatus: z.boolean(),
  removedAncestrySelections: z.array(characterBuilderPreviewEntryDtoSchema),
  removedFeatureAcquisitions: z.array(characterBuilderPreviewEntryDtoSchema),
  removedSpellSelections: z.array(characterBuilderPreviewEntryDtoSchema),
  removedResourceGrants: z.array(characterBuilderPreviewEntryDtoSchema),
  clearedStartingEquipmentSources: z.array(z.enum(['CLASS', 'BACKGROUND'])),
  summaryLines: z.array(z.string()),
  destructive: z.boolean()
})

export const characterBuilderPreviewPayloadDtoSchema = z.object({
  character: characterAuthoredDtoSchema,
  resolution: characterBuilderResolutionDtoSchema,
  preview: characterBuilderChangePreviewDtoSchema
})

export const characterDraftRequestDtoSchema = z.object({
  id: z.string().min(1),
  systemId: z.string().min(1).optional()
})

export const characterBuilderDraftSaveRequestDtoSchema = z.object({
  character: characterAuthoredDtoSchema,
  builderIntent: characterBuilderIntentCacheDtoSchema.optional(),
  mode: characterBuilderModeDtoSchema,
  baseActiveUpdatedAt: z.string().nullable().optional()
})

export const characterBuilderResolveRequestDtoSchema = z.object({
  character: characterAuthoredDtoSchema,
  mode: characterBuilderModeDtoSchema
})

export const characterBuilderSaveRequestDtoSchema = z.object({
  character: characterAuthoredDtoSchema,
  mode: characterBuilderModeDtoSchema,
  targetStatus: authoredRecordStatusSchema.optional()
})

export const characterBuilderCommitRequestDtoSchema = z.object({
  character: characterAuthoredDtoSchema,
  mode: characterBuilderModeDtoSchema,
  targetStatus: z.literal('ACTIVE').optional(),
  baseActiveUpdatedAt: z.string().nullable().optional()
})

export const characterSheetFactDtoSchema = z.object({
  label: z.string(),
  value: z.string()
})

export const characterSheetProficiencyFactDtoSchema = characterSheetFactDtoSchema.extend({
  kind: z.enum(['ARMOR', 'LANGUAGE', 'TOOL', 'WEAPON'])
})

export const characterSheetOptionDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional()
})

export const characterSheetMetaDtoSchema = z.object({
  characterId: z.string(),
  systemId: z.string(),
  status: authoredRecordStatusSchema,
  streamVersion: z.number().int(),
  hasBuilderDraft: z.boolean().optional()
})

export const characterSheetIdentityDtoSchema = z.object({
  label: z.string(),
  description: z.string().optional(),
  concept: z.string().optional(),
  classSummary: z.string(),
  raceLabel: z.string().optional(),
  backgroundLabel: z.string().optional(),
  totalLevel: z.number().int()
})

export const characterSheetAbilityDtoSchema = z.object({
  ability: abilityCodeSchema,
  score: z.number().int(),
  modifier: z.number().int(),
  rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE'])
})

export const characterSheetHitDiceDtoSchema = z.object({
  die: z.number().int(),
  total: z.number().int(),
  used: z.number().int(),
  remaining: z.number().int()
})

export const characterSheetConditionDtoSchema = z.object({
  conditionTypeId: z.string(),
  label: z.string(),
  description: z.string().optional(),
  notes: z.string().optional()
})

export const characterSheetExhaustionDtoSchema = z
  .strictObject({
    label: z.string().trim().min(1),
    description: z.string().trim().min(1),
    level: z.number().int().nonnegative(),
    minimumLevel: z.number().int().nonnegative(),
    maximumLevel: z.number().int().positive(),
    notes: z.string().optional()
  })
  .superRefine((exhaustion, context) => {
    if (
      exhaustion.minimumLevel > exhaustion.maximumLevel ||
      exhaustion.level < exhaustion.minimumLevel ||
      exhaustion.level > exhaustion.maximumLevel
    ) {
      context.addIssue({
        code: 'custom',
        path: ['level'],
        message: 'Exhaustion level must be within the rules-system range.'
      })
    }
  })

export const characterSheetOverviewDtoSchema = z.object({
  abilities: z.array(characterSheetAbilityDtoSchema),
  facts: z.array(characterSheetFactDtoSchema),
  armorClass: z.number().int(),
  initiative: z.number().int(),
  initiativeRollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
  proficiencyBonus: z.number().int(),
  inspiration: z.boolean().optional(),
  currentHitPoints: z.number().int(),
  maxHitPoints: z.number().int(),
  tempHitPoints: z.number().int(),
  maxHitPointsModifier: z.number().int(),
  maxHitPointsModifierAdjustmentId: z.guid().nullable(),
  maxHitPointsOverride: z.number().int().nullable(),
  savingThrows: z.array(
    z.object({
      ability: abilityCodeSchema,
      label: z.string(),
      total: z.number().int(),
      rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
      proficiency: z.enum(['NONE', 'HALF', 'FULL', 'DOUBLE'])
    })
  ),
  skills: z.array(
    z.object({
      skillId: z.string(),
      code: z.string(),
      label: z.string(),
      ability: abilityCodeSchema,
      total: z.number().int(),
      rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
      proficiency: z.enum(['NONE', 'HALF', 'FULL', 'DOUBLE'])
    })
  ),
  exhaustion: characterSheetExhaustionDtoSchema,
  conditions: z.array(characterSheetConditionDtoSchema),
  hitDice: z.array(characterSheetHitDiceDtoSchema)
})

export const characterSheetOutcomeScalingDtoSchema = z.object({
  level: z.number().int().positive(),
  expression: z.string()
})

export const characterSheetOutcomeDtoSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('DAMAGE'),
    pathCode: z.string(),
    expression: z.string(),
    damageTypeId: z.string(),
    damageTypeLabel: z.string(),
    scaling: z.array(characterSheetOutcomeScalingDtoSchema).optional()
  }),
  z.object({
    kind: z.literal('HEAL'),
    pathCode: z.string(),
    expression: z.string(),
    temporary: z.boolean(),
    scaling: z.array(characterSheetOutcomeScalingDtoSchema).optional()
  }),
  z.object({
    kind: z.literal('CONDITION'),
    pathCode: z.string(),
    conditionId: z.string(),
    label: z.string()
  }),
  z.object({
    kind: z.literal('EFFECT'),
    pathCode: z.string(),
    effectKind: z.string(),
    label: z.string().optional()
  })
])

export const characterSheetMechanicDtoSchema = z.object({
  effectId: z.string(),
  trigger: z.string(),
  activation: z
    .object({
      kind: z.string(),
      amount: z.number().int().positive()
    })
    .optional(),
  rangeLabel: z.string().optional(),
  attackBonus: z.number().int().optional(),
  attackRollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']).optional(),
  save: z
    .object({
      ability: abilityCodeSchema,
      dc: z.number().int().optional()
    })
    .optional(),
  outcomes: z.array(characterSheetOutcomeDtoSchema)
})

export const characterSheetActionDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(['ACTION', 'BONUS_ACTION', 'REACTION', 'OTHER']),
  sourceLabel: z.string().optional(),
  description: z.string().optional(),
  rollable: z.boolean().optional(),
  mechanic: characterSheetMechanicDtoSchema.optional(),
  resourceGrantId: z.string().optional(),
  resourceCost: z.number().int().positive().optional()
})

const characterSheetExtraKindOptionDtoSchema = z.object({
  code: z.enum(['COMPANION', 'MOUNT', 'OWNED', 'VEHICLE']),
  label: z.string().min(1)
})

const characterSheetCreatureOriginOptionDtoSchema = z.object({
  code: z.enum(['WORLD', 'SUMMONED']),
  label: z.string().min(1)
})

const characterSheetExtraActionDtoSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional()
})

const characterSheetExtraFeatureDtoSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional()
})

const characterSheetExtraHitPointsDtoSchema = z.object({
  current: z.number().int().nonnegative(),
  maximum: z.number().int().nonnegative()
})

const characterSheetExtraCreatureHitPointsDtoSchema = characterSheetExtraHitPointsDtoSchema.extend({
  temp: z.number().int().nonnegative()
})

const characterSheetExtraHitDiceDtoSchema = z
  .array(
    z
      .object({
        die: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        used: z.number().int().nonnegative(),
        remaining: z.number().int().nonnegative()
      })
      .refine(({ remaining, total, used }) => used <= total && remaining === total - used, {
        message: 'Hit dice usage and remaining count must be consistent.'
      })
  )
  .superRefine((hitDice, context) => {
    const seen = new Set<number>()

    hitDice.forEach(({ die }, index) => {
      if (seen.has(die)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'die'],
          message: 'Hit dice denominations must be unique.'
        })
      }
      seen.add(die)
    })
  })

const characterSheetExtraHitDiceUpdateDtoSchema = z
  .array(
    z
      .object({
        die: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        used: z.number().int().nonnegative()
      })
      .refine(({ total, used }) => used <= total, {
        message: 'Used hit dice cannot exceed the total.'
      })
  )
  .superRefine((hitDice, context) => {
    const seen = new Set<number>()

    hitDice.forEach(({ die }, index) => {
      if (seen.has(die)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'die'],
          message: 'Hit dice denominations must be unique.'
        })
      }
      seen.add(die)
    })
  })

const characterSheetExtraCommonDtoSchema = z.object({
  id: z.guid(),
  kindLabel: z.string().min(1),
  authoredName: z.string().min(1),
  displayName: z.string().min(1),
  customName: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean(),
  actions: z.array(characterSheetExtraActionDtoSchema),
  features: z.array(characterSheetExtraFeatureDtoSchema),
  equipmentItemIds: z.array(z.guid())
})

const characterSheetCreatureExtraDtoSchema = characterSheetExtraCommonDtoSchema.extend({
  kind: z.enum(['COMPANION', 'MOUNT', 'OWNED']),
  creatureId: z.guid(),
  relationshipKind: z.enum(['COMPANION', 'MOUNT', 'OWNED']),
  relationshipLabel: z.string().min(1),
  size: sizeCodeSchema.optional(),
  alignmentId: z.guid().optional(),
  creatureTypeId: z.guid().optional(),
  originKind: z.enum(['WORLD', 'SUMMONED']),
  originLabel: z.string().min(1),
  armorClass: z.number().int().nonnegative(),
  speedLabel: z.string().min(1).optional(),
  carryingCapacityLabel: z.string().min(1).optional(),
  riderCapacity: z.number().int().nonnegative().optional(),
  hitPoints: characterSheetExtraCreatureHitPointsDtoSchema,
  hitDice: characterSheetExtraHitDiceDtoSchema
})

const characterSheetVehicleExtraDtoSchema = characterSheetExtraCommonDtoSchema.extend({
  kind: z.literal('VEHICLE'),
  vehicleId: z.guid(),
  categoryLabel: z.string().min(1),
  speedLabel: z.string().min(1).optional(),
  crewLabel: z.string().min(1).optional(),
  passengerCapacity: z.number().int().nonnegative().optional(),
  cargoCapacityLabel: z.string().min(1).optional(),
  hitPoints: characterSheetExtraHitPointsDtoSchema
})

const characterSheetCreatureExtraOptionDtoSchema = z.object({
  id: z.guid(),
  label: z.string().min(1),
  description: z.string().optional(),
  creatureTypeLabel: z.string().min(1).optional(),
  sizeLabel: z.string().min(1).optional(),
  armorClass: z.number().int().nonnegative().optional(),
  maximumHitPoints: z.number().int().nonnegative().optional(),
  speedLabel: z.string().min(1).optional()
})

const characterSheetVehicleExtraOptionDtoSchema = z.object({
  id: z.guid(),
  label: z.string().min(1),
  description: z.string().optional(),
  categoryLabel: z.string().min(1).optional(),
  maximumHitPoints: z.number().int().nonnegative().optional(),
  speedLabel: z.string().min(1).optional()
})

export const characterSheetExtrasDtoSchema = z.object({
  kindOptions: z.array(characterSheetExtraKindOptionDtoSchema),
  originOptions: z.array(characterSheetCreatureOriginOptionDtoSchema),
  creatureOptions: z.array(characterSheetCreatureExtraOptionDtoSchema),
  vehicleOptions: z.array(characterSheetVehicleExtraOptionDtoSchema),
  items: z.array(
    z.union([characterSheetCreatureExtraDtoSchema, characterSheetVehicleExtraDtoSchema])
  )
})

export const characterSheetResourceDtoSchema = z.object({
  id: z.string(),
  owner: characterResourceOwnerRefDtoSchema,
  label: z.string(),
  description: z.string().optional(),
  sourceLabel: z.string(),
  sourceFeatureId: z.string().optional(),
  used: z.number().int(),
  max: z.number().int(),
  remaining: z.number().int(),
  recoveries: z.array(characterResourceRecoveryDtoSchema)
})

export const characterSheetSpellSlotDtoSchema = z.object({
  slotKey: z.string(),
  label: z.string(),
  level: z.number().int().nullable(),
  used: z.number().int(),
  max: z.number().int(),
  remaining: z.number().int()
})

export const characterSheetSpellSourceDtoSchema = z.object({
  id: z.string().optional(),
  source: characterSpellSourceRefDtoSchema,
  classId: z.string().optional(),
  label: z.string(),
  provenance: z
    .enum(['CLASS', 'SUBCLASS', 'RACE', 'BACKGROUND', 'FEAT', 'FEATURE', 'OPTION', 'EQUIPMENT'])
    .optional(),
  acquisition: z.enum(['KNOWN', 'PREPARED', 'ALWAYS_PREPARED', 'GRANTED']).optional(),
  castMode: z.enum(['SPELL_SLOT', 'AT_WILL', 'FIXED_LEVEL', 'LIMITED_USE']).optional(),
  fixedLevel: z.number().int().positive().optional(),
  resourceGrantId: z.string().optional(),
  resourceOwner: characterResourceOwnerRefDtoSchema.optional(),
  customName: z.string().optional(),
  notes: z.string().optional(),
  displayAsAttack: z.boolean().optional(),
  canPrepare: z.boolean(),
  prepared: z.boolean().optional()
})

export const characterSheetSpellPreparationSourceDtoSchema = z.object({
  classId: z.string(),
  label: z.string(),
  preparedSpellLimit: z.number().int().min(0).optional(),
  preparedSpellIds: z.array(z.string())
})

export const characterSheetSpellDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  level: z.number().int(),
  school: z.string().optional(),
  castingTime: castingTimeDtoSchema.optional(),
  components: z.array(spellComponentSchema).optional(),
  attributes: z.array(spellAttributeSchema).optional(),
  materialDescription: z.string().optional(),
  prepared: z.boolean().optional(),
  known: z.boolean().optional(),
  sourceLabel: z.string().optional(),
  sources: z.array(characterSheetSpellSourceDtoSchema).optional(),
  mechanics: z.array(characterSheetMechanicDtoSchema).optional()
})

export const characterSheetActiveSpellEntryDtoSchema = z.object({
  rowId: z.string().min(1),
  target: z.object({
    kind: z.literal('SPELL'),
    source: characterSpellSourceRefDtoSchema,
    castLevel: z.number().int().nonnegative()
  }),
  spellId: z.guid(),
  source: characterSpellSourceRefDtoSchema,
  sourceId: z.string().min(1),
  displayName: z.string().min(1),
  sourceLabel: z.string().min(1).optional(),
  sourceQualifier: z.string().min(1).optional(),
  castLevel: z.number().int().nonnegative(),
  activationType: activationCodeSchema.optional(),
  activationLabel: z.string().min(1).optional(),
  rangeLabel: z.string().min(1).optional(),
  hitOrDcLabel: z.string().min(1).optional(),
  primaryEffect: z.string().min(1).optional(),
  mechanics: z.array(characterSheetMechanicDtoSchema).optional(),
  available: z.boolean(),
  unavailableReason: z.string().min(1).optional(),
  cast: z.object({
    spellId: z.guid(),
    sourceId: z.string().min(1),
    slotKey: z.string().min(1).optional()
  })
})

export const characterSheetActiveSpellGroupDtoSchema = z.object({
  level: z.number().int().nonnegative(),
  label: z.string().min(1),
  entries: z.array(characterSheetActiveSpellEntryDtoSchema)
})

export const characterSheetEquipmentPropertyDtoSchema = z.object({
  code: equipmentPropertyCodeSchema,
  label: z.string().min(1)
})

export const characterSheetInventoryItemDtoSchema = z.object({
  id: z.string(),
  equipmentId: z.string(),
  label: z.string(),
  equipmentLabel: z.string().optional(),
  description: z.string().nullable().optional(),
  category: z.string().optional(),
  properties: z.array(characterSheetEquipmentPropertyDtoSchema).optional(),
  rarityId: z.string().optional(),
  cost: costDtoSchema.optional(),
  costLabel: z.string().optional(),
  weight: weightDtoSchema.optional(),
  armorClass: z.number().int().optional(),
  customName: z.string().optional(),
  quantity: z.number().int(),
  equipped: z.boolean(),
  attuned: z.boolean(),
  requiresAttunement: z.boolean(),
  displayAsAttack: z.boolean().optional(),
  containerId: z.string().optional(),
  capacity: capacityDtoSchema.optional(),
  notes: z.string().optional()
})

export const characterSheetCurrencyDtoSchema = z.object({
  currencyId: z.string(),
  label: z.string(),
  amount: z.number(),
  containerId: z.string().optional()
})

export const characterSheetReferenceDtoSchema = z.object({
  features: z.array(characterSheetReferenceFeatureDtoSchema),
  proficiencies: z.array(characterSheetProficiencyFactDtoSchema),
  defenses: z.array(
    characterSheetFactDtoSchema.extend({
      kind: z.enum(['RESISTANCE', 'IMMUNITY', 'VULNERABILITY']),
      damageTypeId: z.string()
    })
  ),
  senses: z.array(
    characterSheetFactDtoSchema.extend({
      senseId: z.string(),
      range: rangeDtoSchema.optional()
    })
  ),
  conditionOptions: z.array(
    characterSheetOptionDtoSchema.extend({
      code: z.string().trim().min(1)
    })
  ),
  equipmentOptions: z.array(
    characterSheetOptionDtoSchema.extend({
      isContainer: z.boolean(),
      maxStack: z.number().int().positive().optional(),
      requiresAttunement: z.boolean()
    })
  ),
  currencyOptions: z.array(characterSheetOptionDtoSchema)
})

export const characterSheetNotesDtoSchema = z.object({
  alignment: z.string().optional(),
  lifestyle: z.string().optional(),
  faith: z.string().optional(),
  gender: z.string().optional(),
  age: z.string().optional(),
  appearance: z.string().optional(),
  personalityTraits: z.string().optional(),
  ideals: z.string().optional(),
  bonds: z.string().optional(),
  flaws: z.string().optional(),
  organizations: z.string().optional(),
  allies: z.string().optional(),
  enemies: z.string().optional(),
  backstory: z.string().optional(),
  notes: z.string().optional(),
  groups: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        sortOrder: z.number().int(),
        kind: z.enum(['SESSION', 'LOOT', 'CHARACTERS', 'PLACES', 'CUSTOM'])
      })
    )
    .optional(),
  items: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        body: z.string().optional(),
        groupId: z.string(),
        pinned: z.boolean(),
        createdAt: z.string(),
        updatedAt: z.string()
      })
    )
    .optional()
})

export const characterSheetResponseDtoSchema = z.object({
  publicId: z.string().optional(),
  meta: characterSheetMetaDtoSchema,
  identity: characterSheetIdentityDtoSchema,
  overview: characterSheetOverviewDtoSchema,
  actions: z.object({
    items: z.array(characterSheetActionDtoSchema)
  }),
  resources: z.object({
    items: z.array(characterSheetResourceDtoSchema),
    hitDice: z.array(characterSheetHitDiceDtoSchema)
  }),
  spells: z.object({
    saveDc: z.number().int().nullable(),
    attackBonus: z.number().int().nullable(),
    attackRollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']).optional(),
    slots: z.array(characterSheetSpellSlotDtoSchema),
    activeGroups: z.array(characterSheetActiveSpellGroupDtoSchema),
    spells: z.array(characterSheetSpellDtoSchema),
    preparationSources: z.array(characterSheetSpellPreparationSourceDtoSchema).optional()
  }),
  inventory: z.object({
    items: z.array(characterSheetInventoryItemDtoSchema),
    currencies: z.array(characterSheetCurrencyDtoSchema),
    containers: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          capacity: capacityDtoSchema.optional(),
          itemIds: z.array(z.string()),
          currencies: z.array(characterSheetCurrencyDtoSchema)
        })
      )
      .optional()
  }),
  extras: characterSheetExtrasDtoSchema,
  reference: characterSheetReferenceDtoSchema,
  notes: characterSheetNotesDtoSchema
})

const characterSheetCommandBaseDtoSchema = z.object({
  commandId: z.string().uuid(),
  expectedVersion: z.number().int()
})

export const characterRestPreviewRequestDtoSchema = z
  .strictObject({
    restKind: characterRestKindDtoSchema,
    expectedVersion: z.number().int().nonnegative(),
    selectedHitDice: characterRestHitDieSelectionsDtoSchema,
    resetMaximumHitPointModifier: z.boolean(),
    healingMode: characterRestHealingModeDtoSchema,
    manualHealingAccepted: z.boolean(),
    selectedCompanionInstanceIds: z.array(z.guid()),
    rollId: z.string().uuid().optional(),
    rollEvidence: characterRestHitDiceRollEvidenceDtoSchema.optional(),
    requestRoll: z.literal(false)
  })
  .superRefine((request, context) => {
    if (
      new Set(request.selectedCompanionInstanceIds).size !==
      request.selectedCompanionInstanceIds.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['selectedCompanionInstanceIds'],
        message: 'A companion may be selected only once.'
      })
    }
    if (Boolean(request.rollId) !== Boolean(request.rollEvidence)) {
      context.addIssue({
        code: 'custom',
        path: ['rollId'],
        message: 'Hit-die evidence must reference its authoritative roll.'
      })
    }
  })

const characterRestRecoveryPreviewDtoSchema = z.strictObject({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  recovered: z.number().int().nonnegative()
})

export const characterRestPreviewResponseDtoSchema = z.strictObject({
  restKind: characterRestKindDtoSchema,
  streamVersion: z.number().int().nonnegative(),
  previewFingerprint: z.string().trim().min(1),
  hitPoints: z.strictObject({
    current: z.number().int().nonnegative(),
    maximum: z.number().int().nonnegative(),
    temporary: z.number().int().nonnegative(),
    missing: z.number().int().nonnegative(),
    maximumHitPointModifier: z.number().int(),
    canResetMaximumHitPointModifier: z.boolean()
  }),
  hitDice: z.array(
    z.strictObject({
      die: z.number().int().min(2),
      classLabels: z.array(z.string().trim().min(1)).min(1),
      total: z.number().int().nonnegative(),
      used: z.number().int().nonnegative(),
      remaining: z.number().int().nonnegative(),
      selected: z.number().int().nonnegative(),
      constitutionModifier: z.number().int()
    })
  ),
  healingMode: characterRestHealingModeDtoSchema,
  manualHealingAccepted: z.boolean(),
  canonicalExpression: z.string().trim().min(1).optional(),
  rollEvidence: characterRestHitDiceRollEvidenceDtoSchema.optional(),
  stagedHealing: z.number().int().nonnegative(),
  automaticRecoveries: z.strictObject({
    resources: z.array(characterRestRecoveryPreviewDtoSchema),
    spellSlots: z.array(characterRestRecoveryPreviewDtoSchema)
  }),
  eligibleCompanions: z.array(
    z.strictObject({
      companionInstanceId: z.guid(),
      label: z.string().trim().min(1),
      selected: z.boolean(),
      hitDice: z.array(
        z.strictObject({
          die: z.number().int().min(2),
          total: z.number().int().nonnegative(),
          used: z.number().int().nonnegative(),
          remaining: z.number().int().nonnegative(),
          recovered: z.number().int().nonnegative()
        })
      ),
      resources: z.array(characterRestRecoveryPreviewDtoSchema)
    })
  ),
  canApply: z.boolean()
})

export const characterSheetCommandInputDtoSchema = z
  .discriminatedUnion('type', [
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('UPSERT_SHEET_ADJUSTMENT'),
      adjustment: z.union([
        characterSheetCoreAdjustmentCommandDtoSchema,
        characterSheetItemAdjustmentCommandDtoSchema,
        characterSheetCompanionAdjustmentCommandDtoSchema
      ])
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('REMOVE_SHEET_ADJUSTMENT'),
      adjustmentId: z.string().uuid(),
      target: characterSheetPanelTargetDtoSchema,
      family: z.enum([
        'ABILITY',
        'SAVING_THROW',
        'SKILL',
        'PASSIVE',
        'SENSE',
        'MOVEMENT',
        'HIT_POINTS',
        'COMPANION',
        'SPELL',
        'ITEM',
        'DEFENSE',
        'PROFICIENCY'
      ])
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('RESET_SHEET_PANEL_ADJUSTMENTS'),
      target: characterSheetPanelTargetDtoSchema
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('SET_MOVEMENT_DISPLAY_PREFERENCE'),
      preference: characterMovementDisplayPreferenceDtoSchema
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('UPDATE_SPELL_SOURCE_CUSTOMIZATION'),
      source: characterSpellSourceRefDtoSchema,
      customName: z.string().trim().max(120).nullable().optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
      displayAsAttack: z.boolean().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('ADD_SHEET_EXTRA'),
      extra: z.discriminatedUnion('kind', [
        z.object({
          kind: z.enum(['COMPANION', 'MOUNT', 'OWNED']),
          creatureId: z.guid(),
          originKind: z.enum(['WORLD', 'SUMMONED'])
        }),
        z.object({ kind: z.literal('VEHICLE'), vehicleId: z.guid() })
      ])
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('UPDATE_SHEET_EXTRA'),
      extra: z.discriminatedUnion('kind', [
        z.object({
          kind: z.enum(['COMPANION', 'MOUNT', 'OWNED']),
          extraId: z.guid(),
          customName: z.string().trim().max(120).nullable().optional(),
          notes: z.string().trim().max(2000).nullable().optional(),
          isActive: z.boolean().optional(),
          currentHitPoints: z.number().int().nonnegative().optional(),
          tempHitPoints: z.number().int().nonnegative().optional(),
          hitDice: characterSheetExtraHitDiceUpdateDtoSchema.optional(),
          equipmentItemIds: z.array(z.guid()).optional()
        }),
        z.object({
          kind: z.literal('VEHICLE'),
          extraId: z.guid(),
          customName: z.string().trim().max(120).nullable().optional(),
          notes: z.string().trim().max(2000).nullable().optional(),
          isActive: z.boolean().optional(),
          currentHitPoints: z.number().int().nonnegative().optional(),
          equipmentItemIds: z.array(z.guid()).optional()
        })
      ])
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('REMOVE_SHEET_EXTRA'),
      extra: z.object({
        kind: z.enum(['COMPANION', 'MOUNT', 'OWNED', 'VEHICLE']),
        extraId: z.guid()
      })
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('SET_SPELL_MECHANIC_CUSTOMIZATION'),
      source: characterSpellSourceRefDtoSchema,
      category: z.enum(['TO_HIT', 'SAVE_DC', 'DAMAGE']),
      mode: z.enum(['BONUS', 'OVERRIDE']),
      value: z.number().int(),
      sourceNote: characterSheetSourceNoteDtoSchema.optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('REMOVE_SPELL_MECHANIC_CUSTOMIZATION'),
      source: characterSpellSourceRefDtoSchema,
      category: z.enum(['TO_HIT', 'SAVE_DC', 'DAMAGE'])
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('USE_SHEET_RESOURCE'),
      owner: characterResourceOwnerRefDtoSchema,
      amount: z.number().int().positive().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('RECOVER_SHEET_RESOURCE'),
      owner: characterResourceOwnerRefDtoSchema,
      trigger: z.enum(['SHORT_REST', 'LONG_REST', 'DAWN', 'DUSK', 'DAILY', 'MANUAL'])
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('SET_INSPIRATION'),
      inspired: z.boolean()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('SET_HIT_POINTS'),
      current: z.number().int().min(0).optional(),
      temp: z.number().int().min(0).optional(),
      maxOverride: z.number().int().min(0).nullable().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('ADJUST_HIT_POINTS'),
      mode: z.enum(['DAMAGE', 'HEAL']),
      amount: z.number().int().min(0)
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('USE_HIT_DIE'),
      die: z.number().int()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('APPLY_REST'),
      restKind: z.enum(['SHORT', 'LONG'])
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('COMPLETE_REST'),
      restKind: characterRestKindDtoSchema,
      previewFingerprint: z.string().trim().min(1),
      selectedHitDice: characterRestHitDieSelectionsDtoSchema,
      resetMaximumHitPointModifier: z.boolean(),
      healingMode: characterRestHealingModeDtoSchema,
      manualHealingAccepted: z.boolean(),
      selectedCompanionInstanceIds: z.array(z.guid()),
      rollId: z.string().uuid().optional(),
      rollEvidence: characterRestHitDiceRollEvidenceDtoSchema.optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('SET_EXHAUSTION'),
      level: z.number().int().min(0),
      notes: z.string().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('ADD_CONDITION'),
      conditionTypeId: z.string(),
      notes: z.string().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('REMOVE_CONDITION'),
      conditionTypeId: z.string()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('USE_RESOURCE'),
      resourceGrantId: z.string(),
      amount: z.number().int().min(1).optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('RESTORE_RESOURCE'),
      resourceGrantId: z.string(),
      amount: z.number().int().min(1).optional(),
      all: z.boolean().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('USE_SPELL_SLOT'),
      slotKey: z.string()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('RESTORE_SPELL_SLOT'),
      slotKey: z.string(),
      all: z.boolean().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('CAST_SPELL'),
      spellId: z.string(),
      sourceId: z.string().optional(),
      slotKey: z.string().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('SET_PREPARED_SPELLS'),
      classId: z.string(),
      spellIds: z.array(z.string())
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('ADD_INVENTORY_ITEM'),
      equipmentId: z.string(),
      quantity: z.number().int().min(1),
      containerId: z.string().optional(),
      customName: z.string().optional(),
      notes: z.string().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('REMOVE_INVENTORY_ITEM'),
      itemId: z.string(),
      quantity: z.number().int().min(1).optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('UPDATE_INVENTORY_ITEM'),
      itemId: z.string(),
      quantity: z.number().int().min(0).optional(),
      containerId: z.string().nullable().optional(),
      customName: z.string().nullable().optional(),
      notes: z.string().nullable().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('EQUIP_ITEM'),
      itemId: z.string()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('UNEQUIP_ITEM'),
      itemId: z.string()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('ATTUNE_ITEM'),
      itemId: z.string()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('UNATTUNE_ITEM'),
      itemId: z.string()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('ADJUST_CURRENCY'),
      currencyId: z.string(),
      amount: z.number().int(),
      containerId: z.string().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('MOVE_CURRENCY'),
      currencyId: z.string(),
      amount: z.number().int().positive(),
      fromContainerId: z.string().optional(),
      toContainerId: z.string().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('CREATE_NOTE'),
      title: z.string().trim().min(1),
      body: z.string().optional(),
      groupId: z.string(),
      pinned: z.boolean().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('UPDATE_NOTE'),
      noteId: z.string(),
      title: z.string().trim().min(1).optional(),
      body: z.string().nullable().optional(),
      groupId: z.string().optional(),
      pinned: z.boolean().optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('DELETE_NOTE'),
      noteId: z.string()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('CREATE_NOTE_GROUP'),
      label: z.string().trim().min(1)
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('UPDATE_NOTE_GROUP'),
      groupId: z.string(),
      label: z.string().trim().min(1).optional(),
      sortOrder: z.number().int().min(0).optional()
    }),
    characterSheetCommandBaseDtoSchema.extend({
      type: z.literal('DELETE_NOTE_GROUP'),
      groupId: z.string()
    })
  ])
  .superRefine((command, context) => {
    if (
      command.type === 'SET_SPELL_MECHANIC_CUSTOMIZATION' &&
      command.category === 'DAMAGE' &&
      command.mode !== 'BONUS'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Damage customizations only support bonus mode.',
        path: ['mode']
      })
    }
  })

export const characterHistoryEntryDtoSchema = z.object({
  eventId: z.string(),
  occurredAt: z.string(),
  actorId: z.string(),
  eventType: z.string(),
  summary: z.string(),
  result: characterSheetCommandResultDtoSchema.optional()
})

export const characterHistoryResponseDtoSchema = z.object({
  characterId: z.string(),
  entries: z.array(characterHistoryEntryDtoSchema)
})

export const characterSheetCommandResponseDtoSchema = z.object({
  characterId: z.string(),
  streamVersion: z.number().int(),
  sheet: characterSheetResponseDtoSchema,
  panels: z.array(characterSheetPanelDtoSchema).optional(),
  historyEntry: characterHistoryEntryDtoSchema.optional(),
  result: characterSheetCommandResultDtoSchema.optional()
})

export type CharacterBuilderModeDto = z.infer<typeof characterBuilderModeDtoSchema>
export type CharacterBuilderFormDto = z.infer<typeof characterBuilderFormDtoSchema>
export type CharacterListItemDto = z.infer<typeof characterListItemDtoSchema>
export type CharacterListResponseDto = z.infer<typeof characterListResponseDtoSchema>
export type CharacterBuilderSummaryDto = z.infer<typeof characterBuilderSummaryDtoSchema>
export type CharacterBuilderIssueDto = z.infer<typeof characterBuilderIssueDtoSchema>
export type CharacterBuilderValidationDto = z.infer<typeof characterBuilderValidationDtoSchema>
export type CharacterBuilderReadinessDto = z.infer<typeof characterBuilderReadinessDtoSchema>
export type CharacterBuilderResolutionDto = z.infer<typeof characterBuilderResolutionDtoSchema>
export type CharacterBuilderReferenceOptionDto = z.infer<
  typeof characterBuilderReferenceOptionDtoSchema
>
export type CharacterBuilderRaceReferenceDto = z.infer<
  typeof characterBuilderRaceReferenceDtoSchema
>
export type CharacterBuilderBackgroundReferenceDto = z.infer<
  typeof characterBuilderBackgroundReferenceDtoSchema
>
export type CharacterBuilderClassReferenceDto = z.infer<
  typeof characterBuilderClassReferenceDtoSchema
>
export type CharacterBuilderReferencesDto = z.infer<typeof characterBuilderReferencesDtoSchema>
export type CharacterBuilderChosenGrantChoiceViewDto = {
  id: string
  grantId: string
  grantKind: 'PROFICIENCY_GRANT' | 'SPELL_GRANT' | 'FEAT_GRANT' | 'SENSE_GRANT'
  label: string
  ownerFeatureId?: string
  proficiencyKind?: string
  proficiencyLevel?: 'HALF' | 'FULL' | 'DOUBLE'
  displayCategory?: string
  sourceLabel: string
  source: z.infer<typeof characterProvenanceDtoSchema>
  timing: z.infer<typeof characterAcquisitionTimingDtoSchema>
  progressionLevel?: number
  requiredCount: number
  duplicatePolicy: z.infer<typeof authoringSelectionDuplicatePolicySchema>
  selectedTargetIds: string[]
  options: CharacterBuilderChoiceOptionDto[]
}
export type CharacterBuilderChoiceOptionDto = z.infer<typeof characterBuilderChoiceOptionDtoSchema>
export type CharacterBuilderSpellOptionDto = z.infer<typeof characterBuilderSpellOptionDtoSchema>
export type CharacterBuilderGrantSummaryItemDto = z.infer<
  typeof characterBuilderGrantSummaryItemDtoSchema
>
export type CharacterBuilderFeatureChoiceViewDto = z.infer<
  typeof characterBuilderFeatureChoiceViewDtoSchema
>
export type CharacterBuilderSpellChoiceViewDto = z.infer<
  typeof characterBuilderSpellChoiceViewDtoSchema
>
export type CharacterBuilderRaceViewDto = z.infer<typeof characterBuilderRaceViewDtoSchema>
export type CharacterBuilderClassViewItemDto = z.infer<
  typeof characterBuilderClassViewItemDtoSchema
>
export type CharacterBuilderClassViewDto = z.infer<typeof characterBuilderClassViewDtoSchema>
export type CharacterBuilderBackgroundViewDto = z.infer<
  typeof characterBuilderBackgroundViewDtoSchema
>
export type CharacterBuilderStartingEquipmentViewDto = z.infer<
  typeof characterBuilderStartingEquipmentViewDtoSchema
>
export type CharacterBuilderEquipmentViewDto = z.infer<
  typeof characterBuilderEquipmentViewDtoSchema
>
export type CharacterBuilderReviewViewDto = z.infer<typeof characterBuilderReviewViewDtoSchema>
export type CharacterBuilderViewDto = {
  race: CharacterBuilderRaceViewDto
  classes: CharacterBuilderClassViewDto
  background: CharacterBuilderBackgroundViewDto
  equipment: CharacterBuilderEquipmentViewDto
  review: CharacterBuilderReviewViewDto
}
export type CharacterBuilderPayloadDto = {
  publicId?: string
  character: z.infer<typeof characterAuthoredDtoSchema>
  resolution: CharacterBuilderResolutionDto
  references: CharacterBuilderReferencesDto
  view: CharacterBuilderViewDto
  builderIntent?: CharacterBuilderIntentCacheDto
  baseActiveUpdatedAt?: string | null
}
export type CharacterBuilderAbilitiesIntentCacheDto = z.infer<
  typeof characterBuilderAbilitiesIntentCacheDtoSchema
>
export type CharacterBuilderIntentCacheDto = z.infer<typeof characterBuilderIntentCacheDtoSchema>
export type CharacterBuilderDraftPayloadDto = z.infer<typeof characterBuilderDraftPayloadDtoSchema>
export type CharacterBuilderDraftStateDto = z.infer<typeof characterBuilderDraftStateDtoSchema>
export type CharacterBuilderDraftSummaryDto = z.infer<typeof characterBuilderDraftSummaryDtoSchema>
export type CharacterBuilderDraftDto = z.infer<typeof characterBuilderDraftDtoSchema>
export type CharacterBuilderChangePreviewDto = z.infer<
  typeof characterBuilderChangePreviewDtoSchema
>
export type CharacterBuilderPreviewPayloadDto = z.infer<
  typeof characterBuilderPreviewPayloadDtoSchema
>
export type CharacterDraftRequestDto = z.infer<typeof characterDraftRequestDtoSchema>
export type CharacterBuilderDraftSaveRequestDto = z.infer<
  typeof characterBuilderDraftSaveRequestDtoSchema
>
export type CharacterBuilderResolveRequestDto = z.infer<
  typeof characterBuilderResolveRequestDtoSchema
>
export type CharacterBuilderSaveRequestDto = z.infer<typeof characterBuilderSaveRequestDtoSchema>
export type CharacterBuilderCommitRequestDto = z.infer<
  typeof characterBuilderCommitRequestDtoSchema
>
export type CharacterSheetResponseDto = z.infer<typeof characterSheetResponseDtoSchema>
export type CharacterRestPreviewRequestDto = z.infer<typeof characterRestPreviewRequestDtoSchema>
export type CharacterRestPreviewResponseDto = z.infer<typeof characterRestPreviewResponseDtoSchema>
export type CharacterSheetExtrasDto = z.infer<typeof characterSheetExtrasDtoSchema>
export type CharacterHistoryEntryDto = z.infer<typeof characterHistoryEntryDtoSchema>
export type CharacterHistoryResponseDto = z.infer<typeof characterHistoryResponseDtoSchema>
export type CharacterSheetCommandInputDto = z.infer<typeof characterSheetCommandInputDtoSchema>
export type CharacterSheetCommandResponseDto = z.infer<
  typeof characterSheetCommandResponseDtoSchema
>
