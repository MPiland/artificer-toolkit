import {
  createCampaignAttachment,
  deleteCampaignAttachment,
  getCampaignAttachmentDelivery,
  listCampaignAttachments
} from '@artificer-toolkit/functions'
import * as contracts from '@artificer-toolkit/schema/api/campaigns'
import { signedCampaignFileDeliveryDtoSchema } from '@artificer-toolkit/schema/api/media'
import { withExplicitAuthorityDb } from './dbContext.js'
import { authenticatedProcedure, createTRPCRouter, okResponseSchema } from './procedures.js'
export const campaignAttachmentRouter = createTRPCRouter({
  list: authenticatedProcedure
    .input(contracts.listCampaignAttachmentsInputSchema)
    .output(contracts.campaignAttachmentsDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        listCampaignAttachments(db, userId, input.campaignId)
      )
    ),
  create: authenticatedProcedure
    .input(contracts.createCampaignAttachmentInputSchema)
    .output(contracts.campaignAttachmentDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => createCampaignAttachment(db, userId, input))
    ),
  delivery: authenticatedProcedure
    .input(contracts.getCampaignAttachmentDeliveryInputSchema)
    .output(signedCampaignFileDeliveryDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        getCampaignAttachmentDelivery(db, userId, input.campaignId, input.attachmentId)
      )
    ),
  delete: authenticatedProcedure
    .input(contracts.deleteCampaignAttachmentInputSchema)
    .output(okResponseSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, async (db, userId) => {
        await deleteCampaignAttachment(db, userId, input.campaignId, input.attachmentId)
        return { ok: true as const }
      })
    )
})
