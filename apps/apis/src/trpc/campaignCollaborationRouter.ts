import {
  createCampaignNotebookSection,
  deleteCampaignNotebookSection,
  editCampaignChatEntry,
  executeCampaignRoll,
  executeCampaignPrivateRoll,
  listCampaignChatEntries,
  listCampaignConversations,
  markCampaignConversationRead,
  listCampaignNotebookSections,
  sendCampaignChatEntry,
  unsendCampaignChatEntry,
  updateCampaignNotebookSection
} from '@artificer-toolkit/functions'
import { rollRecordDtoSchema } from '@artificer-toolkit/schema/api/rolls'
import * as campaignContracts from '@artificer-toolkit/schema/api/campaigns'
import { withExplicitAuthorityDb } from './dbContext.js'

import { authenticatedProcedure, createTRPCRouter, okResponseSchema } from './procedures.js'

export const campaignConversationsRouter = createTRPCRouter({
  list: authenticatedProcedure
    .input(campaignContracts.listCampaignConversationsInputSchema)
    .output(campaignContracts.campaignConversationsDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        listCampaignConversations(db, input.campaignId, userId)
      )
    ),
  markRead: authenticatedProcedure
    .input(campaignContracts.markCampaignConversationReadInputSchema)
    .output(okResponseSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => markCampaignConversationRead(db, input, userId))
    )
})

export const campaignChatRouter = createTRPCRouter({
  list: authenticatedProcedure
    .input(campaignContracts.listCampaignChatEntriesInputSchema)
    .output(campaignContracts.campaignChatPageDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => listCampaignChatEntries(db, input, userId))
    ),
  send: authenticatedProcedure
    .input(campaignContracts.sendCampaignChatEntryInputSchema)
    .output(campaignContracts.campaignChatEntryDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => sendCampaignChatEntry(db, input, userId))
    ),
  roll: authenticatedProcedure
    .input(campaignContracts.executeCampaignRollInputSchema)
    .output(campaignContracts.campaignChatEntryDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => executeCampaignRoll(db, input, userId))
    ),
  privateRoll: authenticatedProcedure
    .input(campaignContracts.executeCampaignPrivateRollInputSchema)
    .output(rollRecordDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => executeCampaignPrivateRoll(db, input, userId))
    ),
  edit: authenticatedProcedure
    .input(campaignContracts.editCampaignChatEntryInputSchema)
    .output(campaignContracts.campaignChatEntryDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => editCampaignChatEntry(db, input, userId))
    ),
  unsend: authenticatedProcedure
    .input(campaignContracts.unsendCampaignChatEntryInputSchema)
    .output(campaignContracts.campaignChatEntryDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => unsendCampaignChatEntry(db, input, userId))
    )
})

export const campaignNotebookRouter = createTRPCRouter({
  list: authenticatedProcedure
    .input(campaignContracts.listCampaignNotebookSectionsInputSchema)
    .output(campaignContracts.campaignNotebookSectionsDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => listCampaignNotebookSections(db, input, userId))
    ),
  create: authenticatedProcedure
    .input(campaignContracts.createCampaignNotebookSectionInputSchema)
    .output(campaignContracts.campaignNotebookSectionDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => createCampaignNotebookSection(db, input, userId))
    ),
  update: authenticatedProcedure
    .input(campaignContracts.updateCampaignNotebookSectionInputSchema)
    .output(campaignContracts.campaignNotebookSectionDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => updateCampaignNotebookSection(db, input, userId))
    ),
  delete: authenticatedProcedure
    .input(campaignContracts.deleteCampaignNotebookSectionInputSchema)
    .output(okResponseSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => deleteCampaignNotebookSection(db, input, userId))
    )
})
