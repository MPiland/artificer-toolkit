import { isScenePointExplored, type SceneExplorationState } from './exploration.js'
import { measureSceneDistance } from './geometry.js'
import type { ScenePoint } from './scene.js'
import { sceneTokenFootprintsOverlap } from './sceneCombatPerception.js'
import { sceneLengthInFeet } from './sceneReducer.js'
import type { TeleportAllowanceDestinationKind } from './teleportAllowanceDestinationKind.js'

/** A teleport a cast granted: its range, its destination rule and the move that spent it, if any. */
export interface TeleportAllowanceChoice {
  castCommandId: string
  maxFeet: number
  destinationKind: TeleportAllowanceDestinationKind
  consumedByCommandId: string | null
}

export type TeleportAllowanceSelection =
  | { allowed: true; castCommandId: string }
  | { allowed: false; reason: 'NO_ALLOWANCE' | 'OUT_OF_RANGE' | 'OCCUPIED' | 'UNSEEN' }

/**
 * Picks the unspent allowance a teleport to `destination` spends: the smallest range that covers
 * the measured distance, skipping a visible-destination one when the viewer has not seen the
 * point. The destination must be free of every other token that occupies its space, hidden ones
 * included; a mover that does not occupy its space may arrive on any.
 */
export function selectTeleportAllowance(input: {
  scene: SceneExplorationState
  moverTokenId: string
  viewerUserId: string
  destination: ScenePoint
  allowances: readonly TeleportAllowanceChoice[]
  /** Whether a token fills its space; the Encounter decides it from the token's actor. */
  occupiesSpace: (tokenId: string) => boolean
}): TeleportAllowanceSelection {
  const { scene, destination } = input
  const mover = scene.tokens.find((token) => token.id === input.moverTokenId)
  const unspent = input.allowances
    .filter(({ consumedByCommandId }) => consumedByCommandId === null)
    .sort((left, right) => left.maxFeet - right.maxFeet)
  if (!mover || !unspent.length) return { allowed: false, reason: 'NO_ALLOWANCE' }
  const arrived = { ...mover, position: destination }
  if (
    input.occupiesSpace(mover.id) &&
    scene.tokens.some(
      (token) =>
        token.id !== mover.id &&
        input.occupiesSpace(token.id) &&
        sceneTokenFootprintsOverlap(arrived, token)
    )
  )
    return { allowed: false, reason: 'OCCUPIED' }
  const feet = sceneLengthInFeet(
    measureSceneDistance(scene.grid, mover.position, destination),
    scene.grid
  )
  const covering = unspent.filter(({ maxFeet }) => maxFeet >= feet)
  if (!covering.length) return { allowed: false, reason: 'OUT_OF_RANGE' }
  const seen = isScenePointExplored(scene, input.viewerUserId, destination)
  const usable = covering.find(
    ({ destinationKind }) => destinationKind === 'SPECIFIED_POINT' || seen
  )
  return usable
    ? { allowed: true, castCommandId: usable.castCommandId }
    : { allowed: false, reason: 'UNSEEN' }
}
