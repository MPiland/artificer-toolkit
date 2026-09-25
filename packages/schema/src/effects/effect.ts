import type {
  EffectAuthored,
  EffectInvocationAuthored,
  EquipmentEffectAuthored
} from '@artificer-toolkit/shared/authored'
import { z } from '../zod.js'

import { manifestBehaviorPathDtoSchema, pathDtoSchema } from './path.js'
import {
  activationCodeSchema,
  equipmentGripSchema,
  invocationKindSchema,
  triggerCodeSchema
} from '../shared/enums.js'
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
  code: z.literal(activationCodeSchema._zod.def.entries.REACTION),
  amount: z.number()
})

const resourceUseDtoSchema = z.object({
  chargeId: authoredIdentifierSchema,
  cost: z.number().check(z.int()).check(z.positive())
})

const actionInvocationShape = {
  kind: z.optional(z.literal(invocationKindSchema._zod.def.entries.ACTION)),
  range: rangeDtoSchema,
  shape: z.optional(shapeDtoSchema),
  targeting: z.optional(targetingDtoSchema),
  resourceUse: z.optional(resourceUseDtoSchema)
}

const nonSavingThrowTriggerDtoSchema = z.enum([
  triggerCodeSchema._zod.def.entries.ACTIVATED,
  triggerCodeSchema._zod.def.entries.MELEE_WEAPON_ATTACK,
  triggerCodeSchema._zod.def.entries.RANGED_WEAPON_ATTACK,
  triggerCodeSchema._zod.def.entries.UNARMED_ATTACK,
  triggerCodeSchema._zod.def.entries.SPELL_ATTACK,
  triggerCodeSchema._zod.def.entries.INCOMING_SAVING_THROW,
  triggerCodeSchema._zod.def.entries.ENTER_AREA
])

export const invocationDtoSchema: z.ZodMiniType<EffectInvocationAuthored> = z.union([
  z.object({
    kind: z.literal(invocationKindSchema._zod.def.entries.PASSIVE),
    triggerCode: z.literal(triggerCodeSchema._zod.def.entries.SAVING_THROW),
    savingThrow: savingThrowDtoSchema,
    range: rangeDtoSchema,
    shape: z.optional(shapeDtoSchema),
    targeting: z.optional(targetingDtoSchema),
    resourceUse: z.optional(z.never()),
    reactionMovementTrigger: z.optional(z.never())
  }),
  z.object({
    kind: z.literal(invocationKindSchema._zod.def.entries.PASSIVE),
    triggerCode: z.enum([
      triggerCodeSchema._zod.def.entries.ACTIVATED,
      triggerCodeSchema._zod.def.entries.MELEE_WEAPON_ATTACK,
      triggerCodeSchema._zod.def.entries.RANGED_WEAPON_ATTACK,
      triggerCodeSchema._zod.def.entries.UNARMED_ATTACK,
      triggerCodeSchema._zod.def.entries.SPELL_ATTACK,
      triggerCodeSchema._zod.def.entries.INCOMING_SAVING_THROW,
      triggerCodeSchema._zod.def.entries.ENTER_AREA
    ]),
    range: rangeDtoSchema,
    shape: z.optional(shapeDtoSchema),
    targeting: z.optional(targetingDtoSchema),
    resourceUse: z.optional(z.never()),
    reactionMovementTrigger: z.optional(z.never())
  }),
  z.object({
    ...actionInvocationShape,
    triggerCode: z.literal(triggerCodeSchema._zod.def.entries.SAVING_THROW),
    savingThrow: savingThrowDtoSchema,
    activation: activationDtoSchema,
    reactionMovementTrigger: z.optional(z.never())
  }),
  z.object({
    ...actionInvocationShape,
    triggerCode: z.literal(triggerCodeSchema._zod.def.entries.SAVING_THROW),
    savingThrow: savingThrowDtoSchema,
    activation: reactionActivationDtoSchema,
    reactionMovementTrigger: reactionMovementTriggerBindingDtoSchema
  }),
  z.object({
    ...actionInvocationShape,
    triggerCode: nonSavingThrowTriggerDtoSchema,
    activation: activationDtoSchema,
    reactionMovementTrigger: z.optional(z.never())
  }),
  z.object({
    ...actionInvocationShape,
    triggerCode: nonSavingThrowTriggerDtoSchema,
    activation: reactionActivationDtoSchema,
    reactionMovementTrigger: reactionMovementTriggerBindingDtoSchema
  })
])

const createEffectDtoSchema = <TPathSchema extends z.ZodMiniType>(pathSchema: TPathSchema) =>
  z.object({
    id: postgresUuidSchema,
    order: z.number().check(z.int()),
    invocation: invocationDtoSchema,
    paths: authoredNestedCollectionSchema(pathSchema).check(z.minLength(1))
  })

export const effectDtoSchema = createEffectDtoSchema(pathDtoSchema) as z.ZodMiniType<EffectAuthored>

const weaponAttackTriggerCodes: readonly string[] = [
  triggerCodeSchema._zod.def.entries.MELEE_WEAPON_ATTACK,
  triggerCodeSchema._zod.def.entries.RANGED_WEAPON_ATTACK
]

/** Equipment effects name a grip exactly when they are weapon attacks, never on passive effects. */
export const equipmentEffectDtoSchema = z
  .extend(createEffectDtoSchema(pathDtoSchema), { grip: z.nullable(equipmentGripSchema) })
  .check(
    z.superRefine((effect, context) => {
      const weaponAttack =
        effect.invocation.kind !== invocationKindSchema._zod.def.entries.PASSIVE &&
        weaponAttackTriggerCodes.includes(effect.invocation.triggerCode)
      if ((effect.grip !== null) !== weaponAttack)
        context.addIssue({
          code: 'custom',
          path: ['grip'],
          message:
            effect.grip === null
              ? 'A weapon attack effect requires a grip.'
              : 'Only weapon attack effects have a grip.'
        })
    })
  ) as z.ZodMiniType<EquipmentEffectAuthored>
export const manifestNestedBehaviorDtoSchema = createEffectDtoSchema(manifestBehaviorPathDtoSchema)

export type EffectDto = z.infer<typeof effectDtoSchema>
