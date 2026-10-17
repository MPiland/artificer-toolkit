import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import { insertRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { initiativePolicySnapshot } from '@artificer-toolkit/rules-runtime/testing/initiativePolicySnapshot'
import {
  CAMPAIGN_ID,
  ENCOUNTER_ID,
  SRD_VOCABULARY,
  srdEncounterState
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { DND5E_SYSTEM_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { liveSessionRoomAuthorizationSchema } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { LiveSessionTransientMember } from '@artificer-toolkit/schema/api/liveSessionTransient'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { RoomEncounterStore, type RoomDocument } from '../roomEncounterStore.js'
import { RoomInputs } from '../roomInputs.js'
import { executeRoomEncounterCommand } from '../roomEncounterCommands.js'
import { createNativeLiveRulesRuntime } from '../nativeRulesRuntime.js'
import { roomInputsResponse } from '../../test/roomInputsFixture.js'
import { roomAuthorizationResponse } from '../../test/roomAuthorizationFixture.js'
import { createNodeSqliteRoomStorage } from './nodeSqliteRoomStorage.js'
import { uuid } from './roomAggregateFixture.js'

export type PreparedRoomCommand = Parameters<typeof executeRoomEncounterCommand>[0]['command']

/**
 * A hydrated room holding a PREPARED Encounter Run (initiative still being collected) whose
 * `members` may issue commands through the real room executor, one `execute` per sender.
 */
export async function preparedEncounterRoom(input: {
  actors: readonly EncounterRunActorState[]
  members: readonly LiveSessionTransientMember[]
}) {
  const { actors, members } = input
  const epoch = uuid(0xe01)
  const now = '2026-09-30T12:00:00.000Z'
  const ownerUserId = members.find((member) => member.role === 'OWNER')!.userId
  const state = srdEncounterState({
    actors: [...actors],
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
  const authorization = liveSessionRoomAuthorizationSchema.parse(
    roomAuthorizationResponse({ members })
  )
  const inputOptions = {
    campaignId: CAMPAIGN_ID,
    systemId: DND5E_SYSTEM_ID,
    ownerUserId,
    members: [...members]
  }
  const authority = roomInputsResponse({ kind: 'AUTHORITY', cursor: null }, inputOptions)
  const play = roomInputsResponse({ kind: 'CAMPAIGN_PLAY' }, inputOptions)
  if (authority.kind !== 'AUTHORITY' || play.kind !== 'CAMPAIGN_PLAY')
    throw new Error('Missing native Campaign fixtures.')
  const memory = createMemoryEncounterStore({ idPrefix: 'native-prepared-fixture' })
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
    concentrationCasterCharacterIds: [],
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
  const runtime = createNativeLiveRulesRuntime()
  /** Runs `command` as `userId` through the real room executor. */
  const execute = (userId: string, command: PreparedRoomCommand) =>
    room.transact((transaction) =>
      executeRoomEncounterCommand({
        store: room,
        transaction,
        inputs,
        authorization,
        campaignId: CAMPAIGN_ID,
        epoch,
        userId,
        recipientUserIds: [userId],
        command,
        random: () => 0,
        sceneTokens: async () => null,
        turnExecution: { runtime }
      })
    )
  return {
    room,
    execute,
    /**
     * The GM starts the Run and answers every initiative prompt until the order is settled.
     * Returns the answers it sent, in order.
     */
    async startAndSettleInitiative(input: {
      gmId: string
      startCommandId: string
      answerCommandId: (ordinal: number) => string
    }) {
      let result = await execute(input.gmId, {
        type: 'START',
        encounterId: ENCOUNTER_ID,
        commandId: input.startCommandId,
        expectedVersion: 0
      })
      const answers: PreparedRoomCommand[] = []
      for (let ordinal = 0; ordinal < 10; ordinal += 1) {
        const pending = result.recipients.get(input.gmId)?.occurrence?.pending
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
        const answer: PreparedRoomCommand = {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: ENCOUNTER_ID,
          commandId: input.answerCommandId(ordinal),
          expectedVersion: pending.encounterVersion,
          occurrenceId: pending.occurrenceId,
          expectedOccurrenceVersion: pending.occurrenceVersion,
          correlationId: null,
          resolution
        }
        answers.push(answer)
        result = await execute(input.gmId, answer)
      }
      return { result, answers }
    }
  }
}
