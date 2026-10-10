import {
  encounterPlayerProjectionDtoSchema,
  type EncounterGmProjectionDto,
  type EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounterData'
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
      return { level, ratio: Number((steps * HEALTH_BAR_RATIO_STEP).toFixed(2)) }
    }
    case 'EXACT':
      return { level, current, maximum }
  }
}

/** The viewer and each Character actor's player-set level; see `projectPlayerEncounterProjection`. */
export type EncounterPlayerHealthViewer = {
  userId: string
  /** Keyed by Character ID: its player and "Show my health to the party". */
  characters: ReadonlyMap<string, { ownerUserId: string; health: HealthDisplayLevelDto }>
}

/**
 * Derive the player-safe view from a validated committed projection. This
 * keeps gameplay reads on the same projection for GMs and players while
 * retaining the intentionally smaller player contract: hidden actors, GM notes,
 * stat blocks and resources stay GM-only. Health follows each actor's display
 * level, and an actor's controllers (Foundry owners) always see its exact health.
 */
export function projectPlayerEncounterProjection(
  encounter: EncounterGmProjectionDto,
  viewer: EncounterPlayerHealthViewer
): EncounterPlayerProjectionDto {
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
    version: encounter.version,
    round: encounter.round,
    currentActorId:
      encounter.currentActorId &&
      encounter.actors.find((actor) => actor.id === encounter.currentActorId)?.public
        ? encounter.currentActorId
        : null,
    actors: encounter.actors
      .filter((actor) => actor.public)
      .map((actor) => {
        const character =
          actor.kind === 'CHARACTER' && actor.sourceId
            ? viewer.characters.get(actor.sourceId)
            : undefined
        const controlled =
          actor.controllerUserIds.includes(viewer.userId) ||
          character?.ownerUserId === viewer.userId
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
          outOfInitiative: actor.outOfInitiative,
          health: playerActorHealth(level, actor.currentHitPoints, actor.maxHitPoints)
        }
      }),
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt
  })
}
