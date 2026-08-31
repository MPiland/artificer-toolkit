import { z } from 'zod'

import {
  reusableDefinitionCurrentDtoSchema,
  reusableDefinitionDocumentDtoSchema,
  reusableDefinitionDraftDtoSchema,
  reusableDefinitionFamilyKeyDtoSchema
} from '../shared/reusableDefinitions.js'
import { serverUuidIdentityDtoSchema } from '../shared/rulesExecution.js'

const labelSchema = z.string().trim().min(1).max(160)
const descriptionSchema = z.string().trim().max(4_000).nullable()

export const reusableDefinitionSummaryDtoSchema = z.strictObject({
  id: serverUuidIdentityDtoSchema,
  gameSystemId: serverUuidIdentityDtoSchema,
  contentSourceId: serverUuidIdentityDtoSchema,
  definitionFamilyKey: reusableDefinitionFamilyKeyDtoSchema,
  label: labelSchema,
  description: descriptionSchema,
  version: z.number().int().min(0),
  sourceKind: z.enum(['PLATFORM', 'USER']),
  editable: z.boolean(),
  currentVersion: z.number().int().min(0).nullable(),
  draftVersion: z.number().int().min(0).nullable()
})

export const reusableDefinitionWorkspaceDtoSchema = reusableDefinitionSummaryDtoSchema.extend({
  current: reusableDefinitionCurrentDtoSchema.nullable(),
  draft: reusableDefinitionDraftDtoSchema.nullable()
})

export const listReusableDefinitionsInputDtoSchema = z.strictObject({
  gameSystemId: serverUuidIdentityDtoSchema
})

export const getReusableDefinitionInputDtoSchema = z.strictObject({
  definitionId: serverUuidIdentityDtoSchema
})

export const createReusableDefinitionInputDtoSchema = z.strictObject({
  gameSystemId: serverUuidIdentityDtoSchema,
  definitionFamilyKey: reusableDefinitionFamilyKeyDtoSchema,
  label: labelSchema,
  description: descriptionSchema.default(null)
})

export const saveReusableDefinitionDraftInputDtoSchema = z.strictObject({
  definitionId: serverUuidIdentityDtoSchema,
  expectedDefinitionVersion: z.number().int().min(0),
  expectedDraftVersion: z.number().int().min(0).nullable(),
  document: reusableDefinitionDocumentDtoSchema
})

export const publishReusableDefinitionDraftInputDtoSchema = z.strictObject({
  definitionId: serverUuidIdentityDtoSchema,
  expectedDefinitionVersion: z.number().int().min(0),
  expectedDraftVersion: z.number().int().min(0)
})

export type ReusableDefinitionWorkspaceDto = z.infer<typeof reusableDefinitionWorkspaceDtoSchema>
export type ReusableDefinitionSummaryDto = z.infer<typeof reusableDefinitionSummaryDtoSchema>
export type CreateReusableDefinitionInputDto = z.infer<
  typeof createReusableDefinitionInputDtoSchema
>
export type SaveReusableDefinitionDraftInputDto = z.infer<
  typeof saveReusableDefinitionDraftInputDtoSchema
>
export type PublishReusableDefinitionDraftInputDto = z.infer<
  typeof publishReusableDefinitionDraftInputDtoSchema
>
