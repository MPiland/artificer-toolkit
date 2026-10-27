import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import {
  measureScenePathMovementCost,
  zoneMovementSegmentMultiplier,
  type SceneBarrier,
  type SceneGrid,
  type SpatialEffectInstance,
  type SpatialSceneToken
} from '@artificer-toolkit/shared/vtt'
import { EncounterValidationError } from './encounterErrors.js'
import { readEncounterMovementPendingContext } from './encounterMovementPendingContext.js'
import { sliceMovementPath, terminalMovementPathEnd } from './encounterMovementPath.js'
import { spatialExecutionStopsMovement } from './encounterSpatialCandidateExecution.js'

type Point = { x: number; y: number }
type MovementOutcome = SceneSpatialPreparation['outcome']
type TokenMoved = {
  kind: 'TOKEN_MOVED'
  tokenId: string
  position: Point
  rotationDegrees?: number
}

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
 * exploration follows this segment. A won passage that enters the blocker's space walks to the
 * contact and steps in from there, at no further cost.
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
  let pathEnd: Point
  if (outcome.kind === 'PENDING') {
    const { root } = readEncounterMovementPendingContext(outcome.pendingSnapshot)
    endDistance = root.pathStartDistance
    position = root.currentPosition
    pathEnd = position
  } else {
    position = outcome.result.terminalPosition
    pathEnd = terminalMovementPathEnd(outcome)
    const stops = [
      ...outcome.result.reactionExecutions
        .filter((entry) => entry.execution.movementInterruption?.kind === 'STOP')
        .map((entry) => entry.option.candidate.pathDistance),
      ...(outcome.result.status === 'BATCH_COMPLETE'
        ? outcome.result.executions
            .filter((entry) => spatialExecutionStopsMovement(entry, outcome.result.movementKind))
            .map((entry) => entry.candidate.candidate.pathDistance)
        : [])
    ]
    endDistance =
      outcome.terminalPathDistance ?? (stops.length ? Math.min(...stops) : pathLength(input.path))
  }
  const path = sliceMovementPath(input.path, startDistance, endDistance)
  const last = path.at(-1)!
  if (Math.abs(last.x - pathEnd.x) > 1e-8 || Math.abs(last.y - pathEnd.y) > 1e-8)
    throw new EncounterValidationError(
      'Prepared movement does not match its authoritative path segment.'
    )
  return { path, position }
}

/**
 * The token delta a move publishes: a terminal result moves to its terminal position unless it
 * ended where the Scene already has it, a pause moves only by its movement intent, and an
 * uninterrupted or unbound move reaches the end of its path. A drag publishes one batch: the
 * mover's move, then each dragged token's (D105).
 */
export function preparedMovementSceneDelta(input: {
  tokenId: string
  path: readonly Point[]
  outcome: MovementOutcome | null
  sceneVersion: number
  facingDegrees?: number
  draggedTokens?: SceneSpatialPreparation['draggedTokens']
}): TokenMoved | { kind: 'BATCH'; deltas: TokenMoved[] } | null {
  const moved = preparedMoverSceneDelta(input)
  const dragged = input.draggedTokens ?? []
  // The room drags only behind a mover that moves; persistence refuses a stored drag that does not.
  if (!dragged.length || !moved) return moved
  return {
    kind: 'BATCH',
    deltas: [
      moved,
      ...dragged.map(({ tokenId, to }) => ({
        kind: 'TOKEN_MOVED' as const,
        tokenId,
        position: to
      }))
    ]
  }
}

/**
 * The mover's own token delta, before any drag. A move that ends carries the facing it chose
 * (ATTACK-12); a pause has not ended, so its intent keeps the token's facing.
 */
export function preparedMoverSceneDelta(input: {
  tokenId: string
  path: readonly Point[]
  outcome: MovementOutcome | null
  sceneVersion: number
  facingDegrees?: number
}): TokenMoved | null {
  const { outcome } = input
  const facing = input.facingDegrees === undefined ? {} : { rotationDegrees: input.facingDegrees }
  if (outcome?.kind === 'TERMINAL') {
    const { result } = outcome
    if (
      result.sceneVersion !== input.sceneVersion &&
      result.sceneVersion !== input.sceneVersion + 1
    )
      throw new EncounterValidationError('Spatial Scene version is inconsistent.')
    return result.sceneVersion === input.sceneVersion
      ? null
      : {
          kind: 'TOKEN_MOVED',
          tokenId: result.tokenId,
          position: result.terminalPosition,
          ...facing
        }
  }
  if (outcome?.kind === 'PENDING')
    return outcome.movementIntent ? { kind: 'TOKEN_MOVED', ...outcome.movementIntent } : null
  return { kind: 'TOKEN_MOVED', tokenId: input.tokenId, position: input.path.at(-1)!, ...facing }
}

/**
 * The movement a published segment spends (D38): the path's terrain-aware cost walked to the
 * segment's end less its cost to the segment's start. Measuring from the path's origin keeps grid
 * rounding consistent, so a move's segments sum to its whole walk across decision pauses.
 * A careful mover (SPELLS-17) pays double for the stretch its footprint spends inside a field that
 * allows passage at half speed, and a zone's movement cost applies to the movers it catches (D154);
 * a mover whose passage takes it through other creatures pays its passage multiplier inside them.
 * A drag doubles the whole cost on top (D105).
 */
export function preparedMovementCost(input: {
  grid: SceneGrid
  scene: { readonly barriers: readonly SceneBarrier[] }
  path: readonly Point[]
  startDistance: number
  outcome: MovementOutcome | null
  /** A bound mover and the zones on its Scene; absent for an unbound move. */
  mover?: {
    tokenId: string
    actorId: string
    tokens: readonly SpatialSceneToken[]
    effects: readonly SpatialEffectInstance[]
    /** A careful mover pays double inside a visible field that allows passage at half speed. */
    carefully: boolean
    /** A grappler dragging a creature not two sizes smaller pays double (D105). */
    dragDoublesCost?: boolean
    /** What each foot inside another creature's space costs a mover whose passage takes it through. */
    passage?: { costMultiplier: number; creatureTokenIds: readonly string[] }
  }
}): number {
  const { mover } = input
  // A passed creature's space is a zone of the passage multiplier, its footprint around the token.
  const passage = mover?.passage
  const creatureZones = (passage?.creatureTokenIds ?? []).flatMap((tokenId) => {
    const token = mover?.tokens.find(({ id }) => id === tokenId)
    if (!token || !passage) return []
    const [x, y] = [token.width / 2, token.height / 2]
    return [
      {
        anchorKind: 'TOKEN' as const,
        sourceTokenId: tokenId,
        geometry: {
          frame: 'TOKEN_LOCAL' as const,
          shape: {
            kind: 'POLYGON' as const,
            points: [
              { x: -x, y: -y },
              { x, y: -y },
              { x, y },
              { x: -x, y }
            ]
          }
        },
        unaffectedActorIds: [],
        suppressed: false,
        multiplier: passage.costMultiplier
      }
    ]
  })
  // The highest of the terrain, zone, passage and careful multipliers applies (D154); a drag doubles it (D105).
  const zoneMultiplier =
    mover &&
    zoneMovementSegmentMultiplier({
      zones: [
        ...mover.effects.map((effect) => ({
          ...effect,
          multiplier: Math.max(
            effect.movementCostMultiplier ?? 1,
            mover.carefully && effect.bypassAtHalfSpeed ? 2 : 1
          )
        })),
        ...creatureZones
      ],
      mover,
      tokens: mover.tokens,
      dragDoublesCost: mover.dragDoublesCost ?? false
    })
  const walked = (path: readonly Point[]) =>
    measureScenePathMovementCost(input.grid, input.scene, path, zoneMultiplier)
  const toEnd = preparedMovementSegment({ ...input, startDistance: 0 }).path
  const toStart =
    input.startDistance > 0 ? walked(sliceMovementPath(input.path, 0, input.startDistance)) : 0
  return Math.max(walked(toEnd) - toStart, 0)
}
