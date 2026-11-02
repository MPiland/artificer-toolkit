import type {
  CastModifierAuthored,
  CastModifierCountAuthored,
  CastModifierParameterAuthored,
  SparesCreaturesAuthored
} from '@artificer-toolkit/shared/authored'
import type { RangeDto } from '@artificer-toolkit/schema/shared/range'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { DamageRerollCostDto } from '@artificer-toolkit/schema/shared/ruleExecutionDamageRollWindow'
import { ROUNDS_PER_CAMPAIGN_MINUTE } from '../campaignClock.js'
import type { NativeCharacterActionResourceConsumption } from './characterNativeActionResources.js'

/** A cost a Character may pay on casting a spell, authored as a passive Effect's `castModifier`. */
export type CastModifierSource = {
  /** The id of the Effect that carries the cost; the cast command names it. */
  modifierId: string
  /** The label of the Feature, option or feat that holds it. */
  label: string
  cost: CastModifierAuthored
}

/** The cast modifiers a Feature, option or feat holds, one per passive Effect that authors a cost. */
export function collectCastModifiers(
  effects: readonly CompiledEffectGroup[] | undefined,
  label: string
): CastModifierSource[] {
  return (effects ?? []).flatMap((effect) =>
    effect.invocation.kind === 'PASSIVE' && 'castModifier' in effect.invocation
      ? effect.invocation.castModifier
        ? [{ modifierId: effect.id, label, cost: effect.invocation.castModifier }]
        : []
      : []
  )
}

/** What a cast at this level pays: the authored cost, times the level when it is per spell level (a cantrip counts as 1). */
export function castModifierCostAtLevel(cost: CastModifierAuthored, spellLevel: number): number {
  return cost.perSpellLevel ? cost.cost * Math.max(1, spellLevel) : cost.cost
}

/**
 * Whether an Effect aims at exactly one creature other than only the caster, so a further target can
 * be added to it. Derived from the Effect's own targeting, never from the spell's name: a spell that
 * can already reach several creatures at this level, an area, or a Self range is not eligible.
 */
export function aimsAtOneCreature(invocation: CompiledEffectGroup['invocation']): boolean {
  const { targeting, range } = invocation
  return (
    !invocation.shape &&
    range.rangeKind !== 'SELF' &&
    (!targeting || targeting.selectionKind === 'SINGLE_TARGET')
  )
}

/**
 * The most creatures a paid cast modifier may name, or damage dice it may reroll: its base, plus the holder's modifier in the
 * authored ability, never below the authored minimum (1 when an ability is added).
 */
export function castModifierCountCap(
  targets: CastModifierCountAuthored,
  abilityModifier: (abilityDefinitionId: string) => number
): number {
  const added = targets.abilityDefinitionId ? abilityModifier(targets.abilityDefinitionId) : 0
  const minimum = targets.minimum ?? (targets.abilityDefinitionId ? 1 : 0)
  return Math.max(minimum, targets.base + added)
}

/**
 * The damage rerolls a cast can still pay for once its damage is rolled (D208). An action spends from
 * one pool: a reroll pays from the pool the cast already spends, out of the charges left after it, or
 * from its own pool when nothing on the action spends one.
 */
export function payableDamageRerolls(input: {
  costs: readonly DamageRerollCostDto[]
  spent: Pick<NativeCharacterActionResourceConsumption, 'poolId' | 'afterRemaining'> | null
  capacityUse: unknown
}): DamageRerollCostDto[] {
  const { spent } = input
  if (input.capacityUse) return []
  return input.costs.filter(
    ({ poolId, cost }) => !spent || (poolId === spent.poolId && cost <= spent.afterRemaining)
  )
}

/**
 * The range a cast has once a paid modifier's parameters change it, or null when a parameter does not
 * fit the spell: `RANGE` multiplies a distance (its long range too) and turns Touch into the
 * authored distance, and fits no other range. Offering a modifier and refusing a cast that names it
 * both ask this, so a forged pick on an ineligible spell is refused.
 */
export function castModifierRange(
  parameters: readonly CastModifierParameterAuthored[],
  range: RangeDto
): RangeDto | null {
  let changed: RangeDto | null = range
  for (const parameter of parameters) {
    if (parameter.parameter !== 'RANGE') continue
    if (!changed) return null
    if (changed.rangeKind === 'TOUCH')
      changed = { id: changed.id, rangeKind: 'DISTANCE', ...parameter.touchDistance }
    else if (changed.rangeKind === 'DISTANCE')
      changed = {
        ...changed,
        amount: changed.amount * parameter.multiplier,
        ...(changed.longAmount !== undefined && {
          longAmount: changed.longAmount * parameter.multiplier
        })
      }
    else return null
  }
  return changed
}

/**
 * The activation a cast has once a paid modifier's parameters change it, or null when a parameter
 * does not fit the spell: `ACTIVATION` replaces a cast of exactly one Action, and fits no other.
 * Offering and refusing share it as they do `castModifierRange`.
 */
export function castModifierActivation(
  parameters: readonly CastModifierParameterAuthored[],
  activation: { code: string; amount: number | null } | null
): { code: string; amount: number | null } | null {
  let changed = activation
  for (const parameter of parameters) {
    if (parameter.parameter !== 'ACTIVATION') continue
    if (changed?.code !== 'ACTION' || changed.amount !== 1) return null
    changed = { code: parameter.activation, amount: 1 }
  }
  return changed
}

/**
 * The turns an effect lasts at cast once a paid modifier's parameters change it: `DURATION`
 * multiplies a timed duration of at least `minimumMinutes`, capped at `maximumHours`, and leaves
 * any other (a shorter rider, an untimed effect) as it was. The effect plan applies it, and the
 * offer filter asks `castModifierExtendsDuration` over the spell's own durations.
 */
export function castModifierDuration(
  parameters: readonly CastModifierParameterAuthored[],
  turns: number | null
): number | null {
  let changed = turns
  for (const parameter of parameters) {
    if (parameter.parameter !== 'DURATION' || changed === null) continue
    if (changed < parameter.minimumMinutes * ROUNDS_PER_CAMPAIGN_MINUTE) continue
    changed = Math.max(
      changed,
      Math.min(
        changed * parameter.multiplier,
        parameter.maximumHours * 60 * ROUNDS_PER_CAMPAIGN_MINUTE
      )
    )
  }
  return changed
}

/** Whether a paid modifier's `DURATION` parameters lengthen at least one of the spell's timed effects. */
export function castModifierExtendsDuration(
  parameters: readonly CastModifierParameterAuthored[],
  turnsByEffect: readonly (number | null)[]
): boolean {
  return (
    !parameters.some(({ parameter }) => parameter === 'DURATION') ||
    turnsByEffect.some((turns) => castModifierDuration(parameters, turns) !== turns)
  )
}

/** Creatures a Character may spare from an area spell it casts, authored as a passive Effect's `sparesCreatures`. */
export type SparesCreaturesSource = SparesCreaturesAuthored

export function collectSparesCreatures(
  effects: readonly CompiledEffectGroup[] | undefined
): SparesCreaturesSource[] {
  return (effects ?? []).flatMap((effect) =>
    effect.invocation.kind === 'PASSIVE' && 'sparesCreatures' in effect.invocation
      ? effect.invocation.sparesCreatures
        ? [effect.invocation.sparesCreatures]
        : []
      : []
  )
}

/** How many creatures the sources let a cast of this spell spare; each source that fits adds its own. */
export function sparedCreatureCap(
  sources: readonly SparesCreaturesSource[],
  spell: { level: number; magicSchoolId: string }
): number {
  return sources.reduce(
    (total, { base, plusSpellLevel, magicSchoolIds }) =>
      magicSchoolIds && !magicSchoolIds.includes(spell.magicSchoolId)
        ? total
        : total + base + (plusSpellLevel ? spell.level : 0),
    0
  )
}
