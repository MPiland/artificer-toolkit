import { z } from 'zod'
import { CHARACTER_ABILITY_GENERATION_METHOD } from '@artificer-toolkit/shared/core'

import {
  abilityCodeSchema,
  authoringSelectionDuplicatePolicySchema,
  authoredRecordStatusSchema
} from '../shared/enums.js'
import { startingEquipmentDtoSchema } from '../shared/startingEquipment.js'
import {
  characterAcquisitionTimingDtoSchema,
  characterAbilityScoresIntentDtoSchema,
  characterAuthoredDtoSchema,
  characterProvenanceDtoSchema
} from '../subjects/index.js'
import {
  classHitpointDtoSchema,
  classMulticlassRequirementGroupsDtoSchema,
  classStartingGoldDtoSchema
} from '../subjects/shared.js'
import { listResponseDtoSchema } from './common.js'

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
