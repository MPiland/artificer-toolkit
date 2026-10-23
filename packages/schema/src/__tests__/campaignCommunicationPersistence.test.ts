import { expect, it } from 'vitest'
import {
  campaignStoredEntryHeaderSchema,
  campaignStoredEntryPayloadSchema,
  createCampaignEntryHeader
} from '../projections/campaignCommunicationPersistence.js'

it('binds roll nonce evidence to retry fields while preserving reveal and consumption changes', () => {
  const identity = {
    id: '11111111-1111-4111-8111-111111111111',
    campaignId: '22222222-2222-4222-8222-222222222222',
    conversationId: '33333333-3333-4333-8333-333333333333',
    authorUserId: '44444444-4444-4444-8444-444444444444',
    clientNonce: '55555555-5555-4555-8555-555555555555',
    createdAt: '2026-09-30T12:00:00.000Z'
  }
  const payload = campaignStoredEntryPayloadSchema.parse({
    entryId: identity.id,
    kind: 'ROLL',
    mode: null,
    body: null,
    revealedByGm: false,
    authorUsername: 'Player',
    characterId: null,
    characterLabel: 'Fighter',
    editedAt: null,
    unsentAt: null,
    consumedAt: null,
    roll: {
      id: identity.clientNonce,
      normalizedExpression: '1d20',
      characterId: null,
      characterLabel: 'Fighter',
      source: { kind: 'MANUAL', label: 'Check' },
      ruleset: { systemId: identity.campaignId, code: 'srd', version: '1' },
      createdAt: identity.createdAt,
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
  })
  const header = createCampaignEntryHeader(identity, payload)
  expect(header.kind).toBe('ROLL')
  expect(header.rollNonceFingerprint).toMatch(/^[a-f0-9]{64}$/)
  expect(
    createCampaignEntryHeader(identity, {
      ...payload,
      revealedByGm: true,
      consumedAt: identity.createdAt
    }).rollNonceFingerprint
  ).toBe(header.rollNonceFingerprint)
  expect(
    createCampaignEntryHeader(identity, {
      ...payload,
      authorUsername: 'Other player'
    }).rollNonceFingerprint
  ).not.toBe(header.rollNonceFingerprint)
  expect(
    createCampaignEntryHeader(identity, {
      ...payload,
      roll: { ...payload.roll!, characterLabel: 'Wizard' }
    }).rollNonceFingerprint
  ).not.toBe(header.rollNonceFingerprint)
  const chat = createCampaignEntryHeader(identity, {
    ...payload,
    kind: 'CHAT',
    roll: null,
    mode: 'OOC',
    body: 'hello'
  })
  expect(chat).toMatchObject({ kind: 'CHAT', rollNonceFingerprint: null })
  expect(() =>
    createCampaignEntryHeader({ ...identity, id: identity.campaignId }, payload)
  ).toThrow('identity mismatch')
  expect(() => createCampaignEntryHeader(identity, { ...payload, roll: null })).toThrow()
  expect(
    campaignStoredEntryHeaderSchema.safeParse({ ...header, rollNonceFingerprint: null }).success
  ).toBe(false)
  expect(
    campaignStoredEntryHeaderSchema.safeParse({
      ...chat,
      rollNonceFingerprint: header.rollNonceFingerprint
    }).success
  ).toBe(false)
})
