import { z, lazySchema, lazySchemaParts } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from './identity.js'
import { activeRuleEffectRecordSchema } from './activeRuleEffectPersistence.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import {
  sceneLiveEntityChangeSchema,
  sceneStoredLiveEntityValueSchema,
  sceneLiveCountsSchema,
  sceneLiveCollectionSchema
} from '../api/sceneLiveState.js'
import {
  sceneLiveCommandInputDtoSchema,
  sceneCommandResultDtoSchema,
  sceneDefinitionSettingsDtoSchema
} from '../api/vttScenes.js'
import {
  sceneGeometryCommandResultSchema,
  sceneNativeGeometryCommandInputSchema
} from '../api/sceneGeometry.js'
import { sceneFogPatchInputSchema, sceneFogCommandResultSchema } from '../api/sceneFog.js'
import { sceneUndoExecuteInputSchema, sceneUndoCommandResultSchema } from '../api/sceneUndo.js'

export const sceneStoredLiveStateSchema = lazySchema(() =>
  z.strictObject({
    sceneId: postgresUuidSchema,
    version: z.number().check(z.int()).check(z.positive()),
    fogLayerCount: z.number().check(z.int()).check(z.gte(0)).check(z.lte(101)),
    nextFogOrdinal: z.number().check(z.int()).check(z.nonnegative()),
    settings: z.strictObject({
      // Illumination and daylight change in one command, so they share one version.
      ambientIllumination: z.strictObject({
        value: sceneDefinitionSettingsDtoSchema.shape.ambientIllumination,
        daylight: sceneDefinitionSettingsDtoSchema.shape.daylight,
        version: z.number().check(z.int()).check(z.nonnegative())
      }),
      visionRevealMode: z.strictObject({
        value: sceneDefinitionSettingsDtoSchema.shape.visionRevealMode,
        version: z.number().check(z.int()).check(z.nonnegative())
      }),
      fogMode: z.strictObject({
        value: sceneDefinitionSettingsDtoSchema.shape.fogMode,
        version: z.number().check(z.int()).check(z.nonnegative())
      })
    }),
    counts: sceneLiveCountsSchema,
    nextOrdinals: z.record(
      sceneLiveCollectionSchema,
      z.number().check(z.int()).check(z.nonnegative())
    )
  })
)
export const sceneStoredLiveEntitySchema = lazySchema(() =>
  z.extend(sceneLiveEntityChangeSchema, {
    value: z.nullable(sceneStoredLiveEntityValueSchema),
    sceneId: postgresUuidSchema,
    checksum: projectionChecksumSchema
  })
)
const commandIdentity = lazySchemaParts(() => ({
  sceneId: postgresUuidSchema,
  commandId: postgresUuidSchema,
  actorUserId: postgresUuidSchema,
  inputChecksum: projectionChecksumSchema,
  resultChecksum: projectionChecksumSchema,
  undoneCommandId: z.optional(postgresUuidSchema)
}))
export const sceneStoredInlineCommandSchema = lazySchema(() =>
  z.strictObject({
    ...commandIdentity(),
    encoding: z.literal('INLINE'),
    input: sceneLiveCommandInputDtoSchema,
    result: sceneCommandResultDtoSchema
  })
)
export const sceneStoredFogCommandSchema = lazySchema(() =>
  z.strictObject({
    ...commandIdentity(),
    encoding: z.literal('FOG_PATCH'),
    input: sceneFogPatchInputSchema,
    result: sceneFogCommandResultSchema
  })
)
export const sceneStoredGeometryCommandSchema = lazySchema(() =>
  z.strictObject({
    ...commandIdentity(),
    encoding: z.literal('GEOMETRY'),
    input: sceneNativeGeometryCommandInputSchema,
    result: sceneGeometryCommandResultSchema,
    /**
     * The Encounter action whose forced movement made this move (D139). Only that action's undo
     * reverts it; the Scene's own move undo refuses it. Null for a move a user made.
     */
    actionOrigin: z._default(
      z.nullable(
        z.strictObject({ encounterId: postgresUuidSchema, commandId: postgresUuidSchema })
      ),
      null
    )
  })
)
export const sceneStoredUndoCommandSchema = lazySchema(() =>
  z.strictObject({
    ...commandIdentity(),
    encoding: z.literal('UNDO'),
    input: sceneUndoExecuteInputSchema.shape.input,
    result: sceneUndoCommandResultSchema
  })
)
/**
 * The observers a committed token move dropped from concealments that came to see their holder, so
 * the GM's undo of that move gives them back. Keyed by the move's Scene command.
 */
export const sceneStoredConcealmentPruneSchema = lazySchema(() =>
  z.strictObject({
    sceneId: postgresUuidSchema,
    commandId: postgresUuidSchema,
    entries: z
      .array(
        z.strictObject({
          activeEffectId: postgresUuidSchema,
          holderActorId: postgresUuidSchema,
          beforeObserverActorIds: z
            .array(postgresUuidSchema)
            .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
          afterObserverActorIds: z
            .array(postgresUuidSchema)
            .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
          /** The concealment as it was when the prune left it no observers and ended it; undo gives it back. */
          endedEffect: z.nullable(activeRuleEffectRecordSchema)
        })
      )
      .check(z.minLength(1))
      .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
  })
)
export const sceneStoredLiveCommandSchema = lazySchema(() =>
  z.discriminatedUnion('encoding', [
    sceneStoredInlineCommandSchema,
    sceneStoredFogCommandSchema,
    sceneStoredGeometryCommandSchema,
    sceneStoredUndoCommandSchema
  ])
)
