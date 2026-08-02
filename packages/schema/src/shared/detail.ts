import { z } from 'zod'
import {
  authoredIdentifierSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from './authoredLimits.js'

export const detailDtoSchema = z.object({
  id: authoredIdentifierSchema,
  label: authoredShortTextSchema,
  description: authoredRichTextSchema,
  order: z.number().int()
})

export type DetailDto = z.infer<typeof detailDtoSchema>
