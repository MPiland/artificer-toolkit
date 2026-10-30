import {
  ACTIVATION_REGISTRY,
  evaluateNumericExpr,
  TRIGGER_REGISTRY,
  type NumericExpr
} from '@artificer-toolkit/shared/core'
import type { SpellSummonStatBlockValues } from '@artificer-toolkit/shared/authored'
import type { CompiledActionSummonPlacement } from '@artificer-toolkit/schema/projections/characterMechanics'

/** The stat values a form summon takes from the System Creature the caster chose. */
export type FormSummonStats = Pick<
  SpellSummonStatBlockValues,
  'size' | 'armorClass' | 'abilityScores' | 'speeds' | 'passivePerception'
>

/**
 * The stat block values a summon cast resolves against its caster once, at cast time (D190). A Sheet
 * summon and an Encounter summon's Run actor keep the same values, so both list the same attacks:
 * the effects the spell's conjured repeat offers let the caster make with the summon.
 */
export function resolveSpellSummonStatBlock(input: {
  placement: CompiledActionSummonPlacement
  casterHitPointMaximum: number
  spellId: string
  /** The creature's name when the plan gives none: the chosen form's, else the spell's. */
  label: string
  /** A form summon's values, read from the System Creature it became (`formSummonStats`). */
  formStats?: FormSummonStats
}): SpellSummonStatBlockValues {
  const { placement } = input
  const { entry } = placement
  const actions = [
    ...(entry.modifierGrantContribution?.effectOffers ?? []),
    ...(entry.repeatCarrier?.effectOffers ?? [])
  ].flatMap((offer) =>
    offer.kind === 'REPEAT_SOURCE_PATH' && offer.origin === 'CONJURED'
      ? [
          {
            id: offer.effect.id,
            label: TRIGGER_REGISTRY[offer.effect.invocation.triggerCode].label,
            description: ACTIVATION_REGISTRY[offer.activation].label
          }
        ]
      : []
  )
  const identity = {
    spellId: input.spellId,
    summonOutcomeId: placement.summonOutcomeId,
    label: placement.label ?? input.label,
    concentration: entry.maintenance !== null,
    ...(actions.length ? { actions } : {})
  }
  if (!('statBlock' in placement)) {
    if (!input.formStats) throw new Error('A form summon resolves against its chosen Creature.')
    return { ...identity, ...input.formStats }
  }
  const { statBlock } = placement
  const resolve = (expr: unknown) =>
    expr === undefined
      ? null
      : evaluateNumericExpr(expr as NumericExpr, { hitPointMaximum: input.casterHitPointMaximum })
  const abilityScores = Object.fromEntries(
    Object.entries(statBlock.abilityScores ?? {}).flatMap(([ability, expr]) => {
      const score = resolve(expr)
      return score === null ? [] : [[ability, score]]
    })
  )
  const passivePerception = resolve(statBlock.passivePerception)
  return {
    ...identity,
    ...(statBlock.size ? { size: statBlock.size } : {}),
    armorClass: resolve(statBlock.armorClass),
    ...(Object.keys(abilityScores).length ? { abilityScores } : {}),
    ...(statBlock.speeds?.length ? { speeds: statBlock.speeds } : {}),
    ...(passivePerception === null ? {} : { passivePerception })
  }
}
