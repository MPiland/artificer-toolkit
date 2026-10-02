import { expect, it, vi } from 'vitest'
import { contentSnapshotDocumentsObjectSchema } from '@artificer-toolkit/schema/api/contentSnapshots'
import { liveRoomCharacterPartSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { characterResourceSchema } from '@artificer-toolkit/schema/api/characterResourceRules'
import { characterPlayStateSchema } from '@artificer-toolkit/schema/projections/characterPlayState'
import { characterStoredRowSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import {
  readCharacterPlay,
  readCharacterSheetStructure
} from '@artificer-toolkit/schema/projections/characterStoredState'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { prepareLiveCharacterSheetFacts } from './nativeCharacterRules.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { characterPageFixture } from './testing/characterPageFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { uuid } from './testing/roomAggregateFixture.js'

type SheetFacts = Awaited<ReturnType<typeof prepareLiveCharacterSheetFacts>>
type ReconciliationFacts = {
  active: SheetFacts['active']
  prepared: {
    character: {
      state: Pick<SheetFacts['prepared']['character']['state'], 'hitpoints'> & {
        equipment: {
          inventory: Array<
            Pick<
              SheetFacts['prepared']['character']['state']['equipment']['inventory'][number],
              'id'
            >
          >
        }
      }
    }
  }
  ruleEvaluation: {
    facts: Pick<SheetFacts['ruleEvaluation']['facts'], 'movementFacts'>
    output: {
      resources: SheetFacts['ruleEvaluation']['output']['resources']
      movement: SheetFacts['ruleEvaluation']['output']['movement']
      derivedStats: Pick<SheetFacts['ruleEvaluation']['output']['derivedStats'], 'maxHitPoints'>
    }
  }
}

// Only the preparation facts consumed by reconciliation are mocked; persistence and input reads are real.
const prepareFacts = vi.hoisted(() =>
  vi.fn<
    (...args: Parameters<typeof prepareLiveCharacterSheetFacts>) => Promise<ReconciliationFacts>
  >()
)
vi.mock('./nativeCharacterRules.js', () => ({ prepareLiveCharacterSheetFacts: prepareFacts }))

it('prepares from the stored inputs and authorized snapshot objects, refusing a foreign source scope', async () => {
  const part = liveRoomCharacterPartSchema.parse(characterPageFixture)
  if (part.status !== 'ASSIGNED' || !part.inputs || !part.contentSnapshots)
    throw new Error('Missing Character fixture.')
  const { owner, campaign } = part.inputs
  const roots = [uuid(0x801), uuid(0x802)].map((id, index) => ({
    kind: 'SPELL' as const,
    id,
    label: index === 0 ? 'Referenced Spell' : 'Unreferenced Spell',
    description: 'Published Spell',
    castingTime: { unit: 'ROUND', amount: 1 },
    level: 1,
    classIds: [],
    magicSchoolId: uuid(0x803),
    userId: uuid(0x804),
    systemId: owner.systemId
  }))
  const object = contentSnapshotDocumentsObjectSchema.parse({
    format: 2,
    scope: 'CAMPAIGN',
    scopeId: campaign.id,
    kind: 'SPELL',
    part: 'documents',
    roots,
    versions: roots.map((root) => ({
      identity: {
        subjectKind: 'SPELL',
        subjectId: root.id,
        systemId: root.systemId,
        contentSourceId: uuid(0x804),
        versionId: root.id,
        checksum: checksumRuleDocument(root)
      },
      version: 1,
      storedParentId: null
    }))
  })
  const system = systemAuthoredDtoSchema.parse({
    id: owner.systemId,
    label: 'Character rules fixture',
    rulesetCode: 'DND5E',
    rulesetVersion: '2014',
    userId: owner.userId,
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
  const { storage, database } = createNodeSqliteRoomStorage()
  const store = new RoomEncounterStore(storage)
  const epoch = uuid(0x805)
  store.hydrate({ epoch, documents: [], records: [] })
  const room = new RoomInputs(
    store,
    async () => {
      throw new Error('Unexpected backend read.')
    },
    async () => [object]
  )
  vi.spyOn(room, 'character').mockResolvedValue(part)
  vi.spyOn(room, 'system').mockResolvedValue({
    kind: 'SYSTEM',
    revisions: part.revisions,
    system,
    vocabulary: null
  })
  vi.spyOn(room, 'contentObjects').mockResolvedValue([object])
  vi.mocked(prepareLiveCharacterSheetFacts).mockImplementation(async (input) => {
    expect(input.inputs).toEqual(part.inputs)
    expect(input.system).toEqual(system)
    expect(input.objects).toEqual([object])
    throw new Error('Preparation inputs checked.')
  })
  const scope = {
    campaignId: campaign.id,
    authorityEpoch: epoch,
    characterId: owner.id,
    expectedUserId: owner.userId,
    expectedRole: 'PLAYER' as const
  }
  try {
    await expect(prepareRoomLiveCharacterSheet(store, room, scope, null)).rejects.toThrow(
      'Preparation inputs checked.'
    )
    vi.spyOn(room, 'contentObjects').mockResolvedValue([
      { ...object, scope: 'SOURCE', scopeId: uuid(0x806) }
    ])
    await expect(prepareRoomLiveCharacterSheet(store, room, scope, null)).rejects.toThrow(
      'Room content scope is unauthorized.'
    )
  } finally {
    vi.restoreAllMocks()
    vi.mocked(prepareLiveCharacterSheetFacts).mockReset()
    database.close()
  }
})

it('reconciles native play atomically, recovers after eviction and preserves the play clock on warm or stats-only preparation', async () => {
  const page = liveRoomCharacterPartSchema.parse(characterPageFixture)
  if (page.status !== 'ASSIGNED' || !page.inputs) throw new Error('Missing Character fixture.')
  const original = page.inputs.owner
  const usage = ['retained', 'unresolved', 'removed'].map((resourceGrantId, index) => ({
    id: uuid(0x820 + index),
    characterId: original.id,
    createdBy: original.userId,
    updatedBy: original.userId,
    createdAt: original.createdAt,
    updatedAt: original.updatedAt,
    owner: { kind: 'AUTHORED_GRANT' as const, resourceGrantId },
    used: index + 1
  }))
  const state = characterPlayStateSchema.parse({
    ...readCharacterPlay(original.play),
    hitpoints: { current: 11, temp: 4, hitDice: [{ die: 10, total: 2, used: 1 }] },
    inspiration: true,
    resources: [{ resourceGrantId: 'legacy-resource', used: 2 }],
    spellSlots: [{ slotKey: '1', used: 1 }],
    conditions: [{ conditionTypeId: uuid(0x823), notes: 'Keep this condition.' }],
    exhaustion: { level: 1, notes: 'Keep this exhaustion.' },
    equipped: ['equipped-item', 'removed-item'],
    attuned: ['attuned-item', 'removed-item'],
    resourceUsage: usage,
    partyVisibility: { health: 'HIDDEN', sheet: true }
  })
  const owner = characterStoredRowSchema.parse({
    ...original,
    sheetStateChecksum: checksumRuleDocument(readCharacterSheetStructure(original.sheetState)),
    play: { ...original.play, state, checksum: checksumRuleDocument(state) }
  })
  const part = liveRoomCharacterPartSchema.parse({
    ...page,
    inputs: { ...page.inputs, owner }
  })
  if (part.status !== 'ASSIGNED') throw new Error('Missing Character fixture.')
  const system = systemAuthoredDtoSchema.parse({
    id: owner.systemId,
    label: 'Reconciliation fixture',
    rulesetCode: 'DND5E',
    rulesetVersion: '2014',
    userId: owner.userId,
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
  const epoch = uuid(0x824)
  const { storage, database } = createNodeSqliteRoomStorage()
  let store = new RoomEncounterStore(storage)
  const {
    _id,
    _creationTime,
    documentJson: _documentJson,
    sheetState: _sheetState,
    play,
    ...head
  } = owner
  const { _id: playId, _creationTime: playCreationTime, ...playFields } = play
  store.hydrate({
    epoch,
    documents: [
      { table: 'characters', id: _id, creationTime: _creationTime, fields: head },
      {
        table: 'characterPlayStates',
        id: playId,
        creationTime: playCreationTime,
        fields: playFields
      }
    ],
    records: [
      {
        kind: 'ROOM_INPUT',
        key: `CHARACTER:${owner.id}`,
        revision: JSON.stringify(part.revisions),
        json: JSON.stringify(part)
      },
      {
        kind: 'ROOM_INPUT',
        key: 'SYSTEM:SYSTEM',
        revision: JSON.stringify(part.revisions),
        json: JSON.stringify({
          kind: 'SYSTEM',
          revisions: part.revisions,
          system,
          vocabulary: null
        })
      }
    ]
  })
  const read = vi.fn(async () => {
    throw new Error('Unexpected backend read.')
  })
  const loadContent = vi.fn(async () => [])
  let room = new RoomInputs(store, read, loadContent)
  const scope = {
    campaignId: page.inputs.campaign.id,
    authorityEpoch: epoch,
    characterId: owner.id,
    expectedUserId: owner.userId,
    expectedRole: 'PLAYER' as const
  }
  const hitDice = [{ die: 10, total: 1, used: 1 }]
  const resources = usage.slice(0, 2).map((entry, index) =>
    characterResourceSchema.parse({
      sequence: index,
      poolId: createCharacterResourceOwnerKey(entry.owner),
      resourceDefinitionId: uuid(0x825),
      chargeId: uuid(0x826),
      chargeCalculationId: createCharacterResourceOwnerKey(entry.owner),
      state: index === 0 ? 'RESOLVED' : 'UNRESOLVED',
      maximum: index === 0 ? 3 : null,
      rawUsed: entry.used,
      effectiveUsed: index === 0 ? entry.used : null,
      remaining: index === 0 ? 2 : null,
      reasonCode: index === 0 ? 'CALCULATED' : 'MISSING_REQUIRED_FACT',
      baseContribution: null,
      bonusContributions: [],
      resetKind: 'LONG_REST',
      resetResolution: { baseResetKind: 'LONG_REST', appliedGrantId: null, source: null },
      ownerKind: 'AUTHORED_GRANT',
      resourceGrantId: entry.owner.resourceGrantId,
      availableAtLevel: 1,
      activeSourceLevel: 1
    })
  )
  let maximumHitPoints = 7
  let staleBase = false
  prepareFacts.mockImplementation(async ({ inputs }) => {
    return {
      active: staleBase
        ? {
            ...inputs.owner,
            play: { ...inputs.owner.play, streamVersion: inputs.owner.play.streamVersion + 1 }
          }
        : inputs.owner,
      prepared: {
        character: {
          state: {
            hitpoints: { ...inputs.owner.play.state.hitpoints, hitDice },
            equipment: { inventory: [{ id: 'equipped-item' }, { id: 'attuned-item' }] }
          }
        }
      },
      ruleEvaluation: {
        facts: {},
        output: {
          resources,
          movement: { speeds: [], primaryMovementSpeedId: null },
          derivedStats: {
            maxHitPoints: {
              base: maximumHitPoints,
              effective: maximumHitPoints,
              contributions: [],
              override: null
            }
          }
        }
      }
    }
  })
  const snapshot = () => ({
    head: store.documents('characters'),
    play: store.documents('characterPlayStates'),
    records: store.records('ROOM_INPUT'),
    sequence: store.sequence,
    checksum: store.checksum,
    logRows: store.logRows
  })
  const before = snapshot()
  const expectedState = {
    ...state,
    hitpoints: { ...state.hitpoints, hitDice },
    equipped: ['equipped-item'],
    attuned: ['attuned-item'],
    resourceUsage: usage.slice(0, 2)
  }
  try {
    await expect(
      store.transact(async (transaction) => {
        const facts = await prepareRoomLiveCharacterSheet(
          store,
          room,
          scope,
          part.revisions,
          transaction
        )
        expect(facts.active.play.state).toEqual(expectedState)
        expect(facts.active.play).toMatchObject({
          maximumHitPoints: 7,
          walkingSpeed: 0,
          streamVersion: play.streamVersion + 1
        })
        expect(store.documents('characters')).toEqual(before.head)
        expect(store.records('ROOM_INPUT')).toEqual(before.records)
        throw new Error('Caller command failed.')
      })
    ).rejects.toThrow('Caller command failed.')
    expect(snapshot()).toEqual(before)
    store = new RoomEncounterStore(storage)
    room = new RoomInputs(store, read, loadContent)
    expect(snapshot()).toEqual(before)

    const committed = await store.transact((transaction) =>
      prepareRoomLiveCharacterSheet(store, room, scope, part.revisions, transaction)
    )
    expect(committed.active.play.state).toEqual(expectedState)
    expect(committed.active.play.streamVersion).toBe(play.streamVersion + 1)
    expect(committed.active.play.updatedAt > play.updatedAt).toBe(true)
    expect(store.documents('characters')).toEqual(before.head)
    expect(store.records('ROOM_INPUT')).toEqual(before.records)
    const after = snapshot()
    store = new RoomEncounterStore(storage)
    room = new RoomInputs(store, read, loadContent)
    expect(snapshot()).toEqual(after)
    const recovered = await room.character(owner.id, part.revisions)
    expect(recovered.inputs?.owner.play).toEqual(committed.active.play)
    const fetches = loadContent.mock.calls.length
    const warm = await store.transact((transaction) =>
      prepareRoomLiveCharacterSheet(store, room, scope, part.revisions, transaction)
    )
    expect(warm.active.play).toEqual(committed.active.play)
    expect(snapshot()).toEqual(after)
    expect(loadContent).toHaveBeenCalledTimes(fetches)
    expect(read).not.toHaveBeenCalled()

    // A changed Campaign effective maximum alone updates stats and does not clamp native HP.
    maximumHitPoints = 5
    const statsOnly = await store.transact((transaction) =>
      prepareRoomLiveCharacterSheet(store, room, scope, part.revisions, transaction)
    )
    expect(statsOnly.active.play).toEqual({ ...committed.active.play, maximumHitPoints: 5 })
    expect(store.documents('characters')).toEqual(before.head)
    expect(store.records('ROOM_INPUT')).toEqual(before.records)
    const final = snapshot()
    store = new RoomEncounterStore(storage)
    expect(snapshot()).toEqual(final)
    room = new RoomInputs(store, read, loadContent)
    staleBase = true
    await expect(
      store.transact((transaction) =>
        prepareRoomLiveCharacterSheet(store, room, scope, part.revisions, transaction)
      )
    ).rejects.toThrow('Room Character reconciliation base is stale.')
    expect(snapshot()).toEqual(final)
    expect(read).not.toHaveBeenCalled()
  } finally {
    vi.restoreAllMocks()
    prepareFacts.mockReset()
    database.close()
  }
})
