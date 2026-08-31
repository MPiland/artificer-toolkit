import { z } from 'zod'

import { singleResourceResponseDtoSchema } from './common.js'
import { systemAuthoredDtoSchema } from '../vocabulary/system.js'

export const rulesCatalogueListItemDtoSchema = z.strictObject({
  id: z.string().uuid(),
  label: z.string().trim().min(1),
  description: z.string().nullable()
})

export const systemListItemDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
  rulesetCode: z.string(),
  rulesetVersion: z.string(),
  userId: z.string(),
  rulesCatalogues: z.array(rulesCatalogueListItemDtoSchema)
})

export const systemListResponseDtoSchema = z.array(systemListItemDtoSchema)
export const systemResponseDtoSchema = singleResourceResponseDtoSchema(systemAuthoredDtoSchema)

export type SystemListItemDto = z.infer<typeof systemListItemDtoSchema>
export type RulesCatalogueListItemDto = z.infer<typeof rulesCatalogueListItemDtoSchema>
export type SystemListResponseDto = z.infer<typeof systemListResponseDtoSchema>
export type SystemResponseDto = z.infer<typeof systemResponseDtoSchema>
