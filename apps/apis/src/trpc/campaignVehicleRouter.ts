import {
  createCampaignVehicle,
  deleteCampaignVehicle,
  listCampaignVehicles,
  updateCampaignVehicle
} from '@artificer-toolkit/functions'
import * as contracts from '@artificer-toolkit/schema/api/campaigns'
import { withExplicitAuthorityDb } from './dbContext.js'
import { authenticatedProcedure, createTRPCRouter, okResponseSchema } from './procedures.js'

export const campaignVehicleRouter = createTRPCRouter({
  list: authenticatedProcedure
    .input(contracts.listCampaignVehiclesInputSchema)
    .output(contracts.campaignVehiclesDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        listCampaignVehicles(db, userId, input.campaignId)
      )
    ),
  create: authenticatedProcedure
    .input(contracts.createCampaignVehicleInputSchema)
    .output(contracts.campaignVehicleDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => createCampaignVehicle(db, userId, input))
    ),
  update: authenticatedProcedure
    .input(contracts.updateCampaignVehicleInputSchema)
    .output(contracts.campaignVehicleDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => updateCampaignVehicle(db, userId, input))
    ),
  delete: authenticatedProcedure
    .input(contracts.deleteCampaignVehicleInputSchema)
    .output(okResponseSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, async (db, userId) => {
        await deleteCampaignVehicle(db, userId, input)
        return { ok: true as const }
      })
    )
})
