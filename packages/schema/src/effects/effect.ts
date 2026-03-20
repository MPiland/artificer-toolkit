import { z } from 'zod'

import { branchDtoSchema } from './branch.js'
import { activationCodeSchema, triggerCodeSchema } from '../shared/enums.js'
import { rangeDtoSchema } from '../shared/range.js'
import { savingThrowDtoSchema } from '../shared/savingThrow.js'
import { shapeDtoSchema } from '../shared/shape.js'
import { targetingDtoSchema } from './targeting.js'

export const activationDtoSchema = z.discriminatedUnion('code', [
  z.object({
    code: z.literal(activationCodeSchema.enum.FREE)
  }),
  z.object({
    code: z.literal(activationCodeSchema.enum.ACTION),
    amount: z.number()
  }),
  z.object({
    code: z.literal(activationCodeSchema.enum.BONUS_ACTION),
    amount: z.number()
  }),
  z.object({
    code: z.literal(activationCodeSchema.enum.REACTION),
    amount: z.number()
  })
])

export const invocationDtoSchema = z.discriminatedUnion('triggerCode', [
  z.object({
    triggerCode: z.literal(triggerCodeSchema.enum.SAVING_THROW),
    savingThrow: savingThrowDtoSchema,
    activation: activationDtoSchema,
    range: rangeDtoSchema,
    shape: shapeDtoSchema.optional(),
    targeting: targetingDtoSchema.optional()
  }),
  z.object({
    triggerCode: z.enum([
      triggerCodeSchema.enum.ACTIVATED,
      triggerCodeSchema.enum.MELEE_WEAPON_ATTACK,
      triggerCodeSchema.enum.RANGED_WEAPON_ATTACK,
      triggerCodeSchema.enum.UNARMED_ATTACK,
      triggerCodeSchema.enum.SPELL_ATTACK,
      triggerCodeSchema.enum.ENTER_AREA
    ]),
    activation: activationDtoSchema,
    range: rangeDtoSchema,
    shape: shapeDtoSchema.optional(),
    targeting: targetingDtoSchema.optional()
  })
])

export const effectDtoSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  invocation: invocationDtoSchema,
  branches: z.array(branchDtoSchema)
})

export type EffectDto = z.infer<typeof effectDtoSchema>
