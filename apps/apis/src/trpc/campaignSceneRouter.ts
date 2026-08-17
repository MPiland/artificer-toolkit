import {
  attachEncounterScene,
  createCampaignSceneDefinition,
  deleteCampaignSceneDefinition,
  getCampaignSceneDefinition,
  getEncounterSceneProjection,
  listCampaignSceneDefinitions,
  updateCampaignSceneDefinition
} from '@artificer-toolkit/functions'
import {
  attachEncounterSceneInputDtoSchema,
  attachEncounterSceneResultDtoSchema,
  createSceneDefinitionInputDtoSchema,
  deleteSceneDefinitionInputDtoSchema,
  encounterSceneStateDtoSchema,
  getCampaignSceneDefinitionsInputDtoSchema,
  getEncounterSceneInputDtoSchema,
  getSceneDefinitionInputDtoSchema,
  sceneDefinitionDtoSchema,
  updateSceneDefinitionInputDtoSchema
} from '@artificer-toolkit/schema/api/vttScenes'

import { withExplicitAuthorityDb } from './dbContext.js'
import { authenticatedProcedure, createTRPCRouter, okResponseSchema } from './procedures.js'

export const campaignSceneRouter = createTRPCRouter({
  attach: authenticatedProcedure
    .input(attachEncounterSceneInputDtoSchema)
    .output(attachEncounterSceneResultDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => attachEncounterScene(db, userId, input))
    ),
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
  projection: authenticatedProcedure
    .input(getEncounterSceneInputDtoSchema)
    .output(encounterSceneStateDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => getEncounterSceneProjection(db, userId, input))
    ),
  update: authenticatedProcedure
    .input(updateSceneDefinitionInputDtoSchema)
    .output(sceneDefinitionDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => updateCampaignSceneDefinition(db, userId, input))
    )
})
