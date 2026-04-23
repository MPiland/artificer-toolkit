import { initTRPC, TRPCError } from '@trpc/server'
import { ZodError, z } from 'zod'
import {
  createDb,
  withUserContext,
  type Json,
  type DBLike,
  createCharacterRepository,
  createCharacterEventRepository,
  createClassRepository,
  createRaceRepository,
  createSpellRepository,
  createFeatRepository,
  createEquipmentRepository,
  createBackgroundRepository,
  createCreatureRepository,
  createVehicleRepository,
  createFeatureRepository,
  createSystemRepository,
  createFeatGrantRepository,
  getClassListQuery,
  getRaceListQuery,
  getSpellListQuery,
  getFeatListQuery,
  getEquipmentListQuery,
  getBackgroundListQuery,
  getCreatureListQuery,
  getVehicleListQuery,
  getFeatureListQuery,
  getSystemListQuery,
  ConcurrencyError,
} from '@artificer-toolkit/db'
import {
  dispatchCharacterCommand,
  handleCreateCharacter,
  handleAssignAbilityScores,
  handleGainClassLevel,
  handleApplyHitPoints,
  handleMakeFeatureSelection,
  handleChooseFeat,
  handleUpdateSpellSelection,
  handleAcquireEquipment,
  handleEquipItem,
  handleUnequipItem,
  createClassSubjectAuthoringService,
  createRaceSubjectAuthoringService,
  createSpellSubjectAuthoringService,
  createFeatSubjectAuthoringService,
  createEquipmentSubjectAuthoringService,
  createBackgroundSubjectAuthoringService,
  createCreatureSubjectAuthoringService,
  createVehicleSubjectAuthoringService,
  createFeatureAuthoringUseCaseService,
  createFeatGrantAuthoringService,
  NotFoundError,
  CommandValidationError,
  buildSnapshot,
} from '@artificer-toolkit/functions'
import {
  type CharacterBuildState,
  dnd5e2014RulesSystem,
  runEngine,
  buildCharacterHistoryView,
  type CharacterAssemblyRegistry,
} from '@artificer-toolkit/shared'
import {
  createCharacterCommandSchema,
  characterCommandUnionSchema,
  classAuthoredDtoSchema,
  raceAuthoredDtoSchema,
  spellAuthoredDtoSchema,
  featAuthoredDtoSchema,
  equipmentAuthoredDtoSchema,
  backgroundAuthoredDtoSchema,
  creatureAuthoredDtoSchema,
  vehicleAuthoredDtoSchema,
  featGrantDtoSchema,
} from '@artificer-toolkit/schema'
import type { TrpcContext } from './trpc.context.js'

const idInputSchema = z.object({ id: z.string().min(1) })
const featureAuthoringBodySchema = z.object({
  feature: z.unknown(),
  systemId: z.string(),
})

const t = initTRPC.context<TrpcContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodIssues: error.cause instanceof ZodError ? error.cause.issues : null,
      },
    }
  },
})

const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Missing user context' })
  }
  return next({ ctx: { userId: ctx.userId } })
})

async function runAsUser<TResult>(
  userId: string,
  action: (db: DBLike) => Promise<TResult>
): Promise<TResult> {
  const db = createDb()
  try {
    return await withUserContext(db, userId, (ctx) => action(ctx))
  } finally {
    await db.destroy()
  }
}

function mapServiceError(err: unknown): never {
  if (err instanceof NotFoundError) {
    throw new TRPCError({ code: 'NOT_FOUND', message: err.message, cause: err })
  }
  if (err instanceof ConcurrencyError) {
    throw new TRPCError({ code: 'CONFLICT', message: err.message, cause: err })
  }
  if (err instanceof CommandValidationError) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: err.issues.length > 0
        ? `${err.message} ${err.issues.join('; ')}`
        : err.message,
      cause: err
    })
  }
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Internal Server Error', cause: err })
}

function stubRegistry(): CharacterAssemblyRegistry {
  return { features: {}, classes: {}, feats: {}, races: {}, equipment: {}, spells: {} }
}

const commandHandlerMap = {
  CREATE_CHARACTER: handleCreateCharacter,
  ASSIGN_ABILITY_SCORES: handleAssignAbilityScores,
  GAIN_CLASS_LEVEL: handleGainClassLevel,
  APPLY_HIT_POINTS: handleApplyHitPoints,
  MAKE_FEATURE_SELECTION: handleMakeFeatureSelection,
  CHOOSE_FEAT: handleChooseFeat,
  UPDATE_SPELL_SELECTION: handleUpdateSpellSelection,
  ACQUIRE_EQUIPMENT: handleAcquireEquipment,
  EQUIP_ITEM: handleEquipItem,
  UNEQUIP_ITEM: handleUnequipItem,
} as const

const builtAppRouter = t.router({
  characters: t.router({
    list: authedProcedure.query(async ({ ctx }) =>
      runAsUser(ctx.userId, (db) => createCharacterRepository(db).listByUser(ctx.userId))
    ),

    create: authedProcedure
      .input(createCharacterCommandSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          return await runAsUser(ctx.userId, async (db) => {
            const { events, newState } = await handleCreateCharacter(
              input,
              {
                characterId: input.characterId,
                systemId: input.systemId,
                streamVersion: 0,
                name: '',
                classes: [],
                abilityScores: {},
                abilityGenerationMethod: 'STANDARD_ARRAY',
                hitpointsByLevel: [],
                featureSelections: [],
                featRefs: [],
                spellRefs: [],
                ownedEquipment: [],
              },
              stubRegistry(),
              dnd5e2014RulesSystem
            )

            const charRepo = createCharacterRepository(db)
            const eventRepo = createCharacterEventRepository(db)

            await charRepo.create({
              id: input.characterId,
              systemId: input.systemId,
              userId: ctx.userId,
              label: input.name,
              buildState: newState as unknown as Json,
            })

            await eventRepo.appendBatch(events)

            return { characterId: input.characterId, streamVersion: newState.streamVersion }
          })
        } catch (err) {
          mapServiceError(err)
        }
      }),

    get: authedProcedure.input(idInputSchema).query(async ({ ctx, input }) =>
      runAsUser(ctx.userId, async (db) => {
        const row = await createCharacterRepository(db).findById(input.id)
        if (!row?.build_state) return null
        const registry = stubRegistry()
        const buildState = row.build_state as unknown as CharacterBuildState
        const snapshot = buildSnapshot(buildState, registry)
        const output = runEngine(snapshot, registry, dnd5e2014RulesSystem)
        return { buildState, engineOutput: output }
      })
    ),

    history: authedProcedure.input(idInputSchema).query(async ({ ctx, input }) =>
      runAsUser(ctx.userId, async (db) => {
        const events = await createCharacterEventRepository(db).listByCharacter(input.id)
        return buildCharacterHistoryView(events)
      })
    ),

    command: authedProcedure
      .input(characterCommandUnionSchema)
      .mutation(async ({ ctx, input }) => {
        if (input.type === 'CREATE_CHARACTER') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Use characters.create for CREATE_CHARACTER.',
          })
        }
        try {
          return await runAsUser(ctx.userId, (db) =>
            dispatchCharacterCommand(
              input.characterId,
              input.expectedVersion,
              input,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              commandHandlerMap[input.type] as any,
              db
            )
          )
        } catch (err) {
          mapServiceError(err)
        }
      }),
  }),

  content: t.router({
    classes: t.router({
      list: authedProcedure.query(({ ctx }) => runAsUser(ctx.userId, (db) => getClassListQuery(db))),
      get: authedProcedure.input(idInputSchema).query(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createClassRepository(db).findById(input.id))
      ),
      upsert: authedProcedure.input(classAuthoredDtoSchema).mutation(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createClassSubjectAuthoringService(db).execute(input))
      ),
    }),

    races: t.router({
      list: authedProcedure.query(({ ctx }) => runAsUser(ctx.userId, (db) => getRaceListQuery(db))),
      get: authedProcedure.input(idInputSchema).query(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createRaceRepository(db).findById(input.id))
      ),
      upsert: authedProcedure.input(raceAuthoredDtoSchema).mutation(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createRaceSubjectAuthoringService(db).execute(input))
      ),
    }),

    spells: t.router({
      list: authedProcedure.query(({ ctx }) => runAsUser(ctx.userId, (db) => getSpellListQuery(db))),
      get: authedProcedure.input(idInputSchema).query(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createSpellRepository(db).findById(input.id))
      ),
      upsert: authedProcedure.input(spellAuthoredDtoSchema).mutation(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createSpellSubjectAuthoringService(db).execute(input))
      ),
    }),

    feats: t.router({
      list: authedProcedure.query(({ ctx }) => runAsUser(ctx.userId, (db) => getFeatListQuery(db))),
      get: authedProcedure.input(idInputSchema).query(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createFeatRepository(db).findById(input.id))
      ),
      upsert: authedProcedure.input(featAuthoredDtoSchema).mutation(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createFeatSubjectAuthoringService(db).execute(input))
      ),
    }),

    equipment: t.router({
      list: authedProcedure.query(({ ctx }) => runAsUser(ctx.userId, (db) => getEquipmentListQuery(db))),
      get: authedProcedure.input(idInputSchema).query(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createEquipmentRepository(db).findById(input.id))
      ),
      upsert: authedProcedure.input(equipmentAuthoredDtoSchema).mutation(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createEquipmentSubjectAuthoringService(db).execute(input))
      ),
    }),

    backgrounds: t.router({
      list: authedProcedure.query(({ ctx }) => runAsUser(ctx.userId, (db) => getBackgroundListQuery(db))),
      get: authedProcedure.input(idInputSchema).query(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createBackgroundRepository(db).findById(input.id))
      ),
      upsert: authedProcedure.input(backgroundAuthoredDtoSchema).mutation(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createBackgroundSubjectAuthoringService(db).execute(input))
      ),
    }),

    creatures: t.router({
      list: authedProcedure.query(({ ctx }) => runAsUser(ctx.userId, (db) => getCreatureListQuery(db))),
      get: authedProcedure.input(idInputSchema).query(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createCreatureRepository(db).findById(input.id))
      ),
      upsert: authedProcedure.input(creatureAuthoredDtoSchema).mutation(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createCreatureSubjectAuthoringService(db).execute(input))
      ),
    }),

    vehicles: t.router({
      list: authedProcedure.query(({ ctx }) => runAsUser(ctx.userId, (db) => getVehicleListQuery(db))),
      get: authedProcedure.input(idInputSchema).query(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createVehicleRepository(db).findById(input.id))
      ),
      upsert: authedProcedure.input(vehicleAuthoredDtoSchema).mutation(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createVehicleSubjectAuthoringService(db).execute(input))
      ),
    }),

    features: t.router({
      list: authedProcedure.query(({ ctx }) => runAsUser(ctx.userId, (db) => getFeatureListQuery(db))),
      get: authedProcedure.input(idInputSchema).query(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createFeatureRepository(db).findById(input.id))
      ),
      upsert: authedProcedure.input(featureAuthoringBodySchema).mutation(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createFeatureAuthoringUseCaseService(db).execute(input))
      ),
    }),

    featGrants: t.router({
      get: authedProcedure.input(idInputSchema).query(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createFeatGrantRepository(db).findById(input.id))
      ),
      upsert: authedProcedure.input(featGrantDtoSchema).mutation(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createFeatGrantAuthoringService(db).execute(input))
      ),
    }),

    systems: t.router({
      list: authedProcedure.query(({ ctx }) => runAsUser(ctx.userId, (db) => getSystemListQuery(db))),
      get: authedProcedure.input(idInputSchema).query(({ ctx, input }) =>
        runAsUser(ctx.userId, (db) => createSystemRepository(db).findById(input.id))
      ),
    }),
  }),
})

export const appRouter: ReturnType<typeof t.router> = builtAppRouter
export type AppRouter = ReturnType<typeof t.router>
