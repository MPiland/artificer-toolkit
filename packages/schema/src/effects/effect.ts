import type {
  EffectAuthored,
  EffectInvocationAuthored,
  EquipmentEffectAuthored,
  FeatureEffectAuthored
} from '@artificer-toolkit/shared/authored'
import { z, lazySchema, lazySchemaParts } from '../zod.js'

import { manifestBehaviorPathDtoSchema, pathDtoSchema } from './path.js'
import {
  activationCodeSchema,
  equipmentGripSchema,
  invocationKindSchema,
  triggerCodeSchema
} from '../shared/enums.js'
import { activationDtoSchema } from './activation.js'
import { checkDtoSchema } from './check.js'
import { rangeDtoSchema } from '../shared/range.js'
import { savingThrowDtoSchema } from '../shared/savingThrow.js'
import { shapeDtoSchema } from '../shared/shape.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { reactionTriggerBindingDtoSchema } from '../shared/reaction.js'
import { targetingDtoSchema } from './targeting.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema
} from '../shared/authoredLimits.js'

export { activationDtoSchema }

const reactionActivationDtoSchema = lazySchema(() =>
  z.object({
    code: z.literal(activationCodeSchema._zod.def.entries.REACTION),
    amount: z.number()
  })
)

const resourceUseDtoSchema = lazySchema(() =>
  z.object({
    chargeId: authoredIdentifierSchema,
    cost: z.number().check(z.int()).check(z.positive())
  })
)

const actionInvocationShape = lazySchemaParts(() => ({
  kind: z.optional(z.literal(invocationKindSchema._zod.def.entries.ACTION)),
  range: rangeDtoSchema,
  shape: z.optional(shapeDtoSchema),
  targeting: z.optional(targetingDtoSchema),
  resourceUse: z.optional(resourceUseDtoSchema)
}))

const nonSavingThrowTriggerDtoSchema = lazySchema(() =>
  z.enum([
    triggerCodeSchema._zod.def.entries.ACTIVATED,
    triggerCodeSchema._zod.def.entries.MELEE_WEAPON_ATTACK,
    triggerCodeSchema._zod.def.entries.RANGED_WEAPON_ATTACK,
    triggerCodeSchema._zod.def.entries.UNARMED_ATTACK,
    triggerCodeSchema._zod.def.entries.MELEE_SPELL_ATTACK,
    triggerCodeSchema._zod.def.entries.RANGED_SPELL_ATTACK,
    triggerCodeSchema._zod.def.entries.INCOMING_SAVING_THROW,
    triggerCodeSchema._zod.def.entries.ENTER_AREA
  ])
)

export const invocationDtoSchema: z.ZodMiniType<EffectInvocationAuthored> = lazySchema(() =>
  z.union([
    z.object({
      kind: z.literal(invocationKindSchema._zod.def.entries.PASSIVE),
      triggerCode: z.literal(triggerCodeSchema._zod.def.entries.SAVING_THROW),
      savingThrow: savingThrowDtoSchema,
      range: rangeDtoSchema,
      shape: z.optional(shapeDtoSchema),
      targeting: z.optional(targetingDtoSchema),
      resourceUse: z.optional(z.never()),
      reactionTrigger: z.optional(z.never())
    }),
    z.object({
      kind: z.literal(invocationKindSchema._zod.def.entries.PASSIVE),
      triggerCode: z.enum([
        triggerCodeSchema._zod.def.entries.ACTIVATED,
        triggerCodeSchema._zod.def.entries.MELEE_WEAPON_ATTACK,
        triggerCodeSchema._zod.def.entries.RANGED_WEAPON_ATTACK,
        triggerCodeSchema._zod.def.entries.UNARMED_ATTACK,
        triggerCodeSchema._zod.def.entries.MELEE_SPELL_ATTACK,
        triggerCodeSchema._zod.def.entries.RANGED_SPELL_ATTACK,
        triggerCodeSchema._zod.def.entries.INCOMING_SAVING_THROW,
        triggerCodeSchema._zod.def.entries.ENTER_AREA
      ]),
      range: rangeDtoSchema,
      shape: z.optional(shapeDtoSchema),
      targeting: z.optional(targetingDtoSchema),
      resourceUse: z.optional(z.never()),
      reactionTrigger: z.optional(z.never())
    }),
    z.object({
      ...actionInvocationShape(),
      triggerCode: z.literal(triggerCodeSchema._zod.def.entries.SAVING_THROW),
      savingThrow: savingThrowDtoSchema,
      activation: activationDtoSchema,
      reactionTrigger: z.optional(z.never())
    }),
    z.object({
      ...actionInvocationShape(),
      triggerCode: z.literal(triggerCodeSchema._zod.def.entries.SAVING_THROW),
      savingThrow: savingThrowDtoSchema,
      activation: reactionActivationDtoSchema,
      reactionTrigger: reactionTriggerBindingDtoSchema
    }),
    z.object({
      ...actionInvocationShape(),
      triggerCode: z.literal(triggerCodeSchema._zod.def.entries.CHECK),
      check: checkDtoSchema,
      activation: activationDtoSchema,
      reactionTrigger: z.optional(z.never())
    }),
    z.object({
      ...actionInvocationShape(),
      triggerCode: nonSavingThrowTriggerDtoSchema,
      activation: activationDtoSchema,
      reactionTrigger: z.optional(z.never())
    }),
    z.object({
      ...actionInvocationShape(),
      triggerCode: nonSavingThrowTriggerDtoSchema,
      activation: reactionActivationDtoSchema,
      reactionTrigger: reactionTriggerBindingDtoSchema
    })
  ])
)

const createEffectDtoSchema = <TPathSchema extends z.ZodMiniType>(pathSchema: TPathSchema) =>
  z.object({
    id: postgresUuidSchema,
    order: z.number().check(z.int()),
    invocation: invocationDtoSchema,
    paths: authoredNestedCollectionSchema(pathSchema).check(z.minLength(1))
  })

export const effectDtoSchema = lazySchema(
  () => createEffectDtoSchema(pathDtoSchema) as z.ZodMiniType<EffectAuthored>
)

// Literal codes, checked against the trigger enum, so module load does not build the enum schema.
const weaponAttackTriggerCodes: readonly string[] = [
  'MELEE_WEAPON_ATTACK',
  'RANGED_WEAPON_ATTACK'
] satisfies z.infer<typeof triggerCodeSchema>[]

/** Triggers resolved by an attack roll, so the Feature or option invoking one defines its ATTACK roll. */
export const ATTACK_TRIGGER_CODES: ReadonlySet<string> = new Set([
  ...weaponAttackTriggerCodes,
  ...(['UNARMED_ATTACK', 'MELEE_SPELL_ATTACK', 'RANGED_SPELL_ATTACK'] satisfies z.infer<
    typeof triggerCodeSchema
  >[])
])

function isWeaponAttack(effect: { invocation: EffectInvocationAuthored }) {
  return (
    effect.invocation.kind !== invocationKindSchema._zod.def.entries.PASSIVE &&
    weaponAttackTriggerCodes.includes(effect.invocation.triggerCode)
  )
}

/**
 * Feature effects name a grip only for a versatile weapon attack, which authors one effect per grip
 * so each grip is its own action (D57 ruling 1).
 */
export const featureEffectDtoSchema = lazySchema(
  () =>
    z.extend(createEffectDtoSchema(pathDtoSchema), { grip: z.optional(equipmentGripSchema) }).check(
      z.superRefine((effect, context) => {
        if (effect.grip !== undefined && !isWeaponAttack(effect))
          context.addIssue({
            code: 'custom',
            path: ['grip'],
            message: 'Only weapon attack effects have a grip.'
          })
      })
    ) as z.ZodMiniType<FeatureEffectAuthored>
)

/** Equipment effects name a grip exactly when they are weapon attacks, never on passive effects. */
export const equipmentEffectDtoSchema = lazySchema(
  () =>
    z.extend(createEffectDtoSchema(pathDtoSchema), { grip: z.nullable(equipmentGripSchema) }).check(
      z.superRefine((effect, context) => {
        const weaponAttack = isWeaponAttack(effect)
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
)
export const manifestNestedBehaviorDtoSchema = lazySchema(() =>
  createEffectDtoSchema(manifestBehaviorPathDtoSchema)
)

export type EffectDto = z.infer<typeof effectDtoSchema>
