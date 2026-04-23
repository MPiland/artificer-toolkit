import { z } from 'zod'

import { authoredRecordStatusSchema } from '../shared/enums.js'
import {
  characterAuthoredDtoSchema,
  characterProvenanceDtoSchema,
  characterStateDtoSchema
} from '../subjects/index.js'
import { listResponseDtoSchema } from './common.js'

export const characterBuilderModeDtoSchema = z.enum(['create', 'edit'])

export const characterListItemDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: authoredRecordStatusSchema,
  systemId: z.string(),
  streamVersion: z.number().int()
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
  selectedRace: z.object({
    raceId: z.string(),
    raceLabel: z.string(),
    subraceId: z.string().optional(),
    subraceLabel: z.string().optional(),
    ancestryId: z.string().optional(),
    ancestryLabel: z.string().optional(),
    ancestryOptionId: z.string().optional(),
    ancestryOptionLabel: z.string().optional()
  }).optional(),
  selectedBackground: z.object({
    backgroundId: z.string(),
    label: z.string()
  }).optional(),
  classes: z.array(characterBuilderClassSummaryDtoSchema)
})

export const characterBuilderGrantSummaryItemDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  sourceLabel: z.string(),
  source: characterProvenanceDtoSchema
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
  required: z.boolean()
})

export const characterBuilderValidationDtoSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(['blocking', 'warning'])
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

export const characterBuilderPayloadDtoSchema = z.object({
  character: characterAuthoredDtoSchema,
  resolution: characterBuilderResolutionDtoSchema
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

export const characterBuilderResolveRequestDtoSchema = z.object({
  character: characterAuthoredDtoSchema,
  mode: characterBuilderModeDtoSchema
})

export const characterBuilderSaveRequestDtoSchema = z.object({
  character: characterAuthoredDtoSchema,
  mode: characterBuilderModeDtoSchema,
  targetStatus: authoredRecordStatusSchema.optional()
})

export const characterSheetResponseDtoSchema = z.object({
  character: characterAuthoredDtoSchema,
  resolution: characterBuilderResolutionDtoSchema,
  playState: characterStateDtoSchema
})

export type CharacterBuilderModeDto = z.infer<typeof characterBuilderModeDtoSchema>
export type CharacterListItemDto = z.infer<typeof characterListItemDtoSchema>
export type CharacterListResponseDto = z.infer<typeof characterListResponseDtoSchema>
export type CharacterBuilderSummaryDto = z.infer<typeof characterBuilderSummaryDtoSchema>
export type CharacterBuilderIssueDto = z.infer<typeof characterBuilderIssueDtoSchema>
export type CharacterBuilderValidationDto = z.infer<typeof characterBuilderValidationDtoSchema>
export type CharacterBuilderReadinessDto = z.infer<typeof characterBuilderReadinessDtoSchema>
export type CharacterBuilderResolutionDto = z.infer<typeof characterBuilderResolutionDtoSchema>
export type CharacterBuilderPayloadDto = z.infer<typeof characterBuilderPayloadDtoSchema>
export type CharacterBuilderChangePreviewDto = z.infer<typeof characterBuilderChangePreviewDtoSchema>
export type CharacterBuilderPreviewPayloadDto = z.infer<typeof characterBuilderPreviewPayloadDtoSchema>
export type CharacterDraftRequestDto = z.infer<typeof characterDraftRequestDtoSchema>
export type CharacterBuilderResolveRequestDto = z.infer<typeof characterBuilderResolveRequestDtoSchema>
export type CharacterBuilderSaveRequestDto = z.infer<typeof characterBuilderSaveRequestDtoSchema>
export type CharacterSheetResponseDto = z.infer<typeof characterSheetResponseDtoSchema>
