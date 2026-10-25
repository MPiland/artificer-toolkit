import { expect, it, vi } from 'vitest'
import type { EncounterCharacterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { liveSessionRoomAuthorizationSchema } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { characterPlayStateSchema } from '@artificer-toolkit/schema/projections/characterPlayState'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { seededSrdCreature } from '../test/seededSrdCreature.js'
import { roomAuthorizationResponse } from '../test/roomAuthorizationFixture.js'
import { roomInputsResponse } from '../test/roomInputsFixture.js'
import { writeRoomCharacterPlay } from './roomCharacterWrites.js'
import { applyRoomEncounterMechanicsBatch } from './roomEncounterMechanics.js'
import { roomEncounterReadTransaction } from './roomEncounterReadPorts.js'
import { RoomEncounterStore, type RoomTransaction } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { fixtureSpeeds } from './testing/characterPageFixture.js'
import { uuid } from './testing/roomAggregateFixture.js'
import { srdRoomCharacter, srdRoomHydration } from './testing/srdRoomCharacter.js'
import { storedRunDocuments } from './testing/storedRunFixture.js'
import { prepareLiveCharacterSheetFacts } from './nativeCharacterRules.js'

// Passes through to the real preparation so the test can read the facts it produced.
vi.mock('./nativeCharacterRules.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./nativeCharacterRules.js')>()
  return { ...actual, prepareLiveCharacterSheetFacts: vi.fn(actual.prepareLiveCharacterSheetFacts) }
})

// Settling both batches through a built room takes 3-4 s alone, near the 5 s default, so a loaded runner times out.
it('settles Character and Creature mechanics from native play with private receipts and atomic rollback', async () => {
  const room = srdRoomCharacter({
    characterId: uuid(0xb10),
    userId: uuid(0xb11),
    campaignId: uuid(0xb12)
  })
  const { part } = room
  if (!part.inputs) throw new Error('Missing Character fixture.')
  const { owner } = part.inputs
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
    absence: null,
    form: null,
    stableTieKey: uuid(0xb04)
  })
  const creatureActor = encounterRunActorStateSchema.parse({
    ...srdCreatureActor({
      id: uuid(0xb05),
      creature: seededSrdCreature('Goblin'),
      currentHitPoints: 2
    }),
    encounterId: runId,
    sideId,
    systemId: owner.systemId,
    stableTieKey: uuid(0xb05),
    maxHitPoints: 2,
    createdAt: now,
    updatedAt: now
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
  const { storage, database } = createNodeSqliteRoomStorage()
  let store = new RoomEncounterStore(storage)
  const hydration = srdRoomHydration(room, { ...owner, play: nativePlay })
  const authorityRevisions = part.revisions.filter(
    (revision) => revision.scope === 'SYSTEM' || revision.scope === 'CAMPAIGN'
  )
  store.hydrate({
    epoch,
    documents: [
      ...authority.documents,
      ...hydration.documents,
      ...(await storedRunDocuments(run, [characterActor, creatureActor]))
    ],
    records: [
      ...hydration.records,
      {
        kind: 'ROOM_INPUT',
        key: 'AUTHORITY',
        revision: JSON.stringify(authorityRevisions),
        json: JSON.stringify({ ...authority, revisions: authorityRevisions, documents: [] })
      }
    ]
  })
  const read = vi.fn(async () => {
    throw new Error('Unexpected backend read.')
  })
  let inputs = new RoomInputs(store, read, room.loadContent)
  let caller = gmId
  async function apply(
    transaction: RoomTransaction,
    batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>,
    // A concurrent command's commit, landing between the room's preparation and its identity re-read.
    concurrently?: () => Promise<void>
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
        readCharacterRow: async (characterId) => {
          await concurrently?.()
          return readContext.ports.readCharacterRow(characterId)
        },
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
          critical: false,
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
    inputs = new RoomInputs(store, read, room.loadContent)
    expect(snapshot()).toEqual(before)

    const committed = await store.transact(async (transaction) => ({
      character: await apply(transaction, characterBatch),
      creature: await apply(transaction, creatureBatch)
    }))
    // The GM-admitted mechanics prepare the Character's sheet as the Campaign owner, not its player.
    expect(owner.userId).not.toBe(gmId)
    const prepared = await Promise.all(
      vi.mocked(prepareLiveCharacterSheetFacts).mock.results.map((result) => result.value)
    )
    expect(prepared.length).toBeGreaterThan(0)
    expect(prepared.map(({ campaignContext }) => campaignContext.viewer)).toEqual(
      prepared.map(() => 'CAMPAIGN_OWNER')
    )
    expect(committed.character.characterStreamVersion).toBe(nativePlay.streamVersion + 1)
    expect(committed.character.updatedActor).toEqual(characterActor)
    expect(committed.creature.characterStreamVersion).toBeNull()
    expect(committed.creature.updatedActor).toMatchObject({ currentHitPoints: 0, defeated: true })
    expect(store.documents('characterPlayStates')[0]).toMatchObject({
      streamVersion: nativePlay.streamVersion + 1,
      maximumHitPoints: 11,
      speeds: fixtureSpeeds,
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
    inputs = new RoomInputs(store, read, room.loadContent)
    expect(snapshot()).toEqual(after)

    // The Character's stored owner no longer matches the Campaign assignment the room admitted.
    await expect(
      store.transact(async (transaction) => {
        const [head] = store.documents('characters')
        if (!head) throw new Error('Missing Character head.')
        await store.store.patch(head._id, { userId: uuid(0xb0f) })
        await apply(transaction, characterBatch)
      })
    ).rejects.toThrow('Room mechanics Character identity is stale.')
    expect(snapshot()).toEqual(after)

    // Each of the other identity fields, changed by a concurrent commit after the room prepared the sheet.
    const concurrentChanges = [
      async () => {
        const [play] = store.documents('characterPlayStates')
        if (!play) throw new Error('Missing Character play.')
        await store.store.patch(play._id, { streamVersion: play.streamVersion + 1 })
      },
      async () => {
        const [play] = store.documents('characterPlayStates')
        if (!play) throw new Error('Missing Character play.')
        const state = {
          ...play.state,
          hitpoints: { ...play.state.hitpoints, temp: play.state.hitpoints.temp + 1 }
        }
        await store.store.patch(play._id, { state, checksum: checksumRuleDocument(state) })
      },
      async () => {
        const [head] = store.documents('characters')
        if (!head) throw new Error('Missing Character head.')
        await store.store.delete(head._id)
      },
      async () => {
        const [head] = store.documents('characters')
        if (!head) throw new Error('Missing Character head.')
        const { _id, _creationTime, ...fields } = head
        await store.store.delete(_id)
        await store.store.insert('characters', fields)
      },
      async () => {
        const [head] = store.documents('characters')
        if (!head) throw new Error('Missing Character head.')
        await store.store.patch(head._id, { systemId: uuid(0xb0f) })
      },
      async () => {
        const [head] = store.documents('characters')
        if (!head) throw new Error('Missing Character head.')
        await store.store.patch(head._id, { status: 'DRAFT' })
      }
    ]
    for (const concurrently of concurrentChanges) {
      await expect(
        store.transact((transaction) => apply(transaction, characterBatch, concurrently))
      ).rejects.toThrow('Room mechanics Character identity is stale.')
      expect(snapshot()).toEqual(after)
    }
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
    database.close()
  }
}, 30_000)
