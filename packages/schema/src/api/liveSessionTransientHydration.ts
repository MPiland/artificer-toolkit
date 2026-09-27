import { z, lazySchema } from '../zod.js'
import {
  liveSessionTransientCaptureInputSchema,
  type LiveSessionTransientCaptureInput
} from './liveSessionTransient.js'
import {
  sceneCurrentEntityPageInputSchema,
  sceneCurrentEntityPageSchema,
  type SceneCurrentEntityPage,
  type SceneCurrentEntityPageInput
} from './sceneRecipient.js'
import {
  sceneFogChunksPageInputSchema,
  sceneFogChunksPageSchema,
  sceneFogLayersPageInputSchema,
  sceneFogLayersPageSchema,
  type SceneFogChunksPage,
  type SceneFogChunksPageInput,
  type SceneFogLayersPage,
  type SceneFogLayersPageInput
} from './sceneFog.js'
import {
  sceneSessionCharacterVisionInputSchema,
  sceneSessionCharacterVisionResultSchema,
  sceneSessionVisionBindingsInputSchema,
  sceneSessionVisionBindingsPageSchema,
  sceneSessionVisionRunsInputSchema,
  sceneSessionVisionRunsPageSchema,
  type SceneSessionCharacterVisionInput,
  type SceneSessionCharacterVisionResult,
  type SceneSessionVisionBindingsInput,
  type SceneSessionVisionBindingsPage,
  type SceneSessionVisionRunsInput,
  type SceneSessionVisionRunsPage
} from './sceneSessionVision.js'

export const liveSessionTransientHydrationAuthoritySchema = lazySchema(() =>
  z.pick(liveSessionTransientCaptureInputSchema, {
    campaignId: true,
    expectedRole: true,
    expectedUserId: true
  })
)

const entitiesRequestSchema = lazySchema(() =>
  z.extend(sceneCurrentEntityPageInputSchema, {
    kind: z.literal('ENTITIES')
  })
)
const fogLayersRequestSchema = lazySchema(() =>
  z.extend(sceneFogLayersPageInputSchema, {
    kind: z.literal('FOG_LAYERS')
  })
)
const fogChunksRequestSchema = lazySchema(() =>
  z.extend(sceneFogChunksPageInputSchema, {
    kind: z.literal('FOG_CHUNKS')
  })
)
const visionRunsRequestSchema = lazySchema(() =>
  z.extend(sceneSessionVisionRunsInputSchema, {
    kind: z.literal('VISION_RUNS')
  })
)
const visionBindingsRequestSchema = lazySchema(() =>
  z.extend(sceneSessionVisionBindingsInputSchema, {
    kind: z.literal('VISION_BINDINGS')
  })
)
const visionCharacterRequestSchema = lazySchema(() =>
  z.extend(sceneSessionCharacterVisionInputSchema, {
    kind: z.literal('VISION_CHARACTER')
  })
)

export const liveSessionTransientHydrationRequestSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    entitiesRequestSchema,
    fogLayersRequestSchema,
    fogChunksRequestSchema,
    visionRunsRequestSchema,
    visionBindingsRequestSchema,
    visionCharacterRequestSchema
  ])
)

export const liveSessionTransientHydrationInputSchema = lazySchema(() =>
  z.strictObject({
    authority: liveSessionTransientHydrationAuthoritySchema,
    request: liveSessionTransientHydrationRequestSchema
  })
)

export const liveSessionTransientHydrationResponseSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('ENTITIES'), result: sceneCurrentEntityPageSchema }),
    z.strictObject({ kind: z.literal('FOG_LAYERS'), result: sceneFogLayersPageSchema }),
    z.strictObject({ kind: z.literal('FOG_CHUNKS'), result: sceneFogChunksPageSchema }),
    z.strictObject({ kind: z.literal('VISION_RUNS'), result: sceneSessionVisionRunsPageSchema }),
    z.strictObject({
      kind: z.literal('VISION_BINDINGS'),
      result: sceneSessionVisionBindingsPageSchema
    }),
    z.strictObject({
      kind: z.literal('VISION_CHARACTER'),
      result: sceneSessionCharacterVisionResultSchema
    })
  ])
)

export type LiveSessionTransientHydrationAuthority = z.infer<
  typeof liveSessionTransientHydrationAuthoritySchema
>
export type LiveSessionTransientHydrationInput = z.infer<
  typeof liveSessionTransientHydrationInputSchema
>
export type LiveSessionTransientHydrationResponse = z.infer<
  typeof liveSessionTransientHydrationResponseSchema
>
export type LiveSessionTransientHydrationRequest = z.infer<
  typeof liveSessionTransientHydrationRequestSchema
>
export type LiveSessionTransientHydrationRequestByKind = {
  ENTITIES: SceneCurrentEntityPageInput
  FOG_LAYERS: SceneFogLayersPageInput
  FOG_CHUNKS: SceneFogChunksPageInput
  VISION_RUNS: SceneSessionVisionRunsInput
  VISION_BINDINGS: SceneSessionVisionBindingsInput
  VISION_CHARACTER: SceneSessionCharacterVisionInput
}
export type LiveSessionTransientHydrationResultByKind = {
  ENTITIES: SceneCurrentEntityPage
  FOG_LAYERS: SceneFogLayersPage
  FOG_CHUNKS: SceneFogChunksPage
  VISION_RUNS: SceneSessionVisionRunsPage
  VISION_BINDINGS: SceneSessionVisionBindingsPage
  VISION_CHARACTER: SceneSessionCharacterVisionResult
}
export type { LiveSessionTransientCaptureInput }
