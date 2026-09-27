import { z, lazySchema } from '../zod.js'

export const castingTimeDtoSchema = lazySchema(() =>
  z.object({
    unit: z.enum(['ROUND', 'MINUTE', 'HOUR']),
    amount: z.number()
  })
)
