import { z } from 'zod'

import {
  backgroundAuthoredDtoSchema,
  classAuthoredDtoSchema,
  creatureAuthoredDtoSchema,
  equipmentAuthoredDtoSchema,
  featAuthoredDtoSchema,
  raceAuthoredDtoSchema,
  spellAuthoredDtoSchema,
  vehicleAuthoredDtoSchema
} from '../subjects/index.js'
import { featureDtoSchema } from '../features/index.js'
import {
  authoredContentPermissionsDtoSchema,
  authoredContentProvenanceDtoSchema,
  authoredResourceResponseDtoSchema,
  listResponseDtoSchema,
  ownerContextDtoSchema,
  singleResourceResponseDtoSchema
} from './common.js'
import { authoredRecordStatusSchema } from '../shared/enums.js'
import { unknownObjectSchema } from '../shared/facet.js'

export const authoredSubjectKindDtoSchema = z.enum([
  'BACKGROUND',
  'CLASS',
  'CREATURE',
  'EQUIPMENT',
  'FEAT',
  'RACE',
  'SPELL',
  'VEHICLE'
])

export const authoredDraftStateDtoSchema = z.enum([
  'DRAFT_ONLY',
  'ACTIVE_WITH_DRAFT'
])

export const authoredDraftSummaryDtoSchema = z.object({
  subjectKind: authoredSubjectKindDtoSchema,
  subjectId: z.string(),
  userId: z.string(),
  systemId: z.string(),
  label: z.string(),
  status: z.literal('DRAFT'),
  draftState: authoredDraftStateDtoSchema,
  baseActiveUpdatedAt: z.string().nullable()
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

export const authoredDraftDtoSchema = authoredDraftSummaryDtoSchema.extend({
  id: z.string(),
  payload: unknownObjectSchema
})

export const authoredDraftSaveRequestDtoSchema = z.object({
  subjectKind: authoredSubjectKindDtoSchema,
  subjectId: z.string(),
  systemId: z.string(),
  label: z.string(),
  payload: unknownObjectSchema,
  baseActiveUpdatedAt: z.string().nullable()
    .optional()
})

export const authoredDraftActivateRequestDtoSchema = z.object({
  subjectKind: authoredSubjectKindDtoSchema,
  subjectId: z.string()
})

const authoredContentListItemBaseDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: authoredRecordStatusSchema,
  description: z.string().nullable()
    .optional(),
  draft: authoredDraftSummaryDtoSchema.nullable().optional(),
  provenance: authoredContentProvenanceDtoSchema,
  permissions: authoredContentPermissionsDtoSchema
}).merge(ownerContextDtoSchema)

export const backgroundListItemDtoSchema = authoredContentListItemBaseDtoSchema
export const classListItemDtoSchema = authoredContentListItemBaseDtoSchema.extend({
  category: z.string().optional()
})
export const equipmentListItemDtoSchema = authoredContentListItemBaseDtoSchema.extend({
  category: z.string().optional()
})
export const featListItemDtoSchema = authoredContentListItemBaseDtoSchema
export const raceListItemDtoSchema = authoredContentListItemBaseDtoSchema.extend({
  category: z.string().optional()
})
export const spellListItemDtoSchema = authoredContentListItemBaseDtoSchema.extend({
  level: z.number().int()
    .optional(),
  magicSchoolId: z.string().nullable()
    .optional(),
  castingTimeUnit: z.string().optional(),
  castingTimeAmount: z.number().int()
    .optional()
})
export const creatureListItemDtoSchema = authoredContentListItemBaseDtoSchema.extend({
  category: z.string().optional()
})
export const vehicleListItemDtoSchema = authoredContentListItemBaseDtoSchema.extend({
  category: z.string().optional()
})

export const featureListItemDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  order: z.number().int()
})

export const backgroundListResponseDtoSchema = listResponseDtoSchema(backgroundListItemDtoSchema)
export const classListResponseDtoSchema = listResponseDtoSchema(classListItemDtoSchema)
export const equipmentListResponseDtoSchema = listResponseDtoSchema(equipmentListItemDtoSchema)
export const featListResponseDtoSchema = listResponseDtoSchema(featListItemDtoSchema)
export const raceListResponseDtoSchema = listResponseDtoSchema(raceListItemDtoSchema)
export const spellListResponseDtoSchema = listResponseDtoSchema(spellListItemDtoSchema)
export const creatureListResponseDtoSchema = listResponseDtoSchema(creatureListItemDtoSchema)
export const vehicleListResponseDtoSchema = listResponseDtoSchema(vehicleListItemDtoSchema)
export const featureListResponseDtoSchema = listResponseDtoSchema(featureListItemDtoSchema)

export const backgroundResponseDtoSchema = authoredResourceResponseDtoSchema(backgroundAuthoredDtoSchema)
export const classResponseDtoSchema = authoredResourceResponseDtoSchema(classAuthoredDtoSchema)
export const equipmentResponseDtoSchema = authoredResourceResponseDtoSchema(equipmentAuthoredDtoSchema)
export const featResponseDtoSchema = authoredResourceResponseDtoSchema(featAuthoredDtoSchema)
export const raceResponseDtoSchema = authoredResourceResponseDtoSchema(raceAuthoredDtoSchema)
export const spellResponseDtoSchema = authoredResourceResponseDtoSchema(spellAuthoredDtoSchema)
export const creatureResponseDtoSchema = authoredResourceResponseDtoSchema(creatureAuthoredDtoSchema)
export const vehicleResponseDtoSchema = authoredResourceResponseDtoSchema(vehicleAuthoredDtoSchema)
export const featureResponseDtoSchema = singleResourceResponseDtoSchema(featureDtoSchema)

// Named TypeScript types for list item DTOs
export type BackgroundListItemDto = z.infer<typeof backgroundListItemDtoSchema>
export type ClassListItemDto = z.infer<typeof classListItemDtoSchema>
export type EquipmentListItemDto = z.infer<typeof equipmentListItemDtoSchema>
export type FeatListItemDto = z.infer<typeof featListItemDtoSchema>
export type RaceListItemDto = z.infer<typeof raceListItemDtoSchema>
export type SpellListItemDto = z.infer<typeof spellListItemDtoSchema>
export type CreatureListItemDto = z.infer<typeof creatureListItemDtoSchema>
export type VehicleListItemDto = z.infer<typeof vehicleListItemDtoSchema>
export type FeatureListItemDto = z.infer<typeof featureListItemDtoSchema>
export type AuthoredSubjectKindDto = z.infer<typeof authoredSubjectKindDtoSchema>
export type AuthoredDraftStateDto = z.infer<typeof authoredDraftStateDtoSchema>
export type AuthoredDraftSummaryDto = z.infer<typeof authoredDraftSummaryDtoSchema>
export type AuthoredDraftDto = z.infer<typeof authoredDraftDtoSchema>
export type AuthoredDraftSaveRequestDto = z.infer<typeof authoredDraftSaveRequestDtoSchema>
export type AuthoredDraftActivateRequestDto = z.infer<typeof authoredDraftActivateRequestDtoSchema>

// Named TypeScript types for response DTOs
export type BackgroundListResponseDto = z.infer<typeof backgroundListResponseDtoSchema>
export type ClassListResponseDto = z.infer<typeof classListResponseDtoSchema>
export type EquipmentListResponseDto = z.infer<typeof equipmentListResponseDtoSchema>
export type FeatListResponseDto = z.infer<typeof featListResponseDtoSchema>
export type RaceListResponseDto = z.infer<typeof raceListResponseDtoSchema>
export type SpellListResponseDto = z.infer<typeof spellListResponseDtoSchema>
export type CreatureListResponseDto = z.infer<typeof creatureListResponseDtoSchema>
export type VehicleListResponseDto = z.infer<typeof vehicleListResponseDtoSchema>
export type FeatureListResponseDto = z.infer<typeof featureListResponseDtoSchema>

export type BackgroundResponseDto = z.infer<typeof backgroundResponseDtoSchema>
export type ClassResponseDto = z.infer<typeof classResponseDtoSchema>
export type EquipmentResponseDto = z.infer<typeof equipmentResponseDtoSchema>
export type FeatResponseDto = z.infer<typeof featResponseDtoSchema>
export type RaceResponseDto = z.infer<typeof raceResponseDtoSchema>
export type SpellResponseDto = z.infer<typeof spellResponseDtoSchema>
export type CreatureResponseDto = z.infer<typeof creatureResponseDtoSchema>
export type VehicleResponseDto = z.infer<typeof vehicleResponseDtoSchema>
export type FeatureResponseDto = z.infer<typeof featureResponseDtoSchema>
