import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { EncounterValidationError } from './encounterErrors.js'
import { readEncounterMovementPendingContext } from './encounterMovementPendingContext.js'
import { sliceMovementPath } from './encounterMovementPath.js'

type Point = { x: number; y: number }
type MovementOutcome = SceneSpatialPreparation['outcome']

function pathLength(path: readonly Point[]): number {
  return path
    .slice(1)
    .reduce(
      (total, point, index) =>
        total + Math.hypot(point.x - path[index]!.x, point.y - path[index]!.y),
      0
    )
}

/**
 * The part of a bound move's path its prepared outcome actually walks, and where the token stops.
 * A pause stops at its decision point; a terminal result at its first STOP interruption. Fog
 * exploration follows this segment.
 */
export function preparedMovementSegment(input: {
  path: readonly Point[]
  startDistance: number
  outcome: MovementOutcome | null
}): { path: Point[]; position: Point } {
  const { outcome, startDistance } = input
  if (!outcome || outcome.kind === 'UNINTERRUPTED') {
    const path = sliceMovementPath(input.path, startDistance, Number.POSITIVE_INFINITY)
    return { path, position: path.at(-1)! }
  }
  let endDistance: number
  let position: Point
  if (outcome.kind === 'PENDING') {
    const { root } = readEncounterMovementPendingContext(outcome.pendingSnapshot)
    endDistance = root.pathStartDistance
    position = root.currentPosition
  } else {
    position = outcome.result.terminalPosition
    const stops = [
      ...outcome.result.reactionExecutions
        .filter((entry) => entry.execution.movementInterruption?.kind === 'STOP')
        .map((entry) => entry.option.candidate.pathDistance),
      ...(outcome.result.status === 'BATCH_COMPLETE'
        ? outcome.result.executions
            .filter((entry) => entry.execution.movementInterruption?.kind === 'STOP')
            .map((entry) => entry.candidate.candidate.pathDistance)
        : [])
    ]
    endDistance =
      outcome.terminalPathDistance ?? (stops.length ? Math.min(...stops) : pathLength(input.path))
  }
  const path = sliceMovementPath(input.path, startDistance, endDistance)
  const last = path.at(-1)!
  if (Math.abs(last.x - position.x) > 1e-8 || Math.abs(last.y - position.y) > 1e-8)
    throw new EncounterValidationError(
      'Prepared movement does not match its authoritative path segment.'
    )
  return { path, position }
}

/**
 * The token delta a move publishes: a terminal result moves to its terminal position unless it
 * ended where the Scene already has it, a pause moves only by its movement intent, and an
 * uninterrupted or unbound move reaches the end of its path.
 */
export function preparedMovementSceneDelta(input: {
  tokenId: string
  path: readonly Point[]
  outcome: MovementOutcome | null
  sceneVersion: number
}): { kind: 'TOKEN_MOVED'; tokenId: string; position: Point } | null {
  const { outcome } = input
  if (outcome?.kind === 'TERMINAL') {
    const { result } = outcome
    if (
      result.sceneVersion !== input.sceneVersion &&
      result.sceneVersion !== input.sceneVersion + 1
    )
      throw new EncounterValidationError('Spatial Scene version is inconsistent.')
    return result.sceneVersion === input.sceneVersion
      ? null
      : { kind: 'TOKEN_MOVED', tokenId: result.tokenId, position: result.terminalPosition }
  }
  if (outcome?.kind === 'PENDING')
    return outcome.movementIntent ? { kind: 'TOKEN_MOVED', ...outcome.movementIntent } : null
  return { kind: 'TOKEN_MOVED', tokenId: input.tokenId, position: input.path.at(-1)! }
}
