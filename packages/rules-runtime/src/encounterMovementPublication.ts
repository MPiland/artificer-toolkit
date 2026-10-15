import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import {
  effectiveSpatialGeometry,
  measureScenePathMovementCost,
  spatialSegmentShareInside,
  type SceneBarrier,
  type SceneGrid,
  type SpatialSceneToken
} from '@artificer-toolkit/shared/vtt'
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

/**
 * The movement a published segment spends (D38): the path's terrain-aware cost walked to the
 * segment's end less its cost to the segment's start. Measuring from the path's origin keeps grid
 * rounding consistent, so a move's segments sum to its whole walk across decision pauses.
 * A careful mover (SPELLS-17) pays double for the stretch its footprint spends inside a field that
 * allows passage at half speed.
 */
export function preparedMovementCost(input: {
  grid: SceneGrid
  scene: { readonly barriers: readonly SceneBarrier[] }
  path: readonly Point[]
  startDistance: number
  outcome: MovementOutcome | null
  careful?: {
    tokenId: string
    tokens: readonly SpatialSceneToken[]
    effects: readonly Pick<EncounterSpatialRuleEffectRecord, 'placement'>[]
  }
}): number {
  const careful = input.careful
  const token = careful?.tokens.find(({ id }) => id === careful.tokenId)
  const fields =
    careful && token
      ? careful.effects
          .filter(({ placement }) => placement.bypassAtHalfSpeed)
          .flatMap(({ placement }) => effectiveSpatialGeometry(placement, careful.tokens) ?? [])
      : []
  const doubledShare =
    token && fields.length
      ? (from: Point, to: Point) =>
          spatialSegmentShareInside({ geometries: fields, token, from, to })
      : undefined
  const walked = (path: readonly Point[]) =>
    measureScenePathMovementCost(input.grid, input.scene, path, doubledShare)
  const toEnd = preparedMovementSegment({ ...input, startDistance: 0 }).path
  const toStart =
    input.startDistance > 0 ? walked(sliceMovementPath(input.path, 0, input.startDistance)) : 0
  return Math.max(walked(toEnd) - toStart, 0)
}
