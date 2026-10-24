import { evaluateNumericExpr, type NumericExpr } from '@artificer-toolkit/shared/core'
import type { CompiledActionSummonPlacement } from '@artificer-toolkit/schema/projections/characterMechanics'

/**
 * The hit points a summon's stat block gives it against the caster's effective hit point maximum:
 * 0 when it authors none. The Sheet and the Encounter both size a summon here (D190).
 */
export function summonHitPoints(
  statBlock: Pick<CompiledActionSummonPlacement['statBlock'], 'hitPoints'>,
  casterHitPointMaximum: number
): number {
  const { hitPoints } = statBlock
  return hitPoints
    ? evaluateNumericExpr(hitPoints as NumericExpr, {
        hitPointMaximum: casterHitPointMaximum
      })
    : 0
}
