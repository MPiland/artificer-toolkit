import { expect, it } from 'vitest'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { createActorCapRun } from '../../tests/fixtures/encounterActorCap'
import {
  executeInRoom,
  seedRoomContentSnapshots,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

// Initiative evidence, its order and every refresh list hold one entry per actor, so a Run at the
// actor cap must start and turn, not only a Run within the rule graph's node limit.
it('starts and advances a turn in a Run at the actor cap through the room', async () => {
  const { base, prepared, reads } = await createActorCapRun()
  expect(prepared.actors).toHaveLength(MAX_ENCOUNTER_ACTORS)
  // Creating a Run at the cap read 20.3 MB (over the 16 MiB transaction limit) when every actor
  // insert's trigger re-read the whole Run (b75d8a908); keep it far inside the limit.
  console.info('Run creation reads at the cap', JSON.stringify(reads.reads.byTable))
  expect(reads.reads.bytes).toBeLessThan((16 * 1024 * 1024) / 4)
  expect(reads.reads.documents).toBeLessThan(32_000 / 4)
  await seedRoomContentSnapshots(base.campaign.id)
  let active = await executeInRoom(base.owner.caller, {
    command: {
      type: 'START',
      encounterId: prepared.id,
      commandId: crypto.randomUUID(),
      expectedVersion: prepared.version
    }
  })
  // Tied scores the tie resolver leaves are ordered by the GM, one choice at a time.
  for (let choices = 0; active.occurrence?.status === 'PENDING'; choices++) {
    const pending = active.occurrence.pending
    if (choices >= MAX_ENCOUNTER_ACTORS || pending?.kind !== 'INITIATIVE_ORDER')
      throw new Error(`Unexpected initiative decision: ${pending?.kind ?? 'none'}.`)
    active = await executeInRoom(base.owner.caller, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: prepared.id,
        commandId: crypto.randomUUID(),
        expectedVersion: active.projection.version,
        correlationId: null,
        occurrenceId: active.occurrence.occurrenceId,
        expectedOccurrenceVersion: active.occurrence.occurrenceVersion,
        resolution: {
          kind: 'INITIATIVE_ENTITY',
          requestId: pending.requestId,
          entityId: pending.optionIds[0]!
        }
      }
    })
  }
  const started = encounterGmProjectionDtoSchema.parse(active.projection)
  expect(started).toMatchObject({ status: 'ACTIVE', round: 1 })
  expect(started.actors).toHaveLength(MAX_ENCOUNTER_ACTORS)
  const first = started.currentActorId
  const advanced = await executeInRoom(base.owner.caller, {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: prepared.id,
      commandId: crypto.randomUUID(),
      expectedVersion: started.version
    }
  })
  expect(advanced.projection.status).toBe('ACTIVE')
  expect(advanced.projection.currentActorId).not.toBe(first)
  expect(advanced.projection.version).toBeGreaterThan(started.version)
}, 600_000)
