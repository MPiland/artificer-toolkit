import { z } from '../zod.js'
import { campaignContentShareDtoSchema } from '../api/campaignCore.js'
import { uuidSchema } from '../api/campaignContractSchemas.js'

/** A direct root grant, never a copied publication or permission over an entire source. */
export const campaignStoredContentShareSchema = z.extend(
  z.omit(campaignContentShareDtoSchema, { document: true }),
  { campaignId: uuidSchema }
)
