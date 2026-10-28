import { runInDurableObject } from 'cloudflare:test'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import type { movementRoom } from './movementRoomFixture.js'

/** The Legendary Action choice the room is holding: its occurrence, owner and options. */
export function readLegendaryChoice(stub: DurableObjectStub) {
  return runInDurableObject(stub, async (_instance, context) => {
    const room = new RoomEncounterStore(context.storage)
    const occurrence = room
      .documents('encounterRuleOccurrences')
      .find((candidate) => candidate.state === 'PENDING')
    if (!occurrence) return null
    const snapshot = await readPendingSnapshot({ db: room.store }, occurrence)
    const choice = snapshot?.applicationContext
    if (choice?.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE')
      throw new Error('Expected a Legendary Action choice.')
    return {
      occurrence,
      encounterVersion: room.documents('encounterRuns')[0]!.version,
      ownerActorId: choice.choice.ownerActorId,
      options: choice.choice.options
    }
  })
}

/** Answers the room's pending Legendary Action choice with `resolution`. */
export async function respondToLegendaryChoice(
  room: Awaited<ReturnType<typeof movementRoom>>,
  resolution: Record<string, unknown>
) {
  const held = await readLegendaryChoice(room.base.stub)
  if (!held) throw new Error('No Legendary Action choice is pending.')
  const commandId = crypto.randomUUID()
  const answer = await room.send(commandId, {
    scope: 'ENCOUNTER',
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: room.encounterId,
      commandId,
      expectedVersion: held.encounterVersion,
      occurrenceId: held.occurrence.id,
      expectedOccurrenceVersion: held.occurrence.version,
      correlationId: null,
      resolution
    }
  })
  return { ...held, answer }
}
