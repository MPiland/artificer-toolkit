import {
  getCampaignPlaySettings,
  getCampaignPlaySettingsOptions,
  saveCampaignPlaySettings
} from '@artificer-toolkit/functions'
import * as campaignContracts from '@artificer-toolkit/schema/api/campaigns'
import { withExplicitAuthorityDb } from './dbContext.js'
import { authenticatedProcedure, createTRPCRouter } from './procedures.js'

export const campaignPlaySettingsRouter = createTRPCRouter({
  get: authenticatedProcedure
    .input(campaignContracts.getCampaignPlaySettingsInputSchema)
    .output(campaignContracts.campaignPlaySettingsDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        getCampaignPlaySettings(db, userId, input.campaignId)
      )
    ),
  options: authenticatedProcedure
    .input(campaignContracts.getCampaignPlaySettingsInputSchema)
    .output(campaignContracts.campaignPlaySettingsOptionsDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        getCampaignPlaySettingsOptions(db, userId, input.campaignId)
      )
    ),
  save: authenticatedProcedure
    .input(campaignContracts.saveCampaignPlaySettingsInputSchema)
    .output(campaignContracts.campaignPlaySettingsDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => saveCampaignPlaySettings(db, userId, input))
    )
})
