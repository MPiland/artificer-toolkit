import type {
  EncounterGmProjectionDto,
  EncounterSummaryDto
} from '@artificer-toolkit/schema/api/encounters'

export function summarizeEncounterProjection(
  projection: EncounterGmProjectionDto
): EncounterSummaryDto {
  return {
    id: projection.id,
    name: projection.name,
    status: projection.status,
    round: projection.round,
    actorCount: projection.actors.length,
    updatedAt: projection.updatedAt,
    version: projection.version
  }
}
