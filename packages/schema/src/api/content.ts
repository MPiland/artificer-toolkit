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
