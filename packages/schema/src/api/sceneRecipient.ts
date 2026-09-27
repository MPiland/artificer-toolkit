import { z, lazySchema } from '../zod.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  sceneGeometryPageInputSchema,
  sceneGeometryPageSchema,
  sceneGeometryPageEntrySchema
} from './sceneGeometry.js'
import {
  sceneLiveCollectionSchema,
  sceneLiveEntitySchema,
  sceneLiveStateHeaderSchema
} from './sceneLiveState.js'
import {
  campaignSceneStateDtoSchema,
  encounterSceneActorTokenBindingDtoSchema
} from './vttScenes.js'

export const sceneCurrentEntityPageInputSchema = lazySchema(() =>
  z.extend(sceneGeometryPageInputSchema, {
    collection: sceneLiveCollectionSchema
  })
)
const currentEntry = lazySchema(() =>
  z.extend(sceneGeometryPageEntrySchema, {
    value: sceneLiveEntitySchema
  })
)
export const sceneCurrentEntityPageSchema = lazySchema(() =>
  z.extend(sceneGeometryPageSchema, {
    collection: sceneLiveCollectionSchema,
    page: z.array(currentEntry).check(z.maxLength(8))
  })
)
export const sceneRecipientPageInputSchema = lazySchema(() =>
  z.extend(
    z.omit(sceneCurrentEntityPageInputSchema, {
      definitionSaveId: true,
      phase: true,
      afterOrdinal: true
    }),
    {
      afterEntityId: z.nullable(postgresUuidSchema),
      expectedRecipientRevision: projectionChecksumSchema
    }
  )
)
export const sceneRecipientPageSchema = lazySchema(() =>
  z.extend(sceneCurrentEntityPageSchema, {
    page: z.array(z.omit(currentEntry, { ordinal: true })).check(z.maxLength(8)),
    next: z.nullable(postgresUuidSchema),
    recipientRevision: projectionChecksumSchema
  })
)
export const sceneRecipientHeaderSchema = lazySchema(() =>
  z.extend(
    z.omit(sceneLiveStateHeaderSchema, {
      definitionSaveId: true,
      counts: true,
      currentCounts: true,
      fogLayerCount: true
    }),
    {
      recipientRevision: projectionChecksumSchema,
      snapshot: z.optional(z.nullable(campaignSceneStateDtoSchema))
    }
  )
)
export const sceneRecipientCaptureInputSchema = lazySchema(() =>
  z.pick(sceneRecipientPageInputSchema, {
    sceneId: true,
    expectedVersion: true
  })
)
export const sceneRecipientHeaderInputSchema = lazySchema(() =>
  z.extend(z.pick(sceneRecipientCaptureInputSchema, { sceneId: true }), {
    includeSnapshot: z.optional(z.boolean())
  })
)
export const sceneEncounterBindingInputSchema = lazySchema(() =>
  z.strictObject({
    encounterId: postgresUuidSchema,
    sceneId: postgresUuidSchema
  })
)
export const sceneEncounterBindingSchema = lazySchema(() =>
  z.extend(sceneEncounterBindingInputSchema, {
    encounterVersion: z.number().check(z.int()).check(z.nonnegative())
  })
)
export const sceneRecipientEncounterBindingsInputSchema = lazySchema(() =>
  z.extend(z.omit(sceneRecipientPageInputSchema, { collection: true }), {
    encounterId: postgresUuidSchema,
    expectedEncounterVersion: z.number().check(z.int()).check(z.nonnegative())
  })
)
export const sceneRecipientEncounterBindingsPageSchema = lazySchema(() =>
  z.strictObject({
    sceneId: postgresUuidSchema,
    version: z.number().check(z.int()).check(z.nonnegative()),
    recipientRevision: projectionChecksumSchema,
    encounterId: postgresUuidSchema,
    encounterVersion: z.number().check(z.int()).check(z.nonnegative()),
    page: z.array(encounterSceneActorTokenBindingDtoSchema).check(z.maxLength(8)),
    next: z.nullable(postgresUuidSchema)
  })
)
export const sceneRecipientEncounterBindingsLookupInputSchema = lazySchema(() =>
  z.extend(sceneRecipientEncounterBindingsInputSchema, {
    tokenIds: z.array(postgresUuidSchema).check(z.maxLength(8))
  })
)
export const sceneRecipientCaptureSchema = lazySchema(() =>
  z.strictObject({
    header: sceneLiveStateHeaderSchema,
    viewer: z.strictObject({ role: z.enum(['GM', 'PLAYER']), userId: postgresUuidSchema }),
    campaignRevision: z.nullable(postgresUuidSchema)
  })
)

export type SceneCurrentEntityPageInput = z.infer<typeof sceneCurrentEntityPageInputSchema>
export type SceneCurrentEntityPage = z.infer<typeof sceneCurrentEntityPageSchema>
export type SceneRecipientPageInput = z.infer<typeof sceneRecipientPageInputSchema>
export type SceneRecipientPage = z.infer<typeof sceneRecipientPageSchema>
export type SceneRecipientHeader = z.infer<typeof sceneRecipientHeaderSchema>
export type SceneRecipientHeaderInput = z.infer<typeof sceneRecipientHeaderInputSchema>
export type SceneRecipientCapture = z.infer<typeof sceneRecipientCaptureSchema>
export type SceneEncounterBindingInput = z.infer<typeof sceneEncounterBindingInputSchema>
export type SceneEncounterBinding = z.infer<typeof sceneEncounterBindingSchema>
export type SceneRecipientEncounterBindingsInput = z.infer<
  typeof sceneRecipientEncounterBindingsInputSchema
>
export type SceneRecipientEncounterBindingsPage = z.infer<
  typeof sceneRecipientEncounterBindingsPageSchema
>
export type SceneRecipientEncounterBindingsLookupInput = z.infer<
  typeof sceneRecipientEncounterBindingsLookupInputSchema
>
