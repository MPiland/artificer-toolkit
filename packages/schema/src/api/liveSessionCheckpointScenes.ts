import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { jsonDeltaSchema } from '../shared/jsonDelta.js'
import { sceneLiveCollectionSchema } from './sceneLiveState.js'
import {
  sceneStoredLiveStateSchema,
  sceneStoredLiveEntitySchema
} from '../projections/sceneLivePersistence.js'
import {
  sceneStoredFogLayerSchema,
  sceneStoredFogSaveSchema,
  sceneStoredFogChunkSchema
} from '../projections/sceneFogPersistence.js'

/**
 * Scene authoring and materialization remain outside the room's mutable publication boundary.
 * Command receipts and geometry saves are not here: they stay in the room (ADR 0035 Amendment 26).
 */
export const liveSessionCheckpointSceneSchemas = {
  sceneLiveStates: sceneStoredLiveStateSchema,
  sceneLiveEntities: sceneStoredLiveEntitySchema,
  sceneFogLayers: sceneStoredFogLayerSchema,
  sceneFogSaves: sceneStoredFogSaveSchema,
  sceneFogChunks: sceneStoredFogChunkSchema
}

export const liveSessionCheckpointSceneKeys = {
  sceneLiveStates: ['sceneId'],
  sceneLiveEntities: ['sceneId', 'collection', 'entityId'],
  sceneFogLayers: ['sceneId', 'ownerUserId'],
  sceneFogSaves: ['id'],
  sceneFogChunks: ['saveId', 'ordinal']
} as const

export const liveSessionCheckpointSceneIndexes = {
  sceneLiveStates: 'by_sceneId',
  sceneLiveEntities: 'by_sceneId_collection_entityId',
  sceneFogLayers: 'by_sceneId_ownerUserId',
  sceneFogSaves: 'by_publicId',
  sceneFogChunks: 'by_saveId_ordinal'
} as const

export const liveSessionCheckpointSceneChangeSchema = lazySchema(() =>
  z
    .strictObject({
      table: z.enum(
        Object.keys(liveSessionCheckpointSceneSchemas) as [
          LiveSessionCheckpointSceneTable,
          ...LiveSessionCheckpointSceneTable[]
        ]
      ),
      key: z
        .array(z.union([z.string(), z.number().check(z.int()).check(z.nonnegative()), z.null()]))
        .check(z.minLength(1))
        .check(z.maxLength(3)),
      previousChecksum: z.nullable(projectionChecksumSchema),
      nextChecksum: z.nullable(projectionChecksumSchema),
      delta: z.nullable(jsonDeltaSchema)
    })
    .check(
      z.superRefine((change, context) => {
        const fields = liveSessionCheckpointSceneKeys[change.table]
        if (
          fields.length !== change.key.length ||
          fields.some((field, index) => {
            const value = change.key[index]
            if (field === 'ownerUserId' && value === null) return false
            if (field === 'ordinal') return typeof value !== 'number' || value > 255
            if (field === 'collection') return !sceneLiveCollectionSchema.safeParse(value).success
            return !postgresUuidSchema.safeParse(value).success
          })
        )
          context.addIssue({ code: 'custom', message: 'Checkpoint Scene identity is incomplete.' })
        if (
          change.previousChecksum === change.nextChecksum ||
          (change.nextChecksum === null) !== (change.delta === null) ||
          (change.previousChecksum === null && change.delta !== null && !('set' in change.delta))
        )
          context.addIssue({ code: 'custom', message: 'Checkpoint Scene delta is invalid.' })
      })
    )
)

/** The source and presentation pins distinguish a live instance from a later A → B → A visit. */
export const liveSessionCheckpointSceneSourceSchema = lazySchema(() =>
  z.strictObject({
    sceneId: postgresUuidSchema,
    definitionSaveId: postgresUuidSchema,
    definitionVersion: z.number().check(z.int()).check(z.positive()),
    presentationVersion: z.number().check(z.int()).check(z.nonnegative())
  })
)

export const liveSessionCheckpointSceneSchema = lazySchema(() =>
  z
    .extend(liveSessionCheckpointSceneSourceSchema, {
      fromVersion: z.number().check(z.int()).check(z.nonnegative()),
      toVersion: z.number().check(z.int()).check(z.nonnegative()),
      changes: z.array(liveSessionCheckpointSceneChangeSchema).check(z.minLength(1))
    })
    .check(
      z.superRefine((scene, context) => {
        if (
          scene.toVersion < scene.fromVersion ||
          (scene.toVersion === scene.fromVersion &&
            scene.changes.some((change) =>
              ['sceneLiveStates', 'sceneLiveEntities', 'sceneFogLayers'].includes(change.table)
            ))
        )
          context.addIssue({
            code: 'custom',
            message: 'Checkpoint mutable Scene version must advance.'
          })
      })
    )
)

export type LiveSessionCheckpointSceneTable = keyof typeof liveSessionCheckpointSceneSchemas
export type LiveSessionCheckpointSceneChange = z.infer<
  typeof liveSessionCheckpointSceneChangeSchema
>
export type LiveSessionCheckpointSceneSource = z.infer<
  typeof liveSessionCheckpointSceneSourceSchema
>
export type LiveSessionCheckpointScene = z.infer<typeof liveSessionCheckpointSceneSchema>
