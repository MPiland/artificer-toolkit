import { z } from 'zod'

import { manifestBehaviorPathDtoSchema, pathDtoSchema } from './path.js'
import { activationCodeSchema, invocationKindSchema, triggerCodeSchema } from '../shared/enums.js'
import { rangeDtoSchema } from '../shared/range.js'
import { savingThrowDtoSchema } from '../shared/savingThrow.js'
import { shapeDtoSchema } from '../shared/shape.js'
import { targetingDtoSchema } from './targeting.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema
} from '../shared/authoredLimits.js'

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

const resourceUseDtoSchema = z.object({
  chargeId: authoredIdentifierSchema,
  cost: z.number().int().positive()
})

export const invocationDtoSchema = z.union([
  z.object({
    kind: z.literal(invocationKindSchema.enum.PASSIVE),
    triggerCode: z.literal(triggerCodeSchema.enum.SAVING_THROW),
    savingThrow: savingThrowDtoSchema,
    range: rangeDtoSchema,
    shape: shapeDtoSchema.optional(),
    targeting: targetingDtoSchema.optional(),
    resourceUse: z.never().optional()
  }),
  z.object({
    kind: z.literal(invocationKindSchema.enum.PASSIVE),
    triggerCode: z.enum([
      triggerCodeSchema.enum.ACTIVATED,
      triggerCodeSchema.enum.MELEE_WEAPON_ATTACK,
      triggerCodeSchema.enum.RANGED_WEAPON_ATTACK,
      triggerCodeSchema.enum.UNARMED_ATTACK,
      triggerCodeSchema.enum.SPELL_ATTACK,
      triggerCodeSchema.enum.INCOMING_SAVING_THROW,
      triggerCodeSchema.enum.ENTER_AREA
    ]),
    range: rangeDtoSchema,
    shape: shapeDtoSchema.optional(),
    targeting: targetingDtoSchema.optional(),
    resourceUse: z.never().optional()
  }),
  z.object({
    kind: z.literal(invocationKindSchema.enum.ACTION).optional(),
    triggerCode: z.literal(triggerCodeSchema.enum.SAVING_THROW),
    savingThrow: savingThrowDtoSchema,
    activation: activationDtoSchema,
    range: rangeDtoSchema,
    shape: shapeDtoSchema.optional(),
    targeting: targetingDtoSchema.optional(),
    resourceUse: resourceUseDtoSchema.optional()
  }),
  z.object({
    kind: z.literal(invocationKindSchema.enum.ACTION).optional(),
    triggerCode: z.enum([
      triggerCodeSchema.enum.ACTIVATED,
      triggerCodeSchema.enum.MELEE_WEAPON_ATTACK,
      triggerCodeSchema.enum.RANGED_WEAPON_ATTACK,
      triggerCodeSchema.enum.UNARMED_ATTACK,
      triggerCodeSchema.enum.SPELL_ATTACK,
      triggerCodeSchema.enum.INCOMING_SAVING_THROW,
      triggerCodeSchema.enum.ENTER_AREA
    ]),
    activation: activationDtoSchema,
    range: rangeDtoSchema,
    shape: shapeDtoSchema.optional(),
    targeting: targetingDtoSchema.optional(),
    resourceUse: resourceUseDtoSchema.optional()
  })
])

const createEffectDtoSchema = <TPathSchema extends z.ZodTypeAny>(pathSchema: TPathSchema) =>
  z.object({
    id: authoredIdentifierSchema,
    order: z.number().int(),
    invocation: invocationDtoSchema,
    paths: authoredNestedCollectionSchema(pathSchema).min(1)
  })

export const effectDtoSchema = createEffectDtoSchema(pathDtoSchema)
export const manifestNestedBehaviorDtoSchema = createEffectDtoSchema(manifestBehaviorPathDtoSchema)

export type EffectDto = z.infer<typeof effectDtoSchema>
