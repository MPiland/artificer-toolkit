import { z, lazySchema } from '../zod.js'

import { activationCodeSchema } from '../shared/enums.js'

export const activationDtoSchema = lazySchema(() =>
  z.discriminatedUnion('code', [
    z.object({ code: z.literal(activationCodeSchema._zod.def.entries.FREE) }),
    z.object({ code: z.literal(activationCodeSchema._zod.def.entries.ACTION), amount: z.number() }),
    z.object({
      code: z.literal(activationCodeSchema._zod.def.entries.BONUS_ACTION),
      amount: z.number()
    }),
    z.object({
      code: z.literal(activationCodeSchema._zod.def.entries.REACTION),
      amount: z.number()
    })
  ])
)
