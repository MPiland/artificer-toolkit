import { sizeRank } from '@artificer-toolkit/shared/core'
import {
  effectiveSpatialGeometry,
  sceneTokenFootprintsOverlap,
  sceneTokenMovementFailure,
  spatialEffectAffects,
  spatialSegmentShareInside,
  type CampaignSceneState,
  type ScenePoint,
  type SpatialEffectInstance
} from '@artificer-toolkit/shared/vtt'
import {
  encounterSourceRelationships,
  type EncounterRelationshipActiveEffectsByActorId
} from './encounterRelationshipActionFacts.js'

type SceneToken = CampaignSceneState['tokens'][number]

/** A token the mover drags, with the creature it binds. */
export type EncounterDraggedToken = { tokenId: string; actorId: string }

const translated = (path: readonly ScenePoint[], offset: ScenePoint) =>
  path.map((point) => ({ x: point.x + offset.x, y: point.y + offset.y }))

/**
 * What a grappler's voluntary move drags (D105): the tokens of the creatures its own
 * `TARGET_DRAGGED` holds bind, one level deep. The move costs double unless every dragged creature
 * is two or more sizes smaller than the mover; an unknown size counts as not smaller. `path`, when
 * given, is checked for each dragged token translated by its offset from the mover: a path that
 * leaves the map, crosses a barrier, ends overlapping a token that stays put, or touches a Scene
 * effect that can catch the dragged creature is refused (release the grapple first). An effect
 * anchored on a token that moves with the drag keeps its place relative to the dragged creature.
 */
export function encounterMovementDrag(input: {
  scene: Pick<CampaignSceneState, 'map' | 'tokens' | 'barriers' | 'doorStates'>
  mover: { tokenId: string; actorId: string }
  actorIdByTokenId: ReadonlyMap<string, string>
  activeEffectsByActorId: EncounterRelationshipActiveEffectsByActorId
  sizeOf(actorId: string): string | null
  effects: readonly SpatialEffectInstance[]
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
  const moverRank = sizeRank(input.sizeOf(mover.actorId))
  const doublesCost = tokens.some(({ actorId }) => {
    const rank = sizeRank(input.sizeOf(actorId))
    return moverRank === null || rank === null || moverRank - rank < 2
  })
  const { path } = input
  if (!path || tokens.length === 0) return { kind: 'DRAG', tokens, doublesCost }

  const movingTokenIds = new Set([mover.tokenId, ...tokens.map(({ tokenId }) => tokenId)])
  const tokenById = new Map(scene.tokens.map((token) => [token.id, token]))
  const moverToken = tokenById.get(mover.tokenId)
  if (!moverToken) return { kind: 'REFUSED' }
  const refused = tokens.some(({ tokenId, actorId }) => {
    const token = tokenById.get(tokenId)
    if (!token) return true
    const dragged = translated(path, {
      x: token.position.x - moverToken.position.x,
      y: token.position.y - moverToken.position.y
    })
    const end = dragged.at(-1)!
    if (sceneTokenMovementFailure(scene, tokenId, end, dragged, 'VOLUNTARY')) return true
    const arrived: SceneToken = { ...token, position: end }
    if (
      scene.tokens.some(
        (other) => !movingTokenIds.has(other.id) && sceneTokenFootprintsOverlap(arrived, other)
      )
    )
      return true
    const catching = input.effects.filter(
      (effect) =>
        spatialEffectAffects(effect, actorId) &&
        !(
          effect.anchorKind === 'TOKEN' &&
          effect.sourceTokenId !== null &&
          movingTokenIds.has(effect.sourceTokenId)
        )
    )
    const geometries = catching.flatMap((effect) => {
      const geometry = effectiveSpatialGeometry(effect, scene.tokens)
      return geometry ? [geometry] : []
    })
    // An effect whose area cannot be read fails closed.
    if (geometries.length !== catching.length) return true
    return dragged
      .slice(1)
      .some(
        (to, index) =>
          spatialSegmentShareInside({ geometries, token, from: dragged[index]!, to }) > 0
      )
  })
  return refused ? { kind: 'REFUSED' } : { kind: 'DRAG', tokens, doublesCost }
}
