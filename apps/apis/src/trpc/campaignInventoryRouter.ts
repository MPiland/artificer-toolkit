import { z } from 'zod'
import {
  deleteCampaignCurrencySystem,
  getCampaignInventory,
  listCampaignInventoryAudit,
  mutateCampaignPartyInventory,
  listCampaignCurrencySystems,
  saveCampaignCurrencySystem,
  transferCampaignInventory
} from '@artificer-toolkit/functions'
import * as campaignContracts from '@artificer-toolkit/schema/api/campaigns'
import { withExplicitAuthorityDb } from './dbContext.js'

import { authenticatedProcedure, createTRPCRouter, okResponseSchema } from './procedures.js'

export const campaignInventoryRouter = createTRPCRouter({
  currencySystems: authenticatedProcedure
    .input(campaignContracts.campaignIdInputSchema)
    .output(z.array(campaignContracts.currencySystemDtoSchema))
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        listCampaignCurrencySystems(db, userId, input.campaignId)
      )
    ),
  get: authenticatedProcedure
    .input(campaignContracts.getCampaignInventoryInputSchema)
    .output(campaignContracts.inventoryDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        getCampaignInventory(db, userId, input.campaignId, input.owner)
      )
    ),
  transfer: authenticatedProcedure
    .input(campaignContracts.transferCampaignInventoryInputSchema)
    .output(campaignContracts.campaignInventoryTransferResultDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => transferCampaignInventory(db, userId, input))
    ),
  mutateParty: authenticatedProcedure
    .input(campaignContracts.campaignPartyInventoryMutationInputSchema)
    .output(campaignContracts.campaignPartyInventoryMutationResultDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => mutateCampaignPartyInventory(db, userId, input))
    ),
  audit: authenticatedProcedure
    .input(campaignContracts.listCampaignInventoryAuditInputSchema)
    .output(campaignContracts.campaignInventoryAuditPageDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => listCampaignInventoryAudit(db, userId, input))
    ),
  saveCurrencySystem: authenticatedProcedure
    .input(campaignContracts.saveCampaignCurrencySystemInputSchema)
    .output(campaignContracts.currencySystemDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => saveCampaignCurrencySystem(db, userId, input))
    ),
  deleteCurrencySystem: authenticatedProcedure
    .input(campaignContracts.deleteCampaignCurrencySystemInputSchema)
    .output(okResponseSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, async (db, userId) => {
        await deleteCampaignCurrencySystem(db, userId, input)
        return { ok: true as const }
      })
    )
})
