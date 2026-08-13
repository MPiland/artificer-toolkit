import {
  advanceCampaignClock,
  listCampaignAdjustments,
  listCampaignConditions,
  deleteCampaignCondition,
  deleteCampaignAdjustment,
  getCampaignClock,
  listCampaignEvents,
  saveCampaignAdjustment,
  saveCampaignCondition,
  configureCampaignClock,
  initializeCampaignClock,
  pauseCampaignClock,
  reconcileCampaignClock,
  resetCampaignClock,
  rewindCampaignClock,
  startCampaignClock
} from '@artificer-toolkit/functions'
import * as campaignContracts from '@artificer-toolkit/schema/api/campaigns'
import { withExplicitAuthorityDb } from './dbContext.js'

import { authenticatedProcedure, createTRPCRouter, okResponseSchema } from './procedures.js'

export const campaignClockRouter = createTRPCRouter({
  get: authenticatedProcedure
    .input(campaignContracts.campaignIdInputSchema)
    .output(campaignContracts.campaignClockDtoSchema.nullable())
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => getCampaignClock(db, userId, input.campaignId))
    ),
  initialize: authenticatedProcedure
    .input(campaignContracts.initializeCampaignClockInputSchema)
    .output(campaignContracts.campaignClockDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => initializeCampaignClock(db, userId, input))
    ),
  configure: authenticatedProcedure
    .input(campaignContracts.configureCampaignClockInputSchema)
    .output(campaignContracts.campaignClockDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => configureCampaignClock(db, userId, input))
    ),
  start: authenticatedProcedure
    .input(campaignContracts.startCampaignClockInputSchema)
    .output(campaignContracts.campaignClockDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => startCampaignClock(db, userId, input))
    ),
  pause: authenticatedProcedure
    .input(campaignContracts.pauseCampaignClockInputSchema)
    .output(campaignContracts.campaignClockDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => pauseCampaignClock(db, userId, input))
    ),
  advance: authenticatedProcedure
    .input(campaignContracts.advanceCampaignClockInputSchema)
    .output(campaignContracts.campaignClockDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => advanceCampaignClock(db, userId, input))
    ),
  rewind: authenticatedProcedure
    .input(campaignContracts.rewindCampaignClockInputSchema)
    .output(campaignContracts.campaignClockDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => rewindCampaignClock(db, userId, input))
    ),
  reset: authenticatedProcedure
    .input(campaignContracts.resetCampaignClockInputSchema)
    .output(campaignContracts.campaignClockDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => resetCampaignClock(db, userId, input))
    ),
  reconcile: authenticatedProcedure
    .input(campaignContracts.reconcileCampaignClockInputSchema)
    .output(campaignContracts.campaignClockDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => reconcileCampaignClock(db, userId, input))
    )
})

export const campaignGmRouter = createTRPCRouter({
  adjustments: createTRPCRouter({
    list: authenticatedProcedure
      .input(campaignContracts.listCampaignAdjustmentsInputSchema)
      .output(campaignContracts.campaignAdjustmentsDtoSchema)
      .query(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => listCampaignAdjustments(db, userId, input))
      ),
    save: authenticatedProcedure
      .input(campaignContracts.campaignAdjustmentInputSchema)
      .output(campaignContracts.campaignAdjustmentDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => saveCampaignAdjustment(db, userId, input))
      ),
    delete: authenticatedProcedure
      .input(campaignContracts.deleteCampaignAdjustmentInputSchema)
      .output(okResponseSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, async (db, userId) => {
          await deleteCampaignAdjustment(db, userId, input)
          return { ok: true as const }
        })
      )
  }),
  conditions: createTRPCRouter({
    list: authenticatedProcedure
      .input(campaignContracts.listCampaignAdjustmentsInputSchema)
      .output(campaignContracts.campaignConditionsDtoSchema)
      .query(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => listCampaignConditions(db, userId, input))
      ),
    save: authenticatedProcedure
      .input(campaignContracts.saveCampaignConditionInputSchema)
      .output(campaignContracts.campaignConditionDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => saveCampaignCondition(db, userId, input))
      ),
    delete: authenticatedProcedure
      .input(campaignContracts.deleteCampaignConditionInputSchema)
      .output(okResponseSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, async (db, userId) => {
          await deleteCampaignCondition(db, userId, input)
          return { ok: true as const }
        })
      )
  }),
  events: authenticatedProcedure
    .input(campaignContracts.listCampaignEventsInputSchema)
    .output(campaignContracts.campaignEventPageDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => listCampaignEvents(db, userId, input))
    )
})
