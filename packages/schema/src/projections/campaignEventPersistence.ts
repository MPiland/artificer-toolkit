import { z, lazySchema } from '../zod.js'
import { campaignEventTransportDtoSchema } from '../api/campaignEventTransport.js'
import { uuidSchema } from '../api/campaignContractSchemas.js'
import { projectionChecksumSchema } from './identity.js'

export const campaignStoredEventSchema = lazySchema(() =>
  z
    .extend(campaignEventTransportDtoSchema, {
      actorUserId: z.nullable(uuidSchema),
      visibleInHistory: z.boolean(),
      commandId: z.optional(uuidSchema),
      inputFingerprint: z.optional(projectionChecksumSchema),
      inventoryAudit: z.optional(z.literal(true))
    })
    .check(
      z.refine((event) => event.visibleInHistory === (event.type !== 'CAMPAIGN_COPIED'), {
        message: 'Stored Campaign event history visibility mismatch.'
      })
    )
)
