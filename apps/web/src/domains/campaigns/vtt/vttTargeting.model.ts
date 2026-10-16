import type { EncounterActionTargetModifiersDto } from '@artificer-toolkit/schema/api/encounterActionTargetModifiers'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import {
  measureSceneTokenFootprintDistance,
  sceneRangeBand,
  type SceneRangeBand
} from '@artificer-toolkit/shared/vtt'
import {
  actionRangeLengths,
  formatSceneDistance,
  type VttActionPreview
} from './vttSceneRenderer.model'

interface TargetingActor {
  defeated: boolean
  id: string
  label: string
}

/** The action the caster is picking a target for. */
export interface VttTargetingRequest {
  actionId: string
  /** The action refuses the acting creature as its own target (Help, First Aid). */
  selfRefused: boolean
}

/** One creature the caster can pick as the target of the chosen action (ATTACK-17.1). */
export interface VttTargetEntry {
  actorId: string
  /** The grid-unit distance between the two footprints; null when either creature has no token on the Scene. */
  distance: number | null
  distanceLabel: string | null
  label: string
  /** Where the creature falls in the action's reach; null when the reach cannot be measured. */
  band: SceneRangeBand | null
  /** What the Character believes about attacking this creature; null while unread or for no attack roll. */
  attack: NonNullable<EncounterActionTargetModifiersDto['targets'][number]['attack']> | null
  tokenId: string | null
}

/**
 * The creatures the chosen action can name: a defeated creature is never a target (D63), and the
 * acting creature is not one when the action refuses itself (Help, First Aid).
 */
export function targetableEncounterActors<Actors extends readonly TargetingActor[]>(
  actors: Actors,
  currentActorId: string | null,
  selfRefused: boolean
): Actors[number][] {
  return actors.filter((actor) => !actor.defeated && !(selfRefused && actor.id === currentActorId))
}

/**
 * The target list while the caster targets, nearest first: a creature with no token on the Scene
 * has no distance and sorts last, and creatures at the same distance keep initiative order.
 */
export function buildTargetEntries({
  actorIdByTokenId,
  actors,
  currentActorId,
  modifiers,
  range,
  scene,
  selfRefused,
  sourceTokenId
}: {
  actorIdByTokenId: ReadonlyMap<string, string>
  actors: readonly TargetingActor[]
  currentActorId: string | null
  modifiers: EncounterActionTargetModifiersDto | null
  range: VttActionPreview['range']
  scene: Pick<CampaignSceneStateDto, 'grid' | 'tokens'> | null
  selfRefused: boolean
  sourceTokenId: string | null
}): VttTargetEntry[] {
  const source = scene?.tokens.find((token) => token.id === sourceTokenId) ?? null
  const tokenByActorId = new Map(
    (scene?.tokens ?? []).flatMap((token) => {
      const actorId = actorIdByTokenId.get(token.id)
      return actorId ? [[actorId, token] as const] : []
    })
  )
  const [normal, long] = actionRangeLengths(range)
  const measurable = normal !== undefined && [normal, long].every((length) => !length?.scaling)
  return targetableEncounterActors(actors, currentActorId, selfRefused)
    .map((actor): VttTargetEntry => {
      const token = tokenByActorId.get(actor.id) ?? null
      const measured = scene && source && token ? { grid: scene.grid, source, token } : null
      const distance = measured
        ? measureSceneTokenFootprintDistance(measured.grid, measured.source, measured.token)
        : null
      return {
        actorId: actor.id,
        attack: modifiers?.targets.find((target) => target.actorId === actor.id)?.attack ?? null,
        band:
          measured && measurable
            ? sceneRangeBand(measured.grid, measured.source, measured.token, { long, normal })
            : null,
        distance,
        distanceLabel:
          measured && distance !== null ? formatSceneDistance(measured.grid, distance) : null,
        label: actor.label,
        tokenId: token?.id ?? null
      }
    })
    .sort(
      (left, right) =>
        Number(left.distance === null) - Number(right.distance === null) ||
        (left.distance ?? 0) - (right.distance ?? 0)
    )
}

/** The turn-order list while the caster targets: listed creatures in target order, the rest after them in turn order. */
export function orderActorsForTargeting<Actors extends readonly { id: string }[]>(
  actors: Actors,
  entries: readonly VttTargetEntry[]
): Actors[number][] {
  const listed = entries.flatMap(({ actorId }) => actors.filter((actor) => actor.id === actorId))
  return [
    ...listed,
    ...actors.filter((actor) => !entries.some(({ actorId }) => actorId === actor.id))
  ]
}

/** The tokens the map lets the caster pick: listed creatures in normal or long range. */
export function targetableTokenIds(entries: readonly VttTargetEntry[]): ReadonlySet<string> {
  return new Set(
    entries.flatMap((entry) => (entry.tokenId && entry.band !== 'OUT' ? [entry.tokenId] : []))
  )
}

const bandLabels = {
  LONG: 'In long range',
  NORMAL: 'In range',
  OUT: 'Out of range'
} as const satisfies Record<SceneRangeBand, string>

const rollModeLabels = {
  ADVANTAGE: 'Advantage',
  DISADVANTAGE: 'Disadvantage',
  NORMAL: 'Normal'
} as const satisfies Record<NonNullable<VttTargetEntry['attack']>['rollMode'], string>

/** What the list and the hover readout say about one creature: its distance, its reach and what the Character believes. */
export function describeTargetEntry(entry: VttTargetEntry): string {
  return [
    entry.distanceLabel ?? 'Distance unknown',
    entry.band ? bandLabels[entry.band] : null,
    entry.attack
      ? `${rollModeLabels[entry.attack.rollMode]}${entry.attack.reasons.length ? ` (${entry.attack.reasons.join(', ')})` : ''}`
      : null
  ]
    .filter(Boolean)
    .join(' · ')
}
