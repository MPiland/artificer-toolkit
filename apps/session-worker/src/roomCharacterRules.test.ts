import { expect, it, vi } from 'vitest'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import type { EncounterDocument } from '@artificer-toolkit/encounter-persistence/store'
import { liveRoomCharacterPartSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'
import { characterPlayStateSchema } from '@artificer-toolkit/schema/projections/characterPlayState'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { prepareLiveCharacterSheetFacts } from './nativeCharacterRules.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { fixtureSpeeds } from './testing/characterPageFixture.js'
import { uuid } from './testing/roomAggregateFixture.js'
import {
  srdCharacterScope,
  srdRoomCharacter,
  srdRoomHydration
} from './testing/srdRoomCharacter.js'

const identity = { characterId: uuid(0x901), userId: uuid(0x902), campaignId: uuid(0x903) }

it('prepares the stored SRD Character over its authorized snapshot objects, refusing a foreign source scope', async () => {
  const epoch = uuid(0x805)
  const read = vi.fn(async () => {
    throw new Error('Unexpected backend read.')
  })
  const prepare = async (
    room: ReturnType<typeof srdRoomCharacter>,
    loadContent: typeof room.loadContent
  ) => {
    const { storage, database } = createNodeSqliteRoomStorage()
    try {
      const store = new RoomEncounterStore(storage)
      store.hydrate({ epoch, ...srdRoomHydration(room) })
      return await prepareRoomLiveCharacterSheet(
        store,
        new RoomInputs(store, read, loadContent),
        srdCharacterScope(room, epoch),
        room.part.revisions
      )
    } finally {
      database.close()
    }
  }

  const room = srdRoomCharacter(identity)
  const facts = await prepare(room, room.loadContent)
  expect(facts.active.play).toEqual(room.part.inputs?.owner.play)
  expect(facts.character.id).toBe(identity.characterId)
  expect(facts.ruleEvaluation.output.derivedStats.maxHitPoints.effective).toBe(11)
  expect(facts.ruleEvaluation.output.movement.speeds.map(({ amount }) => amount)).toEqual([30])
  expect(facts.prepared.character.state.equipment.inventory).toHaveLength(1)

  // A source the Character's manifest does not list, and a Campaign scope that is not its own.
  const unlisted = srdRoomCharacter({ ...identity, authorizeSource: false })
  await expect(prepare(unlisted, unlisted.loadContent)).rejects.toThrow(
    'Room content scope is unauthorized.'
  )
  await expect(
    prepare(room, async () =>
      (await room.loadContent()).map((object) => ({
        ...object,
        scope: 'CAMPAIGN' as const,
        scopeId: uuid(0x806)
      }))
    )
  ).rejects.toThrow('Room content scope is unauthorized.')
  expect(read).not.toHaveBeenCalled()
})

it('reconciles native play atomically, recovers after eviction and preserves the play clock on warm or stats-only preparation', async () => {
  const room = srdRoomCharacter({ ...identity, secondWind: true })
  const { part } = room
  if (!part.inputs) throw new Error('Missing Character fixture.')
  const original = part.inputs.owner
  const epoch = uuid(0x824)
  const scope = srdCharacterScope(room, epoch)
  const baseline = await prepareLiveCharacterSheetFacts({
    scope,
    inputs: part.inputs,
    system: room.system,
    objects: await room.loadContent()
  })
  const [pool, ...otherPools] = baseline.ruleEvaluation.output.resources
  if (!pool || pool.ownerKind !== 'AUTHORED_SOURCE' || otherPools.length)
    throw new Error('The SRD Fighter has one authored Resource pool.')
  const inventoryId = baseline.prepared.character.state.equipment.inventory[0]!.id
  const usage = [
    { kind: 'AUTHORED_SOURCE' as const, sourceId: pool.sourceId, chargeId: pool.chargeId },
    { kind: 'AUTHORED_GRANT' as const, resourceGrantId: 'removed' }
  ].map((owner, index) => ({
    id: uuid(0x820 + index),
    characterId: original.id,
    createdBy: original.userId,
    updatedBy: original.userId,
    createdAt: original.createdAt,
    updatedAt: original.updatedAt,
    owner,
    used: index + 1
  }))
  expect(createCharacterResourceOwnerKey(usage[0]!.owner)).toBe(pool.poolId)
  const state = characterPlayStateSchema.parse({
    ...readCharacterPlay(original.play),
    hitpoints: {
      current: 7,
      temp: 4,
      hitDice: [{ die: 10, total: 2, used: 1 }],
      deathSaves: NO_DEATH_SAVES
    },
    inspiration: true,
    resources: [{ resourceGrantId: 'legacy-resource', used: 2 }],
    spellSlots: [{ slotKey: 'STANDARD:1', used: 1 }],
    conditions: [{ conditionTypeId: uuid(0x823), notes: 'Keep this condition.' }],
    exhaustion: { level: 1, notes: 'Keep this exhaustion.' },
    equipped: [inventoryId, 'removed-item'],
    attuned: [inventoryId, 'removed-item'],
    resourceUsage: usage,
    partyVisibility: { health: 'HIDDEN', sheet: true }
  })
  const owner = {
    ...original,
    play: { ...original.play, state, checksum: checksumRuleDocument(state) }
  }
  const play = owner.play
  const { storage, database } = createNodeSqliteRoomStorage()
  let store = new RoomEncounterStore(storage)
  store.hydrate({ epoch, ...srdRoomHydration(room, owner) })
  const read = vi.fn(async () => {
    throw new Error('Unexpected backend read.')
  })
  const loadContent = vi.fn(room.loadContent)
  let inputs = new RoomInputs(store, read, loadContent)
  const snapshot = () => ({
    head: store.documents('characters'),
    play: store.documents('characterPlayStates'),
    records: store.records('ROOM_INPUT'),
    sequence: store.sequence,
    checksum: store.checksum,
    logRows: store.logRows
  })
  const prepare = () =>
    store.transact((transaction) =>
      prepareRoomLiveCharacterSheet(store, inputs, scope, part.revisions, transaction)
    )
  const before = snapshot()
  const expectedState = {
    ...state,
    hitpoints: { ...state.hitpoints, hitDice: [{ die: 10, total: 1, used: 1 }] },
    equipped: [inventoryId],
    attuned: [inventoryId],
    resourceUsage: usage.slice(0, 1)
  }
  try {
    await expect(
      store.transact(async (transaction) => {
        const facts = await prepareRoomLiveCharacterSheet(
          store,
          inputs,
          scope,
          part.revisions,
          transaction
        )
        expect(facts.active.play.state).toEqual(expectedState)
        expect(facts.active.play).toMatchObject({
          maximumHitPoints: 11,
          speeds: fixtureSpeeds,
          streamVersion: play.streamVersion + 1
        })
        expect(store.documents('characters')).toEqual(before.head)
        expect(store.records('ROOM_INPUT')).toEqual(before.records)
        throw new Error('Caller command failed.')
      })
    ).rejects.toThrow('Caller command failed.')
    expect(snapshot()).toEqual(before)
    store = new RoomEncounterStore(storage)
    inputs = new RoomInputs(store, read, loadContent)
    expect(snapshot()).toEqual(before)

    const committed = await prepare()
    expect(committed.active.play.state).toEqual(expectedState)
    expect(committed.active.play.streamVersion).toBe(play.streamVersion + 1)
    expect(committed.active.play.updatedAt > play.updatedAt).toBe(true)
    expect(store.documents('characters')).toEqual(before.head)
    expect(store.records('ROOM_INPUT')).toEqual(before.records)
    const after = snapshot()
    store = new RoomEncounterStore(storage)
    inputs = new RoomInputs(store, read, loadContent)
    expect(snapshot()).toEqual(after)
    const recovered = await inputs.character(original.id, part.revisions)
    expect(recovered.inputs?.owner.play).toEqual(committed.active.play)
    const fetches = loadContent.mock.calls.length
    const warm = await prepare()
    expect(warm.active.play).toEqual(committed.active.play)
    expect(snapshot()).toEqual(after)
    expect(loadContent).toHaveBeenCalledTimes(fetches)

    // A removed Campaign adjustment or Builder level-down lowers the evaluated maximum: a -6 Campaign
    // adjustment makes it 5, which clamps current HP.
    const characterInputs = part.inputs
    const hold = (value: number) =>
      store.transact(async (transaction) => {
        const adjusted = liveRoomCharacterPartSchema.parse({
          ...part,
          inputs: {
            ...characterInputs,
            campaign: {
              ...characterInputs.campaign,
              state: {
                ...characterInputs.campaign.state,
                adjustments: [
                  {
                    id: uuid(0x830),
                    campaignId: identity.campaignId,
                    characterId: original.id,
                    adjustment: { family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value },
                    visibility: 'VISIBLE',
                    version: 1,
                    createdBy: identity.userId,
                    createdAt: original.createdAt,
                    updatedAt: original.updatedAt
                  }
                ]
              }
            }
          }
        })
        transaction.setRecord({
          kind: 'ROOM_INPUT',
          key: `CHARACTER:${original.id}`,
          revision: JSON.stringify(part.revisions),
          json: JSON.stringify(adjusted)
        })
      })
    await hold(-6)
    const lowered = await prepare()
    expect(lowered.active.play).toMatchObject({ maximumHitPoints: 5 })
    expect(lowered.active.play.state.hitpoints.current).toBe(5)
    expect(store.documents('characters')).toEqual(before.head)

    // A raised maximum (a GM adjustment) updates stats and leaves current HP alone.
    await hold(-2)
    const statsOnly = await prepare()
    expect(statsOnly.active.play).toEqual({ ...lowered.active.play, maximumHitPoints: 9 })
    expect(read).not.toHaveBeenCalled()
  } finally {
    database.close()
  }
})

it('retains play usage of a Resource whose maximum is UNRESOLVED and drops usage of pools the Character no longer has', async () => {
  const room = srdRoomCharacter({ ...identity, secondWind: 'UNRESOLVED_MAXIMUM' })
  const { part } = room
  if (!part.inputs) throw new Error('Missing Character fixture.')
  const original = part.inputs.owner
  const epoch = uuid(0x840)
  const scope = srdCharacterScope(room, epoch)
  const baseline = await prepareLiveCharacterSheetFacts({
    scope,
    inputs: part.inputs,
    system: room.system,
    objects: await room.loadContent()
  })
  const [pool, ...otherPools] = baseline.ruleEvaluation.output.resources
  if (!pool || pool.ownerKind !== 'AUTHORED_SOURCE' || otherPools.length)
    throw new Error('The SRD Fighter has one authored Resource pool.')
  expect(pool).toMatchObject({ state: 'UNRESOLVED', maximum: null })
  const usage = [
    { kind: 'AUTHORED_SOURCE' as const, sourceId: pool.sourceId, chargeId: pool.chargeId },
    { kind: 'AUTHORED_GRANT' as const, resourceGrantId: 'removed' }
  ].map((owner, index) => ({
    id: uuid(0x841 + index),
    characterId: original.id,
    createdBy: original.userId,
    updatedBy: original.userId,
    createdAt: original.createdAt,
    updatedAt: original.updatedAt,
    owner,
    used: index + 1
  }))
  expect(createCharacterResourceOwnerKey(usage[0]!.owner)).toBe(pool.poolId)
  const state = characterPlayStateSchema.parse({
    ...readCharacterPlay(original.play),
    resourceUsage: usage
  })
  const owner = {
    ...original,
    play: { ...original.play, state, checksum: checksumRuleDocument(state) }
  }
  const { storage, database } = createNodeSqliteRoomStorage()
  try {
    const store = new RoomEncounterStore(storage)
    store.hydrate({ epoch, ...srdRoomHydration(room, owner) })
    const inputs = new RoomInputs(
      store,
      vi.fn(async () => {
        throw new Error('Unexpected backend read.')
      }),
      room.loadContent
    )
    const facts = await store.transact((transaction) =>
      prepareRoomLiveCharacterSheet(store, inputs, scope, part.revisions, transaction)
    )
    expect(facts.ruleEvaluation.output.resources[0]).toMatchObject({
      poolId: pool.poolId,
      state: 'UNRESOLVED'
    })
    expect(facts.active.play.state.resourceUsage).toEqual(usage.slice(0, 1))
    expect(store.documents('characterPlayStates')[0]?.state.resourceUsage).toEqual(
      usage.slice(0, 1)
    )
  } finally {
    database.close()
  }
})

// A concurrent command may commit between the room's reads of a Character's play and the
// reconciliation write; the changed field is applied to the stored play after the real content read.
const staleBasePlayChanges: [
  string,
  (store: RoomEncounterStore, play: EncounterDocument<'characterPlayStates'>) => Promise<void>
][] = [
  ['row is missing', (store, play) => store.store.delete(play._id)],
  [
    '_id differs',
    async (store, { _id, _creationTime, ...fields }) => {
      await store.store.delete(_id)
      await store.store.insert('characterPlayStates', fields)
    }
  ],
  ['userId differs', (store, play) => store.store.patch(play._id, { userId: uuid(0x8ff) })],
  ['checksum differs', (store, play) => store.store.patch(play._id, { checksum: 'f'.repeat(64) })],
  [
    'streamVersion differs',
    (store, play) => store.store.patch(play._id, { streamVersion: play.streamVersion + 1 })
  ]
]

it.each(staleBasePlayChanges)(
  'refuses to reconcile over a stale base when the stored play %s',
  async (_name, mutate) => {
    const room = srdRoomCharacter(identity)
    const { part } = room
    const epoch = uuid(0x850)
    const { storage, database } = createNodeSqliteRoomStorage()
    try {
      const store = new RoomEncounterStore(storage)
      store.hydrate({ epoch, ...srdRoomHydration(room) })
      const inputs = new RoomInputs(
        store,
        vi.fn(async () => {
          throw new Error('Unexpected backend read.')
        }),
        room.loadContent
      )
      const [play] = store.documents('characterPlayStates')
      if (!play) throw new Error('Missing play row.')
      const readObjects = inputs.contentObjects.bind(inputs)
      vi.spyOn(inputs, 'contentObjects').mockImplementation(async (...args) => {
        const objects = await readObjects(...args)
        await mutate(store, play)
        return objects
      })
      const before = {
        head: store.documents('characters'),
        records: store.records('ROOM_INPUT'),
        sequence: store.sequence,
        logRows: store.logRows
      }
      await expect(
        store.transact((transaction) =>
          prepareRoomLiveCharacterSheet(
            store,
            inputs,
            srdCharacterScope(room, epoch),
            part.revisions,
            transaction
          )
        )
      ).rejects.toThrow('Room Character reconciliation base is stale.')
      expect({
        head: store.documents('characters'),
        records: store.records('ROOM_INPUT'),
        sequence: store.sequence,
        logRows: store.logRows
      }).toEqual(before)
      expect(store.documents('characterPlayStates')).toEqual([play])
    } finally {
      vi.restoreAllMocks()
      database.close()
    }
  }
)
