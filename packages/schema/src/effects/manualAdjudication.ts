import { z } from 'zod'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const manualAdjudicationDtoSchema = z.object({
  id: authoredIdentifierSchema,
  effectKind: z.literal('MANUAL_ADJUDICATION')
})

export type ManualAdjudicationDto = z.infer<typeof manualAdjudicationDtoSchema>
