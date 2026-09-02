import type { EffectAuthored, EffectInvocationAuthored } from '@artificer-toolkit/shared/authored'
import { z } from 'zod'

import { manifestBehaviorPathDtoSchema, pathDtoSchema } from './path.js'
import { activationCodeSchema, invocationKindSchema, triggerCodeSchema } from '../shared/enums.js'
import { activationDtoSchema } from './activation.js'
import { rangeDtoSchema } from '../shared/range.js'
import { savingThrowDtoSchema } from '../shared/savingThrow.js'
import { shapeDtoSchema } from '../shared/shape.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { reactionMovementTriggerBindingDtoSchema } from '../shared/reaction.js'
import { targetingDtoSchema } from './targeting.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema
} from '../shared/authoredLimits.js'

export { activationDtoSchema }

const reactionActivationDtoSchema = z.object({
  code: z.literal(activationCodeSchema.enum.REACTION),
  amount: z.number()
})

const resourceUseDtoSchema = z.object({
  chargeId: authoredIdentifierSchema,
  cost: z.number().int().positive()
})

const actionInvocationShape = {
  kind: z.literal(invocationKindSchema.enum.ACTION).optional(),
  range: rangeDtoSchema,
  shape: shapeDtoSchema.optional(),
  targeting: targetingDtoSchema.optional(),
  resourceUse: resourceUseDtoSchema.optional()
}

const nonSavingThrowTriggerDtoSchema = z.enum([
  triggerCodeSchema.enum.ACTIVATED,
  triggerCodeSchema.enum.MELEE_WEAPON_ATTACK,
  triggerCodeSchema.enum.RANGED_WEAPON_ATTACK,
  triggerCodeSchema.enum.UNARMED_ATTACK,
  triggerCodeSchema.enum.SPELL_ATTACK,
  triggerCodeSchema.enum.INCOMING_SAVING_THROW,
  triggerCodeSchema.enum.ENTER_AREA
])

export const invocationDtoSchema: z.ZodType<EffectInvocationAuthored> = z.union([
  z.object({
    kind: z.literal(invocationKindSchema.enum.PASSIVE),
    triggerCode: z.literal(triggerCodeSchema.enum.SAVING_THROW),
    savingThrow: savingThrowDtoSchema,
    range: rangeDtoSchema,
    shape: shapeDtoSchema.optional(),
    targeting: targetingDtoSchema.optional(),
    resourceUse: z.never().optional(),
    reactionMovementTrigger: z.never().optional()
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
    resourceUse: z.never().optional(),
    reactionMovementTrigger: z.never().optional()
  }),
  z.object({
    ...actionInvocationShape,
    triggerCode: z.literal(triggerCodeSchema.enum.SAVING_THROW),
    savingThrow: savingThrowDtoSchema,
    activation: activationDtoSchema,
    reactionMovementTrigger: z.never().optional()
  }),
  z.object({
    ...actionInvocationShape,
    triggerCode: z.literal(triggerCodeSchema.enum.SAVING_THROW),
    savingThrow: savingThrowDtoSchema,
    activation: reactionActivationDtoSchema,
    reactionMovementTrigger: reactionMovementTriggerBindingDtoSchema
  }),
  z.object({
    ...actionInvocationShape,
    triggerCode: nonSavingThrowTriggerDtoSchema,
    activation: activationDtoSchema,
    reactionMovementTrigger: z.never().optional()
  }),
  z.object({
    ...actionInvocationShape,
    triggerCode: nonSavingThrowTriggerDtoSchema,
    activation: reactionActivationDtoSchema,
    reactionMovementTrigger: reactionMovementTriggerBindingDtoSchema
  })
])

const createEffectDtoSchema = <TPathSchema extends z.ZodTypeAny>(pathSchema: TPathSchema) =>
  z.object({
    id: postgresUuidSchema,
    order: z.number().int(),
    invocation: invocationDtoSchema,
    paths: authoredNestedCollectionSchema(pathSchema).min(1)
  })

export const effectDtoSchema = createEffectDtoSchema(pathDtoSchema) as z.ZodType<EffectAuthored>
export const manifestNestedBehaviorDtoSchema = createEffectDtoSchema(manifestBehaviorPathDtoSchema)

export type EffectDto = z.infer<typeof effectDtoSchema>
