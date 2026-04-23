import { z } from 'zod'

import {
  backgroundAuthoredDtoSchema,
  classAuthoredDtoSchema,
  equipmentAuthoredDtoSchema,
  featAuthoredDtoSchema,
  raceAuthoredDtoSchema,
  spellAuthoredDtoSchema
} from '../subjects/index.js'
import { featureDtoSchema } from '../features/index.js'
import { listResponseDtoSchema, ownerContextDtoSchema, singleResourceResponseDtoSchema } from './common.js'
import { authoredRecordStatusSchema } from '../shared/enums.js'

const authoredContentListItemBaseDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: authoredRecordStatusSchema,
  description: z.string().nullable()
    .optional()
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
    .optional()
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
export const featureListResponseDtoSchema = listResponseDtoSchema(featureListItemDtoSchema)

export const backgroundResponseDtoSchema = singleResourceResponseDtoSchema(backgroundAuthoredDtoSchema)
export const classResponseDtoSchema = singleResourceResponseDtoSchema(classAuthoredDtoSchema)
export const equipmentResponseDtoSchema = singleResourceResponseDtoSchema(equipmentAuthoredDtoSchema)
export const featResponseDtoSchema = singleResourceResponseDtoSchema(featAuthoredDtoSchema)
export const raceResponseDtoSchema = singleResourceResponseDtoSchema(raceAuthoredDtoSchema)
export const spellResponseDtoSchema = singleResourceResponseDtoSchema(spellAuthoredDtoSchema)
export const featureResponseDtoSchema = singleResourceResponseDtoSchema(featureDtoSchema)

// Named TypeScript types for list item DTOs
export type BackgroundListItemDto = z.infer<typeof backgroundListItemDtoSchema>
export type ClassListItemDto = z.infer<typeof classListItemDtoSchema>
export type EquipmentListItemDto = z.infer<typeof equipmentListItemDtoSchema>
export type FeatListItemDto = z.infer<typeof featListItemDtoSchema>
export type RaceListItemDto = z.infer<typeof raceListItemDtoSchema>
export type SpellListItemDto = z.infer<typeof spellListItemDtoSchema>
export type FeatureListItemDto = z.infer<typeof featureListItemDtoSchema>

// Named TypeScript types for response DTOs
export type BackgroundListResponseDto = z.infer<typeof backgroundListResponseDtoSchema>
export type ClassListResponseDto = z.infer<typeof classListResponseDtoSchema>
export type EquipmentListResponseDto = z.infer<typeof equipmentListResponseDtoSchema>
export type FeatListResponseDto = z.infer<typeof featListResponseDtoSchema>
export type RaceListResponseDto = z.infer<typeof raceListResponseDtoSchema>
export type SpellListResponseDto = z.infer<typeof spellListResponseDtoSchema>
export type FeatureListResponseDto = z.infer<typeof featureListResponseDtoSchema>

export type BackgroundResponseDto = z.infer<typeof backgroundResponseDtoSchema>
export type ClassResponseDto = z.infer<typeof classResponseDtoSchema>
export type EquipmentResponseDto = z.infer<typeof equipmentResponseDtoSchema>
export type FeatResponseDto = z.infer<typeof featResponseDtoSchema>
export type RaceResponseDto = z.infer<typeof raceResponseDtoSchema>
export type SpellResponseDto = z.infer<typeof spellResponseDtoSchema>
export type FeatureResponseDto = z.infer<typeof featureResponseDtoSchema>
