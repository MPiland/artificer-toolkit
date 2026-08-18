import { z } from 'zod'
import type { AuthoredCatalogPageInput } from '@artificer-toolkit/db'
import {
  activateAuthoredDomainDraft,
  activateAuthoredDomainInput,
  authoredDomainConfigs,
  deleteAuthoredDomainActive,
  discardAuthoredDomainDraft,
  duplicateAuthoredDomain,
  getAuthoredDomain,
  getAuthoredDomainDraft,
  listAuthoredDomain,
  saveAuthoredDomainInputDraft,
  type AuthoredContentInput,
  type DirectAuthoredDomainConfig
} from '@artificer-toolkit/functions'
import {
  backgroundAuthoringInputDtoSchema,
  type BackgroundAuthoringInputDto
} from '@artificer-toolkit/schema/subjects/background'
import {
  classAuthoringInputDtoSchema,
  type ClassAuthoringInputDto
} from '@artificer-toolkit/schema/subjects/class'
import {
  creatureAuthoringInputDtoSchema,
  type CreatureAuthoringInputDto
} from '@artificer-toolkit/schema/subjects/creature'
import {
  equipmentAuthoringInputDtoSchema,
  type EquipmentAuthoringInputDto
} from '@artificer-toolkit/schema/subjects/equipment'
import {
  featAuthoringInputDtoSchema,
  type FeatAuthoringInputDto
} from '@artificer-toolkit/schema/subjects/feat'
import {
  raceAuthoringInputDtoSchema,
  type RaceAuthoringInputDto
} from '@artificer-toolkit/schema/subjects/race'
import {
  spellAuthoringInputDtoSchema,
  type SpellAuthoringInputDto
} from '@artificer-toolkit/schema/subjects/spell'
import {
  vehicleAuthoringInputDtoSchema,
  type VehicleAuthoringInputDto
} from '@artificer-toolkit/schema/subjects/vehicle'
import {
  authoredDetailRequestDtoSchema,
  authoredDraftDtoSchema,
  backgroundListRequestDtoSchema,
  backgroundListResponseDtoSchema,
  backgroundResponseDtoSchema,
  classListRequestDtoSchema,
  classListResponseDtoSchema,
  classResponseDtoSchema,
  creatureListRequestDtoSchema,
  creatureListResponseDtoSchema,
  creatureResponseDtoSchema,
  equipmentListRequestDtoSchema,
  equipmentListResponseDtoSchema,
  equipmentResponseDtoSchema,
  featListRequestDtoSchema,
  featListResponseDtoSchema,
  featResponseDtoSchema,
  raceListRequestDtoSchema,
  raceListResponseDtoSchema,
  raceResponseDtoSchema,
  spellListRequestDtoSchema,
  spellListResponseDtoSchema,
  spellResponseDtoSchema,
  vehicleListRequestDtoSchema,
  vehicleListResponseDtoSchema,
  vehicleResponseDtoSchema
} from '@artificer-toolkit/schema/api/content'
import { AUTHORED_LIMITS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { withAuthenticatedDb } from './dbContext.js'

import {
  authenticatedProcedure,
  createTRPCRouter,
  idInputSchema,
  okResponseSchema
} from './procedures.js'

interface AuthoredDomainConfig<TInput extends AuthoredContentInput> {
  inputSchema: z.ZodType<TInput>
  listInputSchema: z.ZodType<AuthoredCatalogPageInput>
  listSchema: z.ZodType<unknown>
  responseSchema: z.ZodType<unknown>
  runtime: DirectAuthoredDomainConfig
}

function authoredDomainRouter<TInput extends AuthoredContentInput>(
  config: AuthoredDomainConfig<TInput>
) {
  const mutationInputSchema = config.inputSchema.refine(
    (input) =>
      new TextEncoder().encode(JSON.stringify(input)).byteLength <=
      AUTHORED_LIMITS.mutationPayloadBytes,
    `Authored mutations must be at most ${AUTHORED_LIMITS.mutationPayloadBytes} bytes`
  )

  return createTRPCRouter({
    list: authenticatedProcedure
      .input(config.listInputSchema)
      .output(config.listSchema)
      .query(({ ctx, input }) =>
        withAuthenticatedDb(ctx, (db, userId) =>
          listAuthoredDomain(db, config.runtime, input, userId)
        )
      ),

    get: authenticatedProcedure
      .input(authoredDetailRequestDtoSchema)
      .output(config.responseSchema)
      .query(({ ctx, input }) =>
        withAuthenticatedDb(ctx, (db, userId) =>
          getAuthoredDomain(db, config.runtime, input, userId)
        )
      ),

    getDraft: authenticatedProcedure
      .input(idInputSchema)
      .output(authoredDraftDtoSchema.nullable())
      .query(({ ctx, input }) =>
        withAuthenticatedDb(ctx, (db, userId) =>
          getAuthoredDomainDraft(db, config.runtime, input.id, userId)
        )
      ),

    saveDraft: authenticatedProcedure
      .input(mutationInputSchema)
      .output(authoredDraftDtoSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, (db, userId) =>
          saveAuthoredDomainInputDraft(db, config.runtime, input, userId)
        )
      ),

    discardDraft: authenticatedProcedure
      .input(idInputSchema)
      .output(okResponseSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, (db, userId) =>
          discardAuthoredDomainDraft(db, config.runtime, input.id, userId)
        )
      ),

    deleteActive: authenticatedProcedure
      .input(idInputSchema)
      .output(okResponseSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, (db, userId) =>
          deleteAuthoredDomainActive(db, config.runtime, input.id, userId)
        )
      ),

    activateDraft: authenticatedProcedure
      .input(idInputSchema)
      .output(config.responseSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, (db, userId) =>
          activateAuthoredDomainDraft(db, config.runtime, input.id, userId)
        )
      ),

    activate: authenticatedProcedure
      .input(mutationInputSchema)
      .output(config.responseSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, (db, userId) =>
          activateAuthoredDomainInput(db, config.runtime, input, userId)
        )
      ),

    duplicate: authenticatedProcedure
      .input(idInputSchema)
      .output(authoredDraftDtoSchema.nullable())
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, (db, userId) =>
          duplicateAuthoredDomain(db, config.runtime, input.id, userId)
        )
      )
  })
}

export const authoredContentRouter = createTRPCRouter({
  backgrounds: authoredDomainRouter<BackgroundAuthoringInputDto>({
    inputSchema: backgroundAuthoringInputDtoSchema,
    listInputSchema: backgroundListRequestDtoSchema,
    listSchema: backgroundListResponseDtoSchema,
    responseSchema: backgroundResponseDtoSchema,
    runtime: authoredDomainConfigs.backgrounds
  }),

  classes: authoredDomainRouter<ClassAuthoringInputDto>({
    inputSchema: classAuthoringInputDtoSchema,
    listInputSchema: classListRequestDtoSchema,
    listSchema: classListResponseDtoSchema,
    responseSchema: classResponseDtoSchema,
    runtime: authoredDomainConfigs.classes
  }),

  creatures: authoredDomainRouter<CreatureAuthoringInputDto>({
    inputSchema: creatureAuthoringInputDtoSchema,
    listInputSchema: creatureListRequestDtoSchema,
    listSchema: creatureListResponseDtoSchema,
    responseSchema: creatureResponseDtoSchema,
    runtime: authoredDomainConfigs.creatures
  }),

  equipment: authoredDomainRouter<EquipmentAuthoringInputDto>({
    inputSchema: equipmentAuthoringInputDtoSchema,
    listInputSchema: equipmentListRequestDtoSchema,
    listSchema: equipmentListResponseDtoSchema,
    responseSchema: equipmentResponseDtoSchema,
    runtime: authoredDomainConfigs.equipment
  }),

  feats: authoredDomainRouter<FeatAuthoringInputDto>({
    inputSchema: featAuthoringInputDtoSchema,
    listInputSchema: featListRequestDtoSchema,
    listSchema: featListResponseDtoSchema,
    responseSchema: featResponseDtoSchema,
    runtime: authoredDomainConfigs.feats
  }),

  races: authoredDomainRouter<RaceAuthoringInputDto>({
    inputSchema: raceAuthoringInputDtoSchema,
    listInputSchema: raceListRequestDtoSchema,
    listSchema: raceListResponseDtoSchema,
    responseSchema: raceResponseDtoSchema,
    runtime: authoredDomainConfigs.races
  }),

  spells: authoredDomainRouter<SpellAuthoringInputDto>({
    inputSchema: spellAuthoringInputDtoSchema,
    listInputSchema: spellListRequestDtoSchema,
    listSchema: spellListResponseDtoSchema,
    responseSchema: spellResponseDtoSchema,
    runtime: authoredDomainConfigs.spells
  }),

  vehicles: authoredDomainRouter<VehicleAuthoringInputDto>({
    inputSchema: vehicleAuthoringInputDtoSchema,
    listInputSchema: vehicleListRequestDtoSchema,
    listSchema: vehicleListResponseDtoSchema,
    responseSchema: vehicleResponseDtoSchema,
    runtime: authoredDomainConfigs.vehicles
  })
})
