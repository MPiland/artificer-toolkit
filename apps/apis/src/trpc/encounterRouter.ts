import {
  createEncounter,
  createEncounterBlueprint,
  updateEncounterBlueprint,
  executeEncounterCommand,
  getPendingEncounterRuleOccurrence,
  getEncounterProjection,
  getEncounterTimeline,
  getActiveEncounterProjection,
  listCampaignEncounterProjections,
  listEncounterBlueprints,
  createPlatformRulesRuntime,
  createReusableDefinitionRuntimeSource,
  deriveRulesRuntimeContinuationIntegrityKey
} from '@artificer-toolkit/functions'
import { createReusableDefinitionRepository } from '@artificer-toolkit/db'
import * as encounterContracts from '@artificer-toolkit/schema/api/encounters'
import { withExplicitAuthorityDb } from './dbContext.js'

import { authenticatedProcedure, createTRPCRouter } from './procedures.js'

const runtimeGlobals = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}

function encounterRulesRuntime(db: Parameters<typeof createReusableDefinitionRepository>[0]) {
  const secret = runtimeGlobals.process?.env?.LIVE_SESSION_TICKET_SECRET
  if (!secret) throw new Error('LIVE_SESSION_TICKET_SECRET is not configured.')
  return createPlatformRulesRuntime({
    continuationIntegrityKey: deriveRulesRuntimeContinuationIntegrityKey(secret),
    definitions: createReusableDefinitionRuntimeSource(createReusableDefinitionRepository(db))
  })
}

export const encounterRouter = createTRPCRouter({
  blueprints: createTRPCRouter({
    list: authenticatedProcedure
      .input(encounterContracts.getEncounterBlueprintsInputDtoSchema)
      .output(encounterContracts.encounterBlueprintListDtoSchema)
      .query(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) =>
          listEncounterBlueprints(db, userId, input.gameSystemId)
        )
      ),
    create: authenticatedProcedure
      .input(encounterContracts.createEncounterBlueprintInputDtoSchema)
      .output(encounterContracts.encounterBlueprintDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => createEncounterBlueprint(db, userId, input))
      ),
    update: authenticatedProcedure
      .input(encounterContracts.updateEncounterBlueprintInputDtoSchema)
      .output(encounterContracts.encounterBlueprintDtoSchema)
      .mutation(({ ctx, input }) =>
        withExplicitAuthorityDb(ctx, (db, userId) => updateEncounterBlueprint(db, userId, input))
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
  pendingRuleOccurrence: authenticatedProcedure
    .input(encounterContracts.getPendingEncounterRuleOccurrenceInputDtoSchema)
    .output(encounterContracts.pendingEncounterRuleOccurrenceSummaryDtoSchema.nullable())
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) =>
        getPendingEncounterRuleOccurrence(db, userId, input.encounterId)
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
      withExplicitAuthorityDb(ctx, (db, userId) =>
        executeEncounterCommand(db, userId, input, {
          ...(input.type === 'RESOLVE_ACTION' || input.type === 'RESOLVE_RULE_OCCURRENCE'
            ? { rulesRuntime: encounterRulesRuntime(db) }
            : {})
        })
      )
    ),
  timeline: authenticatedProcedure
    .input(encounterContracts.getEncounterTimelineInputDtoSchema)
    .output(encounterContracts.encounterTimelineDtoSchema)
    .query(({ ctx, input }) =>
      withExplicitAuthorityDb(ctx, (db, userId) => getEncounterTimeline(db, userId, input))
    )
})
