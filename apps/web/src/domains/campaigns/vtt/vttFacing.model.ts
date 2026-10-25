import { sceneBearingDegrees, type ScenePoint } from '@artificer-toolkit/shared/vtt'

const compassNames = [
  'North',
  'North-east',
  'East',
  'South-east',
  'South',
  'South-west',
  'West',
  'North-west'
]

/** Every facing a token may turn to under the Encounter's Facing step, clockwise from north. */
export function facingDirections(stepDegrees: number): number[] {
  return Array.from({ length: 360 / stepDegrees }, (_, index) => index * stepDegrees)
}

/**
 * The facing a move ends in by default: its last leg's direction of travel, snapped to the
 * nearest facing step; null for a path that never leaves its start.
 */
export function travelFacingDegrees(
  path: readonly ScenePoint[],
  stepDegrees: number
): number | null {
  for (let index = path.length - 1; index > 0; index -= 1) {
    const bearing = sceneBearingDegrees(path[index - 1]!, path[index]!)
    if (bearing !== null) return (Math.round(bearing / stepDegrees) * stepDegrees) % 360
  }
  return null
}

/** A facing's name: its compass point when it has one, otherwise its degrees from north. */
export function facingLabel(degrees: number): string {
  return degrees % 45 === 0 ? compassNames[degrees / 45]! : `${degrees}° from north`
}
