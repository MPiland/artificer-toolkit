import { z } from '../zod.js'

export const castingTimeDtoSchema = z.object({
  unit: z.enum(['ROUND', 'MINUTE', 'HOUR']),
  amount: z.number()
})
