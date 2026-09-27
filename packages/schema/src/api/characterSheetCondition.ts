import { z, lazySchema } from '../zod.js'

const stringSchema = lazySchema(() => z.string())

export const characterSheetConditionDtoSchema = lazySchema(() =>
  z.object({
    conditionTypeId: z
      .string()
      .check(
        z.regex(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
          'Condition definition identity must be a canonical lowercase PostgreSQL UUID.'
        )
      ),
    label: stringSchema,
    description: z.optional(stringSchema),
    notes: z.optional(stringSchema)
  })
)
