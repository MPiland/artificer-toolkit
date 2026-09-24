import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { authoredSubjectKindSchema } from '../projections/identity.js'

const ids = (maximum: number) =>
  z
    .array(postgresUuidSchema)
    .check(z.maxLength(maximum))
    .check(z.refine((value) => new Set(value).size === value.length, 'Known IDs must be unique.'))

const rootReferenceSchema = z.strictObject({
  id: postgresUuidSchema,
  systemId: postgresUuidSchema,
  subjectKind: authoredSubjectKindSchema
})
const rootReferences = z
  .array(rootReferenceSchema)
  .check(z.maxLength(32))
  .check(
    z.refine(
      (value) => new Set(value.map((reference) => reference.id)).size === value.length,
      'Known root references must be unique.'
    )
  )

export const developmentAccountDeletionKnownSchema = z.strictObject({
  characterIds: ids(8),
  sourceIds: ids(8),
  campaignIds: ids(32),
  rootReferences,
  dependentRootReferences: rootReferences,
  definitionIds: ids(32),
  blueprintIds: ids(8),
  copyDestinationIds: ids(16),
  mediaAssetIds: ids(32),
  socialProfileId: z.nullable(postgresUuidSchema)
})

export const developmentAccountDeletionScopeSchema = z.enum([
  'IDENTITY',
  'CHARACTERS',
  'AUTHORED',
  'DEFERRED'
])

export const developmentAccountDeletionInspectInputSchema = z.strictObject({
  auditorUserId: postgresUuidSchema,
  subjectUserId: postgresUuidSchema,
  authUserId: z.string().check(z.minLength(1)),
  email: z.string().check(z.regex(/^draft_[0-9a-f]{12}@example\.invalid$/)),
  scope: developmentAccountDeletionScopeSchema,
  known: z.optional(developmentAccountDeletionKnownSchema)
})

export const developmentAccountDeletionInspectResultSchema = z.strictObject({
  stateJson: z.string(),
  known: developmentAccountDeletionKnownSchema
})

export type DevelopmentAccountDeletionKnown = z.output<typeof developmentAccountDeletionKnownSchema>
export type DevelopmentAccountDeletionInspectInput = z.output<
  typeof developmentAccountDeletionInspectInputSchema
>
export type DevelopmentAccountDeletionInspectResult = z.output<
  typeof developmentAccountDeletionInspectResultSchema
>
