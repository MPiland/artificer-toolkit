import { evaluateNumericExpr, type NumericExpr } from '@artificer-toolkit/shared/core'
import type { SummonStatBlockDto } from '@artificer-toolkit/schema/effects/manifest'

/**
 * The hit points a summon's stat block gives it against the caster's effective hit point maximum:
 * 0 when it authors none. The Sheet and the Encounter both size a summon here (D190).
 */
export function summonHitPoints(
  statBlock: Pick<SummonStatBlockDto, 'hitPoints'>,
  casterHitPointMaximum: number
): number {
  const { hitPoints } = statBlock
  if (!hitPoints) return 0
  const value = evaluateNumericExpr(hitPoints as NumericExpr, {
    hitPointMaximum: casterHitPointMaximum
  })
  if (value === null) throw new Error("The summon's hit points do not evaluate.")
  return value
}

/**
 * A group token's hit point pool: one creature's hit points times its count (D200); a single
 * creature has no count. The Sheet and the Encounter both size a group here.
 */
export function groupHitPointPool(creatureHitPoints: number, count: number | null): number {
  return creatureHitPoints * (count ?? 1)
}

/**
 * What the GM setting a group's count changes beyond the count. Lowering leaves hit points alone:
 * the GM lowers it after the damage has already taken them. Raising (an upcast) adds one
 * creature's hit points per added creature to both current and maximum. One creature's hit points
 * is read from its snapshot, since the maximum no longer divides by the count once it was lowered.
 */
export function groupCountChange(
  actor: { maxHitPoints: number; currentHitPoints: number },
  creatureHitPoints: number,
  oldCount: number,
  newCount: number
): { maxHitPoints: number; currentHitPoints: number } | Record<string, never> {
  if (newCount <= oldCount) return {}
  const added = creatureHitPoints * (newCount - oldCount)
  return {
    maxHitPoints: actor.maxHitPoints + added,
    currentHitPoints: actor.currentHitPoints + added
  }
}
