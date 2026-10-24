import { sizeRank } from '@artificer-toolkit/shared/core'
import {
  sceneTokenFootprintsOverlap,
  sceneTokenMovementFailure,
  type CampaignSceneState,
  type ScenePoint
} from '@artificer-toolkit/shared/vtt'
import {
  encounterSourceRelationships,
  type EncounterRelationshipActiveEffectsByActorId
} from './encounterRelationshipActionFacts.js'

type SceneToken = CampaignSceneState['tokens'][number]

/** A token the mover drags, with the creature it binds. */
export type EncounterDraggedToken = { tokenId: string; actorId: string }

/**
 * Whether a drag costs double (D105): unless every dragged creature is two or more sizes smaller
 * than the mover. An unknown size counts as not smaller. Settlement and the route preview's
 * held-relationship read both decide it here.
 */
export function encounterDragDoublesCost(
  moverSize: string | null,
  draggedSizes: readonly (string | null)[]
): boolean {
  const moverRank = sizeRank(moverSize)
  return draggedSizes.some((size) => {
    const rank = sizeRank(size)
    return moverRank === null || rank === null || moverRank - rank < 2
  })
}

const translated = (path: readonly ScenePoint[], offset: ScenePoint) =>
  path.map((point) => ({ x: point.x + offset.x, y: point.y + offset.y }))

/**
 * What a grappler's voluntary move drags (D105): the tokens of the creatures its own
 * `TARGET_DRAGGED` holds bind, one level deep. The move costs double unless every dragged creature
 * is two or more sizes smaller than the mover; an unknown size counts as not smaller. `path`, when
 * given, is checked for each dragged token translated by its offset from the mover: a path that
 * leaves the map, crosses a barrier, or ends overlapping a token that stays put is refused
 * (release the grapple first), unless either token does not occupy its space. Scene effects the drag crosses settle on the dragged creature in
 * the mover's spatial pass (D170), not here.
 */
export function encounterMovementDrag(input: {
  scene: Pick<CampaignSceneState, 'map' | 'tokens' | 'barriers' | 'doorStates'>
  mover: { tokenId: string; actorId: string }
  actorIdByTokenId: ReadonlyMap<string, string>
  activeEffectsByActorId: EncounterRelationshipActiveEffectsByActorId
  sizeOf(actorId: string): string | null
  /** Whether a token fills its space (`encounterTokenOccupiesSpace`). */
  occupiesSpace(tokenId: string): boolean
  path: readonly ScenePoint[] | null
}): { kind: 'DRAG'; tokens: EncounterDraggedToken[]; doublesCost: boolean } | { kind: 'REFUSED' } {
  const { scene, mover } = input
  const heldActorIds = new Set(
    encounterSourceRelationships(input.activeEffectsByActorId, mover.actorId)
      .filter(({ contribution }) =>
        contribution.modules.some(({ kind }) => kind === 'TARGET_DRAGGED')
      )
      .map(({ actorId }) => actorId)
  )
  const tokens = [...input.actorIdByTokenId]
    .filter(([tokenId, actorId]) => tokenId !== mover.tokenId && heldActorIds.has(actorId))
    .map(([tokenId, actorId]) => ({ tokenId, actorId }))
    .sort((left, right) => left.tokenId.localeCompare(right.tokenId))
  const doublesCost = encounterDragDoublesCost(
    input.sizeOf(mover.actorId),
    tokens.map(({ actorId }) => input.sizeOf(actorId))
  )
  const { path } = input
  if (!path || tokens.length === 0) return { kind: 'DRAG', tokens, doublesCost }

  const movingTokenIds = new Set([mover.tokenId, ...tokens.map(({ tokenId }) => tokenId)])
  const tokenById = new Map(scene.tokens.map((token) => [token.id, token]))
  const moverToken = tokenById.get(mover.tokenId)
  if (!moverToken) return { kind: 'REFUSED' }
  const refused = tokens.some(({ tokenId }) => {
    const token = tokenById.get(tokenId)
    if (!token) return true
    const dragged = translated(path, {
      x: token.position.x - moverToken.position.x,
      y: token.position.y - moverToken.position.y
    })
    const end = dragged.at(-1)!
    if (sceneTokenMovementFailure(scene, tokenId, end, dragged, 'VOLUNTARY')) return true
    const arrived: SceneToken = { ...token, position: end }
    return (
      input.occupiesSpace(tokenId) &&
      scene.tokens.some(
        (other) =>
          !movingTokenIds.has(other.id) &&
          input.occupiesSpace(other.id) &&
          sceneTokenFootprintsOverlap(arrived, other)
      )
    )
  })
  return refused ? { kind: 'REFUSED' } : { kind: 'DRAG', tokens, doublesCost }
}
