import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import {
  USERNAME_NOT_ALLOWED_MESSAGE,
  validateUsername
} from '@artificer-toolkit/shared/account/username'
import {
  createAccountProfileRepository,
  createAuthoredRouteIdRepository,
  createSystemRepository,
  getSystemListQuery
} from '@artificer-toolkit/db'
import {
  activateAuthoredDomainDraft,
  activateAuthoredDomainInput,
  authoredDomainConfigs,
  createCharacterDraftForUser,
  clearRollHistoryForUser,
  deleteAuthoredDomainActive,
  discardAuthoredDomainDraft,
  discardCharacterBuilderDraftForUser,
  dispatchCommandForUser,
  duplicateAuthoredDomain,
  discardRollForUser,
  executeDiceConfiguration,
  getAuthoredDomain,
  getAuthoredDomainDraft,
  getCharacterBuilderDraftForUser,
  getCharacterForUser,
  getCharacterHistoryForUser,
  getCharacterSheetPanelForUser,
  getCharacterSheetForUser,
  getRollHistoryForUser,
  listAuthoredDomain,
  listCharactersForUser,
  executeRollForUser,
  normalizeNodeRuntimeValues,
  previewCharacterRestForUser,
  previewCharacterSaveForUser,
  resolveCharacterForUser,
  resolveNodeRuntime,
  saveAuthoredDomainInputDraft,
  saveCharacterBuilderDraftForUser,
  upsertCharacterBuilderForUser,
  type AuthoredContentInput,
  type DirectAuthoredDomainConfig
} from '@artificer-toolkit/functions'
import {
  executeDiceConfigurationInputDtoSchema,
  executeRollInputDtoSchema,
  rollHistoryResponseDtoSchema,
  rollRecordDtoSchema,
  rollResultDtoSchema
} from '@artificer-toolkit/schema/api/rolls'
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
  authoredDraftDtoSchema,
  authoredDetailRequestDtoSchema,
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
  toAuthoredValidationIssues,
  vehicleListResponseDtoSchema,
  vehicleResponseDtoSchema
} from '@artificer-toolkit/schema/api/content'
import {
  characterBuilderCommitRequestDtoSchema,
  characterBuilderDraftDtoSchema,
  characterBuilderDraftSaveRequestDtoSchema,
  characterBuilderPayloadDtoSchema,
  characterBuilderPreviewPayloadDtoSchema,
  characterBuilderResolveRequestDtoSchema,
  characterBuilderSaveRequestDtoSchema,
  characterDraftRequestDtoSchema,
  characterHistoryResponseDtoSchema,
  characterListResponseDtoSchema,
  characterRestPreviewRequestDtoSchema,
  characterRestPreviewResponseDtoSchema,
  characterSheetCommandInputDtoSchema,
  characterSheetCommandResponseDtoSchema,
  characterSheetResponseDtoSchema
} from '@artificer-toolkit/schema/api/characters'
import {
  characterSheetPanelDtoSchema,
  characterSheetPanelTargetDtoSchema
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import {
  nodeRuntimeNormalizeValuesRequestDtoSchema,
  nodeRuntimeNormalizeValuesResponseDtoSchema,
  nodeRuntimeResolveRequestDtoSchema,
  nodeRuntimeResolveResponseDtoSchema
} from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  routeIdentityBySubjectRequestDtoSchema,
  routeIdentityDtoSchema,
  routeIdentityResolveRequestDtoSchema
} from '@artificer-toolkit/schema/api/routeIds'
import { applicationFeatureFlagsDtoSchema } from '@artificer-toolkit/schema/api/applicationConfig'
import {
  accountProfileDtoSchema,
  accountProfileUpdateInputSchema,
  accountUsernameStatusDtoSchema,
  accountUsernameStatusInputSchema
} from '@artificer-toolkit/schema/api/account'
import {
  systemListResponseDtoSchema,
  systemResponseDtoSchema
} from '@artificer-toolkit/schema/api/systems'
import { requireUserId, withAuthenticatedDb, withDb, type TrpcContext } from './dbContext.js'
import { getApplicationFeatureFlags } from '../applicationConfig.js'

interface AuthoredDomainConfig<TInput extends AuthoredContentInput> {
  inputSchema: z.ZodType<TInput>
  listSchema: z.ZodType<unknown>
  responseSchema: z.ZodType<unknown>
  runtime: DirectAuthoredDomainConfig
}

const authoredValidationMutationPathPattern =
  /^content\.(backgrounds|classes|creatures|equipment|feats|races|spells|vehicles)\.(activate|activateDraft|saveDraft)$/

const t = initTRPC.context<TrpcContext>().create({
  errorFormatter: ({ error, path, shape }) => {
    const validationIssues =
      Boolean(path && authoredValidationMutationPathPattern.test(path)) &&
      (error.code === 'BAD_REQUEST' || error.code === 'UNPROCESSABLE_CONTENT') &&
      error.cause instanceof z.ZodError
        ? toAuthoredValidationIssues(error.cause.issues)
        : undefined

    return {
      ...shape,
      data: {
        ...shape.data,
        ...(validationIssues ? { validationIssues } : {})
      }
    }
  }
})

export const createTRPCRouter = t.router

const API_PROCEDURE_TRACE_ENV = 'ARTIFICER_API_PROCEDURE_TRACE'
const procedureCounts = new Map<string, number>()
const runtimeGlobals = globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>
  }
}

function shouldTraceApiProcedure(): boolean {
  return runtimeGlobals.process?.env?.[API_PROCEDURE_TRACE_ENV] === '1'
}

function nextProcedureCount(path: string): number {
  const count = (procedureCounts.get(path) ?? 0) + 1
  procedureCounts.set(path, count)
  return count
}

const authenticatedProcedure = t.procedure.use(async ({ ctx, next, path, type }) => {
  requireUserId(ctx)

  const startedAt = Date.now()
  const result = await next({ ctx })

  if (shouldTraceApiProcedure()) {
    console.info(
      '[artificer-api-procedure]',
      JSON.stringify({
        count: nextProcedureCount(path),
        durationMs: Date.now() - startedAt,
        ok: result.ok,
        path,
        type
      })
    )
  }

  return result
})

const idInputSchema = z.object({
  id: z.string().min(1)
})

const okResponseSchema = z.object({
  ok: z.literal(true)
})

const characterDraftProcedureInputSchema = z.object({
  id: z.string().min(1),
  input: characterBuilderDraftSaveRequestDtoSchema
})

const characterCommandProcedureInputSchema = z.object({
  id: z.string().min(1),
  input: characterSheetCommandInputDtoSchema
})

const characterRestPreviewProcedureInputSchema = z.object({
  id: z.string().min(1),
  input: characterRestPreviewRequestDtoSchema
})

const characterSheetPanelProcedureInputSchema = z.object({
  id: z.string().min(1),
  target: characterSheetPanelTargetDtoSchema
})

function authoredDomainRouter<TInput extends AuthoredContentInput>(
  config: AuthoredDomainConfig<TInput>
) {
  return createTRPCRouter({
    list: authenticatedProcedure
      .output(config.listSchema)
      .query(({ ctx }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          config.listSchema.parse(await listAuthoredDomain(db, config.runtime, userId))
        )
      ),

    get: authenticatedProcedure
      .input(authoredDetailRequestDtoSchema)
      .output(config.responseSchema)
      .query(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          config.responseSchema.parse(await getAuthoredDomain(db, config.runtime, input, userId))
        )
      ),

    getDraft: authenticatedProcedure
      .input(idInputSchema)
      .output(authoredDraftDtoSchema.nullable())
      .query(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          authoredDraftDtoSchema
            .nullable()
            .parse(await getAuthoredDomainDraft(db, config.runtime, input.id, userId))
        )
      ),

    saveDraft: authenticatedProcedure
      .input(config.inputSchema)
      .output(authoredDraftDtoSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          authoredDraftDtoSchema.parse(
            await saveAuthoredDomainInputDraft(db, config.runtime, input, userId)
          )
        )
      ),

    discardDraft: authenticatedProcedure
      .input(idInputSchema)
      .output(okResponseSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          okResponseSchema.parse(
            await discardAuthoredDomainDraft(db, config.runtime, input.id, userId)
          )
        )
      ),

    deleteActive: authenticatedProcedure
      .input(idInputSchema)
      .output(okResponseSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          okResponseSchema.parse(
            await deleteAuthoredDomainActive(db, config.runtime, input.id, userId)
          )
        )
      ),

    activateDraft: authenticatedProcedure
      .input(idInputSchema)
      .output(config.responseSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          config.responseSchema.parse(
            await activateAuthoredDomainDraft(db, config.runtime, input.id, userId)
          )
        )
      ),

    activate: authenticatedProcedure
      .input(config.inputSchema)
      .output(config.responseSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          config.responseSchema.parse(
            await activateAuthoredDomainInput(db, config.runtime, input, userId)
          )
        )
      ),

    duplicate: authenticatedProcedure
      .input(idInputSchema)
      .output(authoredDraftDtoSchema.nullable())
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          authoredDraftDtoSchema
            .nullable()
            .parse(await duplicateAuthoredDomain(db, config.runtime, input.id, userId))
        )
      )
  })
}

export const appRouter = createTRPCRouter({
  application: createTRPCRouter({
    featureFlags: t.procedure
      .output(applicationFeatureFlagsDtoSchema)
      .query(() => getApplicationFeatureFlags())
  }),

  account: createTRPCRouter({
    usernameStatus: t.procedure
      .input(accountUsernameStatusInputSchema)
      .output(accountUsernameStatusDtoSchema)
      .query(({ ctx, input }) => {
        const validation = validateUsername(input.username)
        if (validation.message) {
          return { status: 'not_allowed' as const }
        }

        return withDb(ctx, async (db) => ({
          status: (await createAccountProfileRepository(db).isUsernameTaken(validation.username))
            ? ('taken' as const)
            : ('available' as const)
        }))
      }),

    profile: authenticatedProcedure
      .output(accountProfileDtoSchema.nullable())
      .query(({ ctx }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          accountProfileDtoSchema
            .nullable()
            .parse(await createAccountProfileRepository(db).findForUser(userId))
        )
      ),

    updateProfile: authenticatedProcedure
      .input(accountProfileUpdateInputSchema)
      .output(accountProfileDtoSchema)
      .mutation(({ ctx, input }) => {
        const validation = validateUsername(input.username)
        if (validation.message) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: USERNAME_NOT_ALLOWED_MESSAGE
          })
        }

        return withAuthenticatedDb(ctx, async (db, userId) =>
          accountProfileDtoSchema.parse(
            await createAccountProfileRepository(db).upsertForUser(userId, {
              ...input,
              username: validation.username
            })
          )
        )
      })
  }),

  routeIds: createTRPCRouter({
    resolve: authenticatedProcedure
      .input(routeIdentityResolveRequestDtoSchema)
      .output(routeIdentityDtoSchema.nullable())
      .query(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db) => {
          const identity = await createAuthoredRouteIdRepository(db).resolveByPublicIdForUser(input)

          return routeIdentityDtoSchema.nullable().parse(
            identity
              ? {
                  subjectKind: identity.subjectKind,
                  subjectId: identity.subjectId,
                  publicId: identity.publicId
                }
              : null
          )
        })
      ),

    bySubject: authenticatedProcedure
      .input(routeIdentityBySubjectRequestDtoSchema)
      .output(routeIdentityDtoSchema.nullable())
      .query(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db) => {
          const identity = await createAuthoredRouteIdRepository(db).resolveBySubjectForUser(input)

          return routeIdentityDtoSchema.nullable().parse(
            identity
              ? {
                  subjectKind: identity.subjectKind,
                  subjectId: identity.subjectId,
                  publicId: identity.publicId
                }
              : null
          )
        })
      )
  }),

  systems: createTRPCRouter({
    list: authenticatedProcedure
      .output(systemListResponseDtoSchema)
      .query(({ ctx }) =>
        withAuthenticatedDb(ctx, async (db) =>
          systemListResponseDtoSchema.parse(await getSystemListQuery(db))
        )
      ),

    get: authenticatedProcedure
      .input(idInputSchema)
      .output(systemResponseDtoSchema)
      .query(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db) =>
          systemResponseDtoSchema.parse(await createSystemRepository(db).findById(input.id))
        )
      )
  }),

  content: createTRPCRouter({
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
  }),

  characters: createTRPCRouter({
    list: authenticatedProcedure
      .output(characterListResponseDtoSchema)
      .query(({ ctx }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          characterListResponseDtoSchema.parse(await listCharactersForUser(db, userId))
        )
      ),

    draft: authenticatedProcedure
      .input(characterDraftRequestDtoSchema)
      .output(characterBuilderPayloadDtoSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          characterBuilderPayloadDtoSchema.parse(
            await createCharacterDraftForUser(db, input, userId)
          )
        )
      ),

    get: authenticatedProcedure
      .input(idInputSchema)
      .output(characterBuilderPayloadDtoSchema.nullable())
      .query(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db) =>
          characterBuilderPayloadDtoSchema.nullable().parse(await getCharacterForUser(db, input.id))
        )
      ),

    getDraft: authenticatedProcedure
      .input(idInputSchema)
      .output(characterBuilderDraftDtoSchema.nullable())
      .query(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          characterBuilderDraftDtoSchema
            .nullable()
            .parse(await getCharacterBuilderDraftForUser(db, input.id, userId))
        )
      ),

    saveDraft: authenticatedProcedure
      .input(characterDraftProcedureInputSchema)
      .output(characterBuilderDraftDtoSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          characterBuilderDraftDtoSchema.parse(
            await saveCharacterBuilderDraftForUser(db, input.id, input.input, userId)
          )
        )
      ),

    discardDraft: authenticatedProcedure
      .input(idInputSchema)
      .output(okResponseSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          okResponseSchema.parse(await discardCharacterBuilderDraftForUser(db, input.id, userId))
        )
      ),

    sheet: authenticatedProcedure
      .input(idInputSchema)
      .output(characterSheetResponseDtoSchema.nullable())
      .query(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db) =>
          characterSheetResponseDtoSchema
            .nullable()
            .parse(await getCharacterSheetForUser(db, input.id))
        )
      ),

    restPreview: authenticatedProcedure
      .input(characterRestPreviewProcedureInputSchema)
      .output(characterRestPreviewResponseDtoSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          characterRestPreviewResponseDtoSchema.parse(
            await previewCharacterRestForUser(db, input.id, input.input, userId)
          )
        )
      ),

    panel: authenticatedProcedure
      .input(characterSheetPanelProcedureInputSchema)
      .output(characterSheetPanelDtoSchema)
      .query(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          characterSheetPanelDtoSchema.parse(
            await getCharacterSheetPanelForUser(db, input.id, input.target, userId)
          )
        )
      ),

    resolve: authenticatedProcedure
      .input(characterBuilderResolveRequestDtoSchema)
      .output(characterBuilderPayloadDtoSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          characterBuilderPayloadDtoSchema.parse(await resolveCharacterForUser(db, input, userId))
        )
      ),

    previewSave: authenticatedProcedure
      .input(characterBuilderSaveRequestDtoSchema)
      .output(characterBuilderPreviewPayloadDtoSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          characterBuilderPreviewPayloadDtoSchema.parse(
            await previewCharacterSaveForUser(db, input, userId)
          )
        )
      ),

    upsert: authenticatedProcedure
      .input(characterBuilderCommitRequestDtoSchema)
      .output(characterBuilderPayloadDtoSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          characterBuilderPayloadDtoSchema.parse(
            await upsertCharacterBuilderForUser(db, input, userId)
          )
        )
      ),

    history: authenticatedProcedure
      .input(idInputSchema)
      .output(characterHistoryResponseDtoSchema)
      .query(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          characterHistoryResponseDtoSchema.parse(
            await getCharacterHistoryForUser(db, input.id, userId)
          )
        )
      ),

    command: authenticatedProcedure
      .input(characterCommandProcedureInputSchema)
      .output(characterSheetCommandResponseDtoSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          characterSheetCommandResponseDtoSchema.parse(
            await dispatchCommandForUser(db, input.id, input.input, userId)
          )
        )
      )
  }),

  rolls: createTRPCRouter({
    executeConfiguration: authenticatedProcedure
      .input(executeDiceConfigurationInputDtoSchema)
      .output(rollResultDtoSchema)
      .mutation(({ input }) => rollResultDtoSchema.parse(executeDiceConfiguration(input))),

    clearHistory: authenticatedProcedure
      .output(okResponseSchema)
      .mutation(({ ctx }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          okResponseSchema.parse(await clearRollHistoryForUser(db, userId))
        )
      ),

    discard: authenticatedProcedure
      .input(idInputSchema)
      .output(okResponseSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          okResponseSchema.parse(await discardRollForUser(db, input.id, userId))
        )
      ),

    execute: authenticatedProcedure
      .input(executeRollInputDtoSchema)
      .output(rollRecordDtoSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          rollRecordDtoSchema.parse(await executeRollForUser(db, input, userId))
        )
      ),

    history: authenticatedProcedure
      .output(rollHistoryResponseDtoSchema)
      .query(({ ctx }) =>
        withAuthenticatedDb(ctx, async (db, userId) =>
          rollHistoryResponseDtoSchema.parse(await getRollHistoryForUser(db, userId))
        )
      )
  }),

  nodeRuntime: createTRPCRouter({
    resolve: authenticatedProcedure
      .input(nodeRuntimeResolveRequestDtoSchema)
      .output(nodeRuntimeResolveResponseDtoSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db) =>
          nodeRuntimeResolveResponseDtoSchema.parse(await resolveNodeRuntime(db, input))
        )
      ),

    normalizeValues: authenticatedProcedure
      .input(nodeRuntimeNormalizeValuesRequestDtoSchema)
      .output(nodeRuntimeNormalizeValuesResponseDtoSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, async (db) =>
          nodeRuntimeNormalizeValuesResponseDtoSchema.parse(
            await normalizeNodeRuntimeValues(db, input)
          )
        )
      )
  })
})

export type AppRouter = typeof appRouter
