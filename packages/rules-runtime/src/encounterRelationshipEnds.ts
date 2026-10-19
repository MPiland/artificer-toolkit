import {
  convertSceneDistance,
  measureSceneTokenFootprintDistance,
  type SceneGrid,
  type SceneToken
} from '@artificer-toolkit/shared/vtt'
import {
  encounterRelationships,
  type EncounterRelationshipActiveEffectsByActorId
} from './encounterRelationshipActionFacts.js'

type PlacedActor = { actorId: string } & Pick<
  SceneToken,
  'position' | 'height' | 'width' | 'rotationDegrees'
>

/** Rounding slack on the measured distance, so a creature exactly at the sealed reach stays held. */
const REACH_EPSILON_FEET = 1e-6

export type EncounterReachScene = { grid: SceneGrid; tokens: readonly PlacedActor[] }

/**
 * Whether two actors' tokens stand within `reachFeet` of each other, measured between footprints;
 * null when the Scene does not place both, so the caller decides how an unmeasured pair reads.
 */
export function encounterActorsWithinReach(
  scene: EncounterReachScene | null,
  actorId: string,
  otherActorId: string,
  reachFeet: number
): boolean | null {
  if (!scene) return null
  const first = scene.tokens.find((token) => token.actorId === actorId)
  const second = scene.tokens.find((token) => token.actorId === otherActorId)
  if (!first || !second) return null
  const feet = convertSceneDistance(
    measureSceneTokenFootprintDistance(scene.grid, first, second),
    scene.grid.unit,
    'FEET'
  )
  return feet <= reachFeet + REACH_EPSILON_FEET
}

/**
 * The actor relationships whose hold has ended on its own (D152): the source can't act, or the
 * held creature's token stands beyond the reach the relationship sealed from the source's token.
 * A relationship whose tokens the Scene does not place is not measured. `canAct` is asked at most
 * once per source, and only for sources whose holds are still within reach.
 */
export async function encounterEndedRelationships(input: {
  activeEffectsByActorId: EncounterRelationshipActiveEffectsByActorId
  /** The Scene tokens bound to the Run's actors; null when the Run is on no Scene. */
  scene: EncounterReachScene | null
  canAct: (actorId: string) => Promise<boolean>
}): Promise<{ sourceActorId: string; heldActorId: string; activeEffectId: string }[]> {
  const ableBySource = new Map<string, Promise<boolean>>()
  const ended: { sourceActorId: string; heldActorId: string; activeEffectId: string }[] = []
  for (const relationship of encounterRelationships(input.activeEffectsByActorId)) {
    const { sourceActorId, actorId: heldActorId, effect, contribution } = relationship
    if (ended.some((entry) => entry.activeEffectId === effect.id)) continue
    const beyondReach =
      encounterActorsWithinReach(
        input.scene,
        sourceActorId,
        heldActorId,
        contribution.sealedReachFeet
      ) === false
    if (!beyondReach) {
      const able = ableBySource.get(sourceActorId) ?? input.canAct(sourceActorId)
      ableBySource.set(sourceActorId, able)
      if (await able) continue
    }
    ended.push({ sourceActorId, heldActorId, activeEffectId: effect.id })
  }
  return ended
}
