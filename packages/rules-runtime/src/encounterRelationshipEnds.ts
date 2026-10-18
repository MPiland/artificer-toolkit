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

/**
 * The actor relationships whose hold has ended on its own (D152): the source can't act, or the
 * held creature's token stands beyond the reach the relationship sealed from the source's token.
 * A relationship whose tokens the Scene does not place is not measured. `canAct` is asked at most
 * once per source, and only for sources whose holds are still within reach.
 */
export async function encounterEndedRelationships(input: {
  activeEffectsByActorId: EncounterRelationshipActiveEffectsByActorId
  /** The Scene tokens bound to the Run's actors; null when the Run is on no Scene. */
  scene: { grid: SceneGrid; tokens: readonly PlacedActor[] } | null
  canAct: (actorId: string) => Promise<boolean>
}): Promise<{ sourceActorId: string; heldActorId: string; activeEffectId: string }[]> {
  const ableBySource = new Map<string, Promise<boolean>>()
  const ended: { sourceActorId: string; heldActorId: string; activeEffectId: string }[] = []
  for (const relationship of encounterRelationships(input.activeEffectsByActorId)) {
    const { sourceActorId, actorId: heldActorId, effect, contribution } = relationship
    if (ended.some((entry) => entry.activeEffectId === effect.id)) continue
    const beyondReach = (() => {
      if (!input.scene) return false
      const { grid, tokens } = input.scene
      const source = tokens.find((token) => token.actorId === sourceActorId)
      const held = tokens.find((token) => token.actorId === heldActorId)
      if (!source || !held) return false
      const feet = convertSceneDistance(
        measureSceneTokenFootprintDistance(grid, source, held),
        grid.unit,
        'FEET'
      )
      return feet > contribution.sealedReachFeet + REACH_EPSILON_FEET
    })()
    if (!beyondReach) {
      const able = ableBySource.get(sourceActorId) ?? input.canAct(sourceActorId)
      ableBySource.set(sourceActorId, able)
      if (await able) continue
    }
    ended.push({ sourceActorId, heldActorId, activeEffectId: effect.id })
  }
  return ended
}
