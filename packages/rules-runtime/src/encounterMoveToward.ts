import {
  convertSceneDistance,
  measureSceneTokenFootprintDistance,
  type SceneGrid,
  type SceneToken
} from '@artificer-toolkit/shared/vtt'

/**
 * How far the attacker's latest voluntary move this turn closed its distance to the target, from
 * the Scene (D164); 0 when it made none, or has been moved since.
 */
export type MoveToward = { closedFeet: number }

type PlacedToken = Pick<SceneToken, 'position' | 'height' | 'width' | 'rotationDegrees'>

/** An actor's latest voluntary move this turn, as the token positions it began and ended at. */
export type TurnLastMove = {
  start: { x: number; y: number }
  end: { x: number; y: number }
}

/**
 * How far an attacker's latest move closed its distance to the target (D164): its footprint
 * distance to the target from where the move began, less from where it ended. A grid move that
 * closes N feet is a move of at least N feet straight toward the target. A move the attacker no
 * longer stands at the end of (forced, teleported or undone since) closes nothing.
 */
export function movedTowardTarget(input: {
  grid: SceneGrid
  lastMove: TurnLastMove | null
  attackerToken: PlacedToken
  targetToken: PlacedToken
}): MoveToward {
  const { lastMove, attackerToken } = input
  if (
    !lastMove ||
    lastMove.end.x !== attackerToken.position.x ||
    lastMove.end.y !== attackerToken.position.y
  )
    return { closedFeet: 0 }
  const distanceFrom = (position: PlacedToken['position']) =>
    convertSceneDistance(
      measureSceneTokenFootprintDistance(
        input.grid,
        { ...attackerToken, position },
        input.targetToken
      ),
      input.grid.unit,
      'FEET'
    )
  return { closedFeet: Math.max(0, distanceFrom(lastMove.start) - distanceFrom(lastMove.end)) }
}
