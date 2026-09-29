import type {
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto,
  EncounterSummaryDto
} from '@artificer-toolkit/schema/api/encounterData'

/** The summary `projectionReads:list` returns for the Run a member reads as `projection`. */
export function encounterSummaryOf(
  projection: EncounterGmProjectionDto | EncounterPlayerProjectionDto
): EncounterSummaryDto {
  return {
    id: projection.id,
    name: projection.name,
    status: projection.status,
    round: projection.round,
    actorCount: 'manualReminderMode' in projection ? projection.actors.length : null,
    updatedAt: projection.updatedAt,
    version: projection.version
  }
}
