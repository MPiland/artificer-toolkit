import { afterEach, expect, it, vi } from 'vitest'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import { insertRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { liveSessionRoomAuthorizationSchema } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { systemVocabularySnapshotSchema } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { DND5E_SYSTEM_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { RoomEncounterStore, type RoomDocument } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { RetryableCommandError } from './nativeRulesRevisions.js'
import { executeRoomEncounterCommand } from './roomEncounterCommands.js'
import { createNativeLiveRulesRuntime } from './nativeRulesRuntime.js'
import { roomInputsResponse } from '../test/roomInputsFixture.js'
import { roomAuthorizationResponse } from '../test/roomAuthorizationFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { uuid } from './testing/roomAggregateFixture.js'

afterEach(() => vi.restoreAllMocks())

it('starts and advances a native manual Creature Run atomically, recovers, and replays private player results', async () => {
  const campaignId = uuid(0xf00)
  const epoch = uuid(0xf01)
  const gmId = uuid(0xf02)
  const playerId = uuid(0xf03)
  const encounterId = uuid(0xf04)
  const sideId = uuid(0xf05)
  const now = '2026-09-30T12:00:00.000Z'
  const actors = [0, 1, 2].map((ordinal) => {
    const id = uuid(0xf10 + ordinal)
    const sourceId = uuid(0xf20 + ordinal)
    const payload = {
      id: sourceId,
      systemId: DND5E_SYSTEM_ID,
      label: `Native Creature ${ordinal}`,
      naturalArmorBonus: 7,
      abilityScores: { DEXTERITY: 10 },
      speeds: [],
      senses: [],
      features: [],
      damageVulnerabilities: [],
      damageResistances: [],
      damageImmunities: [],
      qualifiedDamageDefenses: [],
      conditionImmunities: []
    }
    return encounterRunActorStateSchema.parse({
      id,
      encounterId,
      sideId,
      kind: 'CREATURE',
      label: payload.label,
      sourceId,
      sourceRevision: 1,
      stableTieKey: id,
      public: ordinal !== 2,
      controllerUserIds: ordinal === 0 ? [playerId] : [],
      disposition: 'HOSTILE',
      initiative: 20 - ordinal,
      manualOrder: ordinal,
      healthDisplay: null,
      systemId: DND5E_SYSTEM_ID,
      currentHitPoints: 13,
      maxHitPoints: 19,
      tempHitPoints: 0,
      conditions: [],
      defeated: false,
      absence: null,
      resources: {},
      gmNotes: `Private notes ${ordinal}`,
      snapshot: {
        kind: 'CREATURE',
        id: sourceId,
        systemId: DND5E_SYSTEM_ID,
        sourceRevision: 1,
        sourceVersionId: uuid(0xf30 + ordinal),
        sourceChecksum: checksumCanonicalJson(payload),
        payload
      },
      createdAt: now,
      updatedAt: now
    })
  })
  const optionalCombatSnapshot = {
    schemaVersion: 1,
    gameSystemId: DND5E_SYSTEM_ID,
    definitions: []
  }
  const state = encounterRunStateSchema.parse({
    id: encounterId,
    campaignId,
    gameSystemId: DND5E_SYSTEM_ID,
    blueprintId: uuid(0xf06),
    blueprintVersion: 1,
    blueprintChecksum: 'b'.repeat(64),
    name: 'Native manual turns',
    status: 'PREPARED',
    automationMode: 'MANUAL',
    healthDisplayDefault: 'HIDDEN',
    version: 0,
    round: 0,
    currentActorId: null,
    actorIds: actors.map(({ id }) => id),
    initiativePolicySnapshot: null,
    initiativePolicySnapshotChecksum: null,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot),
    turnSequence: 0,
    sides: [{ id: sideId, label: 'Creatures', sortOrder: 0 }],
    createdAt: now,
    updatedAt: now
  })
  const members = [
    { userId: gmId, role: 'OWNER' as const, membershipEpoch: now },
    { userId: playerId, role: 'PLAYER' as const, membershipEpoch: now }
  ]
  const authorization = liveSessionRoomAuthorizationSchema.parse(
    roomAuthorizationResponse({ members })
  )
  const authority = roomInputsResponse(
    { kind: 'AUTHORITY', cursor: null },
    {
      campaignId,
      systemId: DND5E_SYSTEM_ID,
      ownerUserId: gmId,
      members
    }
  )
  const play = roomInputsResponse(
    { kind: 'CAMPAIGN_PLAY' },
    {
      campaignId,
      systemId: DND5E_SYSTEM_ID,
      ownerUserId: gmId,
      members
    }
  )
  if (authority.kind !== 'AUTHORITY' || play.kind !== 'CAMPAIGN_PLAY')
    throw new Error('Missing native Campaign fixtures.')
  const system = systemAuthoredDtoSchema.parse({
    id: DND5E_SYSTEM_ID,
    label: 'D&D 5e',
    rulesetCode: 'DND5E',
    rulesetVersion: '2014',
    userId: gmId,
    alignments: [],
    challengeRatings: [],
    conditionTypes: [],
    creatureTypes: [],
    currencies: [],
    damageTypes: [],
    heritages: [],
    languages: [],
    lifestyles: [],
    magicSchools: [],
    passives: [],
    rarities: [],
    senses: [],
    skills: [],
    speeds: [],
    terrains: []
  })
  const vocabularyIdentity = {
    snapshotId: uuid(0xf07),
    systemId: system.id,
    snapshotVersion: 1,
    schemaVersion: 1,
    document: system
  }
  const vocabulary = systemVocabularySnapshotSchema.parse({
    ...vocabularyIdentity,
    checksum: checksumCanonicalJson(vocabularyIdentity)
  })
  const systemInput = { kind: 'SYSTEM', revisions: play.revisions, system, vocabulary }
  const memory = createMemoryEncounterStore({ idPrefix: 'native-turn-fixture' })
  await memory.store.insert('encounterRuns', {
    id: state.id,
    campaignId,
    gameSystemId: system.id,
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
  let room = new RoomEncounterStore(storage)
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
        json: JSON.stringify(systemInput)
      }))
    ]
  })
  const read = vi.fn(async () => {
    throw new Error('Hydrated turns must not read backend inputs.')
  })
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('Hydrated turns must not fetch.'))
  let inputs = new RoomInputs(room, read, async () => [])
  const runtime = await createNativeLiveRulesRuntime('native-turn-fixture-continuation-secret')
  type Command = Extract<
    Parameters<typeof executeRoomEncounterCommand>[0]['command'],
    { type: 'START' | 'ADVANCE_TURN' }
  >
  function execute(command: Command, userId: string, failDurable = false) {
    return room.transact(
      (transaction) =>
        executeRoomEncounterCommand({
          store: room,
          transaction,
          inputs,
          authorization,
          campaignId,
          epoch,
          userId,
          recipientUserIds: [gmId, playerId],
          command,
          random: () => 0,
          turnExecution: { runtime }
        }),
      failDurable
        ? (entry) => {
            expect(entry.sequence).toBe(1)
            expect(
              storage.sql.exec('SELECT sequence FROM room_writeset_log ORDER BY sequence').toArray()
            ).toEqual([{ sequence: 1 }])
            throw new Error('Injected turn durable commit failure')
          }
        : undefined
    )
  }
  function evidence(value = room) {
    const run = value.documents('encounterRuns')[0]
    if (!run) throw new Error('Missing native turn Run.')
    return {
      sequence: value.sequence,
      checksum: value.checksum,
      state: readRunState(run),
      actors: value.documents('encounterRunActors'),
      snapshots: value.documents('encounterActorSnapshots'),
      sources: value.documents('encounterSourceProjectionFacts'),
      rounds: value.documents('encounterInitiativeRounds'),
      participants: value.documents('encounterInitiativeParticipants'),
      sides: value.documents('encounterInitiativeSides'),
      commands: value.documents('encounterRunCommands'),
      occurrences: value.documents('encounterRuleOccurrences'),
      receipts: value.documents('encounterRuleReceipts'),
      records: value.records('ROOM_INPUT'),
      writes: storage.sql
        .exec('SELECT sequence, json, checksum, chain FROM room_writeset_log ORDER BY sequence')
        .toArray()
    }
  }
  const start: Command = { type: 'START', encounterId, commandId: uuid(0xf40), expectedVersion: 0 }
  const before = evidence()
  await expect(execute(start, gmId, true)).rejects.toThrow('Injected turn durable commit failure')
  expect(evidence()).toEqual(before)
  expect(evidence(new RoomEncounterStore(storage))).toEqual(before)
  const started = await execute(start, gmId)
  const startedOwner = started.recipients.get(gmId)
  if (!startedOwner) throw new Error('Missing START owner result.')
  expect(startedOwner.projection).toMatchObject({
    status: 'ACTIVE',
    version: 1,
    round: 1,
    currentActorId: actors[0]!.id
  })
  expect(started.checkpointBeforeAcknowledgement).toBe(true)
  expect(evidence().state.turnSequence).toBe(1)
  expect(
    evidence().commands.map(({ commandType, commandId }) => ({ commandType, commandId }))
  ).toEqual([{ commandType: 'START', commandId: start.commandId }])
  const advance: Command = {
    type: 'ADVANCE_TURN',
    encounterId,
    commandId: uuid(0xf41),
    expectedVersion: 1
  }
  const advanced = await execute(advance, playerId)
  expect(advanced.checkpointBeforeAcknowledgement).toBe(false)
  const advancedOwner = advanced.recipients.get(gmId)
  const advancedPlayer = advanced.recipients.get(playerId)
  if (!advancedOwner || !advancedPlayer) throw new Error('Missing ADVANCE turn recipient results.')
  expect(advancedOwner.projection).toMatchObject({
    version: 2,
    round: 1,
    currentActorId: actors[1]!.id
  })
  expect(advancedOwner.projection.actors).toHaveLength(3)
  expect(advancedPlayer.projection.actors.map(({ id }) => id)).toEqual([
    actors[0]!.id,
    actors[1]!.id
  ])
  for (const actor of advancedPlayer.projection.actors) {
    expect(actor).not.toHaveProperty('gmNotes')
    expect(actor).not.toHaveProperty('statBlock')
    expect(actor).not.toHaveProperty('resources')
  }
  const committed = evidence()
  expect(committed.sequence).toBe(2)
  expect(committed.state.turnSequence).toBe(2)
  expect(committed.writes.map(({ sequence }) => sequence)).toEqual([1, 2])
  expect(
    committed.commands.map(({ commandType, actorUserId }) => ({ commandType, actorUserId }))
  ).toEqual([
    { commandType: 'START', actorUserId: gmId },
    { commandType: 'ADVANCE_TURN', actorUserId: playerId }
  ])
  expect(
    committed.receipts.map(({ commandId, encounterVersion }) => ({ commandId, encounterVersion }))
  ).toEqual([
    { commandId: start.commandId, encounterVersion: 1 },
    { commandId: advance.commandId, encounterVersion: 2 }
  ])
  // The turn terminal writes each receipt's command metadata and result, and the run command's
  // result checksum, from the same stored result.
  const storedResults = committed.receipts.map((receipt) => JSON.parse(receipt.resultJson))
  expect(committed.receipts.map((receipt) => JSON.parse(receipt.commandMetadataJson))).toEqual([
    {
      schemaVersion: 1,
      transition: 'TURN_EFFECTS',
      commandType: 'START',
      expectedAggregateVersion: 0,
      selectionChecksum: null,
      initiativeChecksum: '3c46a656bef1526854e3c907f91f1bda3530e72ebab5379b1dadb0b5a9ae30a0',
      initiativeAdvanceChecksum: null,
      optionalCombatSnapshotChecksum:
        'e28cc18bcddb716ccd80910cca46f2a13a2ac9ea6f042ca7df18ccf213250919',
      terminalOccurrenceVersion: 0,
      resolutionCommands: []
    },
    {
      schemaVersion: 1,
      transition: 'TURN_EFFECTS',
      commandType: 'ADVANCE_TURN',
      expectedAggregateVersion: 1,
      selectionChecksum: null,
      initiativeChecksum: null,
      initiativeAdvanceChecksum: checksumCanonicalJson(storedResults[1]!.initiativeAdvance),
      optionalCombatSnapshotChecksum:
        'e28cc18bcddb716ccd80910cca46f2a13a2ac9ea6f042ca7df18ccf213250919',
      terminalOccurrenceVersion: 0,
      resolutionCommands: []
    }
  ])
  expect(storedResults).toEqual([
    {
      schemaVersion: 1,
      status: 'INITIATIVE_COMPLETE',
      commandType: 'START',
      encounterId,
      occurrenceId: committed.receipts[0]!.occurrenceId,
      occurrenceVersion: 0,
      initiative: {
        cadence: 'ENCOUNTER_START',
        evidence: { orderChoices: [], primaryResults: [], tieAttempts: [] },
        orderedActorIds: actors.map(({ id }) => id),
        orderedSideIds: [],
        policySnapshotChecksum: null,
        procedure: 'MANUAL',
        round: 1
      },
      initiativeAdvance: null
    },
    {
      schemaVersion: 1,
      status: 'INITIATIVE_COMPLETE',
      commandType: 'ADVANCE_TURN',
      encounterId,
      occurrenceId: committed.receipts[1]!.occurrenceId,
      occurrenceVersion: 0,
      initiative: null,
      initiativeAdvance: {
        currentActorId: actors[0]!.id,
        kind: 'SAME_ROUND',
        nextActorId: actors[1]!.id,
        round: 1,
        stateChecksum: expect.stringMatching(/^[a-f0-9]{64}$/)
      }
    }
  ])
  const resultChecksums = storedResults.map((result) => checksumCanonicalJson(result))
  expect(committed.receipts.map(({ resultChecksum }) => resultChecksum)).toEqual(resultChecksums)
  expect(
    committed.commands.map((command) => {
      if (command.commandType !== 'START' && command.commandType !== 'ADVANCE_TURN')
        throw new Error(`Unexpected ${command.commandType} command.`)
      return {
        commandType: command.commandType,
        ruleOccurrenceId: command.ruleOccurrenceId,
        ruleResultChecksum: command.ruleResultChecksum
      }
    })
  ).toEqual([
    {
      commandType: 'START',
      ruleOccurrenceId: committed.receipts[0]!.occurrenceId,
      ruleResultChecksum: resultChecksums[0]
    },
    {
      commandType: 'ADVANCE_TURN',
      ruleOccurrenceId: committed.receipts[1]!.occurrenceId,
      ruleResultChecksum: resultChecksums[1]
    }
  ])
  room = new RoomEncounterStore(storage)
  inputs = new RoomInputs(room, read, async () => [])
  expect(room.corruption).toBeNull()
  expect(evidence()).toEqual(committed)
  const replay = await execute(advance, playerId)
  expect(replay.recipients.get(playerId)).toEqual(advancedPlayer)
  expect(replay.recipients.get(gmId)).toEqual(advancedOwner)
  expect(evidence()).toEqual(committed)
  const earlier = await execute(start, gmId)
  expect(earlier.recipients.get(gmId)).toEqual({
    ...startedOwner,
    projection: advancedOwner.projection
  })
  expect(evidence()).toEqual(committed)
  // A new command still holding the Run's old version is the client's stale view: refused as a domain rejection, never retried.
  const stale = await execute({ ...advance, commandId: uuid(0xf42) }, playerId).catch(
    (error: unknown) => error
  )
  expect(stale).not.toBeInstanceOf(RetryableCommandError)
  expect(stale).toMatchObject({ data: { reason: 'VERSION_STALE' } })
  expect(evidence()).toEqual(committed)
  expect(read).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})
