import { expect, it } from 'vitest'
import { campaignStoredEntrySchema } from '../projections/campaignCommunicationPersistence.js'

const base = {
  id: '11111111-1111-4111-8111-111111111111',
  campaignId: '22222222-2222-4222-8222-222222222222',
  conversationId: '33333333-3333-4333-8333-333333333333',
  authorUserId: '44444444-4444-4444-8444-444444444444',
  clientNonce: '55555555-5555-4555-8555-555555555555',
  createdAt: '2026-09-30T12:00:00.000Z',
  authorUsername: 'Player',
  characterId: null,
  characterLabel: 'Fighter',
  editedAt: null,
  unsentAt: null,
  consumedAt: null
}

const rollEntry = {
  ...base,
  kind: 'ROLL',
  mode: null,
  body: null,
  revealedByGm: false,
  roll: {
    id: base.clientNonce,
    normalizedExpression: '1d20',
    characterId: null,
    characterLabel: 'Fighter',
    source: { kind: 'MANUAL', label: 'Check' },
    ruleset: { systemId: base.campaignId, code: 'srd', version: '1' },
    createdAt: base.createdAt,
    evidence: {
      terms: [{ count: 1, die: 20, rolls: [10], subtotal: 10 }],
      modifier: 0,
      mode: 'NORMAL',
      keep: 'FIRST',
      subtotal: 10,
      transform: { kind: 'NONE' },
      total: 10
    }
  }
}

const chatEntry = {
  ...base,
  kind: 'CHAT',
  mode: 'OOC',
  body: 'hello',
  roll: null,
  revealedByGm: false
}

it('stores a roll entry and its reveal and consumption changes as one valid document', () => {
  expect(campaignStoredEntrySchema.safeParse(rollEntry).success).toBe(true)
  expect(
    campaignStoredEntrySchema.safeParse({
      ...rollEntry,
      revealedByGm: true,
      consumedAt: base.createdAt
    }).success
  ).toBe(true)
})

it('rejects entries whose kind disagrees with their roll, text or consumption', () => {
  expect(campaignStoredEntrySchema.safeParse(chatEntry).success).toBe(true)
  expect(campaignStoredEntrySchema.safeParse({ ...rollEntry, roll: null }).success).toBe(false)
  expect(campaignStoredEntrySchema.safeParse({ ...chatEntry, roll: rollEntry.roll }).success).toBe(
    false
  )
  expect(
    campaignStoredEntrySchema.safeParse({ ...chatEntry, consumedAt: base.createdAt }).success
  ).toBe(false)
})
