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
  unsentAt: null
}

const rollRecord = {
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

const storedRoll = { roll: rollRecord, revealedByGm: false, consumedAt: null }

const rollEntry = {
  ...base,
  kind: 'ROLL',
  mode: null,
  body: null,
  rolls: [storedRoll]
}

const chatEntry = {
  ...base,
  kind: 'CHAT',
  mode: 'OOC',
  body: 'hello',
  rolls: []
}

it('stores a roll entry and its per-roll reveal and consumption changes as one valid document', () => {
  expect(campaignStoredEntrySchema.safeParse(rollEntry).success).toBe(true)
  expect(
    campaignStoredEntrySchema.safeParse({
      ...rollEntry,
      rolls: [{ ...storedRoll, revealedByGm: true, consumedAt: base.createdAt }]
    }).success
  ).toBe(true)
})

it('stores several rolls in one entry, each with its own reveal and consumption', () => {
  const second = { ...rollRecord, id: '66666666-6666-4666-8666-666666666666' }
  const parsed = campaignStoredEntrySchema.parse({
    ...rollEntry,
    rolls: [
      { ...storedRoll, revealedByGm: true },
      { roll: second, revealedByGm: false, consumedAt: base.createdAt }
    ]
  })
  expect(parsed.rolls.map(({ revealedByGm, consumedAt }) => [revealedByGm, consumedAt])).toEqual([
    [true, null],
    [false, base.createdAt]
  ])
})

it('rejects a roll entry with no rolls', () => {
  expect(campaignStoredEntrySchema.safeParse({ ...rollEntry, rolls: [] }).success).toBe(false)
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
    rollNonceFingerprint: campaignRollNonceFingerprint(campaignStoredEntrySchema.parse(rollEntry))
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
  const entry = campaignStoredEntrySchema.parse(rollEntry)
  const fingerprint = campaignRollNonceFingerprint(entry)
  expect(fingerprint).toMatch(/^[a-f0-9]{64}$/)
  const spent = {
    ...entry,
    rolls: entry.rolls.map((stored) => ({
      ...stored,
      revealedByGm: true,
      consumedAt: base.createdAt
    }))
  }
  expect(campaignRollNonceFingerprint(spent)).toBe(fingerprint)
  expect(campaignRollNonceFingerprint({ ...entry, authorUsername: 'Other' })).not.toBe(fingerprint)
  expect(
    campaignRollNonceFingerprint({
      ...entry,
      rolls: entry.rolls.map((stored) => ({
        ...stored,
        roll: { ...stored.roll, normalizedExpression: '2d20' }
      }))
    })
  ).not.toBe(fingerprint)
})

it('fingerprints every roll of a list, in order', () => {
  const entry = campaignStoredEntrySchema.parse(rollEntry)
  const first = entry.rolls[0]!
  const second = { ...first, roll: { ...first.roll, id: base.id } }
  const pair = { ...entry, rolls: [entry.rolls[0]!, second] }
  const fingerprint = campaignRollNonceFingerprint(pair)
  expect(fingerprint).not.toBe(campaignRollNonceFingerprint(entry))
  expect(campaignRollNonceFingerprint({ ...pair, rolls: [second, entry.rolls[0]!] })).not.toBe(
    fingerprint
  )
  expect(
    campaignRollNonceFingerprint({
      ...pair,
      rolls: [entry.rolls[0]!, { ...second, revealedByGm: true, consumedAt: base.createdAt }]
    })
  ).toBe(fingerprint)
})

it('tells a held entry with content from hydrated metadata', () => {
  const full = campaignStoredEntrySchema.parse(chatEntry)
  expect(hasCampaignEntryContent(full)).toBe(true)
  expect(hasCampaignEntryContent(projectCampaignEntryMetadata(full))).toBe(false)
  expect(campaignRoomEntrySchema.safeParse(full).success).toBe(true)
  expect(campaignRoomEntrySchema.safeParse(projectCampaignEntryMetadata(full)).success).toBe(true)
  expect(campaignRoomEntrySchema.safeParse({ ...full, body: null }).success).toBe(false)
})

it('rejects entries whose kind disagrees with their rolls or text', () => {
  expect(campaignStoredEntrySchema.safeParse(chatEntry).success).toBe(true)
  expect(campaignStoredEntrySchema.safeParse({ ...rollEntry, rolls: [] }).success).toBe(false)
  expect(
    campaignStoredEntrySchema.safeParse({ ...chatEntry, rolls: rollEntry.rolls }).success
  ).toBe(false)
})
