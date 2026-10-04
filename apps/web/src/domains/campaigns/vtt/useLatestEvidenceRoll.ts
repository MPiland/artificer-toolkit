import type { EncounterReadDto } from '@artificer-toolkit/schema/api/encounterRead'
import type { EncounterEvidenceRollDto } from '@artificer-toolkit/schema/api/encounters'
import type { LiveSessionEncounterReadReply } from './liveSessionClient'
import type { HeldEncounterSession } from './useCampaignLiveSession'
import { useRoomEncounterRead } from './useRoomEncounterRead'

/**
 * The viewer's latest "Roll dice" attempt for their pending request, from the room that holds the
 * session; none without a room (the room keeps the Run's history, ADR 0035 Amendment 22).
 */
export function useLatestEvidenceRoll({
  encounterId,
  readEncounter,
  room
}: {
  encounterId: string | null
  readEncounter: (read: EncounterReadDto) => Promise<LiveSessionEncounterReadReply>
  room: HeldEncounterSession | null
}): EncounterEvidenceRollDto | null {
  const fromRoom = useRoomEncounterRead({
    read: encounterId ? { kind: 'LATEST_EVIDENCE_ROLLS', input: { encounterId } } : null,
    readEncounter,
    room,
    select: (result) =>
      result.kind === 'LATEST_EVIDENCE_ROLLS' ? (result.result[0] ?? null) : undefined
  })
  return fromRoom.routed ? (fromRoom.value ?? null) : null
}
