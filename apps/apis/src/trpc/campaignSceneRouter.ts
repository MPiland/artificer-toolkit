import {
  createCampaignSceneDefinition,
  deleteCampaignSceneDefinition,
  getCampaignSceneDefinition,
  listCampaignLiveScenes,
  listCampaignSceneDefinitions,
  updateCampaignSceneDefinition
} from '@artificer-toolkit/functions'
import {
  campaignLiveSceneSummaryDtoSchema,
  createSceneDefinitionInputDtoSchema,
  deleteSceneDefinitionInputDtoSchema,
  getCampaignSceneDefinitionsInputDtoSchema,
  getSceneDefinitionInputDtoSchema,
  listCampaignLiveScenesInputDtoSchema,
  sceneDefinitionDtoSchema,
  updateSceneDefinitionInputDtoSchema
} from '@artificer-toolkit/schema/api/vttScenes'

import { withExplicitAuthorityDb } from './dbContext.js'
import { authenticatedProcedure, createTRPCRouter, okResponseSchema } from './procedures.js'

export const campaignSceneRouter = createTRPCRouter({
  create: authenticatedProcedure
    .input(createSceneDefinitionInputDtoSchema)
    .output(sceneDefinitionDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => createCampaignSceneDefinition(db, userId, input))
    ),
  delete: authenticatedProcedure
    .input(deleteSceneDefinitionInputDtoSchema)
    .output(okResponseSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, async (db, userId) => {
        await deleteCampaignSceneDefinition(db, userId, input)
        return { ok: true as const }
      })
    ),
  get: authenticatedProcedure
    .input(getSceneDefinitionInputDtoSchema)
    .output(sceneDefinitionDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => getCampaignSceneDefinition(db, userId, input))
    ),
  list: authenticatedProcedure
    .input(getCampaignSceneDefinitionsInputDtoSchema)
    .output(sceneDefinitionDtoSchema.array())
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        listCampaignSceneDefinitions(db, userId, input.campaignId)
      )
    ),
  listLive: authenticatedProcedure
    .input(listCampaignLiveScenesInputDtoSchema)
    .output(campaignLiveSceneSummaryDtoSchema.array())
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        listCampaignLiveScenes(db, userId, input.campaignId)
      )
    ),
  update: authenticatedProcedure
    .input(updateSceneDefinitionInputDtoSchema)
    .output(sceneDefinitionDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => updateCampaignSceneDefinition(db, userId, input))
    )
})
