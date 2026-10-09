import { ConvexError } from 'convex/values'
import { expect } from 'vitest'
import { domainRejectionErrorDataSchema } from '@artificer-toolkit/schema/api/domainRejections'
import type { EncounterExecuteInput } from '@artificer-toolkit/schema/api/encounters'
import {
  executeInRoom,
  expectRedactedRoomRefusal,
  readRoomEncounterSession,
  roomErrorLogs,
  type RoomCaller
} from './localRoomWorker'

/**
 * The domain rejection (reason, user-safe message, warnings) a command refused with. An expected
 * refusal reaches the member as a `ConvexError`; anything else fails the test.
 */
export async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught
  )
  if (!(error instanceof ConvexError)) throw new Error('Expected a domain rejection.')
  return domainRejectionErrorDataSchema.parse(error.data)
}

/** The room tells a member nothing of why a command failed; its error log names the cause. */
export async function expectUnavailableRefusal(command: Promise<unknown>, cause: string) {
  await expectRedactedRoomRefusal(command, 'The Encounter command could not be completed.')
  expect(roomErrorLogs().at(-1)).toContain(cause)
}

/** A command ID reused with other input is not a replay. */
export function expectReusedCommandRefusal(command: Promise<unknown>) {
  return expectRedactedRoomRefusal(
    command,
    'The command ID was already used for different input.',
    'INVALID_COMMAND'
  )
}

/**
 * Another member's command ID is not a replay. The room sends every member the commit under its
 * command ID, so this member's socket first completes a round trip: the test client would otherwise
 * settle the reused command with that commit if it arrived after the send.
 */
export async function expectOtherMembersCommandRefusal(
  caller: RoomCaller,
  campaignId: string,
  input: EncounterExecuteInput
) {
  await readRoomEncounterSession(caller, campaignId, { timeline: false })
  await expectReusedCommandRefusal(executeInRoom(caller, input))
}
