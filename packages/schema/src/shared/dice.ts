import { z } from 'zod'

export const diceExpressionDtoSchema = z.object({
  count: z.number().int().positive(),
  die: z.number().int().min(2),
  modifier: z.number().int()
})

export type DiceExpressionDto = z.infer<typeof diceExpressionDtoSchema>
