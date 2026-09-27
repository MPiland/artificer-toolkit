import { z, lazySchema } from '../zod.js'
import { campaignListInputSchema, campaignListPageSchema } from './campaignList.js'
import {
  encounterBlueprintDtoSchema,
  getEncounterBlueprintsInputDtoSchema
} from './encounterData.js'

export const encounterBlueprintListInputSchema = lazySchema(() =>
  z.extend(getEncounterBlueprintsInputDtoSchema, campaignListInputSchema.shape)
)
export const encounterBlueprintPageSchema = lazySchema(() =>
  z.extend(campaignListPageSchema, {
    page: z.array(encounterBlueprintDtoSchema)
  })
)

export type EncounterBlueprintListInput = z.infer<typeof encounterBlueprintListInputSchema>
export type EncounterBlueprintPage = z.infer<typeof encounterBlueprintPageSchema>
