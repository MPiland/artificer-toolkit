import { z } from '../zod.js'
import { campaignListInputSchema, campaignListPageSchema } from './campaignList.js'
import {
  encounterBlueprintDtoSchema,
  getEncounterBlueprintsInputDtoSchema
} from './encounterData.js'

export const encounterBlueprintListInputSchema = z.extend(
  getEncounterBlueprintsInputDtoSchema,
  campaignListInputSchema.shape
)
export const encounterBlueprintPageSchema = z.extend(campaignListPageSchema, {
  page: z.array(encounterBlueprintDtoSchema)
})

export type EncounterBlueprintListInput = z.infer<typeof encounterBlueprintListInputSchema>
export type EncounterBlueprintPage = z.infer<typeof encounterBlueprintPageSchema>
