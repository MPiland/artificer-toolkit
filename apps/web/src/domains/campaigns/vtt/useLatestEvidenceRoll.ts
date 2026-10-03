import { useQuery } from '@tanstack/react-query'
import type { EncounterReadDto } from '@artificer-toolkit/schema/api/encounterRead'
import type { EncounterEvidenceRollDto } from '@artificer-toolkit/schema/api/encounters'
import { getEncounterLatestEvidenceRoll } from '#app/data/campaigns/encounterActions'
import type { LiveSessionEncounterReadReply } from './liveSessionClient'
import type { HeldEncounterSession } from './useCampaignLiveSession'
import { useRoomEncounterRead } from './useRoomEncounterRead'

/**
 * The viewer's latest "Roll dice" attempt for their pending request: the room's answer while it
 * holds the session, else Convex's.
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
  const stored = useQuery(getEncounterLatestEvidenceRoll(fromRoom.routed ? null : encounterId))
  return (fromRoom.routed ? fromRoom.value : stored.data) ?? null
}
