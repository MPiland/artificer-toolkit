import { z } from '../zod.js'
import {
  authoredIdentifierSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'

export const manualAdjudicationDtoSchema = z.object({
  id: authoredIdentifierSchema,
  effectKind: z.literal('MANUAL_ADJUDICATION'),
  label: authoredShortTextSchema,
  reasonCode: z.enum([
    'GM_CHOICE',
    'PLAYER_DECLARATION',
    'NARRATIVE_JUDGMENT',
    'EXTERNAL_WORLD_STATE'
  ]),
  instructions: authoredRichTextSchema
})

export type ManualAdjudicationDto = z.infer<typeof manualAdjudicationDtoSchema>
