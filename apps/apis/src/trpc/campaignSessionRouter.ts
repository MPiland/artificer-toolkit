import {
  createCampaignSession,
  createCampaignSessionNoteSection,
  finishCampaignSession,
  getCampaignSession,
  listCampaignSessionAttendance,
  listCampaignSessionReferencePins,
  listCampaignSessionRsvps,
  deleteCampaignSessionNoteSection,
  listCampaignSessionNoteSections,
  listCampaignSessions,
  updateCampaignSession,
  createCampaignSessionReferencePin,
  deleteCampaignSessionReferencePin,
  setCampaignSessionRsvp,
  setCampaignSessionAttendance,
  updateCampaignSessionNoteSection
} from '@artificer-toolkit/functions'
import * as campaignContracts from '@artificer-toolkit/schema/api/campaigns'
import { withExplicitAuthorityDb } from './dbContext.js'

import { authenticatedProcedure, createTRPCRouter, okResponseSchema } from './procedures.js'

export const campaignSessionRouter = createTRPCRouter({
  list: authenticatedProcedure
    .input(campaignContracts.listCampaignSessionsInputSchema)
    .output(campaignContracts.campaignSessionsDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => listCampaignSessions(db, input, userId))
    ),
  create: authenticatedProcedure
    .input(campaignContracts.createCampaignSessionInputSchema)
    .output(campaignContracts.campaignSessionDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => createCampaignSession(db, input, userId))
    ),
  update: authenticatedProcedure
    .input(campaignContracts.updateCampaignSessionInputSchema)
    .output(campaignContracts.campaignSessionDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => updateCampaignSession(db, input, userId))
    ),
  finish: authenticatedProcedure
    .input(campaignContracts.finishCampaignSessionInputSchema)
    .output(campaignContracts.campaignSessionDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => finishCampaignSession(db, input, userId))
    ),
  get: authenticatedProcedure
    .input(campaignContracts.getCampaignSessionInputSchema)
    .output(campaignContracts.campaignSessionDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => getCampaignSession(db, input, userId))
    ),
  attendance: createTRPCRouter({
    list: authenticatedProcedure
      .input(campaignContracts.listCampaignSessionAttendanceInputSchema)
      .output(campaignContracts.campaignSessionAttendanceDtoListSchema)
      .query(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          listCampaignSessionAttendance(db, input, userId)
        )
      ),
    set: authenticatedProcedure
      .input(campaignContracts.setCampaignSessionAttendanceInputSchema)
      .output(campaignContracts.campaignSessionAttendanceDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          setCampaignSessionAttendance(db, input, userId)
        )
      )
  }),
  rsvps: createTRPCRouter({
    list: authenticatedProcedure
      .input(campaignContracts.listCampaignSessionRsvpsInputSchema)
      .output(campaignContracts.campaignSessionRsvpDtoListSchema)
      .query(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => listCampaignSessionRsvps(db, input, userId))
      ),
    set: authenticatedProcedure
      .input(campaignContracts.setCampaignSessionRsvpInputSchema)
      .output(campaignContracts.campaignSessionRsvpDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => setCampaignSessionRsvp(db, input, userId))
      )
  }),
  references: createTRPCRouter({
    list: authenticatedProcedure
      .input(campaignContracts.listCampaignSessionReferencePinsInputSchema)
      .output(campaignContracts.campaignSessionReferencePinsDtoSchema)
      .query(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          listCampaignSessionReferencePins(db, input, userId)
        )
      ),
    create: authenticatedProcedure
      .input(campaignContracts.createCampaignSessionReferencePinInputSchema)
      .output(campaignContracts.campaignSessionReferencePinDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          createCampaignSessionReferencePin(db, input, userId)
        )
      ),
    delete: authenticatedProcedure
      .input(campaignContracts.deleteCampaignSessionReferencePinInputSchema)
      .output(okResponseSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          deleteCampaignSessionReferencePin(db, input, userId)
        )
      )
  }),
  notes: createTRPCRouter({
    list: authenticatedProcedure
      .input(campaignContracts.listCampaignSessionNoteSectionsInputSchema)
      .output(campaignContracts.campaignSessionNoteSectionsDtoSchema)
      .query(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          listCampaignSessionNoteSections(db, input, userId)
        )
      ),
    create: authenticatedProcedure
      .input(campaignContracts.createCampaignSessionNoteSectionInputSchema)
      .output(campaignContracts.campaignSessionNoteSectionDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          createCampaignSessionNoteSection(db, input, userId)
        )
      ),
    update: authenticatedProcedure
      .input(campaignContracts.updateCampaignSessionNoteSectionInputSchema)
      .output(campaignContracts.campaignSessionNoteSectionDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          updateCampaignSessionNoteSection(db, input, userId)
        )
      ),
    delete: authenticatedProcedure
      .input(campaignContracts.deleteCampaignSessionNoteSectionInputSchema)
      .output(okResponseSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          deleteCampaignSessionNoteSection(db, input, userId)
        )
      )
  })
})
