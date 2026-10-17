import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import { targetingExcludesCreatureType } from './encounterActionTargetPolicy.js'

/**
 * The creatures a rolled hit-point pool affects (Sleep): of the candidates whose creature type the
 * action affects, taken from the lowest current hit points up, each one's hit points subtracted
 * from the pool, a creature affected only while its hit points do not exceed what remains. The
 * candidates arrive in a stable order, which breaks a tie. A creature without a type is eligible.
 */
export function selectHitPointPoolTargets(
  pool: number,
  candidates: readonly {
    actorId: string
    currentHitPoints: number
    creatureTypeId: string | null
  }[],
  targeting: CompiledActionTargetPolicy['targeting']
): string[] {
  let remaining = pool
  const selected: string[] = []
  const eligible = candidates.filter(
    ({ creatureTypeId }) =>
      creatureTypeId === null || !targetingExcludesCreatureType(targeting, creatureTypeId)
  )
  for (const { actorId, currentHitPoints } of eligible.sort(
    (left, right) => left.currentHitPoints - right.currentHitPoints
  )) {
    // Sorted ascending, so every later creature has at least as many hit points.
    if (currentHitPoints > remaining) break
    remaining -= currentHitPoints
    selected.push(actorId)
  }
  return selected
}
