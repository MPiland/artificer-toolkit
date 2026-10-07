import { expect, it } from 'vitest'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import { insertRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { initiativePolicySnapshot } from '@artificer-toolkit/rules-runtime/testing/initiativePolicySnapshot'
import {
  CAMPAIGN_ID,
  ENCOUNTER_ID,
  SRD_VOCABULARY,
  srdCreatureActor,
  srdEncounterState
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { DND5E_SYSTEM_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { liveSessionRoomAuthorizationSchema } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { RoomEncounterStore, type RoomDocument } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { executeRoomEncounterCommand } from './roomEncounterCommands.js'
import { createNativeLiveRulesRuntime } from './nativeRulesRuntime.js'
import { roomInputsResponse } from '../test/roomInputsFixture.js'
import { roomAuthorizationResponse } from '../test/roomAuthorizationFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { plainWolf } from './testing/movementPlannerFixture.js'
import { uuid } from './testing/roomAggregateFixture.js'

it('records the answers to an initiative request in the terminal receipt resolution commands', async () => {
  const gmId = uuid(0xe02)
  const epoch = uuid(0xe01)
  const now = '2026-09-30T12:00:00.000Z'
  const actors = [0, 1].map((ordinal) =>
    srdCreatureActor({
      id: uuid(0xe10 + ordinal),
      creature: { ...plainWolf, id: uuid(0xe20 + ordinal), label: `Wolf ${ordinal}` }
    })
  )
  const state = srdEncounterState({
    actors,
    currentActorId: null,
    status: 'PREPARED',
    round: 0,
    version: 0,
    turnSequence: 0,
    automationMode: 'ASSISTED',
    initiativePolicy: initiativePolicySnapshot({
      procedure: 'ACTOR_ROLL',
      cadence: 'ENCOUNTER_START'
    })
  })
  const members = [{ userId: gmId, role: 'OWNER' as const, membershipEpoch: now }]
  const authorization = liveSessionRoomAuthorizationSchema.parse(
    roomAuthorizationResponse({ members })
  )
  const inputOptions = {
    campaignId: CAMPAIGN_ID,
    systemId: DND5E_SYSTEM_ID,
    ownerUserId: gmId,
    members
  }
  const authority = roomInputsResponse({ kind: 'AUTHORITY', cursor: null }, inputOptions)
  const play = roomInputsResponse({ kind: 'CAMPAIGN_PLAY' }, inputOptions)
  if (authority.kind !== 'AUTHORITY' || play.kind !== 'CAMPAIGN_PLAY')
    throw new Error('Missing native Campaign fixtures.')
  const memory = createMemoryEncounterStore({ idPrefix: 'native-initiative-fixture' })
  await memory.store.insert('encounterRuns', {
    id: state.id,
    campaignId: CAMPAIGN_ID,
    gameSystemId: state.gameSystemId,
    status: state.status,
    version: state.version,
    stateJson: JSON.stringify(state),
    stateChecksum: checksumCanonicalJson(state),
    createCommandId: crypto.randomUUID(),
    createCommandFingerprint: checksumCanonicalJson(state),
    createdAt: now,
    updatedAt: now
  })
  for (const actor of actors) await insertRunActor({ db: memory.store }, actor)
  const documents: RoomDocument[] = [...authority.documents]
  for (const table of [
    'encounterRuns',
    'encounterRunActors',
    'encounterActorSnapshots',
    'encounterSourceProjectionFacts'
  ] as const) {
    for (const { _id, _creationTime, ...fields } of memory.documents(table))
      documents.push({ table, id: _id, creationTime: _creationTime, fields })
  }
  const { storage } = createNodeSqliteRoomStorage()
  const room = new RoomEncounterStore(storage)
  room.hydrate({
    epoch,
    documents,
    records: [
      {
        kind: 'ROOM_INPUT',
        key: 'AUTHORITY',
        revision: JSON.stringify(authority.revisions),
        json: JSON.stringify({ ...authority, documents: [] })
      },
      {
        kind: 'ROOM_INPUT',
        key: 'CAMPAIGN_PLAY',
        revision: JSON.stringify(play.revisions),
        json: JSON.stringify(play)
      },
      {
        kind: 'ROOM_INPUT',
        key: 'DEFINITIONS',
        revision: JSON.stringify(authority.revisions),
        json: JSON.stringify({
          kind: 'DEFINITIONS',
          revisions: authority.revisions,
          definitions: [],
          continueCursor: null
        })
      },
      {
        kind: 'ROOM_INPUT',
        key: `RUN:${state.id}`,
        revision: null,
        json: JSON.stringify({
          kind: 'RUN',
          encounterVersion: state.version,
          activeEncounterId: null,
          maintenanceCharacterOwners: [],
          documents: [],
          continueCursor: null
        })
      },
      ...['SYSTEM:SYSTEM', 'SYSTEM:VOCABULARY'].map((key) => ({
        kind: 'ROOM_INPUT',
        key,
        revision: JSON.stringify(play.revisions),
        json: JSON.stringify({
          kind: 'SYSTEM',
          revisions: play.revisions,
          system: SRD_VOCABULARY.document,
          vocabulary: SRD_VOCABULARY
        })
      }))
    ]
  })
  const inputs = new RoomInputs(
    room,
    async () => {
      throw new Error('Hydrated initiative must not read backend inputs.')
    },
    async () => []
  )
  const runtime = await createNativeLiveRulesRuntime(
    'native-initiative-fixture-continuation-secret'
  )
  type Command = Parameters<typeof executeRoomEncounterCommand>[0]['command']
  const execute = (command: Command) =>
    room.transact((transaction) =>
      executeRoomEncounterCommand({
        store: room,
        transaction,
        inputs,
        authorization,
        campaignId: CAMPAIGN_ID,
        epoch,
        userId: gmId,
        recipientUserIds: [gmId],
        command,
        random: () => 0,
        turnExecution: { runtime }
      })
    )

  let result = await execute({
    type: 'START',
    encounterId: ENCOUNTER_ID,
    commandId: uuid(0xe40),
    expectedVersion: 0
  })
  const answers: Command[] = []
  for (let ordinal = 0; ordinal < 10; ordinal += 1) {
    const owner = result.recipients.get(gmId)
    const pending = owner?.occurrence?.pending
    if (!pending) break
    const resolution =
      pending.kind === 'INITIATIVE_EVIDENCE'
        ? {
            kind: 'ENTER_INTEGER' as const,
            requestId: pending.request.requestId,
            value: 12 + ordinal
          }
        : pending.kind === 'INITIATIVE_ORDER'
          ? {
              kind: 'INITIATIVE_ENTITY' as const,
              requestId: pending.requestId,
              entityId: pending.optionIds[0]!
            }
          : null
    if (!resolution) throw new Error(`Unexpected pending ${pending.kind}.`)
    const answer: Command = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: ENCOUNTER_ID,
      commandId: uuid(0xe50 + ordinal),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      correlationId: null,
      resolution
    }
    answers.push(answer)
    result = await execute(answer)
  }

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
