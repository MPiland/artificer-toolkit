import { expect, it, vi } from 'vitest'
import {
  readCharacterRecord,
  readCharacterSheetState
} from '@artificer-toolkit/schema/projections/characterStoredState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { writeRoomCharacterPlay } from './roomCharacterWrites.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { uuid } from './testing/roomAggregateFixture.js'
import { srdRoomCharacter, srdRoomHydration } from './testing/srdRoomCharacter.js'
import { roomInputsResponse } from '../test/roomInputsFixture.js'
import { prepareLiveCharacterSheetFacts } from './nativeCharacterRules.js'

// Passes through to the real preparation so the test can read the facts it produced.
vi.mock('./nativeCharacterRules.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./nativeCharacterRules.js')>()
  return { ...actual, prepareLiveCharacterSheetFacts: vi.fn(actual.prepareLiveCharacterSheetFacts) }
})

it('stages typed play only in the parent transaction, rolls back failed evaluation and refuses stale or structural writes', async () => {
  const room = srdRoomCharacter({
    characterId: uuid(0x911),
    userId: uuid(0x912),
    campaignId: uuid(0x913)
  })
  const { part } = room
  if (!part.inputs) throw new Error('Missing Character fixture.')
  const hydration = srdRoomHydration(room)
  const owner = part.inputs.owner
  const campaignId = part.inputs.campaign.id
  const epoch = uuid(0x901)
  const campaignOwnerId = uuid(0x904)
  const authority = roomInputsResponse(
    { kind: 'AUTHORITY', cursor: null },
    {
      campaignId,
      systemId: owner.systemId,
      ownerUserId: campaignOwnerId,
      members: [
        { userId: campaignOwnerId, role: 'OWNER', membershipEpoch: owner.createdAt },
        { userId: owner.userId, role: 'PLAYER', membershipEpoch: owner.createdAt }
      ],
      assignments: [{ userId: owner.userId, characterId: owner.id }]
    }
  )
  if (authority.kind !== 'AUTHORITY') throw new Error('Missing authority fixture.')
  const { storage, database } = createNodeSqliteRoomStorage()
  const store = new RoomEncounterStore(storage)
  const authorityRevisions = part.revisions.filter(
    (revision) => revision.scope === 'SYSTEM' || revision.scope === 'CAMPAIGN'
  )
  store.hydrate({
    epoch,
    documents: [...authority.documents, ...hydration.documents],
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
  const storedHead = store.documents('characters')[0]
  const storedPlay = store.documents('characterPlayStates')[0]
  if (!storedHead || !storedPlay) throw new Error('Missing local Character fixture.')
  const current = { ...owner, ...storedHead, play: storedPlay }
  const read = vi.fn(async () => {
    throw new Error('Unexpected backend read.')
  })
  const inputs = new RoomInputs(store, read, room.loadContent)
  const evidence = () => ({
    head: store.documents('characters'),
    play: store.documents('characterPlayStates'),
    records: store.records('ROOM_INPUT'),
    checksum: store.checksum,
    sequence: store.sequence,
    logRows: store.logRows
  })
  const before = evidence()
  const document = readCharacterRecord(owner)
  const nextDocument = {
    ...document,
    state: { ...document.state, hitpoints: { ...document.state.hitpoints, current: 6 } }
  }
  const sheetState = readCharacterSheetState(owner)
  const fields = {
    streamVersion: owner.play.streamVersion + 1,
    updatedAt: '2026-09-30T12:00:00.000Z'
  }
  const write = {
    current,
    fields,
    document: nextDocument,
    sheetState: { ...sheetState, partyVisibility: { ...sheetState.partyVisibility, sheet: true } }
  }
  const stage = (override: Partial<typeof write>) =>
    store.transact((transaction) =>
      writeRoomCharacterPlay({
        store,
        inputs,
        transaction,
        campaignId,
        epoch,
        observed: part.revisions,
        write: { ...write, ...override }
      })
    )
  try {
    // The real evaluation of the written play fails (a malformed slot key), so nothing stays.
    await expect(
      stage({
        document: {
          ...nextDocument,
          state: { ...nextDocument.state, spellSlots: [{ slotKey: '1', used: 1 }] }
        }
      })
    ).rejects.toThrow('Unsupported spell slot usage key: 1')
    expect(evidence()).toEqual(before)

    await expect(
      store.transact(async (transaction) => {
        const state = {
          ...owner.play.state,
          hitpoints: { ...owner.play.state.hitpoints, current: 7 }
        }
        await store.store.patch(storedPlay._id, {
          state,
          checksum: checksumRuleDocument(state),
          streamVersion: fields.streamVersion
        })
        await writeRoomCharacterPlay({
          store,
          inputs,
          transaction,
          campaignId,
          epoch,
          observed: part.revisions,
          write
        })
      })
    ).rejects.toThrow('Room Character write base is stale.')
    await expect(
      stage({ document: { ...nextDocument, label: 'Builder structure changed' } })
    ).rejects.toThrow('Room Character writer only accepts play changes.')
    await expect(
      stage({
        sheetState: {
          ...sheetState,
          movementDisplayPreference: { mode: 'EXPLICIT', speedId: uuid(0x905) }
        }
      })
    ).rejects.toThrow('Room Character writer only accepts play changes.')
    expect(evidence()).toEqual(before)

    // A valid write is staged for the parent command, which can still refuse it.
    await expect(
      store.transact(async (transaction) => {
        await writeRoomCharacterPlay({
          store,
          inputs,
          transaction,
          campaignId,
          epoch,
          observed: part.revisions,
          write
        })
        const written = await inputs.character(owner.id, part.revisions, transaction)
        if (!written.inputs) throw new Error('Missing written owner.')
        expect(readCharacterRecord(written.inputs.owner).state.hitpoints.current).toBe(6)
        expect(written.inputs.owner.play.streamVersion).toBe(owner.play.streamVersion + 1)
        expect(written.inputs.owner.play.updatedAt).toBe(fields.updatedAt)
        expect(readCharacterSheetState(written.inputs.owner).partyVisibility.sheet).toBe(true)
        expect(store.documents('characters')).toEqual(before.head)
        expect(store.records('ROOM_INPUT')).toEqual(before.records)
        expect(store.logRows).toBe(before.logRows)
        throw new Error('Parent command refused.')
      })
    ).rejects.toThrow('Parent command refused.')
    expect(evidence()).toEqual(before)

    await stage({})
    const committed = store.documents('characterPlayStates')[0]
    expect(committed).toMatchObject({
      streamVersion: fields.streamVersion,
      updatedAt: fields.updatedAt,
      maximumHitPoints: 11,
      walkingSpeed: 30,
      state: { hitpoints: { current: 6 } }
    })
    expect(store.documents('characters')).toEqual(before.head)
    expect(store.sequence).toBe(before.sequence + 1)
    expect(read).not.toHaveBeenCalled()
    const restarted = new RoomEncounterStore(storage)
    expect(restarted.documents('characterPlayStates')).toEqual([committed])
    expect(restarted.documents('characters')).toEqual(before.head)
    expect(restarted.sequence).toBe(before.sequence + 1)
    expect(restarted.records('ROOM_INPUT')).toEqual(before.records)
    expect(restarted.checksum).toBe(store.checksum)

    // The writer admits the Campaign owner, not the Character's user, so its facts view the sheet as the GM.
    expect(owner.userId).not.toBe(campaignOwnerId)
    // The malformed-slot evaluation rejected by design, so only the settled preparations are read.
    const prepared = (
      await Promise.allSettled(
        vi.mocked(prepareLiveCharacterSheetFacts).mock.results.map((result) => result.value)
      )
    ).flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
    expect(prepared.length).toBeGreaterThan(0)
    expect(prepared.map(({ campaignContext }) => campaignContext.viewer)).toEqual(
      prepared.map(() => 'CAMPAIGN_OWNER')
    )
  } finally {
    database.close()
  }
})
