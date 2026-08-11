import {
  acceptSocialEligibility,
  closeSocialListing,
  createSocialBlock,
  createSocialListing,
  createSocialReport,
  deleteSocialListingDraft,
  decideSocialApplication,
  getSocialEligibility,
  getSocialListing,
  getOwnedSocialListing,
  getSocialProfile,
  listOwnedSocialListings,
  listOwnSocialApplications,
  listSocialApplicationsForListing,
  listSocialBlocks,
  listSocialModerationQueue,
  openSocialListing,
  openSocialModerationReport,
  removeSocialBlock,
  searchSocialListings,
  submitSocialApplication,
  takeSocialModerationAction,
  updateSocialListing,
  updateSocialContentPreference,
  withdrawSocialApplication
} from '@artificer-toolkit/functions'
import * as socialContracts from '@artificer-toolkit/schema/api/socialHub'
import { withExplicitAuthorityDb } from './dbContext.js'
import { authenticatedProcedure, createTRPCRouter, okResponseSchema } from './procedures.js'

export const socialHubRouter = createTRPCRouter({
  eligibility: createTRPCRouter({
    get: authenticatedProcedure
      .output(socialContracts.socialEligibilityDtoSchema)
      .query(({ ctx }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => getSocialEligibility(db, userId))
      ),
    accept: authenticatedProcedure
      .input(socialContracts.acceptSocialEligibilityInputSchema)
      .output(socialContracts.socialEligibilityDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => acceptSocialEligibility(db, userId, input))
      )
  }),
  preferences: createTRPCRouter({
    update: authenticatedProcedure
      .input(socialContracts.updateSocialContentPreferenceInputSchema)
      .output(socialContracts.socialEligibilityDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          updateSocialContentPreference(db, userId, input)
        )
      )
  }),
  profiles: createTRPCRouter({
    get: authenticatedProcedure
      .input(socialContracts.socialProfilePublicIdInputSchema)
      .output(socialContracts.socialProfileDtoSchema)
      .query(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          getSocialProfile(db, userId, input.profilePublicId)
        )
      )
  }),
  discovery: createTRPCRouter({
    search: authenticatedProcedure
      .input(socialContracts.socialDiscoveryInputSchema)
      .output(socialContracts.socialDiscoveryPageDtoSchema)
      .query(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => searchSocialListings(db, userId, input))
      )
  }),
  listings: createTRPCRouter({
    get: authenticatedProcedure
      .input(socialContracts.socialListingPublicIdInputSchema)
      .output(socialContracts.socialListingDtoSchema)
      .query(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          getSocialListing(db, userId, input.listingPublicId)
        )
      ),
    getOwned: authenticatedProcedure
      .input(socialContracts.socialListingPublicIdInputSchema)
      .output(socialContracts.socialListingDtoSchema)
      .query(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          getOwnedSocialListing(db, userId, input.listingPublicId)
        )
      ),
    mine: authenticatedProcedure
      .output(socialContracts.socialListingDtoSchema.array())
      .query(({ ctx }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => listOwnedSocialListings(db, userId))
      ),
    create: authenticatedProcedure
      .input(socialContracts.createSocialListingInputSchema)
      .output(socialContracts.socialListingDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => createSocialListing(db, userId, input))
      ),
    update: authenticatedProcedure
      .input(socialContracts.updateSocialListingInputSchema)
      .output(socialContracts.socialListingDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => updateSocialListing(db, userId, input))
      ),
    open: authenticatedProcedure
      .input(socialContracts.socialListingVersionInputSchema)
      .output(socialContracts.socialListingDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          openSocialListing(db, userId, input.listingPublicId, input.expectedVersion)
        )
      ),
    close: authenticatedProcedure
      .input(socialContracts.socialListingVersionInputSchema)
      .output(socialContracts.socialListingDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          closeSocialListing(db, userId, input.listingPublicId, input.expectedVersion)
        )
      ),
    deleteDraft: authenticatedProcedure
      .input(socialContracts.socialListingVersionInputSchema)
      .output(okResponseSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, async (db, userId) => {
          await deleteSocialListingDraft(db, userId, input.listingPublicId, input.expectedVersion)
          return { ok: true as const }
        })
      )
  }),
  applications: createTRPCRouter({
    mine: authenticatedProcedure
      .output(socialContracts.socialApplicationDtoSchema.array())
      .query(({ ctx }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => listOwnSocialApplications(db, userId))
      ),
    forListing: authenticatedProcedure
      .input(socialContracts.socialListingPublicIdInputSchema)
      .output(socialContracts.socialApplicationDtoSchema.array())
      .query(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          listSocialApplicationsForListing(db, userId, input.listingPublicId)
        )
      ),
    submit: authenticatedProcedure
      .input(socialContracts.submitSocialApplicationInputSchema)
      .output(socialContracts.socialApplicationDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => submitSocialApplication(db, userId, input))
      ),
    withdraw: authenticatedProcedure
      .input(socialContracts.socialApplicationVersionInputSchema)
      .output(socialContracts.socialApplicationDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          withdrawSocialApplication(db, userId, input.applicationPublicId, input.expectedVersion)
        )
      ),
    decide: authenticatedProcedure
      .input(socialContracts.decideSocialApplicationInputSchema)
      .output(socialContracts.socialApplicationDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => decideSocialApplication(db, userId, input))
      )
  }),
  blocks: createTRPCRouter({
    list: authenticatedProcedure
      .output(socialContracts.socialBlockDtoSchema.array())
      .query(({ ctx }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => listSocialBlocks(db, userId))
      ),
    create: authenticatedProcedure
      .input(socialContracts.socialBlockInputSchema)
      .output(socialContracts.socialBlockDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          createSocialBlock(db, userId, input.profilePublicId)
        )
      ),
    remove: authenticatedProcedure
      .input(socialContracts.socialBlockInputSchema)
      .output(okResponseSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, async (db, userId) => {
          await removeSocialBlock(db, userId, input.profilePublicId)
          return { ok: true as const }
        })
      )
  }),
  reports: createTRPCRouter({
    create: authenticatedProcedure
      .input(socialContracts.createSocialReportInputSchema)
      .output(socialContracts.socialReportReceiptDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => createSocialReport(db, userId, input))
      )
  }),
  moderation: createTRPCRouter({
    queue: authenticatedProcedure
      .output(socialContracts.socialModerationQueueItemDtoSchema.array())
      .query(({ ctx }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          listSocialModerationQueue(db, userId, ctx.isSuperAdmin === true)
        )
      ),
    openReport: authenticatedProcedure
      .input(socialContracts.socialReportPublicIdInputSchema)
      .output(socialContracts.socialModerationReportDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          openSocialModerationReport(db, userId, ctx.isSuperAdmin === true, input.reportPublicId)
        )
      ),
    takeAction: authenticatedProcedure
      .input(socialContracts.takeSocialModerationActionInputSchema)
      .output(socialContracts.socialModerationReportDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          takeSocialModerationAction(db, userId, ctx.isSuperAdmin === true, input)
        )
      )
  })
})
