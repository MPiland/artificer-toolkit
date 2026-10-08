import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { characterSceneVisionResultSchema } from './characterMechanicsRead.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt/scene'

const version = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))

export const sceneSessionVisionCaptureInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: postgresUuidSchema,
    systemId: postgresUuidSchema,
    sceneId: postgresUuidSchema,
    expectedSceneVersion: version,
    expectedPresentationVersion: version
  })
)

export const sceneSessionVisionFreshnessSchema = lazySchema(() =>
  z.strictObject({
    system: z.nullable(postgresUuidSchema),
    campaign: z.nullable(postgresUuidSchema),
    play: z.nullable(postgresUuidSchema)
  })
)

export const sceneSessionVisionScopeSchema = lazySchema(() =>
  z.extend(sceneSessionVisionCaptureInputSchema, {
    freshness: sceneSessionVisionFreshnessSchema
  })
)

const sceneSessionCharacterVisionResultSchema = lazySchema(() =>
  z.strictObject({
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
)

export const sceneSessionVisionCharacterRevisionsSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({ characterId: postgresUuidSchema, revision: z.nullable(postgresUuidSchema) })
    )
    .check(z.maxLength(VTT_SCENE_LIMITS.tokens))
)

export const sceneSessionVisionCompositionSchema = lazySchema(() =>
  z.strictObject({
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
)

export type SceneSessionVisionComposition = z.infer<typeof sceneSessionVisionCompositionSchema>
export type SceneSessionVisionScope = z.infer<typeof sceneSessionVisionScopeSchema>
export type SceneSessionVisionCaptureInput = z.infer<typeof sceneSessionVisionCaptureInputSchema>
export type SceneSessionVisionFreshness = z.infer<typeof sceneSessionVisionFreshnessSchema>
