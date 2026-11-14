import {
  convertSceneDistance,
  measureSceneTokenFootprintDistance,
  type SceneGrid,
  type SceneToken
} from '@artificer-toolkit/shared/vtt'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { withLinkedDependents } from './activeEffectLinks.js'
import { encounterRelationships } from './encounterRelationshipActionFacts.js'
import { discoverEncounterEventHooks, REACH_EPSILON_FEET } from './events/encounterEventHooks.js'
import type { EncounterEvent } from './events/encounterEventTable.js'

type PlacedActor = { actorId: string } & Pick<
  SceneToken,
  'position' | 'height' | 'width' | 'rotationDegrees'
>

export type EncounterReachScene = { grid: SceneGrid; tokens: readonly PlacedActor[] }

/** The feet between two actors' token footprints; null when the Scene does not place both. */
function encounterActorDistanceFeet(
  scene: EncounterReachScene | null,
  actorId: string,
  otherActorId: string
): number | null {
  if (!scene) return null
  const first = scene.tokens.find((token) => token.actorId === actorId)
  const second = scene.tokens.find((token) => token.actorId === otherActorId)
  if (!first || !second) return null
  return convertSceneDistance(
    measureSceneTokenFootprintDistance(scene.grid, first, second),
    scene.grid.unit,
    'FEET'
  )
}

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
  const feet = encounterActorDistanceFeet(scene, actorId, otherActorId)
  return feet === null ? null : feet <= reachFeet + REACH_EPSILON_FEET
}

/**
 * The `SEPARATED` events a held creature's distance from a source raises on it: one when the Scene
 * places both tokens, none for an unmeasured pair.
 */
function separatedEvents(
  scene: EncounterReachScene | null,
  sourceActorId: string,
  heldActorId: string
): EncounterEvent[] {
  const feet = encounterActorDistanceFeet(scene, sourceActorId, heldActorId)
  return feet === null ? [] : [{ kind: 'SEPARATED', sourceActorId, feet }]
}

export type EncounterEndedHold = {
  sourceActorId: string
  heldActorId: string
  activeEffectId: string
}

type SweptEffectsByActorId = ReadonlyMap<
  string,
  readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition' | 'lifecycle'>[]
>

/**
 * The effects that end once their holder stands farther from the actor that applied them than a
 * `SEPARATED` end trigger allows (Warding Bond): the measured distance is raised on each as a
 * `SEPARATED` event. An effect whose tokens the Scene does not place is not measured.
 */
function encounterSeparatedEffects(input: {
  activeEffectsByActorId: SweptEffectsByActorId
  scene: EncounterReachScene | null
}): EncounterEndedHold[] {
  return [...input.activeEffectsByActorId].flatMap(([heldActorId, effects]) =>
    effects.flatMap((effect) => {
      const { origin } = effect.definition
      if (origin.kind !== 'ENCOUNTER' || !origin.sourceActorId) return []
      const { sourceActorId } = origin
      // Each effect is asked alone, so the sweep lists only an effect whose own subscription is met.
      const { ended } = discoverEncounterEventHooks({
        effects: [effect],
        events: separatedEvents(input.scene, sourceActorId, heldActorId)
      })
      return ended.length > 0 ? [{ sourceActorId, heldActorId, activeEffectId: effect.id }] : []
    })
  )
}

/**
 * The actor relationships whose hold has ended on its own (D152): the source can't act, or the
 * held creature's token stands beyond the reach the relationship sealed from the source's token.
 * A relationship whose tokens the Scene does not place is not measured. Each is raised on the hold
 * as an event: the measured distance as `SEPARATED`, then an unable source as `INCAPACITATED`.
 * `canAct` is asked at most once per source, and only for sources whose holds are still within
 * reach. Effects a `SEPARATED` end trigger ends (`encounterSeparatedEffects`) end with them.
 */
export async function encounterEndedRelationships(input: {
  activeEffectsByActorId: SweptEffectsByActorId
  /** The Scene tokens bound to the Run's actors; null when the Run is on no Scene. */
  scene: EncounterReachScene | null
  canAct: (actorId: string) => Promise<boolean>
}): Promise<EncounterEndedHold[]> {
  const ableBySource = new Map<string, Promise<boolean>>()
  const ended: EncounterEndedHold[] = []
  for (const relationship of encounterRelationships(input.activeEffectsByActorId)) {
    const { sourceActorId, actorId: heldActorId, effect, contribution } = relationship
    if (ended.some((entry) => entry.activeEffectId === effect.id)) continue
    if (contribution.modules.some(({ kind }) => kind === 'SOURCE_INDEPENDENT_HOLD')) continue
    const broken = (events: readonly EncounterEvent[]) =>
      discoverEncounterEventHooks({
        relationshipHolds: [{ sourceActorId, sealedReachFeet: contribution.sealedReachFeet }],
        events
      }).relationshipHolds.length > 0
    if (!broken(separatedEvents(input.scene, sourceActorId, heldActorId))) {
      const able = ableBySource.get(sourceActorId) ?? input.canAct(sourceActorId)
      ableBySource.set(sourceActorId, able)
      if (
        (await able) ||
        !broken([{ kind: 'INCAPACITATED', of: 'SOURCE', sourceActorIds: new Set([sourceActorId]) }])
      )
        continue
    }
    ended.push({ sourceActorId, heldActorId, activeEffectId: effect.id })
  }
  for (const separated of encounterSeparatedEffects(input))
    if (!ended.some((entry) => entry.activeEffectId === separated.activeEffectId))
      ended.push(separated)
  // An effect linked to an ended one ends with it (D172), as the event table does for every other end.
  const withDependents = [...ended]
  for (const end of ended) {
    const held = input.activeEffectsByActorId.get(end.heldActorId) ?? []
    const effect = held.find(({ id }) => id === end.activeEffectId)
    for (const { id } of effect ? withLinkedDependents([effect], held) : [])
      if (!withDependents.some((entry) => entry.activeEffectId === id))
        withDependents.push({ ...end, activeEffectId: id })
  }
  return withDependents
}
