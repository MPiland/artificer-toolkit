import { z, lazySchema } from '../zod.js'

import {
  reusableDefinitionCurrentDtoSchema,
  reusableDefinitionDocumentDtoSchema,
  reusableDefinitionDraftDtoSchema,
  reusableDefinitionFamilyKeyDtoSchema
} from '../shared/reusableDefinitions.js'
import { postgresUuidSchema as serverUuidIdentityDtoSchema } from '../shared/postgresUuid.js'

const labelSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))
)
const descriptionSchema = lazySchema(() =>
  z.nullable(z.string().check(z.trim()).check(z.maxLength(4_000)))
)

export const reusableDefinitionSummaryDtoSchema = lazySchema(() =>
  z.strictObject({
    id: serverUuidIdentityDtoSchema,
    gameSystemId: serverUuidIdentityDtoSchema,
    contentSourceId: serverUuidIdentityDtoSchema,
    definitionFamilyKey: reusableDefinitionFamilyKeyDtoSchema,
    label: labelSchema,
    description: descriptionSchema,
    version: z.number().check(z.int()).check(z.gte(0)),
    sourceKind: z.enum(['PLATFORM', 'USER']),
    editable: z.boolean(),
    currentVersion: z.nullable(z.number().check(z.int()).check(z.gte(0))),
    draftVersion: z.nullable(z.number().check(z.int()).check(z.gte(0)))
  })
)

export const reusableDefinitionWorkspaceDtoSchema = lazySchema(() =>
  z.extend(reusableDefinitionSummaryDtoSchema, {
    current: z.nullable(reusableDefinitionCurrentDtoSchema),
    draft: z.nullable(reusableDefinitionDraftDtoSchema)
  })
)

export const listReusableDefinitionsPageInputDtoSchema = lazySchema(() =>
  z.strictObject({
    gameSystemId: serverUuidIdentityDtoSchema,
    cursor: z.nullable(z.string()),
    limit: z.number().check(z.int()).check(z.gte(1)).check(z.lte(10))
  })
)

export const reusableDefinitionListPageDtoSchema = lazySchema(() =>
  z.strictObject({
    page: z.array(reusableDefinitionSummaryDtoSchema),
    isDone: z.boolean(),
    continueCursor: z.string()
  })
)

export const getReusableDefinitionInputDtoSchema = lazySchema(() =>
  z.strictObject({
    definitionId: serverUuidIdentityDtoSchema
  })
)

export const createReusableDefinitionInputDtoSchema = lazySchema(() =>
  z.strictObject({
    gameSystemId: serverUuidIdentityDtoSchema,
    definitionFamilyKey: reusableDefinitionFamilyKeyDtoSchema,
    label: labelSchema,
    description: z._default(descriptionSchema, null)
  })
)

export const saveReusableDefinitionDraftInputDtoSchema = lazySchema(() =>
  z.strictObject({
    definitionId: serverUuidIdentityDtoSchema,
    expectedDefinitionVersion: z.number().check(z.int()).check(z.gte(0)),
    expectedDraftVersion: z.nullable(z.number().check(z.int()).check(z.gte(0))),
    document: reusableDefinitionDocumentDtoSchema
  })
)

export const publishReusableDefinitionDraftInputDtoSchema = lazySchema(() =>
  z.strictObject({
    definitionId: serverUuidIdentityDtoSchema,
    expectedDefinitionVersion: z.number().check(z.int()).check(z.gte(0)),
    expectedDraftVersion: z.number().check(z.int()).check(z.gte(0))
  })
)

export type ReusableDefinitionWorkspaceDto = z.infer<typeof reusableDefinitionWorkspaceDtoSchema>
export type ListReusableDefinitionsPageInputDto = z.infer<
  typeof listReusableDefinitionsPageInputDtoSchema
>
export type ReusableDefinitionListPageDto = z.infer<typeof reusableDefinitionListPageDtoSchema>
export type CreateReusableDefinitionInputDto = z.infer<
  typeof createReusableDefinitionInputDtoSchema
>
export type SaveReusableDefinitionDraftInputDto = z.infer<
  typeof saveReusableDefinitionDraftInputDtoSchema
>
export type PublishReusableDefinitionDraftInputDto = z.infer<
  typeof publishReusableDefinitionDraftInputDtoSchema
>
