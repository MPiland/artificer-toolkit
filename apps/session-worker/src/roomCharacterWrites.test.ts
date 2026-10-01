import { expect, it, vi } from 'vitest'
import { liveRoomCharacterPartSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'
import {
  readCharacterRecord,
  readCharacterSheetState,
  readCharacterSheetStructure
} from '@artificer-toolkit/schema/projections/characterStoredState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { RoomEncounterStore, type RoomTransaction } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { writeRoomCharacterPlay } from './roomCharacterWrites.js'
import { characterPageFixture } from './testing/characterPageFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { roomInputsResponse } from '../test/roomInputsFixture.js'

vi.mock('./roomCharacterRules.js', () => ({ prepareRoomLiveCharacterSheet: vi.fn() }))

it('stages typed play only in the parent transaction, rolls back failed evaluation and refuses stale or structural writes', async () => {
  const page = liveRoomCharacterPartSchema.parse(characterPageFixture)
  if (page.status !== 'ASSIGNED' || !page.inputs) throw new Error('Missing Character fixture.')
  const owner = {
    ...page.inputs.owner,
    sheetStateChecksum: checksumRuleDocument(
      readCharacterSheetStructure(page.inputs.owner.sheetState)
    )
  }
  const part = { ...page, inputs: { ...page.inputs, owner } }
  const campaignId = part.inputs.campaign.id
  const epoch = '00000000-0000-4000-8000-000000000901'
  const campaignOwnerId = '00000000-0000-4000-8000-000000000904'
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
  const { storage } = createNodeSqliteRoomStorage()
  const store = new RoomEncounterStore(storage)
  const {
    _id,
    _creationTime,
    documentJson: _documentJson,
    sheetState: _sheetState,
    play,
    ...head
  } = owner
  const { _id: playId, _creationTime: playCreationTime, ...playFields } = play
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
      }
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
  const storedHead = store.documents('characters')[0]
  const storedPlay = store.documents('characterPlayStates')[0]
  if (!storedHead || !storedPlay) throw new Error('Missing local Character fixture.')
  const current = { ...owner, ...storedHead, play: storedPlay }
  const read = vi.fn(async () => {
    throw new Error('Unexpected backend read.')
  })
  const inputs = new RoomInputs(store, read, async () => [])
  const before = {
    head: store.documents('characters'),
    play: store.documents('characterPlayStates'),
    records: store.records('ROOM_INPUT'),
    checksum: store.checksum,
    sequence: store.sequence,
    logRows: store.logRows
  }
  let parent: RoomTransaction | undefined
  vi.mocked(prepareRoomLiveCharacterSheet).mockImplementation(
    async (storeInput, room, scope, observed, transaction) => {
      expect(storeInput).toBe(store)
      expect(room).toBe(inputs)
      expect(transaction).toBe(parent)
      expect(scope).toEqual({
        campaignId,
        authorityEpoch: epoch,
        characterId: owner.id,
        expectedUserId: campaignOwnerId,
        expectedRole: 'OWNER'
      })
      const written = await room.character(owner.id, observed, transaction)
      if (!written.inputs) throw new Error('Missing written owner.')
      expect(readCharacterRecord(written.inputs.owner).state.hitpoints.current).toBe(6)
      expect(written.inputs.owner.play.streamVersion).toBe(owner.play.streamVersion + 1)
      expect(written.inputs.owner.play.updatedAt).toBe('2026-09-30T12:00:00.000Z')
      expect(readCharacterSheetState(written.inputs.owner).partyVisibility.sheet).toBe(true)
      expect(store.documents('characters')).toEqual(before.head)
      expect(store.records('ROOM_INPUT')).toEqual(before.records)
      expect(store.logRows).toBe(before.logRows)
      throw new Error('Written Character evaluation failed.')
    }
  )
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
  await expect(
    store.transact(async (transaction) => {
      parent = transaction
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
  ).rejects.toThrow('Written Character evaluation failed.')
  expect({
    head: store.documents('characters'),
    play: store.documents('characterPlayStates'),
    records: store.records('ROOM_INPUT'),
    checksum: store.checksum,
    sequence: store.sequence,
    logRows: store.logRows
  }).toEqual(before)

  await expect(
    store.transact(async (transaction) => {
      const state = { ...play.state, hitpoints: { ...play.state.hitpoints, current: 7 } }
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
    store.transact(async (transaction) => {
      await writeRoomCharacterPlay({
        store,
        inputs,
        transaction,
        campaignId,
        epoch,
        observed: part.revisions,
        write: { ...write, document: { ...nextDocument, label: 'Builder structure changed' } }
      })
    })
  ).rejects.toThrow('Room Character writer only accepts play changes.')
  await expect(
    store.transact(async (transaction) => {
      await writeRoomCharacterPlay({
        store,
        inputs,
        transaction,
        campaignId,
        epoch,
        observed: part.revisions,
        write: {
          ...write,
          sheetState: {
            ...sheetState,
            movementDisplayPreference: {
              mode: 'EXPLICIT',
              speedId: '00000000-0000-4000-8000-000000000905'
            }
          }
        }
      })
    })
  ).rejects.toThrow('Room Character writer only accepts play changes.')
  expect(prepareRoomLiveCharacterSheet).toHaveBeenCalledTimes(1)
  expect(read).not.toHaveBeenCalled()
  const restarted = new RoomEncounterStore(storage)
  expect(restarted.documents('characters')).toEqual(before.head)
  expect(restarted.documents('characterPlayStates')).toEqual(before.play)
  expect(restarted.records('ROOM_INPUT')).toEqual(before.records)
  expect(restarted.checksum).toBe(before.checksum)
  expect(restarted.sequence).toBe(before.sequence)
})
