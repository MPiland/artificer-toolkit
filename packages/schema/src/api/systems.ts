import { z, lazySchema } from '../zod.js'

import { singleResourceResponseDtoSchema } from './common.js'
import { systemAuthoredDtoSchema } from '../vocabulary/system.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

export const rulesCatalogueListItemDtoSchema = lazySchema(() =>
  z.strictObject({
    id: z.string().check(z.uuid()),
    label: z.string().check(z.trim()).check(z.minLength(1)),
    description: z.nullable(z.string())
  })
)

export const systemListItemDtoSchema = lazySchema(() =>
  z.object({
    id: z.string(),
    label: z.string(),
    description: z.optional(z.nullable(z.string())),
    rulesetCode: z.string(),
    rulesetVersion: z.string(),
    userId: z.string(),
    rulesCatalogues: z.array(rulesCatalogueListItemDtoSchema)
  })
)

export const systemListResponseDtoSchema = lazySchema(() => z.array(systemListItemDtoSchema))
export const systemResponseDtoSchema = lazySchema(() =>
  singleResourceResponseDtoSchema(systemAuthoredDtoSchema)
)

export const systemLookupInputDtoSchema = lazySchema(() =>
  z.strictObject({ id: postgresUuidSchema })
)
export const systemListPageInputDtoSchema = lazySchema(() =>
  z.strictObject({
    cursor: z.nullable(z.string()),
    limit: z.number().check(z.int()).check(z.gte(1)).check(z.lte(10))
  })
)
export const systemListPageDtoSchema = lazySchema(() =>
  z.strictObject({
    page: systemListResponseDtoSchema,
    isDone: z.boolean(),
    continueCursor: z.string()
  })
)

export type SystemListItemDto = z.infer<typeof systemListItemDtoSchema>
export type RulesCatalogueListItemDto = z.infer<typeof rulesCatalogueListItemDtoSchema>
export type SystemListResponseDto = z.infer<typeof systemListResponseDtoSchema>
export type SystemResponseDto = z.infer<typeof systemResponseDtoSchema>
export type SystemLookupInputDto = z.input<typeof systemLookupInputDtoSchema>
export type SystemListPageInputDto = z.infer<typeof systemListPageInputDtoSchema>
export type SystemListPageDto = z.infer<typeof systemListPageDtoSchema>
