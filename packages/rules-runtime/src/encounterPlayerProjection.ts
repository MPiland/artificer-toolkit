import {
  encounterPlayerProjectionDtoSchema,
  type EncounterGmProjectionDto,
  type EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounterData'
import { controlsActorOrOwner } from '@artificer-toolkit/shared/campaign/actorOwnership'
import { controlsAssignedCharacter } from '@artificer-toolkit/shared/campaign/characterControl'
import {
  HEALTH_BAR_RATIO_STEP,
  type HealthDescriptiveStateDto,
  type HealthDisplayLevelDto,
  type PlayerActorHealthDto
} from '@artificer-toolkit/schema/api/healthDisplay'
import { hideActiveGrantSources, hideConcentrationSource } from './activeGrantListings.js'

/** A coarse GM band; being defeated at 0 hit points is the actor's own `defeated` state (D63). */
export function healthBand(current: number, maximum: number) {
  if (maximum <= 0 || current >= maximum * 0.75) return 'HEALTHY' as const
  if (current >= maximum * 0.5) return 'WOUNDED' as const
  if (current >= maximum * 0.25) return 'BLOODIED' as const
  return 'CRITICAL' as const
}

/** Bloodied is the rules fact (at or below half); Near death starts at a quarter, including 0. */
export function healthDescriptiveState(
  current: number,
  maximum: number
): HealthDescriptiveStateDto {
  if (maximum <= 0 || current >= maximum) return 'UNHURT'
  if (current * 2 > maximum) return 'HURT'
  if (current * 4 > maximum) return 'BLOODIED'
  return 'NEAR_DEATH'
}

/** Only what the level allows: Hidden carries nothing, and a bar is a coarse ratio. */
export function playerActorHealth(
  level: HealthDisplayLevelDto,
  current: number,
  maximum: number
): PlayerActorHealthDto | null {
  switch (level) {
    case 'HIDDEN':
      return null
    case 'DESCRIPTIVE':
      return { level, state: healthDescriptiveState(current, maximum) }
    case 'BAR': {
      const ratio = maximum <= 0 ? 1 : Math.min(Math.max(current / maximum, 0), 1)
      const steps = Math.round(ratio / HEALTH_BAR_RATIO_STEP)
      return {
        level,
        ratio: Number((steps * HEALTH_BAR_RATIO_STEP).toFixed(2))
      }
    }
    case 'EXACT':
      return { level, current, maximum }
  }
}

/** What the viewer sees of the Encounter; see `projectPlayerEncounterProjection`. */
export type EncounterPlayerViewer = {
  userId: string
  /** Keyed by Character ID: its player, the members the GM granted control (D162) and "Show my health to the party". */
  characters: ReadonlyMap<
    string,
    { ownerUserId: string; health: HealthDisplayLevelDto; controllerUserIds?: readonly string[] }
  >
  /**
   * Public actors this viewer cannot see (token hidden or in fog, or a creature with no token on the
   * Encounter's Scene), from `unseenEncounterActorIds` (ATTACK-17.3, D121).
   */
  unseenActorIds: ReadonlySet<string>
}

/** The viewer a projection is built for: what they see, plus the Invisible condition types (D131). */
export type EncounterProjectionViewer = EncounterPlayerViewer & {
  unseenConditionTypeIds: ReadonlySet<string>
}

/** The ids of the System's condition types marked `unseen`: the one condition fact a player's list carries (D131). */
export function unseenConditionTypeIds(
  conditionTypes: readonly { id: string; code: string; unseen?: boolean }[]
): ReadonlySet<string> {
  return new Set(conditionTypes.flatMap((type) => (type.unseen ? [type.id] : [])))
}

/** Whether an actor's stored conditions (a type id, or a record holding one) include any of `typeIds`. */
function carriesConditionType(conditions: unknown, typeIds: ReadonlySet<string>): boolean {
  return (
    Array.isArray(conditions) &&
    conditions.some((condition) => {
      const typeId =
        typeof condition === 'object' && condition !== null && 'conditionTypeId' in condition
          ? condition.conditionTypeId
          : condition
      return typeof typeId === 'string' && typeIds.has(typeId)
    })
  )
}

/** The only label a creature revealed unnamed carries to a player. */
export const UNSEEN_CREATURE_LABEL = 'Unseen creature'

type ViewedActor = Pick<
  EncounterGmProjectionDto['actors'][number],
  'id' | 'kind' | 'sourceId' | 'public' | 'controllerUserIds' | 'owner' | 'reveal'
>

/**
 * The one decision, shared by every host, of which actors a non-GM cannot see (D121). An Encounter
 * with no Scene lists everything. Otherwise an actor is unseen when its token on the Scene is not
 * drawn for the viewer, or, with no token there, when it is a creature (a party Character without a
 * token stays listed, and the GM stages creatures off-map by leaving them unbound). The Convex reads
 * cannot read fog, so they pass `visibleTokenIds: null` and every bound actor is unseen; a host that
 * can tell passes the tokens the viewer's map draws, which only ever lists more.
 */
export function unseenEncounterActorIds(input: {
  actors: readonly Pick<EncounterGmProjectionDto['actors'][number], 'id' | 'kind'>[]
  /** The Scene the Encounter is bound to; null when it has none. */
  sceneId: string | null
  bindings: readonly { actorId: string; sceneId: string; tokenId: string }[]
  /** The tokens on `sceneId` the viewer's map draws; null when the host cannot tell. */
  visibleTokenIds: ReadonlySet<string> | null
}): ReadonlySet<string> {
  const { sceneId, bindings, visibleTokenIds } = input
  if (sceneId === null) return new Set()
  return new Set(
    input.actors.flatMap((actor) => {
      const binding = bindings.find(
        (candidate) => candidate.actorId === actor.id && candidate.sceneId === sceneId
      )
      const unseen = binding
        ? visibleTokenIds === null || !visibleTokenIds.has(binding.tokenId)
        : actor.kind !== 'CHARACTER'
      return unseen ? [actor.id] : []
    })
  )
}

/**
 * Whether the viewer controls the actor or, through `owner`, any actor in its owner chain: a listed
 * controller, or the player of a Character actor. `actors` is the Encounter's actor list the owners
 * are found in.
 */
export function playerControlsActor(
  actor: ViewedActor,
  viewer: EncounterPlayerViewer,
  actors: readonly ViewedActor[]
): boolean {
  return controlsActorOrOwner(
    actor,
    (actorId) => actors.find((candidate) => candidate.id === actorId),
    (candidate) => {
      const character =
        candidate.kind === 'CHARACTER' && candidate.sourceId !== null
          ? viewer.characters.get(candidate.sourceId)
          : undefined
      return (
        candidate.controllerUserIds.includes(viewer.userId) ||
        controlsAssignedCharacter(
          character && {
            userId: character.ownerUserId,
            controllerUserIds: character.controllerUserIds
          },
          viewer.userId
        )
      )
    }
  )
}

/**
 * The one visibility rule for a player's list, turn and targets (ATTACK-17.3): a public actor that
 * the viewer's map draws (or that has no token on the Scene), that the viewer controls, or that the
 * GM revealed.
 */
export function playerSeesActor(
  actor: ViewedActor,
  viewer: EncounterPlayerViewer,
  actors: readonly ViewedActor[]
): boolean {
  return (
    actor.public &&
    (!viewer.unseenActorIds.has(actor.id) ||
      actor.reveal !== null ||
      playerControlsActor(actor, viewer, actors))
  )
}

/**
 * Derive the player-safe view from a validated committed projection. This
 * keeps gameplay reads on the same projection for GMs and players while
 * retaining the intentionally smaller player contract: hidden actors, GM notes,
 * stat blocks and resources stay GM-only. Health follows each actor's display
 * level, and an actor's controllers (Foundry owners) always see its exact health.
 * A public actor the viewer cannot see and does not control is listed only once the
 * GM reveals it, and an actor revealed unnamed carries nothing that identifies it.
 */
export function projectPlayerEncounterProjection(
  encounter: EncounterGmProjectionDto,
  viewer: EncounterProjectionViewer
): EncounterPlayerProjectionDto {
  const listedCurrentActor = encounter.actors.find(
    (actor) =>
      actor.id === encounter.currentActorId && playerSeesActor(actor, viewer, encounter.actors)
  )
  return encounterPlayerProjectionDtoSchema.parse({
    id: encounter.id,
    campaignId: encounter.campaignId,
    gameSystemId: encounter.gameSystemId,
    blueprintId: encounter.blueprintId,
    blueprintVersion: encounter.blueprintVersion,
    blueprintChecksum: encounter.blueprintChecksum,
    name: encounter.name,
    status: encounter.status,
    automationMode: encounter.automationMode,
    initiativePolicy: encounter.initiativePolicy,
    optionalCombatRules: encounter.optionalCombatRules,
    facingStepDegrees: encounter.facingStepDegrees,
    facingArcs: encounter.facingArcs,
    version: encounter.version,
    round: encounter.round,
    currentActorId: listedCurrentActor?.id ?? null,
    actors: encounter.actors
      .filter((actor) => playerSeesActor(actor, viewer, encounter.actors))
      .map((actor) => {
        const character =
          actor.kind === 'CHARACTER' && actor.sourceId
            ? viewer.characters.get(actor.sourceId)
            : undefined
        const controlled = playerControlsActor(actor, viewer, encounter.actors)
        const unseenReason =
          controlled || !viewer.unseenActorIds.has(actor.id)
            ? null
            : carriesConditionType(actor.conditions, viewer.unseenConditionTypeIds)
              ? ('INVISIBLE' as const)
              : ('HIDDEN' as const)
        if (!controlled && actor.reveal === 'UNNAMED' && viewer.unseenActorIds.has(actor.id))
          return {
            id: actor.id,
            encounterId: actor.encounterId,
            kind: 'CREATURE' as const,
            label: UNSEEN_CREATURE_LABEL,
            sourceId: null,
            sourceRevision: null,
            public: true,
            controllerUserIds: [],
            disposition: 'NEUTRAL' as const,
            initiative: actor.initiative,
            manualOrder: actor.manualOrder,
            conditions: [],
            activeGrants: [],
            concentration: null,
            defeated: false,
            absence: null,
            health: null,
            unseenReason
          }
        const level: HealthDisplayLevelDto = controlled
          ? 'EXACT'
          : actor.kind === 'CHARACTER'
            ? (character?.health ?? 'HIDDEN')
            : (actor.healthDisplay ?? encounter.healthDisplayDefault)
        return {
          id: actor.id,
          encounterId: actor.encounterId,
          kind: actor.kind,
          label: actor.label,
          sourceId: actor.kind === 'CHARACTER' ? actor.sourceId : null,
          sourceRevision: null,
          public: actor.public,
          controllerUserIds: actor.controllerUserIds,
          disposition: actor.disposition,
          initiative: actor.initiative,
          manualOrder: actor.manualOrder,
          conditions: actor.conditions,
          activeGrants: hideActiveGrantSources(actor.activeGrants),
          // Only an actor's controllers end its Concentration (SPELLS-5.11).
          concentration: controlled ? hideConcentrationSource(actor.concentration) : null,
          defeated: actor.defeated,
          absence: actor.absence,
          health: playerActorHealth(level, actor.currentHitPoints, actor.maxHitPoints),
          unseenReason
        }
      }),
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt
  })
}
