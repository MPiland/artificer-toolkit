import { z } from 'zod'

import { characterSheetAdjustmentCommandDtoSchema } from './characterSheet.js'
import {
  jsonSchema,
  timestampSchema,
  uuidSchema,
  versionSchema
} from './campaignContractSchemas.js'

export const campaignAdjustmentVisibilityDtoSchema = z.enum(['VISIBLE', 'SECRET'])
export const campaignAdjustmentDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  characterId: uuidSchema,
  adjustment: characterSheetAdjustmentCommandDtoSchema,
  visibility: campaignAdjustmentVisibilityDtoSchema,
  version: versionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export const campaignAdjustmentInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema,
  adjustment: characterSheetAdjustmentCommandDtoSchema,
  visibility: campaignAdjustmentVisibilityDtoSchema,
  expectedVersion: versionSchema
})
export const deleteCampaignAdjustmentInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema,
  adjustmentId: uuidSchema,
  expectedVersion: versionSchema
})
export const listCampaignAdjustmentsInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema
})
export const campaignAdjustmentsDtoSchema = z.array(campaignAdjustmentDtoSchema)
export const campaignConditionValueDtoSchema = z.strictObject({
  conditionTypeId: uuidSchema,
  notes: z.string().trim().max(2000).optional()
})
export const campaignConditionDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  characterId: uuidSchema,
  conditionTypeId: uuidSchema,
  notes: z.string().trim().max(2000).optional(),
  visibility: campaignAdjustmentVisibilityDtoSchema,
  version: versionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export const saveCampaignConditionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema,
  conditionTypeId: uuidSchema,
  notes: z.string().trim().max(2000).optional(),
  visibility: campaignAdjustmentVisibilityDtoSchema,
  expectedVersion: versionSchema
})
export const deleteCampaignConditionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema,
  conditionId: uuidSchema,
  expectedVersion: versionSchema
})
export const campaignConditionsDtoSchema = z.array(campaignConditionDtoSchema)
export const campaignEventVisibilityDtoSchema = z.enum(['TABLE', 'OWNER', 'SUBJECT'])
export const campaignEventDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  type: z.string().trim().min(1).max(80),
  visibility: campaignEventVisibilityDtoSchema,
  subjectCharacterId: uuidSchema.nullable(),
  payload: jsonSchema,
  createdAt: timestampSchema
})
export const listCampaignEventsInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema,
  cursor: uuidSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50)
})
export const campaignEventPageDtoSchema = z.strictObject({
  events: z.array(campaignEventDtoSchema),
  nextCursor: uuidSchema.nullable()
})

export type CampaignAdjustmentInput = z.input<typeof campaignAdjustmentInputSchema>
export type CampaignAdjustmentDto = z.infer<typeof campaignAdjustmentDtoSchema>
export type CampaignConditionDto = z.infer<typeof campaignConditionDtoSchema>
export type SaveCampaignConditionInput = z.input<typeof saveCampaignConditionInputSchema>
export type DeleteCampaignConditionInput = z.input<typeof deleteCampaignConditionInputSchema>
export type CampaignEventDto = z.infer<typeof campaignEventDtoSchema>
export type CampaignEventPageDto = z.infer<typeof campaignEventPageDtoSchema>
