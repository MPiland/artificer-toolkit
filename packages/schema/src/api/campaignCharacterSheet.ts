import { z, lazySchema } from '../zod.js'
import { listCampaignAdjustmentsInputSchema } from './campaignLiveState.js'
import {
  characterSheetExecuteInputSchema,
  characterRestPreviewInputSchema
} from './characterSheetCommands.js'
import { characterSheetPanelInputSchema } from './characterSheetPanel.js'
import { executeRollInputDtoSchema } from './rolls.js'

export const campaignCharacterSheetExecuteInputSchema = lazySchema(() =>
  z.extend(listCampaignAdjustmentsInputSchema, {
    command: characterSheetExecuteInputSchema.shape.command
  })
)
export const campaignCharacterSheetPanelInputSchema = lazySchema(() =>
  z.extend(listCampaignAdjustmentsInputSchema, {
    target: characterSheetPanelInputSchema.shape.target
  })
)
export const campaignCharacterRestPreviewInputSchema = lazySchema(() =>
  z.extend(listCampaignAdjustmentsInputSchema, {
    input: characterRestPreviewInputSchema.shape.input
  })
)
export const campaignCharacterSheetRollInputSchema = lazySchema(() =>
  z.safeExtend(executeRollInputDtoSchema, listCampaignAdjustmentsInputSchema.shape)
)
