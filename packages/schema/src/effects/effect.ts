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

const optionalOnHitDtoSchema = lazySchema(() => z.object({ kind: z.literal('SPELL_SLOT') }))

const actionInvocationShape = lazySchemaParts(() => ({
  kind: z.optional(z.literal(invocationKindSchema._zod.def.entries.ACTION)),
  range: rangeDtoSchema,
  shape: z.optional(shapeDtoSchema),
  targeting: z.optional(targetingDtoSchema),
  resourceUse: z.optional(resourceUseDtoSchema),
  optionalOnHit: z.optional(z.never())
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
      reactionTrigger: z.optional(z.never()),
      optionalOnHit: z.optional(z.never())
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
      reactionTrigger: z.optional(z.never()),
      optionalOnHit: z.optional(optionalOnHitDtoSchema)
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

function countWeaponDamageTypeChoices(value: unknown): number {
  if (Array.isArray(value))
    return value.reduce((sum: number, item) => sum + countWeaponDamageTypeChoices(item), 0)
  if (typeof value !== 'object' || value === null) return 0
  return Object.entries(value).reduce(
    (sum, [key, item]) =>
      sum +
      (key === 'usesTriggeringWeaponDamageType' && item === true
        ? 1
        : countWeaponDamageTypeChoices(item)),
    0
  )
}

/**
 * Taking the triggering weapon's damage type means something only for an on-hit rider: damage a
 * passive Effect's fixed `ON_HIT` path owes to the attack it rides on (D119). Anywhere else there
 * is no weapon to take the type from.
 */
function checkWeaponDamageTypeChoices(
  effect: Pick<EffectAuthored, 'invocation' | 'paths'>,
  context: z.core.$RefinementCtx
) {
  const riderChoices =
    effect.invocation.kind !== invocationKindSchema._zod.def.entries.PASSIVE
      ? 0
      : effect.paths.reduce(
          (sum, path) =>
            path.pathCode !== 'ON_HIT' || path.selectionKind !== 'FIXED'
              ? sum
              : sum +
                path.resultBlock.outcomes.filter(
                  (outcome) =>
                    outcome.effectKind === 'DAMAGE' &&
                    outcome.usesTriggeringWeaponDamageType === true
                ).length,
          0
        )
  if (countWeaponDamageTypeChoices(effect.paths) !== riderChoices)
    context.addIssue({
      code: 'custom',
      path: ['paths'],
      message:
        "Only an on-hit rider (damage on a passive Effect's fixed ON_HIT path) can use the triggering weapon's damage type."
    })
}

/**
 * Path restrictions and usage limits gate the damage an attack's hit or critical owes (D119); the
 * roll mode and the turn they read exist only for that attack, so no other path can carry one.
 */
function checkPathRestrictions(
  effect: Pick<EffectAuthored, 'paths'>,
  context: z.core.$RefinementCtx
) {
  effect.paths.forEach((path, index) => {
    if (path.pathCode === 'ON_HIT' || path.pathCode === 'ON_CRIT') return
    if (path.restrictions)
      context.addIssue({
        code: 'custom',
        path: ['paths', index, 'restrictions'],
        message: 'Only an ON_HIT or ON_CRIT path can carry restrictions.'
      })
    if (path.usage)
      context.addIssue({
        code: 'custom',
        path: ['paths', index, 'usage'],
        message: 'Only an ON_HIT or ON_CRIT path can carry a usage limit.'
      })
  })
}

export const effectDtoSchema = lazySchema(() =>
  (createEffectDtoSchema(pathDtoSchema) as z.ZodMiniType<EffectAuthored>).check(
    z.superRefine(checkWeaponDamageTypeChoices),
    z.superRefine(checkPathRestrictions)
  )
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
export const featureEffectDtoSchema = lazySchema(() =>
  (
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
  ).check(z.superRefine(checkWeaponDamageTypeChoices), z.superRefine(checkPathRestrictions))
)

/** Equipment effects name a grip exactly when they are weapon attacks, never on passive effects. */
export const equipmentEffectDtoSchema = lazySchema(() =>
  (
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
  ).check(z.superRefine(checkWeaponDamageTypeChoices), z.superRefine(checkPathRestrictions))
)

export const manifestNestedBehaviorDtoSchema = lazySchema(() =>
  createEffectDtoSchema(manifestBehaviorPathDtoSchema)
)

export type EffectDto = z.infer<typeof effectDtoSchema>
