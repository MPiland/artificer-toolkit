import { z } from '../zod.js'

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
  notes: z.optional(z.string().check(z.trim()).check(z.maxLength(2000)))
})
export const campaignConditionDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  characterId: uuidSchema,
  conditionTypeId: uuidSchema,
  notes: z.optional(z.string().check(z.trim()).check(z.maxLength(2000))),
  visibility: campaignAdjustmentVisibilityDtoSchema,
  version: versionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export const saveCampaignConditionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema,
  conditionTypeId: uuidSchema,
  notes: z.optional(z.string().check(z.trim()).check(z.maxLength(2000))),
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
  type: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80)),
  visibility: campaignEventVisibilityDtoSchema,
  subjectCharacterId: z.nullable(uuidSchema),
  payload: jsonSchema,
  createdAt: timestampSchema
})
export const listCampaignEventsInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema,
  cursor: z.optional(uuidSchema),
  limit: z._default(z.number().check(z.int()).check(z.gte(1)).check(z.lte(100)), 50)
})
export const campaignEventPageDtoSchema = z.strictObject({
  events: z.array(campaignEventDtoSchema),
  nextCursor: z.nullable(uuidSchema)
})

export type CampaignAdjustmentInput = z.input<typeof campaignAdjustmentInputSchema>
export type CampaignAdjustmentDto = z.infer<typeof campaignAdjustmentDtoSchema>
export type CampaignConditionDto = z.infer<typeof campaignConditionDtoSchema>
export type SaveCampaignConditionInput = z.input<typeof saveCampaignConditionInputSchema>
export type DeleteCampaignConditionInput = z.input<typeof deleteCampaignConditionInputSchema>
export type CampaignEventDto = z.infer<typeof campaignEventDtoSchema>
export type CampaignEventPageDto = z.infer<typeof campaignEventPageDtoSchema>
