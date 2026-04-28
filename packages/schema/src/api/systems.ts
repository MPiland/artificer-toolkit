import { z } from 'zod'

import { singleResourceResponseDtoSchema } from './common.js'
import { systemAuthoredDtoSchema } from '../vocabulary/system.js'

export const systemListItemDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
  userId: z.string()
})

export const systemListResponseDtoSchema = z.array(systemListItemDtoSchema)
export const systemResponseDtoSchema = singleResourceResponseDtoSchema(systemAuthoredDtoSchema)

export type SystemListItemDto = z.infer<typeof systemListItemDtoSchema>
export type SystemListResponseDto = z.infer<typeof systemListResponseDtoSchema>
export type SystemResponseDto = z.infer<typeof systemResponseDtoSchema>
