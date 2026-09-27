import { z, lazySchema } from '../zod.js'

export const resourceIdParamsDtoSchema = lazySchema(() =>
  z.object({
    id: z.string().check(z.minLength(1))
  })
)

export const ownerContextDtoSchema = lazySchema(() =>
  z.object({
    userId: z.string(),
    systemId: z.string()
  })
)

export const authoredContentProvenanceDtoSchema = lazySchema(() =>
  z.object({
    kind: z.enum(['MASTER', 'OWNED']),
    ownerUserId: z.nullable(z.string())
  })
)

export const authoredContentPermissionsDtoSchema = lazySchema(() =>
  z.object({
    canView: z.boolean(),
    canEdit: z.boolean(),
    canCopy: z.boolean(),
    canDelete: z.boolean()
  })
)

export function authoredResourceResponseDtoSchema<
  TSchema extends z.ZodMiniType,
  TExtrasShape extends z.core.$ZodShape
>(itemSchema: TSchema, extrasSchema: z.ZodMiniObject<TExtrasShape>) {
  const base = z.object({
    item: z.nullable(itemSchema),
    publicId: z.string(),
    provenance: authoredContentProvenanceDtoSchema,
    permissions: authoredContentPermissionsDtoSchema
  })

  return z.nullable(z.extend(base, extrasSchema.shape))
}

export function listResponseDtoSchema<TSchema extends z.ZodMiniType>(itemSchema: TSchema) {
  return z.object({
    items: z.array(itemSchema),
    meta: z.record(z.string(), z.unknown())
  })
}

export function singleResourceResponseDtoSchema<TSchema extends z.ZodMiniType>(
  itemSchema: TSchema
) {
  return z.nullable(itemSchema)
}

export type AuthoredContentProvenanceDto = z.infer<typeof authoredContentProvenanceDtoSchema>
export type AuthoredContentPermissionsDto = z.infer<typeof authoredContentPermissionsDtoSchema>
