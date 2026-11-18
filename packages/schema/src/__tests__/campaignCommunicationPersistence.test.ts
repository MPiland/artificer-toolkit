import { expect, it } from 'vitest'
import {
  campaignRollNonceFingerprint,
  campaignRoomEntrySchema,
  campaignStoredEntryMetadataSchema,
  campaignStoredEntrySchema,
  hasCampaignEntryContent,
  projectCampaignEntryMetadata
} from '../projections/campaignCommunicationPersistence.js'

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

it('projects only nonce metadata, with a fingerprint for rolls alone', () => {
  const roll = projectCampaignEntryMetadata(campaignStoredEntrySchema.parse(rollEntry))
  expect(roll).toEqual({
    id: base.id,
    campaignId: base.campaignId,
    conversationId: base.conversationId,
    authorUserId: base.authorUserId,
    createdAt: base.createdAt,
    kind: 'ROLL',
    clientNonce: base.clientNonce,
    rollNonceFingerprint: campaignRollNonceFingerprint(rollEntry)
  })
  expect(campaignStoredEntryMetadataSchema.safeParse(roll).success).toBe(true)
  const chat = projectCampaignEntryMetadata(campaignStoredEntrySchema.parse(chatEntry))
  expect(chat).toMatchObject({ kind: 'CHAT', rollNonceFingerprint: null })
  expect(JSON.stringify(chat)).not.toContain('hello')
  expect(
    campaignStoredEntryMetadataSchema.safeParse({ ...chat, rollNonceFingerprint: 'x' }).success
  ).toBe(false)
  expect(
    campaignStoredEntryMetadataSchema.safeParse({ ...roll, rollNonceFingerprint: null }).success
  ).toBe(false)
})

it('fingerprints the retry fields and ignores reveal and consumption', () => {
  const fingerprint = campaignRollNonceFingerprint(rollEntry)
  expect(fingerprint).toMatch(/^[a-f0-9]{64}$/)
  expect(
    campaignRollNonceFingerprint({ ...rollEntry, revealedByGm: true, consumedAt: base.createdAt })
  ).toBe(fingerprint)
  expect(campaignRollNonceFingerprint({ ...rollEntry, authorUsername: 'Other' })).not.toBe(
    fingerprint
  )
  expect(
    campaignRollNonceFingerprint({
      ...rollEntry,
      roll: { ...rollEntry.roll, normalizedExpression: '2d20' }
    })
  ).not.toBe(fingerprint)
})

it('tells a held entry with content from hydrated metadata', () => {
  const full = campaignStoredEntrySchema.parse(chatEntry)
  expect(hasCampaignEntryContent(full)).toBe(true)
  expect(hasCampaignEntryContent(projectCampaignEntryMetadata(full))).toBe(false)
  expect(campaignRoomEntrySchema.safeParse(full).success).toBe(true)
  expect(campaignRoomEntrySchema.safeParse(projectCampaignEntryMetadata(full)).success).toBe(true)
  expect(campaignRoomEntrySchema.safeParse({ ...full, body: null }).success).toBe(false)
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
