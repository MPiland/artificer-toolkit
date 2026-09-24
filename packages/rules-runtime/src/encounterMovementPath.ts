import { EncounterValidationError } from './encounterErrors.js'

function samePoint(left: { x: number; y: number }, right: { x: number; y: number }): boolean {
  return Math.abs(left.x - right.x) <= 1e-8 && Math.abs(left.y - right.y) <= 1e-8
}

/** Exact polyline slice by distance; avoids using position lookup on self-intersecting paths. */
export function sliceMovementPath(
  path: readonly { x: number; y: number }[],
  startDistance: number,
  endDistance: number
): { x: number; y: number }[] {
  if (startDistance < 0 || endDistance < startDistance) {
    throw new EncounterValidationError('Movement slice distances are invalid.')
  }
  let walked = 0
  const result: { x: number; y: number }[] = []
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1]!
    const to = path[index]!
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    const segmentStart = walked
    const segmentEnd = walked + length
    const overlapStart = Math.max(startDistance, segmentStart)
    const overlapEnd = Math.min(endDistance, segmentEnd)
    if (overlapStart <= overlapEnd + 1e-8 && length > 0) {
      const pointAt = (distance: number) => {
        const ratio = Math.max(0, Math.min(1, (distance - segmentStart) / length))
        return {
          x: from.x + (to.x - from.x) * ratio,
          y: from.y + (to.y - from.y) * ratio
        }
      }
      const start = pointAt(overlapStart)
      const end = pointAt(overlapEnd)
      if (result.length === 0 || !samePoint(result.at(-1)!, start)) result.push(start)
      if (!samePoint(result.at(-1)!, end)) result.push(end)
    }
    walked = segmentEnd
  }
  if (result.length === 0) throw new EncounterValidationError('Movement slice is outside its path.')
  return result
}
