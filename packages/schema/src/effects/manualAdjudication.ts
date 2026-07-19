import { z } from 'zod'

export const manualAdjudicationDtoSchema = z.object({
  id: z.string(),
  effectKind: z.literal('MANUAL_ADJUDICATION')
})

export type ManualAdjudicationDto = z.infer<typeof manualAdjudicationDtoSchema>
