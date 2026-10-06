import type { z } from 'zod'
import type { encounterExecuteInputSchema } from '@artificer-toolkit/schema/api/encounters'
import type { QueryCtx } from '../../convex/_generated/server'
import {
  executeInRoom as executeInRealRoom,
  readEncounterHistory as readConvexEncounterHistory,
  usesRoomWorker,
  type RoomCaller
} from './localRoomWorker'
import {
  executeInRoom as executeInStandInRoom,
  persistHeldHistoryToConvex as persistStandInHeldHistory,
  readEncounterHistory as readStandInEncounterHistory
} from './liveSessionWorker'

/**
 * Shared fixtures serve tests on either room while the stand-in (`liveSessionWorker.ts`) exists:
 * a test file that called `useLocalRoomWorker()` gets the real room, every other file the stand-in.
 * Delete this module with the stand-in, and import `localRoomWorker` from the fixtures.
 */

/** The member's command through whichever room the file uses. */
export function executeInRoom(
  caller: RoomCaller,
  input: z.input<typeof encounterExecuteInputSchema>
) {
  return usesRoomWorker() ? executeInRealRoom(caller, input) : executeInStandInRoom(caller, input)
}

/**
 * The Encounter history rows a test reads. The stand-in merges what its room holds; the real room
 * holds a Run's history until the Run ends (D85), so only Convex's rows are visible there.
 */
export function readEncounterHistory(ctx: QueryCtx, campaignId: string) {
  return usesRoomWorker()
    ? readConvexEncounterHistory(ctx)
    : readStandInEncounterHistory(ctx, campaignId)
}

/**
 * Copies the stand-in room's held history into Convex for suites that run an operation straight
 * against Convex. The real room has no such export: send the operation through the room instead.
 */
export function persistHeldHistoryToConvex(
  caller: Parameters<typeof persistStandInHeldHistory>[0],
  campaignId: string,
  encounterId: string
) {
  if (usesRoomWorker())
    throw new Error('The real room serves no held history: run the operation through the room.')
  return persistStandInHeldHistory(caller, campaignId, encounterId)
}
