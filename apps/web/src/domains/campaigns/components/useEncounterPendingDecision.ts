import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import type { RoomEncounterRun } from '../vtt/roomEncounterRun'

/**
 * The decision pending on a Run: the room's while it holds the Run, otherwise Convex's.
 * `enabled` only gates the Convex read.
 */
export function useEncounterPendingDecision(
  encounterId: string,
  room: RoomEncounterRun | null,
  enabled = true
) {
  const stored = useQuery({
    ...convexQuery(
      convexApi.encounters.pendingReads.pendingRuleOccurrence,
      room || !enabled ? 'skip' : { encounterId }
    ),
    select: (occurrence) =>
      occurrence === null ? null : pendingEncounterRuleOccurrenceSummaryDtoSchema.parse(occurrence)
  })
  return room ? { data: room.pending, error: null, isPending: false } : stored
}
