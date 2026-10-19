import {
  collectTokenFootprintPathCrossings,
  sceneTokenFootprintsOverlap,
  type ScenePoint,
  type SceneToken,
  type SpatialMovementKind
} from '@artificer-toolkit/shared/vtt'

/**
 * Geometry-only passage contact. Relationship and policy eligibility remain
 * outside this helper so a System policy, rather than token presentation,
 * decides whether a crossing can be attempted.
 */
interface EncounterMovementPassageContact {
  readonly blockerActorId: string
  readonly blockerTokenId: string
  readonly contact: ScenePoint
  readonly pathDistance: number
}

type EncounterMovementPassageDiscovery =
  | { readonly kind: 'NONE' }
  | { readonly kind: 'ENDPOINT_OCCUPIED'; readonly blockerActorIds: readonly string[] }
  | {
      readonly kind: 'CROSSING'
      readonly contact: EncounterMovementPassageContact
      readonly laterContacts: readonly EncounterMovementPassageContact[]
    }

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/**
 * Finds the ordered blocking full-footprint passage boundaries for voluntary movement.
 * The caller supplies already-locked relationship and passage facts through `blocks`; no actor
 * state is read or inferred here. A final footprint that blocks the mover ending inside it is
 * rejected rather than converted into a passage attempt.
 */
export function discoverEncounterMovementPassageContact(input: {
  readonly actorIdByTokenId: ReadonlyMap<string, string>
  /** Whether the blocker's footprint stops the mover crossing it, or ending inside it. */
  readonly blocks: (input: {
    readonly blockerActorId: string
    readonly movingActorId: string
    readonly endsInside: boolean
  }) => boolean
  readonly movementKind: SpatialMovementKind
  readonly movingTokenId: string
  readonly path: readonly ScenePoint[]
  readonly tokens: readonly Pick<SceneToken, 'height' | 'id' | 'position' | 'width'>[]
}): EncounterMovementPassageDiscovery {
  if (input.movementKind !== 'VOLUNTARY' || input.path.length < 2) return { kind: 'NONE' }
  const movingToken = input.tokens.find((token) => token.id === input.movingTokenId)
  const movingActorId = movingToken ? input.actorIdByTokenId.get(movingToken.id) : null
  if (!movingToken || !movingActorId) return { kind: 'NONE' }
  const stationary = input.tokens.filter((token) => token.id !== movingToken.id)
  const blocking = (endsInside: boolean) =>
    stationary.filter((token) => {
      const blockerActorId = input.actorIdByTokenId.get(token.id)
      return (
        blockerActorId !== undefined && input.blocks({ blockerActorId, movingActorId, endsInside })
      )
    })
  const endpoint = input.path.at(-1)
  if (!endpoint) return { kind: 'NONE' }
  const endpointBlockers = [
    ...new Set(
      blocking(true)
        .filter((token) =>
          sceneTokenFootprintsOverlap({ ...movingToken, position: endpoint }, token)
        )
        .map((token) => input.actorIdByTokenId.get(token.id)!)
    )
  ].sort(compareText)
  if (endpointBlockers.length > 0) {
    return { kind: 'ENDPOINT_OCCUPIED', blockerActorIds: endpointBlockers }
  }
  const crossings = collectTokenFootprintPathCrossings({
    movingToken,
    path: input.path,
    stationaryTokens: blocking(false)
  })
    .map((crossing) => {
      const blockerActorId = input.actorIdByTokenId.get(crossing.stationaryTokenId)
      return blockerActorId
        ? {
            blockerActorId,
            blockerTokenId: crossing.stationaryTokenId,
            contact: crossing.entry,
            pathDistance: crossing.entryPathDistance
          }
        : null
    })
    .filter((value): value is EncounterMovementPassageContact => value !== null)
    .sort(
      (left, right) =>
        left.pathDistance - right.pathDistance ||
        compareText(left.blockerActorId, right.blockerActorId) ||
        compareText(left.blockerTokenId, right.blockerTokenId)
    )
  return crossings[0]
    ? { kind: 'CROSSING', contact: crossings[0], laterContacts: crossings.slice(1) }
    : { kind: 'NONE' }
}
