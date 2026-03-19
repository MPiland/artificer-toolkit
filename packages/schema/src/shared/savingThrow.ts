import { z } from 'zod'

export const savingThrowDtoSchema = z.union([
  z.object({
    id: z.string(),
    savingThrowKind: z.literal('SOURCE_SAVE_DC'),
    ability: z.string(),
    sourceAbility: z.string().optional()
  }),
  z.object({
    id: z.string(),
    savingThrowKind: z.literal('FIXED_VALUE'),
    ability: z.string(),
    dc: z.number().int()
  })
])

export type SavingThrowDto = z.infer<typeof savingThrowDtoSchema>
