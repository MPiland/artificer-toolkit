import { z, lazySchema, lazySchemaParts } from '../zod.js'
import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt/scene'
import {
  sceneDefinitionSettingsDtoSchema,
  sceneAnnotationDtoSchema,
  sceneBarrierDtoSchema,
  sceneDarknessZoneDtoSchema,
  sceneLightDtoSchema,
  sceneTokenDtoSchema,
  campaignLiveSceneSummaryDtoSchema
} from './vttScenes.js'
import { campaignListPageSchema } from './campaignList.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

const uuid = postgresUuidSchema
const count = (maximum: number) => z.number().check(z.int()).check(z.gte(0)).check(z.lte(maximum))
export const sceneDefinitionCountsSchema = lazySchema(() =>
  z.strictObject({
    annotations: count(VTT_SCENE_LIMITS.annotations),
    barriers: count(VTT_SCENE_LIMITS.barriers),
    darknessZones: count(VTT_SCENE_LIMITS.darknessZones),
    lights: count(VTT_SCENE_LIMITS.lights),
    tokens: count(VTT_SCENE_LIMITS.tokens)
  })
)
export const sceneDefinitionCollectionSchema = lazySchema(() =>
  z.enum(['annotations', 'barriers', 'darknessZones', 'lights', 'tokens'])
)

// Eight largest legal polygons remain below 512 KiB before document envelopes.
// This is a transport batch size, not an additional limit on a Scene.
export const SCENE_DEFINITION_BATCH_SIZE = 8
const batchBase = lazySchemaParts(() => ({
  saveId: uuid,
  offset: count(VTT_SCENE_LIMITS.barriers)
}))
export const appendSceneDefinitionInputSchema = lazySchema(() =>
  z.discriminatedUnion('collection', [
    z.strictObject({
      ...batchBase(),
      collection: z.literal('annotations'),
      entities: z
        .array(sceneAnnotationDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(SCENE_DEFINITION_BATCH_SIZE))
    }),
    z.strictObject({
      ...batchBase(),
      collection: z.literal('barriers'),
      entities: z
        .array(sceneBarrierDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(SCENE_DEFINITION_BATCH_SIZE))
    }),
    z.strictObject({
      ...batchBase(),
      collection: z.literal('darknessZones'),
      entities: z
        .array(sceneDarknessZoneDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(SCENE_DEFINITION_BATCH_SIZE))
    }),
    z.strictObject({
      ...batchBase(),
      collection: z.literal('lights'),
      entities: z
        .array(sceneLightDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(SCENE_DEFINITION_BATCH_SIZE))
    }),
    z.strictObject({
      ...batchBase(),
      collection: z.literal('tokens'),
      entities: z
        .array(sceneTokenDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(SCENE_DEFINITION_BATCH_SIZE))
    })
  ])
)
export const sceneDefinitionEntitySchema = lazySchema(() =>
  z.discriminatedUnion('collection', [
    z.strictObject({ collection: z.literal('annotations'), entity: sceneAnnotationDtoSchema }),
    z.strictObject({ collection: z.literal('barriers'), entity: sceneBarrierDtoSchema }),
    z.strictObject({ collection: z.literal('darknessZones'), entity: sceneDarknessZoneDtoSchema }),
    z.strictObject({ collection: z.literal('lights'), entity: sceneLightDtoSchema }),
    z.strictObject({ collection: z.literal('tokens'), entity: sceneTokenDtoSchema })
  ])
)
export const beginSceneDefinitionInputSchema = lazySchema(() =>
  z
    .strictObject({
      commandId: uuid,
      sceneId: z.nullable(uuid),
      expectedVersion: z.nullable(z.number().check(z.int()).check(z.positive())),
      settings: sceneDefinitionSettingsDtoSchema,
      counts: sceneDefinitionCountsSchema
    })
    .check(
      z.superRefine((input, ctx) => {
        if ((input.sceneId === null) !== (input.expectedVersion === null))
          ctx.addIssue({
            code: 'custom',
            path: ['expectedVersion'],
            message: 'Existing Scene definitions require their current version.'
          })
      })
    )
)
export const sceneDefinitionSaveLookupSchema = lazySchema(() => z.strictObject({ saveId: uuid }))
export const sceneDefinitionSaveProgressSchema = lazySchema(() =>
  z.strictObject({
    saveId: uuid,
    sceneId: uuid,
    version: z.number().check(z.int()).check(z.positive()),
    status: z.enum(['RECEIVING', 'PUBLISHED', 'EXPIRED']),
    counts: sceneDefinitionCountsSchema,
    received: sceneDefinitionCountsSchema,
    liveSceneId: z.nullable(uuid)
  })
)
export const sceneDefinitionHeaderSchema = lazySchema(() =>
  z.extend(sceneDefinitionSettingsDtoSchema, {
    id: uuid,
    version: z.number().check(z.int()).check(z.positive()),
    saveId: uuid,
    counts: sceneDefinitionCountsSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
)
const pageInput = lazySchema(() =>
  z.strictObject({
    cursor: z.nullable(z.string()),
    numItems: z.number().check(z.int()).check(z.gte(1)).check(z.lte(SCENE_DEFINITION_BATCH_SIZE)),
    endCursor: z.optional(z.nullable(z.string())),
    id: z.optional(z.number())
  })
)
export const sceneDefinitionListInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuid,
    paginationOpts: pageInput
  })
)
export const sceneDefinitionListPageSchema = lazySchema(() =>
  z.extend(campaignListPageSchema, {
    page: z.array(sceneDefinitionHeaderSchema)
  })
)
export const campaignLiveSceneListPageSchema = lazySchema(() =>
  z.extend(campaignListPageSchema, {
    page: z.array(campaignLiveSceneSummaryDtoSchema)
  })
)
export const sceneDefinitionEntityPageInputSchema = lazySchema(() =>
  z.extend(sceneDefinitionListInputSchema, {
    sceneId: uuid,
    saveId: uuid,
    collection: sceneDefinitionCollectionSchema
  })
)
export const sceneDefinitionEntityPageSchema = lazySchema(() =>
  z.extend(campaignListPageSchema, {
    page: z.array(
      z.strictObject({
        ordinal: count(VTT_SCENE_LIMITS.barriers),
        value: sceneDefinitionEntitySchema
      })
    )
  })
)
export type BeginSceneDefinitionInput = z.infer<typeof beginSceneDefinitionInputSchema>
export type AppendSceneDefinitionInput = z.infer<typeof appendSceneDefinitionInputSchema>
export type SceneDefinitionSaveProgress = z.infer<typeof sceneDefinitionSaveProgressSchema>
export type SceneDefinitionHeader = z.infer<typeof sceneDefinitionHeaderSchema>
export type SceneDefinitionEntity = z.infer<typeof sceneDefinitionEntitySchema>
export type SceneDefinitionEntityPageInput = z.infer<typeof sceneDefinitionEntityPageInputSchema>
export type SceneDefinitionEntityPage = z.infer<typeof sceneDefinitionEntityPageSchema>
export type SceneDefinitionListInput = z.infer<typeof sceneDefinitionListInputSchema>
export type SceneDefinitionListPage = z.infer<typeof sceneDefinitionListPageSchema>
