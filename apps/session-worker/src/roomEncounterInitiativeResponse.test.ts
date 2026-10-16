import { expect, it } from 'vitest'
import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { plainWolf } from './testing/movementPlannerFixture.js'
import { preparedEncounterRoom } from './testing/preparedEncounterRoom.js'
import { uuid } from './testing/roomAggregateFixture.js'

it('records the answers to an initiative request in the terminal receipt resolution commands', async () => {
  const gmId = uuid(0xe02)
  const actors = [0, 1].map((ordinal) =>
    srdCreatureActor({
      id: uuid(0xe10 + ordinal),
      creature: { ...plainWolf, id: uuid(0xe20 + ordinal), label: `Wolf ${ordinal}` }
    })
  )
  const { room, startAndSettleInitiative } = await preparedEncounterRoom({
    actors,
    members: [{ userId: gmId, role: 'OWNER', membershipEpoch: '2026-09-30T12:00:00.000Z' }]
  })
  const { result, answers } = await startAndSettleInitiative({
    gmId,
    startCommandId: uuid(0xe40),
    answerCommandId: (ordinal) => uuid(0xe50 + ordinal)
  })

  expect(answers.length).toBeGreaterThan(0)
  expect(result.recipients.get(gmId)?.occurrence).toMatchObject({
    status: 'COMPLETE',
    pending: null
  })
  const commands = room.documents('encounterRunCommands')
  expect(commands.filter(({ commandType }) => commandType === 'START')).toHaveLength(1)
  const receipts = room.documents('encounterRuleReceipts')
  // The settled occurrence keeps one receipt, owned by the START that opened it.
  expect(receipts).toHaveLength(1)
  const [receipt] = receipts
  expect(receipt).toMatchObject({
    commandId: uuid(0xe40),
    commandType: 'START',
    actorUserId: gmId
  })
  const metadata: { resolutionCommands: unknown[] } = JSON.parse(receipt!.commandMetadataJson)
  expect(metadata.resolutionCommands).toHaveLength(answers.length)
  expect(metadata.resolutionCommands).toEqual(
    answers.map((answer) => {
      if (answer.type !== 'RESOLVE_RULE_OCCURRENCE' || !('requestId' in answer.resolution))
        throw new Error('Unexpected command.')
      return {
        kind: answer.resolution.kind,
        commandId: answer.commandId,
        commandFingerprint: checksumCanonicalJson(answer),
        actorUserId: gmId,
        correlationId: null,
        expectedOccurrenceVersion: answer.expectedOccurrenceVersion,
        requestId: answer.resolution.requestId,
        initiativeActorId: null
      }
    })
  )
})
