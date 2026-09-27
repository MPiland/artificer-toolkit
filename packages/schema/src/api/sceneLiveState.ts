import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  sceneDefinitionCountsSchema,
  sceneDefinitionEntityPageInputSchema,
  sceneDefinitionCollectionSchema,
  sceneDefinitionEntitySchema
} from './sceneDefinitionSave.js'
import { sceneDefinitionSettingsDtoSchema, sceneMeasurementDtoSchema } from './vttScenes.js'
import { campaignListPageSchema } from './campaignList.js'
import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt/scene'

export const sceneLiveCollectionSchema = lazySchema(() =>
  z.enum([...sceneDefinitionCollectionSchema.options, 'measurements'])
)
export const sceneLiveCountsSchema = lazySchema(() =>
  z.extend(sceneDefinitionCountsSchema, {
    measurements: z
      .number()
      .check(z.int())
      .check(z.gte(0))
      .check(z.lte(VTT_SCENE_LIMITS.measurements))
  })
)
export const sceneLiveEntitySchema = lazySchema(() =>
  z.union([
    sceneDefinitionEntitySchema,
    z.strictObject({ collection: z.literal('measurements'), entity: sceneMeasurementDtoSchema })
  ])
)

// Entity arrays travel in bounded pages; this header identifies their exact live instance/base.
export const sceneLiveStateHeaderSchema = lazySchema(() =>
  z.extend(sceneDefinitionSettingsDtoSchema, {
    id: postgresUuidSchema,
    definitionId: postgresUuidSchema,
    definitionVersion: z.number().check(z.int()).check(z.positive()),
    definitionSaveId: postgresUuidSchema,
    version: z.number().check(z.int()).check(z.nonnegative()),
    fogLayerCount: z.number().check(z.int()).check(z.gte(0)).check(z.lte(101)),
    counts: sceneDefinitionCountsSchema,
    currentCounts: sceneLiveCountsSchema
  })
)

export const sceneLiveEntityChangeSchema = lazySchema(() =>
  z.strictObject({
    collection: sceneLiveCollectionSchema,
    entityId: z.string().check(z.uuid()),
    value: z.nullable(sceneLiveEntitySchema),
    // Door overrides carry current state separately from the authored initial state.
    doorState: z.optional(z.nullable(z.enum(['OPEN', 'CLOSED', 'LOCKED']))),
    ordinal: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
    version: z.number().check(z.int()).check(z.positive())
  })
)
export const sceneLiveEntityChangesPageSchema = lazySchema(() =>
  z.extend(campaignListPageSchema, {
    page: z.array(sceneLiveEntityChangeSchema)
  })
)

export const sceneLiveStateEntityPageInputSchema = lazySchema(() =>
  z.strictObject({
    sceneId: postgresUuidSchema,
    definitionSaveId: postgresUuidSchema,
    expectedVersion: z.number().check(z.int()).check(z.nonnegative()),
    collection: sceneDefinitionEntityPageInputSchema.shape.collection,
    paginationOpts: sceneDefinitionEntityPageInputSchema.shape.paginationOpts
  })
)

export const sceneLiveChangesPageInputSchema = lazySchema(() =>
  z.extend(sceneLiveStateEntityPageInputSchema, {
    collection: sceneLiveCollectionSchema
  })
)
export const sceneMeasurementsPageInputSchema = lazySchema(() =>
  z.strictObject({
    sceneId: postgresUuidSchema,
    expectedVersion: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
    paginationOpts: sceneDefinitionEntityPageInputSchema.shape.paginationOpts
  })
)
export const sceneMeasurementsPageSchema = lazySchema(() =>
  z.extend(campaignListPageSchema, {
    version: z.number().check(z.int()).check(z.nonnegative()),
    count: sceneLiveCountsSchema.shape.measurements,
    page: z.array(
      z.strictObject({
        ordinal: z.number().check(z.int()).check(z.nonnegative()),
        measurement: sceneMeasurementDtoSchema
      })
    )
  })
)

export type SceneLiveStateHeader = z.infer<typeof sceneLiveStateHeaderSchema>
export type SceneLiveStateEntityPageInput = z.infer<typeof sceneLiveStateEntityPageInputSchema>
export type SceneLiveEntityChangesPage = z.infer<typeof sceneLiveEntityChangesPageSchema>
export type SceneLiveChangesPageInput = z.infer<typeof sceneLiveChangesPageInputSchema>
export type SceneLiveEntity = z.infer<typeof sceneLiveEntitySchema>
export type SceneMeasurementsPageInput = z.infer<typeof sceneMeasurementsPageInputSchema>
export type SceneMeasurementsPage = z.infer<typeof sceneMeasurementsPageSchema>
