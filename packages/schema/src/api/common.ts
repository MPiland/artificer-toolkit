import { z } from 'zod'

export const resourceIdParamsDtoSchema = z.object({
  id: z.string().min(1)
})

export const ownerContextDtoSchema = z.object({
  userId: z.string(),
  systemId: z.string()
})

export function listResponseDtoSchema<TSchema extends z.ZodTypeAny>(
  itemSchema: TSchema
) {
  return z.object({
    items: z.array(itemSchema),
    meta: z.record(z.string(), z.unknown())
  })
}

export function singleResourceResponseDtoSchema<TSchema extends z.ZodTypeAny>(
  itemSchema: TSchema
) {
  return itemSchema.nullable()
}
