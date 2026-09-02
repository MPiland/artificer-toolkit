import { z } from 'zod'

import { activationCodeSchema } from '../shared/enums.js'

export const activationDtoSchema = z.discriminatedUnion('code', [
  z.object({ code: z.literal(activationCodeSchema.enum.FREE) }),
  z.object({ code: z.literal(activationCodeSchema.enum.ACTION), amount: z.number() }),
  z.object({ code: z.literal(activationCodeSchema.enum.BONUS_ACTION), amount: z.number() }),
  z.object({ code: z.literal(activationCodeSchema.enum.REACTION), amount: z.number() })
])
