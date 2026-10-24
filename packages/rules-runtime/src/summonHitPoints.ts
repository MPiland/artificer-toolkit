import { evaluateNumericExpr, type NumericExpr } from '@artificer-toolkit/shared/core'
import type { CompiledActionSummonPlacement } from '@artificer-toolkit/schema/projections/characterMechanics'

/**
 * The hit points a summon's stat block gives it: 0 when it authors none, null when it reads a caster
 * maximum the caller does not hold (a Character's lives on the Sheet), which the cast refuses. The
 * Sheet and the Encounter both size a summon here (D190).
 */
export function summonHitPoints(
  statBlock: Pick<CompiledActionSummonPlacement['statBlock'], 'hitPoints'>,
  casterHitPointMaximum: number | null
): number | null {
  const { hitPoints } = statBlock
  return hitPoints
    ? evaluateNumericExpr(hitPoints as NumericExpr, {
        hitPointMaximum: casterHitPointMaximum ?? undefined
      })
    : 0
}
