import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  characterMechanicsReadInputSchema,
  characterSceneVisionResultSchema
} from './characterMechanicsRead.js'
import { campaignListInputSchema, campaignListPageSchema } from './campaignList.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt/scene'

const version = z.number().check(z.int()).check(z.nonnegative())

export const sceneSessionVisionCaptureInputSchema = z.strictObject({
  campaignId: postgresUuidSchema,
  systemId: postgresUuidSchema,
  sceneId: postgresUuidSchema,
  expectedSceneVersion: version,
  expectedPresentationVersion: version
})

export const sceneSessionVisionFreshnessSchema = z.strictObject({
  system: z.nullable(postgresUuidSchema),
  campaign: z.nullable(postgresUuidSchema),
  play: z.nullable(postgresUuidSchema)
})

export const sceneSessionVisionScopeSchema = z.extend(sceneSessionVisionCaptureInputSchema, {
  freshness: sceneSessionVisionFreshnessSchema
})

export const sceneSessionVisionRunSchema = z.extend(sceneSessionVisionScopeSchema, {
  encounterId: postgresUuidSchema,
  expectedEncounterVersion: version
})

export const sceneSessionCharacterVisionInputSchema = z.extend(sceneSessionVisionRunSchema, {
  ...characterMechanicsReadInputSchema.shape,
  actorId: postgresUuidSchema,
  tokenId: postgresUuidSchema
})

export const sceneSessionVisionRunsInputSchema = z.extend(
  sceneSessionVisionScopeSchema,
  campaignListInputSchema.shape
)

export const sceneSessionVisionRunsPageSchema = z.extend(campaignListPageSchema, {
  page: z.array(sceneSessionVisionRunSchema)
})

export const sceneSessionVisionBindingsInputSchema = z.extend(
  sceneSessionVisionRunSchema,
  campaignListInputSchema.shape
)

export const sceneSessionVisionBindingsPageSchema = z.extend(campaignListPageSchema, {
  page: z.array(sceneSessionCharacterVisionInputSchema)
})

export const sceneSessionCharacterVisionResultSchema = z.strictObject({
  binding: z.strictObject({
    encounterId: postgresUuidSchema,
    actorId: postgresUuidSchema,
    characterId: postgresUuidSchema,
    tokenId: postgresUuidSchema
  }),
  characterVision: characterSceneVisionResultSchema,
  characterRevision: z.nullable(postgresUuidSchema),
  snapshotChecksum: projectionChecksumSchema
})

export const sceneSessionVisionCharacterRevisionsSchema = z
  .array(
    z.strictObject({ characterId: postgresUuidSchema, revision: z.nullable(postgresUuidSchema) })
  )
  .check(z.maxLength(VTT_SCENE_LIMITS.tokens))

export const sceneSessionVisionCompositionSchema = z.strictObject({
  context: z.strictObject({
    encounterCharacterBindings: z
      .array(sceneSessionCharacterVisionResultSchema.shape.binding)
      .check(z.maxLength(VTT_SCENE_LIMITS.tokens)),
    characterVisions: z
      .array(characterSceneVisionResultSchema)
      .check(z.maxLength(VTT_SCENE_LIMITS.tokens))
  }),
  characterRevisions: sceneSessionVisionCharacterRevisionsSchema
})

export type SceneSessionVisionComposition = z.infer<typeof sceneSessionVisionCompositionSchema>

export type SceneSessionCharacterVisionInput = z.infer<
  typeof sceneSessionCharacterVisionInputSchema
>
export type SceneSessionCharacterVisionResult = z.infer<
  typeof sceneSessionCharacterVisionResultSchema
>
export type SceneSessionVisionScope = z.infer<typeof sceneSessionVisionScopeSchema>
export type SceneSessionVisionCaptureInput = z.infer<typeof sceneSessionVisionCaptureInputSchema>
export type SceneSessionVisionFreshness = z.infer<typeof sceneSessionVisionFreshnessSchema>
export type SceneSessionVisionRun = z.infer<typeof sceneSessionVisionRunSchema>
export type SceneSessionVisionRunsInput = z.infer<typeof sceneSessionVisionRunsInputSchema>
export type SceneSessionVisionRunsPage = z.infer<typeof sceneSessionVisionRunsPageSchema>
export type SceneSessionVisionBindingsInput = z.infer<typeof sceneSessionVisionBindingsInputSchema>
export type SceneSessionVisionBindingsPage = z.infer<typeof sceneSessionVisionBindingsPageSchema>
