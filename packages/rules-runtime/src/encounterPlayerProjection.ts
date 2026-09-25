import {
  encounterPlayerProjectionDtoSchema,
  type EncounterGmProjectionDto,
  type EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounterData'

export function healthBand(current: number, maximum: number) {
  if (current <= 0) return 'DEFEATED' as const
  if (maximum <= 0 || current >= maximum * 0.75) return 'HEALTHY' as const
  if (current >= maximum * 0.5) return 'WOUNDED' as const
  if (current >= maximum * 0.25) return 'BLOODIED' as const
  return 'CRITICAL' as const
}
/**
 * Derive the player-safe view from a validated committed projection. This
 * keeps gameplay reads on the same projection for GMs and players while
 * retaining the intentionally smaller player contract: hidden actors, GM notes,
 * stat blocks, resources and every actor's health stay GM-only.
 */
export function projectPlayerEncounterProjection(
  encounter: EncounterGmProjectionDto
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
      .map((actor) => ({
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
        conditions: actor.conditions
      })),
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt
  })
}
