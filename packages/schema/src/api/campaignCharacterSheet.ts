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

/**
 * The public roster basics every Campaign member sees for an assigned Character (ADR 0034 decision 5).
 * sheetVisible tells another player whether the Character's "Party can view" is on.
 */
export const campaignCharacterBasicsDtoSchema = z.strictObject({
  characterId: z.string().check(z.uuid()),
  label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(100)),
  classSummary: z.string(),
  totalLevel: z.number().check(z.int()).check(z.nonnegative()),
  sheetVisible: z.boolean()
})
export type CampaignCharacterBasicsDto = z.infer<typeof campaignCharacterBasicsDtoSchema>
