import { z, lazySchema } from '../zod.js'

export const diceExpressionDtoSchema = lazySchema(() =>
  z.object({
    count: z.number().check(z.int()).check(z.positive()),
    die: z.number().check(z.int()).check(z.gte(2)),
    modifier: z.number().check(z.int())
  })
)

export type DiceExpressionDto = z.infer<typeof diceExpressionDtoSchema>
