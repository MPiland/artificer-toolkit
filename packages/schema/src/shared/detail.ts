import { z } from '../zod.js'
import {
  authoredIdentifierSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from './authoredLimits.js'

export const detailDtoSchema = z.object({
  id: authoredIdentifierSchema,
  label: authoredShortTextSchema,
  description: authoredRichTextSchema,
  order: z.number().check(z.int())
})

export type DetailDto = z.infer<typeof detailDtoSchema>
