import type { HeldEncounterSession } from './useCampaignLiveSession'

/** One Run as the room pushed it, with the decision pending on it. */
export type RoomEncounterRun = Pick<
  HeldEncounterSession['preparedPending'][number],
  'encounter'
> & { pending: HeldEncounterSession['state']['pending'] }

/** The Run with this id from the room's session: the ACTIVE Run or a PREPARED one awaiting a decision. */
export function readRoomEncounterRun(
  session: HeldEncounterSession | null,
  encounterId: string
): RoomEncounterRun | null {
  if (!session) return null
  const { encounter, pending } = session.state
  if (encounter?.id === encounterId) return { encounter, pending }
  return session.preparedPending.find((entry) => entry.encounter.id === encounterId) ?? null
}
