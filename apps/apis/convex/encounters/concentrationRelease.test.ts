// @vitest-environment node
import { expect, it } from 'vitest'
import {
  concentrationAction,
  seedConcentration,
  setupConcentration
} from '../../tests/fixtures/concentration'
import { api } from '../_generated/api'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  readRoomRollCards,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

it('answers a pending Assisted concentration check after the room releases and a new epoch hydrates', async () => {
  const fixture = await setupConcentration('PROMPT')
  await seedConcentration(fixture)
  await attachFixtureRoom(fixture.t, fixture.campaign.id)
  const parent = await executeInRoom(fixture.owner.caller, {
    command: concentrationAction(fixture)
  })
  expect(parent.occurrence?.status).toBe('COMPLETE')
  await checkpointLiveRoom(fixture.campaign.id)
  const pending = await fixture.player.caller.query(
    api.encounters.pendingReads.pendingRuleOccurrence,
    { encounterId: fixture.run.id }
  )
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected a pending concentration check.')

  // Idle release and CLOSE_ROOM share one path: drain, checkpoint, release; no Convex writes.
  await closeRoom(fixture.campaign.id)

  const settled = await executeInRoom(fixture.player.caller, {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: fixture.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      correlationId: null,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: pending.request.requestId,
        rawFaces: [1],
        rollMode: 'NORMAL'
      }
    }
  })
  expect(settled.occurrence).toMatchObject({ status: 'COMPLETE' })
  // The save's outcome is the Concentration roll card of the die the target's controller entered.
  expect(await readRoomRollCards(fixture.player.caller, fixture.campaign.id)).toContainEqual(
    expect.objectContaining({
      ruleCheck: expect.objectContaining({
        kind: 'CONCENTRATION',
        actorId: pending.rollerActorId,
        faces: [1],
        outcome: 'LOST'
      })
    })
  )
}, 90_000)
