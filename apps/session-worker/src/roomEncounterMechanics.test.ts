import { expect, it, vi } from 'vitest'
import type { EncounterCharacterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { liveRoomCharacterPartSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'
import { liveSessionRoomAuthorizationSchema } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { characterStoredRowSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { characterPlayStateSchema } from '@artificer-toolkit/schema/projections/characterPlayState'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  readCharacterPlay,
  readCharacterRecord,
  readCharacterSheetState,
  readCharacterSheetStructure
} from '@artificer-toolkit/schema/projections/characterStoredState'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { roomAuthorizationResponse } from '../test/roomAuthorizationFixture.js'
import { roomInputsResponse } from '../test/roomInputsFixture.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { writeRoomCharacterPlay } from './roomCharacterWrites.js'
import { applyRoomEncounterMechanicsBatch } from './roomEncounterMechanics.js'
import { roomEncounterReadTransaction } from './roomEncounterReadPorts.js'
import { RoomEncounterStore, type RoomTransaction } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { characterPageFixture } from './testing/characterPageFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { uuid } from './testing/roomAggregateFixture.js'
import { storedRunDocuments } from './testing/storedRunFixture.js'

type SheetFacts = Awaited<ReturnType<typeof prepareRoomLiveCharacterSheet>>
type MechanicsFacts = Pick<SheetFacts, 'active' | 'character' | 'sheetState'> & {
  campaignContext: Pick<SheetFacts['campaignContext'], 'conditions'>
  ruleEvaluation: {
    facts: Pick<SheetFacts['ruleEvaluation']['facts'], 'movementFacts'>
    output: {
      movement: SheetFacts['ruleEvaluation']['output']['movement']
      derivedStats: Pick<SheetFacts['ruleEvaluation']['output']['derivedStats'], 'maxHitPoints'>
    }
  }
}
const prepareFacts = vi.hoisted(() =>
  vi.fn<(...args: Parameters<typeof prepareRoomLiveCharacterSheet>) => Promise<MechanicsFacts>>()
)
vi.mock('./roomCharacterRules.js', () => ({ prepareRoomLiveCharacterSheet: prepareFacts }))

it('settles Character and Creature mechanics from native play with private receipts and atomic rollback', async () => {
  const page = liveRoomCharacterPartSchema.parse(characterPageFixture)
  if (page.status !== 'ASSIGNED' || !page.inputs) throw new Error('Missing Character fixture.')
  const owner = characterStoredRowSchema.parse({
    ...page.inputs.owner,
    sheetStateChecksum: checksumRuleDocument(
      readCharacterSheetStructure(page.inputs.owner.sheetState)
    )
  })
  const part = { ...page, inputs: { ...page.inputs, owner } }
  const campaignId = part.inputs.campaign.id
  const epoch = uuid(0xb00)
  const gmId = uuid(0xb01)
  const members = [
    { userId: gmId, role: 'OWNER' as const, membershipEpoch: owner.createdAt },
    { userId: owner.userId, role: 'PLAYER' as const, membershipEpoch: owner.createdAt }
  ]
  const assignments = [{ userId: owner.userId, characterId: owner.id }]
  const authorization = liveSessionRoomAuthorizationSchema.parse(
    roomAuthorizationResponse({ members, assignments })
  )
  const authority = roomInputsResponse(
    { kind: 'AUTHORITY', cursor: null },
    {
      campaignId,
      systemId: owner.systemId,
      ownerUserId: gmId,
      members,
      assignments
    }
  )
  if (authority.kind !== 'AUTHORITY') throw new Error('Missing Campaign authority fixture.')
  const runId = uuid(0xb02)
  const sideId = uuid(0xb03)
  const now = '2026-09-30T12:00:00.000Z'
  const actorBase = {
    encounterId: runId,
    sideId,
    public: true,
    controllerUserIds: [],
    disposition: 'HOSTILE',
    initiative: 0,
    manualOrder: 0,
    healthDisplay: null,
    systemId: owner.systemId,
    resources: {},
    gmNotes: null,
    snapshot: {},
    createdAt: now,
    updatedAt: now
  }
  const characterActor = encounterRunActorStateSchema.parse({
    ...actorBase,
    id: uuid(0xb04),
    label: 'Character',
    kind: 'CHARACTER',
    sourceId: owner.id,
    frozenState: null,
    outOfInitiative: false,
    stableTieKey: uuid(0xb04)
  })
  const creatureActor = encounterRunActorStateSchema.parse({
    ...actorBase,
    id: uuid(0xb05),
    label: 'Creature',
    kind: 'CREATURE',
    sourceId: uuid(0xb06),
    sourceRevision: 1,
    stableTieKey: uuid(0xb05),
    currentHitPoints: 2,
    maxHitPoints: 2,
    tempHitPoints: 0,
    conditions: [],
    defeated: false
  })
  const optionalCombatSnapshot = { schemaVersion: 1, gameSystemId: owner.systemId, definitions: [] }
  const run = encounterRunStateSchema.parse({
    id: runId,
    campaignId,
    gameSystemId: owner.systemId,
    blueprintId: uuid(0xb07),
    blueprintVersion: 1,
    blueprintChecksum: 'b'.repeat(64),
    name: 'Native mechanics fixture',
    status: 'ACTIVE',
    automationMode: 'MANUAL',
    manualReminderMode: 'OFF',
    healthDisplayDefault: 'HIDDEN',
    version: 1,
    round: 1,
    currentActorId: null,
    actorIds: [characterActor.id, creatureActor.id],
    initiativePolicySnapshot: null,
    initiativePolicySnapshotChecksum: null,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot),
    turnSequence: 0,
    sides: [{ id: sideId, label: 'Targets', sortOrder: 0 }],
    createdAt: now,
    updatedAt: now
  })
  const nativeState = characterPlayStateSchema.parse({
    ...readCharacterPlay(owner.play),
    hitpoints: { ...owner.play.state.hitpoints, current: 8, temp: 0 },
    conditions: []
  })
  const nativePlay = {
    ...owner.play,
    state: nativeState,
    checksum: checksumRuleDocument(nativeState),
    streamVersion: owner.play.streamVersion + 2,
    updatedAt: now
  }
  const {
    _id,
    _creationTime,
    documentJson: _documentJson,
    sheetState: _sheetState,
    play: _play,
    ...head
  } = owner
  const { _id: playId, _creationTime: playCreationTime, ...playFields } = nativePlay
  const { storage, database } = createNodeSqliteRoomStorage()
  let store = new RoomEncounterStore(storage)
  const authorityRevisions = part.revisions.filter(
    (revision) => revision.scope === 'SYSTEM' || revision.scope === 'CAMPAIGN'
  )
  store.hydrate({
    epoch,
    documents: [
      ...authority.documents,
      { table: 'characters', id: _id, creationTime: _creationTime, fields: head },
      {
        table: 'characterPlayStates',
        id: playId,
        creationTime: playCreationTime,
        fields: playFields
      },
      ...(await storedRunDocuments(run, [characterActor, creatureActor]))
    ],
    records: [
      {
        kind: 'ROOM_INPUT',
        key: 'AUTHORITY',
        revision: JSON.stringify(authorityRevisions),
        json: JSON.stringify({ ...authority, revisions: authorityRevisions, documents: [] })
      },
      {
        kind: 'ROOM_INPUT',
        key: `CHARACTER:${owner.id}`,
        revision: JSON.stringify(part.revisions),
        json: JSON.stringify(part)
      }
    ]
  })
  const read = vi.fn(async () => {
    throw new Error('Unexpected backend read.')
  })
  let inputs = new RoomInputs(store, read, async () => [])
  let stalePrepared = false
  prepareFacts.mockImplementation(async (actualStore, room, scope, observed, transaction) => {
    expect(actualStore).toBe(store)
    expect(scope).toMatchObject({
      campaignId,
      authorityEpoch: epoch,
      characterId: owner.id,
      expectedUserId: gmId,
      expectedRole: 'OWNER'
    })
    const loaded = await room.character(owner.id, observed, transaction)
    if (!loaded.inputs) throw new Error('Missing native Character inputs.')
    const active = loaded.inputs.owner
    const walkingId = uuid(0xb08)
    return {
      active: stalePrepared
        ? { ...active, play: { ...active.play, streamVersion: active.play.streamVersion - 1 } }
        : active,
      character: characterAuthoredDtoSchema.parse(readCharacterRecord(active)),
      sheetState: readCharacterSheetState(active),
      campaignContext: { conditions: loaded.inputs.campaign.state.conditions },
      ruleEvaluation: {
        facts: {
          movementFacts: {
            speeds: [
              { speedId: walkingId, code: 'WALK', baseAmount: 30, unit: 'FEET', override: null }
            ],
            preference: { mode: 'AUTO', speedId: null }
          }
        },
        output: {
          movement: {
            speeds: [
              {
                speedId: walkingId,
                amount: 30,
                unit: 'FEET',
                calculation: { base: 30, effective: 30, contributions: [], override: null }
              }
            ],
            primaryMovementSpeedId: walkingId
          },
          derivedStats: {
            maxHitPoints: { base: 11, effective: 11, contributions: [], override: null }
          }
        }
      }
    }
  })
  let caller = gmId
  async function apply(
    transaction: RoomTransaction,
    batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
  ) {
    const readContext = await roomEncounterReadTransaction({
      store,
      transaction,
      inputs,
      authorization,
      campaignId,
      epoch,
      userId: caller,
      observed: part.revisions
    })
    const ctx: EncounterCharacterWriteTransaction = {
      ...readContext,
      ports: {
        ...readContext.ports,
        writeCharacterRecord: (write) =>
          writeRoomCharacterPlay({
            store,
            transaction,
            inputs,
            campaignId,
            epoch,
            observed: part.revisions,
            write
          })
      }
    }
    return applyRoomEncounterMechanicsBatch({
      ctx,
      store,
      transaction,
      inputs,
      campaignId,
      epoch,
      observed: part.revisions,
      batch
    })
  }
  function damageBatch(
    actorId: string,
    current: number,
    maximum: number,
    amount: number,
    commandId: string
  ): Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'> {
    return {
      encounterId: run.id,
      targetActorId: actorId,
      expectedEncounterVersion: run.version,
      occurrenceId: uuid(0xb09),
      sourceCommandId: uuid(0xb0a),
      commandId,
      occurredAt: '2026-09-30T12:01:00.000Z',
      effectiveMaximumHitPoints: maximum,
      forceVersionAdvance: false,
      applications: [
        {
          sourceNodeId: 'room-mechanics',
          sourceOperationKey: 'damage',
          authoredPath: null,
          resolvedPath: 'TEST',
          kind: 'DAMAGE',
          targetActorId: actorId,
          requestedAmount: amount,
          resolvedAmount: amount,
          appliedAmount: amount,
          beforeCurrentHitPoints: current,
          afterCurrentHitPoints: current - amount,
          beforeTemporaryHitPoints: 0,
          afterTemporaryHitPoints: 0,
          maximumHitPoints: maximum,
          damageTypeId: uuid(0xb0b),
          damageDisposition: 'NORMAL'
        }
      ]
    }
  }
  const characterBatch = damageBatch(characterActor.id, 8, 11, 1, uuid(0xb0c))
  const creatureBatch = damageBatch(creatureActor.id, 2, 2, 2, uuid(0xb0d))
  const snapshot = () => ({
    runs: store.documents('encounterRuns'),
    actors: store.documents('encounterRunActors'),
    snapshots: store.documents('encounterActorSnapshots'),
    sources: store.documents('encounterSourceProjectionFacts'),
    head: store.documents('characters'),
    play: store.documents('characterPlayStates'),
    receipts: store.documents('characterCommandReceipts'),
    assignments: store.documents('campaignCharacterAssignments'),
    records: store.records('ROOM_INPUT'),
    sequence: store.sequence,
    checksum: store.checksum,
    logRows: store.logRows
  })
  const before = snapshot()
  try {
    expect(readCharacterPlay(owner.play).hitpoints.current).toBe(11)
    expect(nativePlay.streamVersion).toBeGreaterThan(owner.play.streamVersion)
    await expect(
      store.transact(async (transaction) => {
        const character = await apply(transaction, characterBatch)
        const creature = await apply(transaction, creatureBatch)
        expect(character.characterStreamVersion).toBe(nativePlay.streamVersion + 1)
        expect(character.targetTransition).toMatchObject({
          before: { currentHitPoints: 8 },
          after: { currentHitPoints: 7 }
        })
        expect(store.documents('characterCommandReceipts')).toHaveLength(0)
        expect(creature.updatedActor).toMatchObject({ currentHitPoints: 0, defeated: true })
        expect(store.documents('characters')).toEqual(before.head)
        throw new Error('Caller command failed.')
      })
    ).rejects.toThrow('Caller command failed.')
    expect(snapshot()).toEqual(before)
    store = new RoomEncounterStore(storage)
    inputs = new RoomInputs(store, read, async () => [])
    expect(snapshot()).toEqual(before)

    const committed = await store.transact(async (transaction) => ({
      character: await apply(transaction, characterBatch),
      creature: await apply(transaction, creatureBatch)
    }))
    expect(committed.character.characterStreamVersion).toBe(nativePlay.streamVersion + 1)
    expect(committed.character.updatedActor).toEqual(characterActor)
    expect(committed.creature.characterStreamVersion).toBeNull()
    expect(committed.creature.updatedActor).toMatchObject({ currentHitPoints: 0, defeated: true })
    expect(store.documents('characterPlayStates')[0]).toMatchObject({
      streamVersion: nativePlay.streamVersion + 1,
      maximumHitPoints: 11,
      walkingSpeed: 30,
      updatedAt: characterBatch.occurredAt,
      state: { hitpoints: { current: 7 } }
    })
    // The Encounter keeps its own history: a Character stream advance leaves no Sheet receipt.
    expect(store.documents('characterCommandReceipts')).toEqual([])
    expect(store.documents('characters')).toEqual(before.head)
    expect(store.records('ROOM_INPUT')).toEqual(before.records)
    expect(store.sequence).toBe(before.sequence + 1)
    expect(store.logRows).toBe(before.logRows + 1)
    const after = snapshot()
    store = new RoomEncounterStore(storage)
    inputs = new RoomInputs(store, read, async () => [])
    expect(snapshot()).toEqual(after)

    stalePrepared = true
    await expect(
      store.transact((transaction) => apply(transaction, characterBatch))
    ).rejects.toThrow('Room mechanics Character identity is stale.')
    stalePrepared = false
    expect(snapshot()).toEqual(after)
    caller = uuid(0xb0e)
    await expect(
      store.transact((transaction) => apply(transaction, characterBatch))
    ).rejects.toThrow('Campaign access ended.')
    caller = gmId
    expect(snapshot()).toEqual(after)
    await expect(
      store.transact(async (transaction) => {
        const assignment = await store.store
          .query('campaignCharacterAssignments')
          .withIndex('by_characterId', (q) => q.eq('characterId', owner.id))
          .unique()
        if (!assignment) throw new Error('Missing Character assignment.')
        await store.store.delete(assignment._id)
        await apply(transaction, characterBatch)
      })
    ).rejects.toThrow('Assigned Character not found.')
    expect(snapshot()).toEqual(after)
    expect(read).not.toHaveBeenCalled()
  } finally {
    prepareFacts.mockReset()
    database.close()
  }
})
