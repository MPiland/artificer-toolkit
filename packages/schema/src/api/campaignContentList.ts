import { z } from '../zod.js'
import { campaignContentSharesDtoSchema, type CampaignContentShareDto } from './campaignCore.js'
import { uuidSchema } from './campaignContractSchemas.js'
import {
  campaignListInputSchema,
  campaignListPageSchema,
  type CampaignListPage
} from './campaignList.js'

export const campaignContentListInputSchema = z.extend(campaignListInputSchema, {
  campaignId: uuidSchema
})
export type CampaignContentListPage = Omit<CampaignListPage, 'page'> & {
  page: CampaignContentShareDto[]
}
export const campaignContentListPageSchema: z.ZodMiniType<CampaignContentListPage> = z.extend(
  campaignListPageSchema,
  {
    page: campaignContentSharesDtoSchema
  }
)
export type CampaignContentListInput = z.infer<typeof campaignContentListInputSchema>
