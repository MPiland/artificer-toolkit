import type { LiveCampaignSummaryDto } from '@artificer-toolkit/schema/api/liveSessions'
import type { EncounterSummaryDto } from '@artificer-toolkit/schema/api/encounters'

interface HitPoints {
  currentHitPoints: number
  maxHitPoints: number
}

/**
 * The room's hit points for a Character while it provides them; otherwise Convex's value. A
 * Character the room leaves out is never read as deleted, so the page keeps what Convex has.
 */
export function resolveHitPoints(
  summary: LiveCampaignSummaryDto | null,
  characterId: string,
  stored: HitPoints | undefined
): HitPoints | undefined {
  const room = summary?.characters.find((character) => character.characterId === characterId)
  return room
    ? {
        currentHitPoints: room.currentHitPoints,
        maxHitPoints: room.maxHitPoints
      }
    : stored
}

/**
 * Status and round from the room for the Run it holds ACTIVE; every other Run keeps Convex's
 * value, because `encounter: null` only says no Run is ACTIVE, so PREPARED Runs still come from Convex.
 */
export function mergeEncounterSummary<
  Stored extends Pick<EncounterSummaryDto, 'id' | 'round' | 'status'>
>(summary: LiveCampaignSummaryDto | null, stored: Stored): Stored {
  const room = summary?.encounter
  return room?.encounterId === stored.id
    ? { ...stored, round: room.round, status: room.status }
    : stored
}
