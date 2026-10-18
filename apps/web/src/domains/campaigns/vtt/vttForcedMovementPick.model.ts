import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { measureSceneDistance, type ScenePoint } from '@artificer-toolkit/shared/vtt'
import {
  formatSceneDistance,
  type VttScenePresentationOverlay,
  type VttSquarePick
} from './vttSceneRenderer.model'

const destinationColor = 0x1c7ed6

/** Where the creature a forced movement moves may land, as the board offers it to the source. */
export interface VttForcedMovementPick {
  creature: string
  /** Each legal square in the room's order, named by the direction and distance it moves the creature. */
  destinations: { position: ScenePoint; label: string }[]
  squares: VttSquarePick
}

/**
 * The board pick a pending forced-movement destination offers (D157): the legal squares the room
 * derived, each a footprint of the moved creature's size; null while that creature has no token.
 */
export function forcedMovementDestinationPick({
  pending,
  scene,
  targetTokenId
}: {
  pending: Extract<
    PendingEncounterRuleOccurrenceSummaryDto,
    { kind: 'FORCED_MOVEMENT_DESTINATION' }
  >
  scene: Pick<CampaignSceneStateDto, 'grid' | 'tokens'>
  targetTokenId: string
}): VttForcedMovementPick | null {
  const token = scene.tokens.find(({ id }) => id === targetTokenId)
  if (!token) return null
  const { grid } = scene
  const along = (offset: number) =>
    formatSceneDistance(grid, (Math.abs(offset) / grid.cellSize) * grid.distancePerCell)
  return {
    creature: token.label,
    destinations: pending.positions.map((position) => {
      const dx = position.x - token.position.x
      const dy = position.y - token.position.y
      if (dx === 0 && dy === 0) return { position, label: `Leave ${token.label} where it is` }
      const northSouth = dy < 0 ? 'north' : 'south'
      const eastWest = dx > 0 ? 'east' : 'west'
      const moved = formatSceneDistance(grid, measureSceneDistance(grid, token.position, position))
      const label =
        dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)
          ? `Move ${token.label} ${moved} ${[dy ? northSouth : null, dx ? eastWest : null].filter(Boolean).join('-')}`
          : `Move ${token.label} ${moved}: ${along(dx)} ${eastWest}, ${along(dy)} ${northSouth}`
      return { position, label }
    }),
    squares: {
      centers: pending.positions,
      width: token.width,
      height: token.height
    }
  }
}

/** Outlines every legal square on the board, marking the one the keyboard focuses. */
export function forcedMovementDestinationOverlays(
  pick: VttForcedMovementPick,
  focused: ScenePoint | null
): VttScenePresentationOverlay[] {
  const halfWidth = pick.squares.width / 2
  const halfHeight = pick.squares.height / 2
  return pick.destinations.map(({ position, label }) => ({
    color: destinationColor,
    id: `forced-movement-destination-${position.x}-${position.y}`,
    kind: 'POLYGON',
    label,
    purpose: focused?.x === position.x && focused.y === position.y ? 'TARGET' : 'RANGE',
    points: [
      { x: position.x - halfWidth, y: position.y - halfHeight },
      { x: position.x + halfWidth, y: position.y - halfHeight },
      { x: position.x + halfWidth, y: position.y + halfHeight },
      { x: position.x - halfWidth, y: position.y + halfHeight }
    ]
  }))
}
