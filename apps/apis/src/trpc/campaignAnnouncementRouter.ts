import {
  createCampaignAnnouncement,
  getCampaignAnnouncement,
  listCampaignAnnouncements
} from '@artificer-toolkit/functions'
import * as contracts from '@artificer-toolkit/schema/api/campaigns'
import { withExplicitAuthorityDb } from './dbContext.js'
import { authenticatedProcedure, createTRPCRouter } from './procedures.js'
export const campaignAnnouncementRouter = createTRPCRouter({
  list: authenticatedProcedure
    .input(contracts.listCampaignAnnouncementsInputSchema)
    .output(contracts.campaignAnnouncementDtoSchema.array())
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        listCampaignAnnouncements(db, userId, input.campaignId)
      )
    ),
  get: authenticatedProcedure
    .input(contracts.getCampaignAnnouncementInputSchema)
    .output(contracts.campaignAnnouncementDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        getCampaignAnnouncement(db, userId, input.campaignId, input.announcementPublicId)
      )
    ),
  create: authenticatedProcedure
    .input(contracts.createCampaignAnnouncementInputSchema)
    .output(contracts.campaignAnnouncementDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => createCampaignAnnouncement(db, userId, input))
    )
})
