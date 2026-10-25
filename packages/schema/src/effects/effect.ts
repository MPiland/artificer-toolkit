import type {
  EffectAuthored,
  EffectInvocationAuthored,
  EquipmentEffectAuthored,
  FeatureEffectAuthored
} from '@artificer-toolkit/shared/authored'
import { parseRollExpression } from '@artificer-toolkit/shared/rolls'
import { z, lazySchema, lazySchemaParts } from '../zod.js'

import { manifestBehaviorPathDtoSchema, pathDtoSchema } from './path.js'
import {
  activationCodeSchema,
  equipmentGripSchema,
  equipmentPropertyCodeSchema,
  invocationKindSchema,
  triggerCodeSchema
} from '../shared/enums.js'
import { activationDtoSchema } from './activation.js'
import { facetDtoSchema } from '../shared/facet.js'
import { checkDtoSchema } from './check.js'
import { rangeDtoSchema } from '../shared/range.js'
import { savingThrowDtoSchema } from '../shared/savingThrow.js'
import { shapeDtoSchema } from '../shared/shape.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { damageTypeFilterDtoSchema, reactionTriggerBindingDtoSchema } from '../shared/reaction.js'
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

const resourceUseDtoShape = lazySchemaParts(() => ({
  chargeId: authoredIdentifierSchema,
  cost: z.number().check(z.int()).check(z.positive())
}))

const resourceUseDtoSchema = lazySchema(() => z.object(resourceUseDtoShape()))

const optionalOnHitDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('SPELL_SLOT') }),
    z.object({ kind: z.literal('RESOURCE_POOL'), ...resourceUseDtoShape() })
  ])
)

const actionInvocationShape = lazySchemaParts(() => ({
  kind: z.optional(z.literal(invocationKindSchema._zod.def.entries.ACTION)),
  range: rangeDtoSchema,
  shape: z.optional(shapeDtoSchema),
  targeting: z.optional(targetingDtoSchema),
  resourceUse: z.optional(resourceUseDtoSchema),
  optionalOnHit: z.optional(z.never()),
  ridesFeatureId: z.optional(z.never())
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
      triggerCode: z.enum([
        triggerCodeSchema._zod.def.entries.SAVING_THROW,
        triggerCodeSchema._zod.def.entries.HP_ZERO
      ]),
      savingThrow: savingThrowDtoSchema,
      range: rangeDtoSchema,
      shape: z.optional(shapeDtoSchema),
      targeting: z.optional(targetingDtoSchema),
      resourceUse: z.optional(z.never()),
      reactionTrigger: z.optional(z.never()),
      optionalOnHit: z.optional(z.never()),
      ridesFeatureId: z.optional(z.never())
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
        triggerCodeSchema._zod.def.entries.ENTER_AREA,
        triggerCodeSchema._zod.def.entries.INCOMING_WEAPON_HIT,
        triggerCodeSchema._zod.def.entries.ROLL_INITIATIVE,
        triggerCodeSchema._zod.def.entries.START_OF_TURN
      ]),
      range: rangeDtoSchema,
      shape: z.optional(shapeDtoSchema),
      targeting: z.optional(targetingDtoSchema),
      resourceUse: z.optional(z.never()),
      reactionTrigger: z.optional(z.never()),
      optionalOnHit: z.optional(optionalOnHitDtoSchema),
      ridesFeatureId: z.optional(authoredIdentifierSchema)
    }),
    z.object({
      kind: z.literal(invocationKindSchema._zod.def.entries.PASSIVE),
      triggerCode: z.literal(triggerCodeSchema._zod.def.entries.INCOMING_DAMAGE),
      damageTypeIds: damageTypeFilterDtoSchema,
      range: rangeDtoSchema,
      shape: z.optional(shapeDtoSchema),
      targeting: z.optional(targetingDtoSchema),
      resourceUse: z.optional(z.never()),
      reactionTrigger: z.optional(z.never()),
      optionalOnHit: z.optional(z.never()),
      ridesFeatureId: z.optional(z.never())
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

/**
 * A failure-margin rider reads the margin of the saving throw the Effect itself makes, so only the
 * fixed ON_SAVE_FAIL result of a saving-throw action carries one (a follow-up save carries its own).
 */
function checkFailureMarginRiders(
  effect: Pick<EffectAuthored, 'invocation' | 'paths'>,
  context: z.core.$RefinementCtx
) {
  effect.paths.forEach((path, index) => {
    const resultBlocks =
      path.selectionKind === 'FIXED'
        ? [path.resultBlock]
        : path.selectionKind === 'CHOICE'
          ? path.options.map((option) => option.resultBlock)
          : path.selectionKind === 'HIT_POINT_TIERS'
            ? path.rows.map((row) => row.resultBlock)
            : path.rows.flatMap((row) => (row.resolutionKind === 'RESULT' ? [row.resultBlock] : []))
    const allowed =
      path.selectionKind === 'FIXED' &&
      path.pathCode === 'ON_SAVE_FAIL' &&
      effect.invocation.kind !== invocationKindSchema._zod.def.entries.PASSIVE &&
      effect.invocation.triggerCode === 'SAVING_THROW'
    if (!allowed && resultBlocks.some((block) => block.failureMarginRider))
      context.addIssue({
        code: 'custom',
        path: ['paths', index],
        message:
          'Only the fixed ON_SAVE_FAIL result of a saving-throw action can carry a failure margin rider.'
      })
  })
}

/** The lowest and highest totals of a roll table's dice, or null when they are not one plain term. */
function rollTableBounds(dieConfig: string): [number, number] | null {
  let parsed: ReturnType<typeof parseRollExpression>
  try {
    parsed = parseRollExpression(dieConfig)
  } catch {
    return null
  }
  const [term] = parsed.terms
  if (
    !term ||
    parsed.terms.length !== 1 ||
    parsed.modifier !== 0 ||
    parsed.transform.kind !== 'NONE' ||
    term.modifier !== 0 ||
    term.reroll ||
    term.selection
  )
    return null
  return [term.count, term.count * term.die]
}

/**
 * Every total a roll table's dice can roll selects exactly one row, so an executed roll never lands
 * outside the table (ATTACK-16.T1a).
 */
function checkRollTableCoverage(
  effect: Pick<EffectAuthored, 'paths'>,
  context: z.core.$RefinementCtx
) {
  effect.paths.forEach((path, index) => {
    if (path.selectionKind !== 'ROLL_TABLE') return
    const bounds = rollTableBounds(path.dieConfig)
    if (!bounds) {
      context.addIssue({
        code: 'custom',
        path: ['paths', index, 'dieConfig'],
        message: 'A roll table rolls one plain dice term, such as 1d10 or 2d6.'
      })
      return
    }
    const ranges = path.rows.map(({ rollRange, rollValue }) =>
      path.rollTableKind === 'RANGE'
        ? rollRange
        : rollValue === undefined
          ? undefined
          : [rollValue, rollValue]
    )
    const issue = (message: string) =>
      context.addIssue({ code: 'custom', path: ['paths', index, 'rows'], message })
    const wholeRanges = ranges.filter(
      (range): range is [number, number] =>
        range !== undefined &&
        Number.isInteger(range[0]) &&
        Number.isInteger(range[1]) &&
        range[0] <= range[1]
    )
    if (wholeRanges.length !== ranges.length)
      return issue('Roll-table row ranges must run from low to high in whole numbers.')
    const [lowest, highest] = bounds
    const coverage = `Roll-table rows must cover every roll of ${path.dieConfig} exactly once`
    const outside = wholeRanges.flat().find((value) => value < lowest || value > highest)
    if (outside !== undefined)
      return issue(`${coverage}: ${outside} is outside ${lowest}–${highest}.`)
    for (let roll = lowest; roll <= highest; roll += 1) {
      const rows = wholeRanges.filter(([low, high]) => low <= roll && roll <= high).length
      if (rows === 0) return issue(`${coverage}: no row covers ${roll}.`)
      if (rows > 1) return issue(`${coverage}: more than one row covers ${roll}.`)
    }
  })
}

export const effectDtoSchema = lazySchema(() =>
  (createEffectDtoSchema(pathDtoSchema) as z.ZodMiniType<EffectAuthored>).check(
    z.superRefine(checkWeaponDamageTypeChoices),
    z.superRefine(checkPathRestrictions),
    z.superRefine(checkFailureMarginRiders),
    z.superRefine(checkRollTableCoverage)
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

/** What an action casts: the level it is cast at, which Counterspell's higher-level check reads (D136). */
const featureSpellCastDtoSchema = lazySchema(() =>
  z.object({ castLevel: z.number().check(z.int()).check(z.gte(1)).check(z.lte(9)) })
)

/**
 * An action that casts one of the spells its holder is granted, chosen at the table (D156,
 * SPELLS-33.T6c): a cantrip, or a levelled spell cast from a slot as normal.
 */
const featureGrantedSpellCastDtoSchema = lazySchema(() =>
  z.object({ spellKind: z.enum(['CANTRIP', 'LEVELED']) })
)

/** An attack made with each wielded weapon that has these properties (D156). */
const featureWeaponAttackDtoSchema = lazySchema(() =>
  z.object({
    requiredPropertyCodes: z.optional(z.array(equipmentPropertyCodeSchema).check(z.maxLength(20)))
  })
)

/**
 * Feature effects name a grip only for a versatile weapon attack, which authors one effect per grip
 * so each grip is its own action (D57 ruling 1). A weapon attack made with the wielded weapons
 * takes each weapon's own grip and outcomes, so it names no grip and its own paths are optional.
 */
export const featureEffectDtoSchema = lazySchema(() =>
  (
    z
      .extend(createEffectDtoSchema(pathDtoSchema), {
        paths: authoredNestedCollectionSchema(pathDtoSchema),
        grip: z.optional(equipmentGripSchema),
        spellCast: z.optional(featureSpellCastDtoSchema),
        grantedSpellCast: z.optional(featureGrantedSpellCastDtoSchema),
        weaponAttack: z.optional(featureWeaponAttackDtoSchema)
      })
      .check(
        z.superRefine((effect, context) => {
          if (
            effect.paths.length === 0 &&
            effect.weaponAttack === undefined &&
            effect.grantedSpellCast === undefined
          )
            context.addIssue({
              code: 'custom',
              path: ['paths'],
              message: 'An effect needs at least one outcome path.'
            })
          if (effect.grip !== undefined && !isWeaponAttack(effect))
            context.addIssue({
              code: 'custom',
              path: ['grip'],
              message: 'Only weapon attack effects have a grip.'
            })
          if (
            effect.spellCast !== undefined &&
            effect.invocation.kind === invocationKindSchema._zod.def.entries.PASSIVE
          )
            context.addIssue({
              code: 'custom',
              path: ['spellCast'],
              message: 'Only an action can cast a spell.'
            })
          if (
            effect.grantedSpellCast !== undefined &&
            effect.invocation.kind === invocationKindSchema._zod.def.entries.PASSIVE
          )
            context.addIssue({
              code: 'custom',
              path: ['grantedSpellCast'],
              message: 'Only an action can cast a granted spell.'
            })
          if (effect.grantedSpellCast !== undefined && effect.spellCast !== undefined)
            context.addIssue({
              code: 'custom',
              path: ['spellCast'],
              message: 'A granted spell names its own level when cast, so the action names none.'
            })
          if (effect.weaponAttack !== undefined && !isWeaponAttack(effect))
            context.addIssue({
              code: 'custom',
              path: ['weaponAttack'],
              message: 'Only a weapon attack action attacks with the wielded weapons.'
            })
          if (effect.weaponAttack !== undefined && effect.grip !== undefined)
            context.addIssue({
              code: 'custom',
              path: ['grip'],
              message: "An attack with the wielded weapons uses each weapon's own grip."
            })
        })
      ) as z.ZodMiniType<FeatureEffectAuthored>
  ).check(
    z.superRefine(checkWeaponDamageTypeChoices),
    z.superRefine(checkPathRestrictions),
    z.superRefine(checkFailureMarginRiders),
    z.superRefine(checkRollTableCoverage)
  )
)

/** Equipment effects name a grip exactly when they are weapon attacks, never on passive effects. */
export const equipmentEffectDtoSchema = lazySchema(() =>
  (
    z
      .extend(createEffectDtoSchema(pathDtoSchema), {
        grip: z.nullable(equipmentGripSchema),
        requirements: z.optional(facetDtoSchema)
      })
      .check(
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
  ).check(
    z.superRefine(checkWeaponDamageTypeChoices),
    z.superRefine(checkPathRestrictions),
    z.superRefine(checkFailureMarginRiders),
    z.superRefine(checkRollTableCoverage)
  )
)

export const manifestNestedBehaviorDtoSchema = lazySchema(() =>
  createEffectDtoSchema(manifestBehaviorPathDtoSchema)
)

export type EffectDto = z.infer<typeof effectDtoSchema>
