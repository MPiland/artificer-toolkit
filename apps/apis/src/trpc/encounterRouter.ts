import {
  createEncounter,
  createEncounterTemplate,
  executeEncounterCommand,
  getEncounterProjection,
  getEncounterTimeline,
  getActiveEncounterProjection,
  listCampaignEncounterProjections,
  listEncounterTemplates
} from '@artificer-toolkit/functions'
import * as encounterContracts from '@artificer-toolkit/schema/api/encounters'
import { withExplicitAuthorityDb } from './dbContext.js'

import { authenticatedProcedure, createTRPCRouter } from './procedures.js'

export const encounterRouter = createTRPCRouter({
  templates: createTRPCRouter({
    list: authenticatedProcedure
      .input(encounterContracts.getCampaignEncounterTemplatesInputDtoSchema)
      .output(encounterContracts.encounterTemplateListDtoSchema)
      .query(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          listEncounterTemplates(db, userId, input.campaignId)
        )
      ),
    create: authenticatedProcedure
      .input(encounterContracts.createEncounterTemplateInputDtoSchema)
      .output(encounterContracts.encounterTemplateDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => createEncounterTemplate(db, userId, input))
      )
  }),
  create: authenticatedProcedure
    .input(encounterContracts.createEncounterInputDtoSchema)
    .output(encounterContracts.encounterGmProjectionDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => createEncounter(db, userId, input))
    ),
  get: authenticatedProcedure
    .input(encounterContracts.getEncounterInputDtoSchema)
    .output(encounterContracts.encounterProjectionDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        getEncounterProjection(db, userId, input.encounterId)
      )
    ),
  active: authenticatedProcedure
    .input(encounterContracts.getCampaignEncounterInputDtoSchema)
    .output(encounterContracts.encounterProjectionDtoSchema.nullable())
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        getActiveEncounterProjection(db, userId, input.campaignId)
      )
    ),
  list: authenticatedProcedure
    .input(encounterContracts.getCampaignEncounterInputDtoSchema)
    .output(encounterContracts.encounterProjectionListDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        listCampaignEncounterProjections(db, userId, input.campaignId)
      )
    ),
  command: authenticatedProcedure
    .input(encounterContracts.encounterCommandInputDtoSchema)
    .output(encounterContracts.encounterCommandResultDtoSchema)
    .mutation(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => executeEncounterCommand(db, userId, input))
    ),
  timeline: authenticatedProcedure
    .input(encounterContracts.getEncounterTimelineInputDtoSchema)
    .output(encounterContracts.encounterTimelineDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => getEncounterTimeline(db, userId, input))
    )
})
