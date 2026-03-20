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

const authoredContentListItemBaseDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().nullable().optional()
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
  level: z.number().int().optional()
})

export const featureListItemDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  order: z.number().int()
})

export const backgroundListResponseDtoSchema: z.ZodTypeAny = listResponseDtoSchema(backgroundListItemDtoSchema)
export const classListResponseDtoSchema: z.ZodTypeAny = listResponseDtoSchema(classListItemDtoSchema)
export const equipmentListResponseDtoSchema: z.ZodTypeAny = listResponseDtoSchema(equipmentListItemDtoSchema)
export const featListResponseDtoSchema: z.ZodTypeAny = listResponseDtoSchema(featListItemDtoSchema)
export const raceListResponseDtoSchema: z.ZodTypeAny = listResponseDtoSchema(raceListItemDtoSchema)
export const spellListResponseDtoSchema: z.ZodTypeAny = listResponseDtoSchema(spellListItemDtoSchema)
export const featureListResponseDtoSchema: z.ZodTypeAny = listResponseDtoSchema(featureListItemDtoSchema)

export const backgroundResponseDtoSchema: z.ZodTypeAny = singleResourceResponseDtoSchema(backgroundAuthoredDtoSchema)
export const classResponseDtoSchema: z.ZodTypeAny = singleResourceResponseDtoSchema(classAuthoredDtoSchema)
export const equipmentResponseDtoSchema: z.ZodTypeAny = singleResourceResponseDtoSchema(equipmentAuthoredDtoSchema)
export const featResponseDtoSchema: z.ZodTypeAny = singleResourceResponseDtoSchema(featAuthoredDtoSchema)
export const raceResponseDtoSchema: z.ZodTypeAny = singleResourceResponseDtoSchema(raceAuthoredDtoSchema)
export const spellResponseDtoSchema: z.ZodTypeAny = singleResourceResponseDtoSchema(spellAuthoredDtoSchema)
export const featureResponseDtoSchema: z.ZodTypeAny = singleResourceResponseDtoSchema(featureDtoSchema)
