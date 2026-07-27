import { z } from 'zod'

export const resourceIdParamsDtoSchema = z.object({
  id: z.string().min(1)
})

export const ownerContextDtoSchema = z.object({
  userId: z.string(),
  systemId: z.string()
})

export const authoredContentProvenanceDtoSchema = z.object({
  kind: z.enum(['MASTER', 'OWNED']),
  ownerUserId: z.string().nullable()
})

export const authoredContentPermissionsDtoSchema = z.object({
  canView: z.boolean(),
  canEdit: z.boolean(),
  canCopy: z.boolean(),
  canDelete: z.boolean()
})

export function authoredResourceResponseDtoSchema<
  TSchema extends z.ZodTypeAny,
  TExtrasShape extends z.ZodRawShape
>(itemSchema: TSchema, extrasSchema: z.ZodObject<TExtrasShape>) {
  const base = z.object({
    item: itemSchema.nullable(),
    publicId: z.string(),
    provenance: authoredContentProvenanceDtoSchema,
    permissions: authoredContentPermissionsDtoSchema
  })

  return base.merge(extrasSchema).nullable()
}

export function listResponseDtoSchema<TSchema extends z.ZodTypeAny>(itemSchema: TSchema) {
  return z.object({
    items: z.array(itemSchema),
    meta: z.record(z.string(), z.unknown())
  })
}

export function singleResourceResponseDtoSchema<TSchema extends z.ZodTypeAny>(itemSchema: TSchema) {
  return itemSchema.nullable()
}

export type AuthoredContentProvenanceDto = z.infer<typeof authoredContentProvenanceDtoSchema>
export type AuthoredContentPermissionsDto = z.infer<typeof authoredContentPermissionsDtoSchema>
