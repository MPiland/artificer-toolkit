import { afterEach, describe, expect, it, vi } from 'vitest'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { liveRoomCharacterPartSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'
import { liveSessionRoomWriteSetSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import { liveSessionRoomAuthorizationSchema } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { RoomEncounterStore, type RoomDocument } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import {
  readFrozenUnassignedCharacterIds,
  readRoomActorDepartures,
  reconcileRoomActorDepartures
} from './roomActorReconcile.js'
import { characterPageFixtureFor } from './testing/characterPageFixture.js'
import { encounterRunFixture } from './testing/encounterRunFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { uuid } from './testing/roomAggregateFixture.js'
import { DND5E_SYSTEM_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { roomAuthorizationResponse } from '../test/roomAuthorizationFixture.js'
import { roomInputsResponse } from '../test/roomInputsFixture.js'

const EPOCH = uuid(0x900)
const CAMPAIGN = uuid(0x901)
// The Run's System must be installed: Concentration reads resolve through its module (6.16).
const SYSTEM = DND5E_SYSTEM_ID
const GM = uuid(0xa01)
const PLAYER_B = uuid(0xa02)
const PLAYER_C = uuid(0xa03)
const DEPARTED = uuid(0xa04)
const CHARACTER_A = uuid(0xb01)
const CHARACTER_B = uuid(0xb02)
const CHARACTER_C = uuid(0xb03)
const CHARACTER_D = uuid(0xb04)
const PLAYER_OF: Record<string, string> = {
  [CHARACTER_A]: PLAYER_B,
  [CHARACTER_B]: PLAYER_B,
  [CHARACTER_C]: PLAYER_C
}
const MEMBERSHIP_EPOCH = '2026-09-30T00:00:00.000Z'
const databases: Array<{ close(): void }> = []

afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

/**
 * A room holding one open Run with a Character actor for each of Characters A, B and C. A's
 * Character is gone from storage; B and C keep their stored play. `assigned` names the Characters whose assignment
 * survives; an archived Campaign has no members.
 */
async function heldRoom({
  assigned,
  controllers = {},
  archived = false,
  cached = []
}: {
  assigned: readonly string[]
  controllers?: Record<string, string[]>
  archived?: boolean
  /** Characters whose cached room inputs the room holds. */
  cached?: readonly string[]
}) {
  const members = archived
    ? []
    : [
        {
          userId: GM,
          role: 'OWNER' as const,
          membershipEpoch: MEMBERSHIP_EPOCH
        },
        {
          userId: PLAYER_B,
          role: 'PLAYER' as const,
          membershipEpoch: MEMBERSHIP_EPOCH
        },
        {
          userId: PLAYER_C,
          role: 'PLAYER' as const,
          membershipEpoch: MEMBERSHIP_EPOCH
        }
      ]
  const assignments = assigned.map((characterId) => ({
    characterId,
    userId: PLAYER_OF[characterId]!
  }))
  const authorization = liveSessionRoomAuthorizationSchema.parse(
    roomAuthorizationResponse({ members, assignments })
  )
  const authority = roomInputsResponse(
    { kind: 'AUTHORITY', cursor: null },
    {
      campaignId: CAMPAIGN,
      systemId: SYSTEM,
      ownerUserId: GM,
      members,
      assignments
    }
  )
  const system = roomInputsResponse(
    { kind: 'SYSTEM', part: 'SYSTEM' },
    { campaignId: CAMPAIGN, systemId: SYSTEM }
  )
  if (authority.kind !== 'AUTHORITY' || system.kind !== 'SYSTEM')
    throw new Error('Missing room fixture inputs.')
  const characterDocuments: RoomDocument[] = [CHARACTER_B, CHARACTER_C].flatMap((characterId) => {
    const page = liveRoomCharacterPartSchema.parse(
      characterPageFixtureFor({ characterId, userId: PLAYER_OF[characterId], campaignId: CAMPAIGN })
    )
    if (page.status !== 'ASSIGNED' || !page.inputs) throw new Error('Missing Character fixture.')
    const {
      _creationTime,
      documentJson: _document,
      sheetState: _sheet,
      checksum: _checksum,
      sheetStateChecksum: _sheetChecksum,
      play,
      ...head
    } = { ...page.inputs.owner, systemId: SYSTEM }
    const { _id: _playId, _creationTime: playCreationTime, ...playFields } = play
    return [
      {
        table: 'characters',
        id: `fixture:${characterId}`,
        creationTime: _creationTime,
        fields: head
      },
      {
        table: 'characterPlayStates',
        id: `fixture:play:${characterId}`,
        creationTime: playCreationTime,
        fields: playFields
      }
    ]
  })
  const run = await encounterRunFixture({
    campaignId: CAMPAIGN,
    systemId: SYSTEM,
    actors: [CHARACTER_A, CHARACTER_B, CHARACTER_C].map((characterId) => ({
      characterId,
      controllerUserIds: controllers[characterId]
    }))
  })
  const { storage, database } = createNodeSqliteRoomStorage()
  databases.push(database)
  const store = new RoomEncounterStore(storage)
  store.hydrate({
    epoch: EPOCH,
    documents: [...authority.documents, ...run.documents, ...characterDocuments],
    records: [
      {
        kind: 'ROOM_INPUT',
        key: 'AUTHORITY',
        revision: JSON.stringify(authority.revisions),
        json: JSON.stringify({ ...authority, documents: [] })
      },
      {
        kind: 'ROOM_INPUT',
        key: 'SYSTEM:SYSTEM',
        revision: JSON.stringify(system.revisions),
        json: JSON.stringify(system)
      },
      ...cached.map((characterId) => ({
        kind: 'ROOM_INPUT',
        key: `CHARACTER:${characterId}`,
        revision: null,
        json: '{}'
      }))
    ]
  })
  const inputs = new RoomInputs(
    store,
    vi.fn(async () => {
      throw new Error('Unexpected backend read.')
    }),
    async () => []
  )
  /** The Run's Character actors by Character. */
  const actors = async () =>
    Object.fromEntries(
      (await readRunActors({ db: store.store }, readRunState(store.documents('encounterRuns')[0]!)))
        .filter((actor) => actor.kind === 'CHARACTER')
        .map((actor) => [actor.sourceId, actor])
    )
  const reconcile = (deletedCharacterIds: ReadonlySet<string>) =>
    store.transact((transaction) =>
      reconcileRoomActorDepartures({
        store,
        transaction,
        inputs,
        authorization,
        campaignId: CAMPAIGN,
        epoch: EPOCH,
        deletedCharacterIds
      })
    )
  /** The ops the latest committed transaction journaled, in order. */
  const journaled = () => {
    const row = storage.sql
      .exec('SELECT json FROM room_writeset_log WHERE sequence = ?', store.sequence)
      .toArray()[0]
    if (typeof row?.json !== 'string') throw new Error('Missing write set.')
    return liveSessionRoomWriteSetSchema.parse(JSON.parse(row.json))
  }
  return { store, inputs, authorization, actors, reconcile, journaled }
}

const rowIdOf = (store: RoomEncounterStore, actorId: string) =>
  store.documents('encounterRunActors').find((row) => row.id === actorId)!._id

describe('readRoomActorDepartures', () => {
  it.each([
    {
      name: 'a Run naming no departure',
      assigned: [CHARACTER_A, CHARACTER_B, CHARACTER_C]
    },
    { name: 'an archived Campaign', assigned: [CHARACTER_C], archived: true }
  ])('returns null and writes nothing for $name', async ({ assigned, archived }) => {
    const { store, inputs, authorization } = await heldRoom({ assigned, archived })
    const { sequence, logRows } = store
    await expect(readRoomActorDepartures(store, inputs, authorization)).resolves.toBeNull()
    expect([store.sequence, store.logRows]).toEqual([sequence, logRows])
  })

  it('names the unfrozen Character actors whose assignment is gone', async () => {
    const { store, inputs, authorization } = await heldRoom({
      assigned: [CHARACTER_C]
    })
    const departures = await readRoomActorDepartures(store, inputs, authorization)
    expect(departures?.unassignedCharacterIds.sort()).toEqual([CHARACTER_A, CHARACTER_B])
  })

  it('reports a departed controller with no unassigned Character', async () => {
    const { store, inputs, authorization } = await heldRoom({
      assigned: [CHARACTER_A, CHARACTER_B, CHARACTER_C],
      controllers: { [CHARACTER_C]: [PLAYER_C, DEPARTED] }
    })
    await expect(readRoomActorDepartures(store, inputs, authorization)).resolves.toEqual({
      unassignedCharacterIds: []
    })
  })

  it('reports a cached unassigned Character that no open Run names', async () => {
    const { store, inputs, authorization } = await heldRoom({
      assigned: [CHARACTER_A, CHARACTER_B, CHARACTER_C],
      cached: [CHARACTER_D]
    })
    await expect(readRoomActorDepartures(store, inputs, authorization)).resolves.toEqual({
      unassignedCharacterIds: []
    })
  })
})

describe('frozen Character actors on a Character notice (D200)', () => {
  it('names only the frozen Character actors whose assignment is gone', async () => {
    const { store, authorization, reconcile } = await heldRoom({
      assigned: [CHARACTER_A, CHARACTER_C]
    })
    await expect(readFrozenUnassignedCharacterIds(store, authorization)).resolves.toEqual([])
    await reconcile(new Set())
    await expect(readFrozenUnassignedCharacterIds(store, authorization)).resolves.toEqual([
      CHARACTER_B
    ])
  })

  it('keeps a frozen actor whose Character still reads unassigned', async () => {
    const { actors, reconcile } = await heldRoom({ assigned: [CHARACTER_A, CHARACTER_C] })
    await reconcile(new Set())
    const frozen = await actors()
    expect(frozen[CHARACTER_B]).toMatchObject({ frozenState: { currentHitPoints: 11 } })
    await reconcile(new Set())
    expect(await actors()).toEqual(frozen)
  })

  it('removes a frozen actor once its Character reads deleted', async () => {
    // A's Character is gone from storage, so the first reconcile removes it as it freezes B.
    const { actors, reconcile } = await heldRoom({ assigned: [CHARACTER_C] })
    await reconcile(new Set([CHARACTER_A]))
    const frozen = await actors()
    expect(frozen[CHARACTER_B]).toMatchObject({ frozenState: { currentHitPoints: 11 } })
    await reconcile(new Set([CHARACTER_B]))
    expect(await actors()).toEqual({ [CHARACTER_C]: frozen[CHARACTER_C] })
  })
})

describe('reconcileRoomActorDepartures', () => {
  it('removes a deleted Character actor from the Run and its initiative', async () => {
    const { store, actors, reconcile, journaled } = await heldRoom({
      assigned: [CHARACTER_B, CHARACTER_C]
    })
    const held = await actors()
    const rowA = rowIdOf(store, held[CHARACTER_A]!.id)
    const { sequence } = store
    await reconcile(new Set([CHARACTER_A]))

    const remaining = await actors()
    expect(Object.keys(remaining).sort()).toEqual([CHARACTER_B, CHARACTER_C])
    expect(remaining[CHARACTER_B]).toEqual(held[CHARACTER_B])
    expect(remaining[CHARACTER_C]).toEqual(held[CHARACTER_C])
    const remainingIds = [remaining[CHARACTER_B]!.id, remaining[CHARACTER_C]!.id].sort()
    expect([...readRunState(store.documents('encounterRuns')[0]!).actorIds].sort()).toEqual(
      remainingIds
    )
    expect(
      store
        .documents('encounterInitiativeParticipants')
        .map((participant) => participant.actorId)
        .sort()
    ).toEqual(remainingIds)
    expect(store.sequence).toBe(sequence + 1)
    expect(journaled()).toContainEqual({ op: 'DELETE', id: rowA })
  })

  it('freezes an unfrozen Character actor whose assignment is gone at its play values', async () => {
    const { store, actors, reconcile, journaled } = await heldRoom({
      assigned: [CHARACTER_A, CHARACTER_C]
    })
    const held = await actors()
    const rowB = rowIdOf(store, held[CHARACTER_B]!.id)
    await reconcile(new Set())

    const reconciled = await actors()
    expect(reconciled[CHARACTER_B]).toMatchObject({ frozenState: { currentHitPoints: 11 } })
    expect(reconciled[CHARACTER_C]).toEqual(held[CHARACTER_C])
    const writes = journaled()
    expect(writes).toContainEqual(expect.objectContaining({ op: 'PATCH', id: rowB }))
    expect(writes.some((write) => write.op === 'DELETE')).toBe(false)
  })

  it('removes a deleted Character actor and freezes an unassigned one in one reconcile', async () => {
    const { actors, reconcile } = await heldRoom({ assigned: [CHARACTER_C] })
    const held = await actors()
    await reconcile(new Set([CHARACTER_A]))

    const reconciled = await actors()
    expect(Object.keys(reconciled).sort()).toEqual([CHARACTER_B, CHARACTER_C])
    expect(reconciled[CHARACTER_B]).toMatchObject({ frozenState: { currentHitPoints: 11 } })
    expect(reconciled[CHARACTER_C]).toEqual(held[CHARACTER_C])
  })

  it('evicts the cached inputs of every unassigned Character and keeps assigned ones', async () => {
    const { store, reconcile } = await heldRoom({
      assigned: [CHARACTER_B, CHARACTER_C],
      cached: [CHARACTER_A, CHARACTER_C, CHARACTER_D]
    })
    const cached = () => store.records('ROOM_INPUT').map(({ key }) => key)
    await reconcile(new Set([CHARACTER_A]))
    expect(cached()).toContain(`CHARACTER:${CHARACTER_C}`)
    expect(cached()).not.toContain(`CHARACTER:${CHARACTER_A}`)
    expect(cached()).not.toContain(`CHARACTER:${CHARACTER_D}`)
    expect(store.documents('characterPlayStates')).toHaveLength(2)
  })

  it('unlists a controller who is no longer a member and keeps the rest', async () => {
    const { actors, reconcile } = await heldRoom({
      assigned: [CHARACTER_A, CHARACTER_B, CHARACTER_C],
      controllers: { [CHARACTER_C]: [PLAYER_C, DEPARTED] }
    })
    await reconcile(new Set())
    const reconciled = Object.values(await actors())
    expect(reconciled.flatMap(({ controllerUserIds }) => controllerUserIds)).toEqual([PLAYER_C])
    expect(reconciled.every(({ frozenState }) => frozenState === null)).toBe(true)
  })

  it('reconciles nothing for an archived Campaign', async () => {
    const { store, actors, reconcile } = await heldRoom({
      assigned: [CHARACTER_C],
      archived: true
    })
    const { sequence, logRows } = store
    const held = await actors()
    await reconcile(new Set([CHARACTER_A]))
    expect(await actors()).toEqual(held)
    expect([store.sequence, store.logRows]).toEqual([sequence, logRows])
  })
})
