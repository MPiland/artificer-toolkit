import { z, lazySchema } from '../zod.js'

import {
  authoredVersionVectorEntrySchema,
  authoredVersionVectorSchema,
  projectionChecksumSchema
} from '../projections/identity.js'
import { CHARACTER_ABILITY_GENERATION_METHOD } from '@artificer-toolkit/shared/core'

import {
  authoringSelectionDuplicatePolicySchema,
  authoredRecordStatusSchema
} from '../shared/enums.js'
import { startingEquipmentDtoSchema } from '../shared/startingEquipment.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  characterAcquisitionTimingDtoSchema,
  characterAbilityScoresIntentDtoSchema,
  characterAuthoredDtoSchema,
  characterProvenanceDtoSchema
} from '../subjects/character.js'
import {
  classHitpointDtoSchema,
  classMulticlassRequirementGroupsDtoSchema,
  classStartingGoldDtoSchema
} from '../subjects/shared.js'
import { listResponseDtoSchema } from './common.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'

const stringSchema = lazySchema(() => z.string())
const integerSchema = lazySchema(() => z.number().check(z.int()))
const booleanSchema = lazySchema(() => z.boolean())

export const characterBuilderModeDtoSchema = lazySchema(() => z.enum(['create', 'edit']))

export const characterBuilderAbilitiesFormDtoSchema = characterAbilityScoresIntentDtoSchema

const characterBuilderAbilityMethodDtoSchema = lazySchema(() =>
  z.enum([
    CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY,
    CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY,
    CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
  ])
)

const characterBuilderAbilityDraftDtoSchema = lazySchema(() =>
  z.discriminatedUnion('method', [
    z.strictObject({
      method: z.literal(CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY),
      slots: z
        .array(
          z.strictObject({
            ability: z.optional(systemCoreCodeSchema),
            option: z.optional(z.enum(['8', '10', '12', '13', '14', '15']))
          })
        )
        .check(z.length(6))
    }),
    z.strictObject({
      method: z.literal(CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY),
      slots: z
        .array(
          z.strictObject({
            ability: z.optional(systemCoreCodeSchema),
            option: z.optional(z.enum(['8', '9', '10', '11', '12', '13', '14', '15']))
          })
        )
        .check(z.length(6))
    }),
    z.strictObject({
      method: z.literal(CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED),
      slots: z
        .array(
          z.strictObject({
            ability: z.optional(systemCoreCodeSchema),
            score: z.optional(integerSchema)
          })
        )
        .check(z.length(6))
    })
  ])
)

export const characterBuilderAbilitiesIntentCacheDtoSchema = lazySchema(() =>
  z.strictObject({
    activeMethod: characterBuilderAbilityMethodDtoSchema,
    drafts: z
      .optional(
        z.partialRecord(
          characterBuilderAbilityMethodDtoSchema,
          characterBuilderAbilityDraftDtoSchema
        )
      )
      .check(
        z.superRefine((drafts, context) => {
          for (const [method, draft] of Object.entries(drafts ?? {})) {
            if (draft !== undefined && draft.method !== method) {
              context.addIssue({
                code: 'custom',
                path: [method, 'method'],
                message: `Cached ability draft ${method} contains ${draft.method} slots.`
              })
            }
          }
        })
      ),
    methods: z
      .partialRecord(characterBuilderAbilityMethodDtoSchema, characterBuilderAbilitiesFormDtoSchema)
      .check(
        z.superRefine((methods, context) => {
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
      )
  })
)

export const characterBuilderIntentCacheDtoSchema = lazySchema(() =>
  z.strictObject({
    abilities: z.optional(characterBuilderAbilitiesIntentCacheDtoSchema)
  })
)

export const characterBuilderFormDtoSchema = lazySchema(() =>
  z.extend(characterAuthoredDtoSchema, {
    builderIntent: z.optional(characterBuilderIntentCacheDtoSchema)
  })
)

export const characterBuilderDraftStateDtoSchema = lazySchema(() =>
  z.enum(['DRAFT_ONLY', 'ACTIVE_WITH_DRAFT'])
)

export const characterBuilderDraftSummaryDtoSchema = lazySchema(() =>
  z.object({
    characterId: stringSchema,
    publicId: stringSchema,
    userId: stringSchema,
    systemId: stringSchema,
    label: stringSchema,
    status: z.literal('DRAFT'),
    draftState: characterBuilderDraftStateDtoSchema,
    baseActiveUpdatedAt: z.optional(z.nullable(stringSchema)),
    createdAt: z.optional(stringSchema),
    updatedAt: z.optional(stringSchema)
  })
)

export const characterListItemDtoSchema = lazySchema(() =>
  z.object({
    id: stringSchema,
    publicId: stringSchema,
    label: stringSchema,
    status: authoredRecordStatusSchema,
    systemId: stringSchema,
    streamVersion: integerSchema,
    draft: z.optional(z.nullable(characterBuilderDraftSummaryDtoSchema))
  })
)

export const characterListResponseDtoSchema = lazySchema(() =>
  listResponseDtoSchema(characterListItemDtoSchema)
)

export const characterBuilderClassSummaryDtoSchema = lazySchema(() =>
  z.object({
    classId: stringSchema,
    classLabel: stringSchema,
    classLevel: integerSchema,
    subclassId: z.optional(stringSchema),
    subclassLabel: z.optional(stringSchema),
    specializationId: z.optional(stringSchema),
    specializationLabel: z.optional(stringSchema),
    featureLabels: z.array(stringSchema),
    resourceLabels: z.array(stringSchema),
    spellcastingLabels: z.array(stringSchema)
  })
)

export const characterBuilderSummaryDtoSchema = lazySchema(() =>
  z.object({
    totalLevel: integerSchema,
    abilities: z.record(stringSchema, integerSchema),
    selectedRace: z.optional(
      z.object({
        raceId: stringSchema,
        raceLabel: stringSchema,
        subraceId: z.optional(stringSchema),
        subraceLabel: z.optional(stringSchema),
        ancestryId: z.optional(stringSchema),
        ancestryLabel: z.optional(stringSchema),
        ancestryOptionId: z.optional(stringSchema),
        ancestryOptionLabel: z.optional(stringSchema)
      })
    ),
    selectedBackground: z.optional(
      z.object({
        backgroundId: stringSchema,
        label: stringSchema
      })
    ),
    classes: z.array(characterBuilderClassSummaryDtoSchema)
  })
)

export const characterBuilderGrantSummaryItemDtoSchema = lazySchema(() =>
  z.object({
    id: stringSchema,
    label: stringSchema,
    description: z.optional(stringSchema),
    sortOrder: z.optional(integerSchema),
    availableAtLevel: z.optional(integerSchema.check(z.positive())),
    details: z.optional(
      z.array(
        z.object({
          id: stringSchema,
          label: stringSchema,
          description: stringSchema
        })
      )
    ),
    attributes: z.optional(z.array(stringSchema)),
    sourceLabel: stringSchema,
    source: characterProvenanceDtoSchema
  })
)

export const characterSheetReferenceFeatureDtoSchema = lazySchema(() =>
  z.extend(characterBuilderGrantSummaryItemDtoSchema, {
    source: z.union([
      characterProvenanceDtoSchema,
      z.object({
        kind: z.literal('EQUIPMENT_INSTANCE'),
        equipmentId: stringSchema,
        itemInstanceId: stringSchema
      })
    ]),
    resourceCost: z.optional(integerSchema.check(z.positive())),
    resourceGrantId: z.optional(stringSchema.check(z.minLength(1)))
  })
)

export const characterBuilderGrantedContentDtoSchema = lazySchema(() =>
  z.object({
    features: z.array(characterBuilderGrantSummaryItemDtoSchema),
    resources: z.array(characterBuilderGrantSummaryItemDtoSchema),
    spellcasting: z.array(characterBuilderGrantSummaryItemDtoSchema)
  })
)

export const characterBuilderIssueDtoSchema = lazySchema(() =>
  z.object({
    code: stringSchema,
    sectionId: characterBuilderSectionIdDtoSchema,
    message: stringSchema,
    sourceLabel: stringSchema,
    source: z.optional(characterProvenanceDtoSchema),
    required: booleanSchema
  })
)

export const characterBuilderValidationDtoSchema = lazySchema(() =>
  z.object({
    code: stringSchema,
    sectionId: characterBuilderSectionIdDtoSchema,
    message: stringSchema,
    severity: z.enum(['blocking', 'warning']),
    sourceLabel: z.optional(stringSchema),
    source: z.optional(characterProvenanceDtoSchema)
  })
)

export const characterBuilderReadinessDtoSchema = lazySchema(() =>
  z.object({
    ready: booleanSchema,
    blockingIssues: z.array(stringSchema),
    outstandingRequiredChoices: z.array(stringSchema)
  })
)

export const characterBuilderSectionIdDtoSchema = lazySchema(() =>
  z.enum([
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
)

export const characterBuilderResolutionDtoSchema = lazySchema(() =>
  z.object({
    mode: characterBuilderModeDtoSchema,
    summary: characterBuilderSummaryDtoSchema,
    grants: characterBuilderGrantedContentDtoSchema,
    outstandingChoices: z.array(characterBuilderIssueDtoSchema),
    validations: z.array(characterBuilderValidationDtoSchema),
    readiness: characterBuilderReadinessDtoSchema,
    recommendedSectionId: characterBuilderSectionIdDtoSchema
  })
)

export const characterBuilderReferenceOptionDtoSchema = lazySchema(() =>
  z.object({
    id: stringSchema,
    label: stringSchema
  })
)

export const characterBuilderRaceReferenceDtoSchema = lazySchema(() =>
  z.extend(characterBuilderReferenceOptionDtoSchema, {
    category: z.optional(stringSchema),
    description: z.optional(stringSchema),
    parentRaceId: z.optional(stringSchema),
    selectionMode: z.optional(z.enum(['DIRECT', 'REQUIRES_SUBRACE'])),
    sizeLabel: z.optional(stringSchema),
    speedLabels: z.optional(z.array(stringSchema)),
    abilityScoreIncreaseFacts: z.optional(
      z.array(z.object({ label: stringSchema, value: stringSchema }))
    ),
    ancestry: z.optional(
      z.object({
        id: stringSchema,
        label: stringSchema,
        options: z.array(
          z.extend(characterBuilderReferenceOptionDtoSchema, {
            description: z.optional(stringSchema),
            features: z.array(characterBuilderGrantSummaryItemDtoSchema)
          })
        )
      })
    )
  })
)

export const characterBuilderBackgroundReferenceDtoSchema = lazySchema(() =>
  z.extend(characterBuilderReferenceOptionDtoSchema, {
    description: z.optional(stringSchema),
    summary: stringSchema,
    grantFacts: z.array(z.object({ label: stringSchema, value: stringSchema })),
    featureLabels: z.array(stringSchema),
    hiddenGrantFactCount: integerSchema.check(z.nonnegative()),
    hiddenFeatureCount: integerSchema.check(z.nonnegative())
  })
)

export const characterBuilderClassReferenceDtoSchema = lazySchema(() =>
  z.extend(characterBuilderReferenceOptionDtoSchema, {
    category: z.optional(stringSchema),
    description: z.optional(stringSchema),
    hitpoint: z.optional(classHitpointDtoSchema),
    requirementGroups: z.optional(classMulticlassRequirementGroupsDtoSchema),
    parentClassId: z.optional(stringSchema),
    savingThrowLabels: z.optional(z.array(stringSchema)),
    proficiencyGroups: z.optional(
      z.array(
        z.object({
          label: stringSchema,
          entries: z.array(stringSchema)
        })
      )
    ),
    specializations: z.optional(z.array(characterBuilderReferenceOptionDtoSchema))
  })
)

export const characterBuilderReferencesDtoSchema = lazySchema(() =>
  z.object({
    abilities: z.array(characterBuilderReferenceOptionDtoSchema),
    advancementMethods: z.array(characterBuilderReferenceOptionDtoSchema),
    abilityGenerationMethods: z.array(characterBuilderReferenceOptionDtoSchema),
    hitpointCalculationMethods: z.array(characterBuilderReferenceOptionDtoSchema),
    standardArrayScores: z.array(characterBuilderReferenceOptionDtoSchema),
    pointBuyScores: z.array(
      z.extend(characterBuilderReferenceOptionDtoSchema, {
        cost: integerSchema.check(z.nonnegative())
      })
    ),
    pointBuyTotalPoints: integerSchema.check(z.positive()),
    races: z.array(characterBuilderRaceReferenceDtoSchema),
    classes: z.array(characterBuilderClassReferenceDtoSchema),
    backgrounds: z.array(characterBuilderBackgroundReferenceDtoSchema),
    equipment: z.array(characterBuilderReferenceOptionDtoSchema),
    currencies: z.array(characterBuilderReferenceOptionDtoSchema),
    alignments: z.array(characterBuilderReferenceOptionDtoSchema),
    lifestyles: z.array(characterBuilderReferenceOptionDtoSchema)
  })
)

export const characterBuilderChoiceOptionDtoSchema = lazySchema(() =>
  z.extend(characterBuilderReferenceOptionDtoSchema, {
    category: z.optional(stringSchema),
    disabled: z.optional(booleanSchema),
    disabledReason: z.optional(stringSchema),
    properties: z.optional(z.array(stringSchema))
  })
)

export const characterBuilderSpellOptionDtoSchema = lazySchema(() =>
  z.extend(characterBuilderChoiceOptionDtoSchema, {
    level: integerSchema.check(z.nonnegative()),
    schoolLabel: z.optional(stringSchema),
    ritual: z.optional(booleanSchema),
    concentration: z.optional(booleanSchema)
  })
)

export const characterBuilderFeatureChoiceViewDtoSchema = lazySchema(() =>
  z.object({
    featureId: stringSchema,
    featureLabel: stringSchema,
    sourceLabel: stringSchema,
    source: characterProvenanceDtoSchema,
    selectionKey: stringSchema,
    requiredCount: integerSchema,
    selectedOptionIds: z.array(stringSchema),
    options: z.array(characterBuilderChoiceOptionDtoSchema)
  })
)

export const characterBuilderChosenGrantChoiceViewDtoSchema: z.ZodMiniType<CharacterBuilderChosenGrantChoiceViewDto> =
  lazySchema(() =>
    z.object({
      id: stringSchema,
      grantId: stringSchema,
      grantKind: z.enum(['PROFICIENCY_GRANT', 'SPELL_GRANT', 'FEAT_GRANT', 'SENSE_GRANT']),
      label: stringSchema,
      ownerFeatureId: z.optional(stringSchema),
      proficiencyKind: z.optional(stringSchema),
      proficiencyLevel: z.optional(z.enum(['HALF', 'FULL', 'DOUBLE'])),
      displayCategory: z.optional(stringSchema),
      sourceLabel: stringSchema,
      source: characterProvenanceDtoSchema,
      timing: characterAcquisitionTimingDtoSchema,
      progressionLevel: z.optional(integerSchema.check(z.positive())),
      requiredCount: integerSchema.check(z.positive()),
      duplicatePolicy: authoringSelectionDuplicatePolicySchema,
      selectedTargetIds: z.array(stringSchema),
      options: z.array(characterBuilderChoiceOptionDtoSchema)
    })
  )

export const characterBuilderSpellChoiceViewDtoSchema = lazySchema(() =>
  z.object({
    id: stringSchema,
    label: stringSchema,
    sourceLabel: stringSchema,
    source: characterProvenanceDtoSchema,
    cantripLimit: integerSchema,
    learnedSpellLimit: integerSchema,
    spellCollectionLabel: stringSchema,
    selectedCantripIds: z.array(stringSchema),
    selectedSpellIds: z.array(stringSchema),
    cantripOptions: z.array(characterBuilderSpellOptionDtoSchema),
    spellOptions: z.array(characterBuilderSpellOptionDtoSchema)
  })
)

export const characterBuilderRaceViewDtoSchema = lazySchema(() =>
  z.object({
    raceOptions: z.array(characterBuilderChoiceOptionDtoSchema),
    subraceOptions: z.array(characterBuilderChoiceOptionDtoSchema),
    ancestry: z.nullable(
      z.object({
        ancestryId: stringSchema,
        label: stringSchema,
        selectedOptionId: z.optional(stringSchema),
        options: z.array(characterBuilderChoiceOptionDtoSchema)
      })
    ),
    grantChoices: z.array(characterBuilderChosenGrantChoiceViewDtoSchema),
    features: z.array(characterBuilderGrantSummaryItemDtoSchema),
    featureChoices: z.array(characterBuilderFeatureChoiceViewDtoSchema)
  })
)

export const characterBuilderClassViewItemDtoSchema = lazySchema(() =>
  z.object({
    classId: stringSchema,
    classLabel: stringSchema,
    classLevel: integerSchema,
    classOptions: z.optional(z.array(characterBuilderChoiceOptionDtoSchema)),
    subclassOptions: z.array(characterBuilderChoiceOptionDtoSchema),
    specializationOptions: z.array(characterBuilderChoiceOptionDtoSchema),
    subclassSelectionFeatureId: z.optional(stringSchema),
    proficiencyGroups: z.array(
      z.object({
        category: stringSchema,
        label: stringSchema,
        grantedEntries: z.array(stringSchema),
        choiceInstructions: z.array(z.object({ label: stringSchema, required: booleanSchema })),
        choiceIds: z.array(stringSchema)
      })
    ),
    grantChoices: z.array(characterBuilderChosenGrantChoiceViewDtoSchema),
    featureLabels: z.array(stringSchema),
    features: z.array(characterBuilderGrantSummaryItemDtoSchema),
    featureChoices: z.array(characterBuilderFeatureChoiceViewDtoSchema),
    spellChoices: z.array(characterBuilderSpellChoiceViewDtoSchema)
  })
)

export const characterBuilderClassViewDtoSchema = lazySchema(() =>
  z.object({
    classOptions: z.array(characterBuilderChoiceOptionDtoSchema),
    selectedClasses: z.array(characterBuilderClassViewItemDtoSchema)
  })
)

export const characterBuilderBackgroundViewDtoSchema = lazySchema(() =>
  z.object({
    grantChoices: z.array(characterBuilderChosenGrantChoiceViewDtoSchema),
    backgroundOptions: z.array(characterBuilderChoiceOptionDtoSchema),
    description: z.optional(stringSchema),
    detailSections: z.array(
      z.object({
        label: stringSchema,
        details: z.array(
          z.object({
            id: stringSchema,
            label: stringSchema,
            description: stringSchema
          })
        )
      })
    ),
    features: z.array(characterBuilderGrantSummaryItemDtoSchema),
    featureChoices: z.array(characterBuilderFeatureChoiceViewDtoSchema)
  })
)

export const characterBuilderStartingEquipmentViewDtoSchema = lazySchema(() =>
  z.object({
    source: z.enum(['CLASS', 'BACKGROUND']),
    sourceLabel: stringSchema,
    startingGold: z.optional(z.nullable(classStartingGoldDtoSchema)),
    startingEquipment: startingEquipmentDtoSchema,
    choiceLabels: z.record(stringSchema, stringSchema)
  })
)

export const characterBuilderEquipmentViewDtoSchema = lazySchema(() =>
  z.object({
    classStartingEquipmentRequired: booleanSchema,
    backgroundStartingEquipmentRequired: booleanSchema,
    classStartingEquipment: z.nullable(characterBuilderStartingEquipmentViewDtoSchema),
    backgroundStartingEquipment: z.nullable(characterBuilderStartingEquipmentViewDtoSchema),
    equipmentOptions: z.array(characterBuilderChoiceOptionDtoSchema),
    currencyOptions: z.array(characterBuilderChoiceOptionDtoSchema)
  })
)

export const characterBuilderReviewViewDtoSchema = lazySchema(() =>
  z.object({
    blockers: z.array(stringSchema),
    warnings: z.array(stringSchema),
    ready: booleanSchema
  })
)

export const characterBuilderViewDtoSchema: z.ZodMiniType<CharacterBuilderViewDto> = lazySchema(
  () =>
    z.object({
      race: characterBuilderRaceViewDtoSchema,
      classes: characterBuilderClassViewDtoSchema,
      background: characterBuilderBackgroundViewDtoSchema,
      equipment: characterBuilderEquipmentViewDtoSchema,
      review: characterBuilderReviewViewDtoSchema
    })
)

export const characterBuilderPayloadDtoSchema: z.ZodMiniType<CharacterBuilderPayloadDto> =
  lazySchema(() =>
    z.object({
      publicId: z.optional(stringSchema),
      character: characterAuthoredDtoSchema,
      resolution: characterBuilderResolutionDtoSchema,
      references: characterBuilderReferencesDtoSchema,
      view: characterBuilderViewDtoSchema,
      builderIntent: z.optional(characterBuilderIntentCacheDtoSchema),
      baseActiveUpdatedAt: z.optional(z.nullable(stringSchema))
    })
  )

export const characterBuilderCommitReceiptDtoSchema = lazySchema(() =>
  z.object({
    character: characterAuthoredDtoSchema,
    publicId: stringSchema,
    streamVersion: integerSchema.check(z.nonnegative()),
    mechanicsProjectionChecksum: projectionChecksumSchema
  })
)

export const characterBuilderDraftPayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    character: characterAuthoredDtoSchema,
    builderIntent: z.optional(characterBuilderIntentCacheDtoSchema)
  })
)

export const characterBuilderDraftDtoSchema = lazySchema(() =>
  z.extend(characterBuilderDraftSummaryDtoSchema, {
    id: stringSchema,
    payload: characterBuilderDraftPayloadDtoSchema,
    mode: characterBuilderModeDtoSchema
  })
)

export const characterBuilderPreviewEntryDtoSchema = lazySchema(() =>
  z.object({
    id: stringSchema,
    label: stringSchema
  })
)

export const characterBuilderChangePreviewDtoSchema = lazySchema(() =>
  z.object({
    predictedStatus: authoredRecordStatusSchema,
    downgradesStatus: booleanSchema,
    removedAncestrySelections: z.array(characterBuilderPreviewEntryDtoSchema),
    removedFeatureAcquisitions: z.array(characterBuilderPreviewEntryDtoSchema),
    removedSpellSelections: z.array(characterBuilderPreviewEntryDtoSchema),
    removedResourceGrants: z.array(characterBuilderPreviewEntryDtoSchema),
    clearedStartingEquipmentSources: z.array(z.enum(['CLASS', 'BACKGROUND'])),
    summaryLines: z.array(stringSchema),
    destructive: booleanSchema
  })
)

export const characterBuilderPreviewPayloadDtoSchema = lazySchema(() =>
  z.object({
    character: characterAuthoredDtoSchema,
    resolution: characterBuilderResolutionDtoSchema,
    preview: characterBuilderChangePreviewDtoSchema,
    authoredContentUpgrade: z.optional(
      z.object({
        previewChecksum: projectionChecksumSchema,
        currentVector: authoredVersionVectorSchema,
        candidateVector: authoredVersionVectorSchema,
        changes: z.array(
          z.object({
            subjectKind: authoredVersionVectorEntrySchema.shape.subjectKind,
            subjectId: authoredVersionVectorEntrySchema.shape.subjectId,
            previous: z.nullable(authoredVersionVectorEntrySchema),
            next: z.nullable(authoredVersionVectorEntrySchema)
          })
        )
      })
    )
  })
)

export const characterDraftRequestDtoSchema = lazySchema(() =>
  z.object({
    id: stringSchema.check(z.minLength(1)),
    systemId: postgresUuidSchema,
    primaryRulesCatalogueId: postgresUuidSchema
  })
)

export const characterBuilderDraftSaveRequestDtoSchema = lazySchema(() =>
  z.object({
    character: characterAuthoredDtoSchema,
    builderIntent: z.optional(characterBuilderIntentCacheDtoSchema),
    mode: characterBuilderModeDtoSchema,
    baseActiveUpdatedAt: z.optional(z.nullable(stringSchema))
  })
)

export const characterBuilderResolveRequestDtoSchema = lazySchema(() =>
  z.object({
    character: characterAuthoredDtoSchema,
    mode: characterBuilderModeDtoSchema
  })
)

export const characterBuilderSaveRequestDtoSchema = lazySchema(() =>
  z.object({
    character: characterAuthoredDtoSchema,
    mode: characterBuilderModeDtoSchema,
    targetStatus: z.optional(authoredRecordStatusSchema)
  })
)

export const characterBuilderCommitRequestDtoSchema = lazySchema(() =>
  z.object({
    character: characterAuthoredDtoSchema,
    mode: characterBuilderModeDtoSchema,
    targetStatus: z.optional(z.literal('ACTIVE')),
    baseActiveUpdatedAt: z.optional(z.nullable(stringSchema)),
    authoredContentUpgradePreviewChecksum: z.optional(projectionChecksumSchema)
  })
)

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
export type CharacterBuilderCommitReceiptDto = z.infer<
  typeof characterBuilderCommitReceiptDtoSchema
>
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
