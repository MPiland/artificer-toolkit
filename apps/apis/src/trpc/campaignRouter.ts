import {
  acceptCampaignInvite,
  acceptCampaignOwnershipTransfer,
  archiveCampaign,
  assignCampaignCharacter,
  copyCampaign,
  createCampaign,
  createCampaignInvite,
  declineCampaignInvite,
  deleteCampaign,
  getCampaign,
  getCampaignSettings,
  listCampaignContentVersions,
  leaveCampaign,
  listSentCampaignInvites,
  listReceivedCampaignInvites,
  listCampaigns,
  removeCampaignMember,
  requestCampaignOwnershipTransfer,
  revokeCampaignInvite,
  submitCampaignContentVersion,
  unassignCampaignCharacter,
  reviewCampaignContentVersion,
  updateCampaign
} from '@artificer-toolkit/functions'
import * as campaignContracts from '@artificer-toolkit/schema/api/campaigns'
import { withExplicitAuthorityDb } from './dbContext.js'

import { authenticatedProcedure, createTRPCRouter, okResponseSchema } from './procedures.js'

import {
  campaignConversationsRouter,
  campaignChatRouter,
  campaignNotebookRouter
} from './campaignCollaborationRouter.js'
import { campaignSessionRouter } from './campaignSessionRouter.js'
import { campaignInventoryRouter } from './campaignInventoryRouter.js'
import { campaignClockRouter, campaignGmRouter } from './campaignPlayRouter.js'

export const campaignRouter = createTRPCRouter({
  list: authenticatedProcedure
    .output(campaignContracts.campaignSummariesDtoSchema)
    .query(({ ctx }) => withExplicitAuthorityDb(ctx, (db, userId) => listCampaigns(db, userId))),
  get: authenticatedProcedure
    .input(campaignContracts.campaignIdInputSchema)
    .output(campaignContracts.campaignDetailDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => getCampaign(db, userId, input.campaignId))
    ),
  getSettings: authenticatedProcedure
    .input(campaignContracts.campaignIdInputSchema)
    .output(campaignContracts.campaignDetailDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        getCampaignSettings(db, userId, input.campaignId)
      )
    ),
  create: authenticatedProcedure
    .input(campaignContracts.createCampaignInputSchema)
    .output(campaignContracts.campaignDetailDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => createCampaign(db, userId, input))
    ),
  copy: authenticatedProcedure
    .input(campaignContracts.copyCampaignInputSchema)
    .output(campaignContracts.campaignDetailDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => copyCampaign(db, userId, input))
    ),
  update: authenticatedProcedure
    .input(campaignContracts.updateCampaignInputSchema)
    .output(campaignContracts.campaignDetailDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => updateCampaign(db, userId, input))
    ),
  archive: authenticatedProcedure
    .input(campaignContracts.archiveCampaignInputSchema)
    .output(campaignContracts.campaignDetailDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        archiveCampaign(db, userId, input.campaignId, input.expectedVersion)
      )
    ),
  delete: authenticatedProcedure
    .input(campaignContracts.deleteCampaignInputSchema)
    .output(okResponseSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, async (db, userId) => {
        await deleteCampaign(db, userId, input.campaignId, input.expectedVersion)
        return { ok: true as const }
      })
    ),
  invites: createTRPCRouter({
    create: authenticatedProcedure
      .input(campaignContracts.createCampaignInviteInputSchema)
      .output(campaignContracts.campaignInviteDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => createCampaignInvite(db, userId, input))
      ),
    listReceived: authenticatedProcedure
      .output(campaignContracts.campaignInviteDtoSchema.array())
      .query(({ ctx }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => listReceivedCampaignInvites(db, userId))
      ),
    listSent: authenticatedProcedure
      .input(campaignContracts.listSentCampaignInvitesInputSchema)
      .output(campaignContracts.campaignInviteDtoSchema.array())
      .query(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          listSentCampaignInvites(db, userId, input.listingPublicId)
        )
      ),
    revoke: authenticatedProcedure
      .input(campaignContracts.revokeCampaignInviteInputSchema)
      .output(okResponseSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, async (db, userId) => {
          await revokeCampaignInvite(db, userId, input.invitePublicId, input.expectedVersion)
          return { ok: true as const }
        })
      ),
    accept: authenticatedProcedure
      .input(campaignContracts.acceptCampaignInviteInputSchema)
      .output(campaignContracts.campaignDetailDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          acceptCampaignInvite(db, userId, input.invitePublicId, input.expectedVersion)
        )
      ),
    decline: authenticatedProcedure
      .input(campaignContracts.declineCampaignInviteInputSchema)
      .output(campaignContracts.campaignInviteDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          declineCampaignInvite(db, userId, input.invitePublicId, input.expectedVersion)
        )
      )
  }),
  leave: authenticatedProcedure
    .input(campaignContracts.leaveCampaignInputSchema)
    .output(okResponseSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, async (db, userId) => {
        await leaveCampaign(db, userId, input.campaignId)
        return { ok: true as const }
      })
    ),
  removeMember: authenticatedProcedure
    .input(campaignContracts.removeCampaignMemberInputSchema)
    .output(okResponseSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, async (db, userId) => {
        await removeCampaignMember(db, userId, input.campaignId, input.userId)
        return { ok: true as const }
      })
    ),
  assignCharacter: authenticatedProcedure
    .input(campaignContracts.assignCampaignCharacterInputSchema)
    .output(okResponseSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, async (db, userId) => {
        await assignCampaignCharacter(db, userId, input.campaignId, input.characterId)
        return { ok: true as const }
      })
    ),
  unassignCharacter: authenticatedProcedure
    .input(campaignContracts.unassignCampaignCharacterInputSchema)
    .output(okResponseSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, async (db, userId) => {
        await unassignCampaignCharacter(db, userId, input.campaignId, input.characterId)
        return { ok: true as const }
      })
    ),
  ownership: createTRPCRouter({
    request: authenticatedProcedure
      .input(campaignContracts.requestCampaignOwnershipTransferInputSchema)
      .output(okResponseSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, async (db, userId) => {
          await requestCampaignOwnershipTransfer(
            db,
            userId,
            input.campaignId,
            input.recipientUserId
          )
          return { ok: true as const }
        })
      ),
    accept: authenticatedProcedure
      .input(campaignContracts.acceptCampaignOwnershipTransferInputSchema)
      .output(campaignContracts.campaignDetailDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          acceptCampaignOwnershipTransfer(db, userId, input.campaignId)
        )
      )
  }),
  content: createTRPCRouter({
    list: authenticatedProcedure
      .input(campaignContracts.campaignIdInputSchema)
      .output(campaignContracts.campaignContentBindingsDtoSchema)
      .query(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          listCampaignContentVersions(db, userId, input.campaignId)
        )
      ),
    submit: authenticatedProcedure
      .input(campaignContracts.submitCampaignContentVersionInputSchema)
      .output(campaignContracts.campaignContentBindingDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          submitCampaignContentVersion(db, userId, input)
        )
      ),
    review: authenticatedProcedure
      .input(campaignContracts.reviewCampaignContentVersionInputSchema)
      .output(campaignContracts.campaignContentBindingDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          reviewCampaignContentVersion(db, userId, input)
        )
      )
  }),
  conversations: campaignConversationsRouter,
  chat: campaignChatRouter,
  notebook: campaignNotebookRouter,
  sessions: campaignSessionRouter,
  inventory: campaignInventoryRouter,
  clock: campaignClockRouter,
  gm: campaignGmRouter
})
