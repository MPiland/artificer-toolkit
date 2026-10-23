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
import { endSubscriptions } from './events/effectHooks.js'

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

export type EncounterEndedHold = {
  sourceActorId: string
  heldActorId: string
  activeEffectId: string
}

/**
 * The effects that end once their holder stands farther from the actor that applied them than a
 * `SEPARATED` end trigger allows (Warding Bond). An effect whose tokens the Scene does not place is
 * not measured.
 */
export function encounterSeparatedEffects(input: {
  activeEffectsByActorId: EncounterRelationshipActiveEffectsByActorId
  scene: EncounterReachScene | null
}): EncounterEndedHold[] {
  return [...input.activeEffectsByActorId].flatMap(([heldActorId, effects]) =>
    effects.flatMap((effect) => {
      const { origin } = effect.definition
      if (origin.kind !== 'ENCOUNTER' || !origin.sourceActorId) return []
      const { sourceActorId } = origin
      const separated = endSubscriptions(effect).some(
        (subscription) =>
          subscription.event === 'SEPARATED' &&
          encounterActorsWithinReach(
            input.scene,
            sourceActorId,
            heldActorId,
            subscription.beyondFeet
          ) === false
      )
      return separated ? [{ sourceActorId, heldActorId, activeEffectId: effect.id }] : []
    })
  )
}

/**
 * The actor relationships whose hold has ended on its own (D152): the source can't act, or the
 * held creature's token stands beyond the reach the relationship sealed from the source's token.
 * A relationship whose tokens the Scene does not place is not measured. `canAct` is asked at most
 * once per source, and only for sources whose holds are still within reach. Effects a `SEPARATED`
 * end trigger ends (`encounterSeparatedEffects`) end with them.
 */
export async function encounterEndedRelationships(input: {
  activeEffectsByActorId: EncounterRelationshipActiveEffectsByActorId
  /** The Scene tokens bound to the Run's actors; null when the Run is on no Scene. */
  scene: EncounterReachScene | null
  canAct: (actorId: string) => Promise<boolean>
}): Promise<EncounterEndedHold[]> {
  const ableBySource = new Map<string, Promise<boolean>>()
  const ended: EncounterEndedHold[] = []
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
  for (const separated of encounterSeparatedEffects(input))
    if (!ended.some((entry) => entry.activeEffectId === separated.activeEffectId))
      ended.push(separated)
  return ended
}
