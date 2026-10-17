/**
 * The creatures a rolled hit-point pool affects (Sleep): taken from the lowest current hit points
 * up, each one's hit points subtracted from the pool, a creature affected only while its hit
 * points do not exceed what remains. The candidates arrive in a stable order, which breaks a tie.
 */
export function selectHitPointPoolTargets(
  pool: number,
  candidates: readonly { actorId: string; currentHitPoints: number }[]
): string[] {
  let remaining = pool
  const selected: string[] = []
  for (const { actorId, currentHitPoints } of [...candidates].sort(
    (left, right) => left.currentHitPoints - right.currentHitPoints
  )) {
    // Sorted ascending, so every later creature has at least as many hit points.
    if (currentHitPoints > remaining) break
    remaining -= currentHitPoints
    selected.push(actorId)
  }
  return selected
}
