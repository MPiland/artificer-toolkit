import {
  ACTIVATION_REGISTRY,
  evaluateNumericExpr,
  TRIGGER_REGISTRY,
  type NumericExpr
} from '@artificer-toolkit/shared/core'
import type { SpellSummonStatBlockValues } from '@artificer-toolkit/shared/authored'
import type { CompiledActionSummonPlacement } from '@artificer-toolkit/schema/projections/characterMechanics'

/**
 * The stat block values a summon cast resolves against its caster once, at cast time (D190). A Sheet
 * summon and an Encounter summon's Run actor keep the same values, so both list the same attacks:
 * the effects the spell's conjured repeat offers let the caster make with the summon.
 */
export function resolveSpellSummonStatBlock(input: {
  placement: CompiledActionSummonPlacement
  casterHitPointMaximum: number
  spellId: string
  /** The creature's name when the stat block gives none: the spell's. */
  label: string
}): SpellSummonStatBlockValues {
  const { placement } = input
  const { statBlock, entry } = placement
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
  return {
    spellId: input.spellId,
    summonOutcomeId: placement.summonOutcomeId,
    label: placement.label ?? input.label,
    concentration: entry.maintenance !== null,
    ...(statBlock.size ? { size: statBlock.size } : {}),
    armorClass: resolve(statBlock.armorClass),
    ...(Object.keys(abilityScores).length ? { abilityScores } : {}),
    ...(statBlock.speeds?.length ? { speeds: statBlock.speeds } : {}),
    ...(passivePerception === null ? {} : { passivePerception }),
    ...(actions.length ? { actions } : {})
  }
}
