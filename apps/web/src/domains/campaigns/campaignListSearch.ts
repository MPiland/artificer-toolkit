import { z } from 'zod'

export const campaignListSearchSchema = z.object({
  campaignId: z.guid().optional().catch(undefined)
})
