import { z, lazySchema } from '../zod.js'
import {
  campaignAdjustmentDtoSchema,
  campaignConditionDtoSchema
} from '../api/campaignLiveState.js'
import { uuidSchema } from '../api/campaignContractSchemas.js'

export const campaignCharacterStateSchema = lazySchema(() =>
  z.strictObject({
    adjustments: z.array(z.extend(campaignAdjustmentDtoSchema, { createdBy: uuidSchema })),
    conditions: z.array(z.extend(campaignConditionDtoSchema, { createdBy: uuidSchema }))
  })
)
export type CampaignCharacterState = z.infer<typeof campaignCharacterStateSchema>
