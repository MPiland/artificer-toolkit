import { z } from '../zod.js'
import { listCampaignAdjustmentsInputSchema } from './campaignLiveState.js'
import {
  characterSheetExecuteInputSchema,
  characterRestPreviewInputSchema
} from './characterSheetCommands.js'
import { characterSheetPanelInputSchema } from './characterSheetPanel.js'
import { executeRollInputDtoSchema } from './rolls.js'

export const campaignCharacterSheetExecuteInputSchema = z.extend(
  listCampaignAdjustmentsInputSchema,
  {
    command: characterSheetExecuteInputSchema.shape.command
  }
)
export const campaignCharacterSheetPanelInputSchema = z.extend(listCampaignAdjustmentsInputSchema, {
  target: characterSheetPanelInputSchema.shape.target
})
export const campaignCharacterRestPreviewInputSchema = z.extend(
  listCampaignAdjustmentsInputSchema,
  {
    input: characterRestPreviewInputSchema.shape.input
  }
)
export const campaignCharacterSheetRollInputSchema = z.safeExtend(
  executeRollInputDtoSchema,
  listCampaignAdjustmentsInputSchema.shape
)
