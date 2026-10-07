import { describe, expect, it } from 'vitest'
import {
  campaignStoredEntryIdentitySchema,
  campaignStoredEntryPayloadSchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import { insertConversationEntry } from '../conversationPersistence.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'

const uuid = (ordinal: number) =>
  `00000000-0000-4000-8000-${ordinal.toString(16).padStart(12, '0')}`
const conversationId = uuid(2)
const frozenClock = '2026-10-01T00:00:00.000Z'

function entry(id: string, conversationIdOfEntry = conversationId) {
  return {
    identity: campaignStoredEntryIdentitySchema.parse({
      id,
      campaignId: uuid(1),
      conversationId: conversationIdOfEntry,
      authorUserId: uuid(3),
      clientNonce: uuid(Number.parseInt(id.slice(-4), 16) + 1000),
      createdAt: frozenClock
    }),
    payload: campaignStoredEntryPayloadSchema.parse({
      entryId: id,
      kind: 'CHAT',
      mode: 'OOC',
      body: id,
      roll: null,
      revealedByGm: false,
      authorUsername: 'tester',
      characterId: null,
      characterLabel: null,
      editedAt: null,
      unsentAt: null,
      consumedAt: null
    })
  }
}

describe('conversation entry order', () => {
  it('reads same-clock entries back in insertion order, whatever their ids', async () => {
    const { store } = createMemoryEncounterStore()
    const ctx = { db: store }
    // Ids descend, so an id tiebreak would read the entries back reversed.
    const ids = [uuid(0x30), uuid(0x20), uuid(0x10)]
    const stamped = []
    for (const id of ids) {
      const { identity, payload } = entry(id)
      stamped.push(await insertConversationEntry(ctx, identity, payload))
    }
    await insertConversationEntry(
      ctx,
      entry(uuid(0x05), uuid(9)).identity,
      entry(uuid(0x05), uuid(9)).payload
    )
    const read = await store
      .query('campaignConversationEntries')
      .withIndex('by_conversationId_createdAt_id', (q) => q.eq('conversationId', conversationId))
      .collect()
    expect(read.map((header) => header.id)).toEqual(ids)
    expect(stamped.map((header) => header.createdAt)).toEqual(
      read.map((header) => header.createdAt)
    )
  })

  it('keeps a later clock reading as proposed', async () => {
    const { store } = createMemoryEncounterStore()
    const ctx = { db: store }
    const first = entry(uuid(0x10))
    await insertConversationEntry(ctx, first.identity, first.payload)
    const later = entry(uuid(0x20))
    const proposed = '2026-10-01T00:00:05.000Z'
    const stamped = await insertConversationEntry(
      ctx,
      { ...later.identity, createdAt: proposed },
      later.payload
    )
    expect(stamped.createdAt).toBe(proposed)
  })
})
