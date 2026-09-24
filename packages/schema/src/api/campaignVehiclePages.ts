import { z } from '../zod.js'
import { campaignListInputSchema, campaignListPageSchema } from './campaignList.js'
import { campaignVehicleDtoSchema, listCampaignVehiclesInputSchema } from './campaignVehicles.js'

export const campaignVehicleListInputSchema = z.extend(
  campaignListInputSchema,
  listCampaignVehiclesInputSchema.shape
)
export const campaignVehiclePageSchema = z.extend(campaignListPageSchema, {
  page: z.array(campaignVehicleDtoSchema).check(z.maxLength(48))
})
export type CampaignVehicleListInput = z.infer<typeof campaignVehicleListInputSchema>
export type CampaignVehiclePage = z.infer<typeof campaignVehiclePageSchema>
