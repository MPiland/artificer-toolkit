import { z } from 'zod'

export const speedDtoSchema = z.object({
  speedId: z.string(),
  amount: z.number(),
  unit: z.string()
})

export type SpeedDto = z.infer<typeof speedDtoSchema>
