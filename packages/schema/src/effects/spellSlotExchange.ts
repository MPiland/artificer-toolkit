import { z, lazySchema } from '../zod.js'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'
import { roundingCodeSchema } from '../shared/enums.js'

const spellSlotLevelSchema = z.number().check(z.int()).check(z.gte(1)).check(z.lte(9))

export const spellSlotExchangeDtoSchema = lazySchema(() =>
  z.intersection(
    z.object({
      id: authoredIdentifierSchema,
      effectKind: z.literal('SPELL_SLOT_EXCHANGE')
    }),
    z.discriminatedUnion('mode', [
      z.object({
        mode: z.literal('RECOVER_SLOTS'),
        levelBudget: z.object({
          classId: authoredIdentifierSchema,
          divisor: z.number().check(z.int()).check(z.gte(1)),
          rounding: roundingCodeSchema
        }),
        maximumSlotLevel: spellSlotLevelSchema
      }),
      z.object({
        mode: z.literal('SLOT_TO_RESOURCE'),
        chargeId: authoredIdentifierSchema,
        maximumSlotLevel: z.optional(spellSlotLevelSchema)
      }),
      z.object({
        mode: z.literal('RESOURCE_TO_SLOT'),
        chargeId: authoredIdentifierSchema,
        costs: z
          .array(
            z.object({
              slotLevel: spellSlotLevelSchema,
              cost: z.number().check(z.int()).check(z.gte(1))
            })
          )
          .check(z.minLength(1))
      })
    ])
  )
)

export type SpellSlotExchangeDto = z.infer<typeof spellSlotExchangeDtoSchema>
