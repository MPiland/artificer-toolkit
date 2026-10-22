import type { EncounterActionTargetModifiersDto } from '@artificer-toolkit/schema/api/encounterActionTargetModifiers'
import type { EncounterPlayerProjectionDto } from '@artificer-toolkit/schema/api/encounterData'
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
  /** Why the player cannot see this listed creature; absent for the GM, who sees every creature. */
  unseenReason?: EncounterPlayerProjectionDto['actors'][number]['unseenReason']
}

/** The action the caster is picking a target for. */
export interface VttTargetingRequest {
  /** Null for a held effect's offer, which has no action to read attack modifiers for. */
  actionId: string | null
  /** The action refuses the acting creature as its own target (Help, First Aid). */
  selfRefused: boolean
  /** The only creatures the action may name (it targets what the user holds); absent for any creature. */
  onlyActorIds?: readonly string[]
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
  /** Set for a creature the GM revealed but the player cannot see: it has no distance and no token to pick. */
  unseenReason: NonNullable<TargetingActor['unseenReason']> | null
}

/**
 * The creatures the chosen action can name: a defeated creature is never a target (D63), and the
 * acting creature is not one when the action refuses itself (Help, First Aid).
 */
export function targetableEncounterActors<Actors extends readonly TargetingActor[]>(
  actors: Actors,
  currentActorId: string | null,
  selfRefused: boolean,
  onlyActorIds?: readonly string[]
): Actors[number][] {
  return actors.filter(
    (actor) =>
      !actor.defeated &&
      !(selfRefused && actor.id === currentActorId) &&
      (!onlyActorIds || onlyActorIds.includes(actor.id))
  )
}

/**
 * The target list while the caster targets: creatures the GM revealed but the player cannot see lead,
 * marked Hidden or Invisible with no distance (D131), then visible creatures nearest first. A visible
 * creature with no token on the Scene sorts last, and creatures at the same distance keep initiative order.
 */
export function buildTargetEntries({
  actorIdByTokenId,
  actors,
  currentActorId,
  modifiers,
  range,
  scene,
  selfRefused,
  onlyActorIds,
  sourceTokenId
}: {
  actorIdByTokenId: ReadonlyMap<string, string>
  actors: readonly TargetingActor[]
  currentActorId: string | null
  modifiers: EncounterActionTargetModifiersDto | null
  range: VttActionPreview['range']
  scene: Pick<CampaignSceneStateDto, 'grid' | 'tokens'> | null
  selfRefused: boolean
  onlyActorIds?: readonly string[]
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
  return targetableEncounterActors(actors, currentActorId, selfRefused, onlyActorIds)
    .map((actor): VttTargetEntry => {
      const unseenReason = actor.unseenReason ?? null
      const token = unseenReason ? null : (tokenByActorId.get(actor.id) ?? null)
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
        tokenId: token?.id ?? null,
        unseenReason
      }
    })
    .sort(
      (left, right) =>
        Number(right.unseenReason !== null) - Number(left.unseenReason !== null) ||
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

const unseenReasonLabels = {
  HIDDEN: 'Hidden',
  INVISIBLE: 'Invisible'
} as const satisfies Record<NonNullable<VttTargetEntry['unseenReason']>, string>

/** What the list and the hover readout say about one creature: its distance, its reach and what the Character believes. */
export function describeTargetEntry(entry: VttTargetEntry): string {
  return [
    entry.unseenReason ? unseenReasonLabels[entry.unseenReason] : null,
    entry.distanceLabel ?? 'Distance unknown',
    entry.band ? bandLabels[entry.band] : null,
    entry.attack
      ? `${entry.attack.rollModeLabel}${entry.attack.reasons.length ? ` (${entry.attack.reasons.join(', ')})` : ''}`
      : null
  ]
    .filter(Boolean)
    .join(' · ')
}
