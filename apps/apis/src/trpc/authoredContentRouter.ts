import { z } from 'zod'
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
  backgroundListResponseDtoSchema,
  backgroundResponseDtoSchema,
  classListResponseDtoSchema,
  classResponseDtoSchema,
  creatureListResponseDtoSchema,
  creatureResponseDtoSchema,
  equipmentListResponseDtoSchema,
  equipmentResponseDtoSchema,
  featListResponseDtoSchema,
  featResponseDtoSchema,
  raceListResponseDtoSchema,
  raceResponseDtoSchema,
  spellListResponseDtoSchema,
  spellResponseDtoSchema,
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
      .output(config.listSchema)
      .query(({ ctx }) =>
        withAuthenticatedDb(ctx, (db, userId) => listAuthoredDomain(db, config.runtime, userId))
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
    listSchema: backgroundListResponseDtoSchema,
    responseSchema: backgroundResponseDtoSchema,
    runtime: authoredDomainConfigs.backgrounds
  }),

  classes: authoredDomainRouter<ClassAuthoringInputDto>({
    inputSchema: classAuthoringInputDtoSchema,
    listSchema: classListResponseDtoSchema,
    responseSchema: classResponseDtoSchema,
    runtime: authoredDomainConfigs.classes
  }),

  creatures: authoredDomainRouter<CreatureAuthoringInputDto>({
    inputSchema: creatureAuthoringInputDtoSchema,
    listSchema: creatureListResponseDtoSchema,
    responseSchema: creatureResponseDtoSchema,
    runtime: authoredDomainConfigs.creatures
  }),

  equipment: authoredDomainRouter<EquipmentAuthoringInputDto>({
    inputSchema: equipmentAuthoringInputDtoSchema,
    listSchema: equipmentListResponseDtoSchema,
    responseSchema: equipmentResponseDtoSchema,
    runtime: authoredDomainConfigs.equipment
  }),

  feats: authoredDomainRouter<FeatAuthoringInputDto>({
    inputSchema: featAuthoringInputDtoSchema,
    listSchema: featListResponseDtoSchema,
    responseSchema: featResponseDtoSchema,
    runtime: authoredDomainConfigs.feats
  }),

  races: authoredDomainRouter<RaceAuthoringInputDto>({
    inputSchema: raceAuthoringInputDtoSchema,
    listSchema: raceListResponseDtoSchema,
    responseSchema: raceResponseDtoSchema,
    runtime: authoredDomainConfigs.races
  }),

  spells: authoredDomainRouter<SpellAuthoringInputDto>({
    inputSchema: spellAuthoringInputDtoSchema,
    listSchema: spellListResponseDtoSchema,
    responseSchema: spellResponseDtoSchema,
    runtime: authoredDomainConfigs.spells
  }),

  vehicles: authoredDomainRouter<VehicleAuthoringInputDto>({
    inputSchema: vehicleAuthoringInputDtoSchema,
    listSchema: vehicleListResponseDtoSchema,
    responseSchema: vehicleResponseDtoSchema,
    runtime: authoredDomainConfigs.vehicles
  })
})
