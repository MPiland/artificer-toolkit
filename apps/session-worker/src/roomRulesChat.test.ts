import { expect, it } from 'vitest'
import { postRulesChatMessage } from '@artificer-toolkit/encounter-persistence/rulesChatPersistence'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { buildRoomCheckpointRecords } from './roomCheckpointRecords.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { uuid } from './testing/roomAggregateFixture.js'
import { roomInputsResponse } from '../test/roomInputsFixture.js'

it('commits native rules chat with its checkpoint records and rolls back an unfinished command', async () => {
  const { storage, database } = createNodeSqliteRoomStorage()
  try {
    const campaignId = uuid(201)
    const ownerUserId = uuid(202)
    const epoch = uuid(203)
    const input = roomInputsResponse(
      { kind: 'AUTHORITY', cursor: null },
      {
        campaignId,
        systemId: uuid(204),
        ownerUserId,
        members: [
          { userId: ownerUserId, role: 'OWNER', membershipEpoch: '2026-09-29T00:00:00.000Z' }
        ]
      }
    )
    if (input.kind !== 'AUTHORITY') throw new Error('Missing authority fixture.')
    let store = new RoomEncounterStore(storage)
    store.hydrate({ epoch, documents: input.documents, records: [] })
    const checksum = store.checksum
    const campaign = await store.store
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', campaignId))
      .unique()
    const membership = await store.store
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', campaignId).eq('userId', ownerUserId)
      )
      .unique()
    if (!campaign || !membership) throw new Error('Missing native authority.')
    const authority = { campaign, membership }
    const context = {
      db: store.store,
      ports: {
        requireCampaignAuthority: async (requestedCampaign: string, requestedUser: string) => {
          if (requestedCampaign !== campaignId || requestedUser !== ownerUserId)
            throw new Error('Campaign access ended.')
          return authority
        }
      }
    }
    const message = {
      authorUserId: ownerUserId,
      clientNonce: uuid(205),
      body: 'The GM skipped this decision.'
    }
    await expect(
      store.transact(async () => {
        await postRulesChatMessage(context, authority, message)
        throw new Error('Command did not complete.')
      })
    ).rejects.toThrow('Command did not complete.')
    expect(store.sequence).toBe(0)
    expect(store.documents('campaignConversationEntries')).toEqual([])
    expect(store.documents('campaignConversations')).toEqual([])

    await store.transact(() => postRulesChatMessage(context, authority, message))
    expect(store.sequence).toBe(1)
    const [header] = store.documents('campaignConversationEntries')
    const [payload] = store.documents('campaignConversationEntryPayloads')
    expect(header).toMatchObject({
      campaignId,
      authorUserId: ownerUserId,
      clientNonce: message.clientNonce,
      kind: 'CHAT',
      rollNonceFingerprint: null
    })
    expect(payload).toMatchObject({ entryId: header!.id, body: message.body, mode: 'OOC' })
    expect(header!.createdAt >= membership.accessStartedAt).toBe(true)
    const journal = store.committedWriteSets({
      epoch,
      fromSequence: 0,
      fromChecksum: checksum,
      toSequence: 1,
      maxEntries: 10,
      maxBytes: 1024 * 1024
    })
    const checkpoint = buildRoomCheckpointRecords({
      documents: input.documents,
      records: [],
      fromSequence: 0,
      fromChecksum: checksum,
      entries: journal.entries
    })
    expect(checkpoint.changes.map(({ table }) => table).sort()).toEqual([
      'campaignConversationEntries',
      'campaignConversationEntryPayloads',
      'campaignConversationMembers',
      'campaignConversations'
    ])
    store = new RoomEncounterStore(storage)
    expect(store.corruption).toBeNull()
    expect(store.documents('campaignConversationEntries')).toEqual([header])
    expect(store.documents('campaignConversationEntryPayloads')).toEqual([payload])
  } finally {
    database.close()
  }
})
