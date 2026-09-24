import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import {
  type CampaignChatEntryDto,
  type CampaignChatPageDto,
  type CampaignConversationDto,
  editCampaignChatEntryInputSchema,
  getCampaignConversationInputSchema,
  listCampaignChatEntriesInputSchema,
  listCampaignConversationsInputSchema,
  markCampaignConversationReadInputSchema,
  sendCampaignChatEntryInputSchema,
  unsendCampaignChatEntryInputSchema
} from '@artificer-toolkit/schema/api/campaignCommunication'
import { campaignStoredEntryPayloadSchema } from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, components } from '../_generated/api'
import { fixture as characterFixture } from '../../tests/fixtures/characters'

const create = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const open = makeFunctionReference<
  'mutation',
  z.input<typeof getCampaignConversationInputSchema>,
  CampaignConversationDto
>('campaigns/conversations:open')
const conversations = makeFunctionReference<
  'query',
  z.input<typeof listCampaignConversationsInputSchema>,
  CampaignConversationDto[]
>('campaigns/conversations:list')
const markRead = makeFunctionReference<
  'mutation',
  z.input<typeof markCampaignConversationReadInputSchema>,
  { ok: true }
>('campaigns/conversations:markRead')
const list = makeFunctionReference<
  'query',
  z.input<typeof listCampaignChatEntriesInputSchema>,
  CampaignChatPageDto
>('campaigns/chat:list')
const send = makeFunctionReference<
  'mutation',
  z.input<typeof sendCampaignChatEntryInputSchema>,
  CampaignChatEntryDto
>('campaigns/chat:send')
const edit = makeFunctionReference<
  'mutation',
  z.input<typeof editCampaignChatEntryInputSchema>,
  CampaignChatEntryDto
>('campaigns/chat:edit')
const unsend = makeFunctionReference<
  'mutation',
  z.input<typeof unsendCampaignChatEntryInputSchema>,
  CampaignChatEntryDto
>('campaigns/chat:unsend')

const campaignInput: CreateCampaignInput = {
  name: 'Chat test',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}

async function setup() {
  const base = await characterFixture()
  await base.owner.caller.mutation(api.account.updateProfile, {
    username: 'CampaignOwner',
    bio: null
  })
  await base.other.caller.mutation(api.account.updateProfile, {
    username: 'CampaignPlayer',
    bio: null
  })
  const campaign = await base.owner.caller.mutation(create, campaignInput)
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  const extended = await base.t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.updateMany, {
      input: {
        model: 'session',
        update: { expiresAt: Date.now() + 24 * 60 * 60_000 }
      },
      paginationOpts: { cursor: null, numItems: 10 }
    })
  )
  expect(extended).toMatchObject({ count: 2, isDone: true })
  return { ...base, campaign }
}

const nonce = () => crypto.randomUUID()
const room = (campaignId: string, kind: 'TABLE' | 'PARTY' | 'DIRECT', directUserId?: string) => ({
  campaignId,
  kind,
  ...(directUserId ? { directUserId } : {})
})
const chat = (
  campaignId: string,
  roomName: 'TABLE' | 'PARTY' | 'DIRECT',
  body: string,
  directUserId?: string
) => ({
  campaignId,
  room: roomName,
  mode: 'OOC' as const,
  body,
  clientNonce: nonce(),
  ...(directUserId ? { directUserId } : {})
})

afterEach(() => vi.useRealTimers())

describe('native Campaign text chat', () => {
  it('opens each canonical room once, sorts DIRECT participants, and lists only opened rooms', async () => {
    const { owner, other, campaign, t } = await setup()
    await expect(t.mutation(open, room(campaign.id, 'TABLE'))).rejects.toThrow('Unauthenticated')
    await expect(t.query(conversations, { campaignId: campaign.id })).rejects.toThrow(
      'Unauthenticated'
    )
    await expect(
      t.query(list, { campaignId: campaign.id, room: 'TABLE', limit: 50 })
    ).rejects.toThrow('Unauthenticated')
    await expect(
      t.mutation(markRead, {
        campaignId: campaign.id,
        conversationId: crypto.randomUUID(),
        entryId: crypto.randomUUID()
      })
    ).rejects.toThrow('Unauthenticated')
    const [a, b] = await Promise.all([
      owner.caller.mutation(open, room(campaign.id, 'TABLE')),
      owner.caller.mutation(open, room(campaign.id, 'TABLE'))
    ])
    expect(a).toEqual(b)
    const direct = await other.caller.mutation(
      open,
      room(campaign.id.toUpperCase(), 'DIRECT', owner.userId.toUpperCase())
    )
    expect(direct.participantUserIds).toEqual([owner.userId, other.userId].sort())
    expect(
      (await owner.caller.query(conversations, { campaignId: campaign.id }))
        .map((r) => r.kind)
        .sort()
    ).toEqual(['DIRECT', 'TABLE'])
    expect(await t.run((ctx) => ctx.db.query('campaignConversations').collect())).toHaveLength(2)
    await expect(owner.caller.mutation(open, room(campaign.id, 'PARTY'))).rejects.toThrow()
  })

  it('keeps chat private to the opened room and closes a direct room when its peer leaves', async () => {
    const { owner, other, campaign, t } = await setup()
    await other.caller.mutation(open, room(campaign.id, 'PARTY'))
    const direct = await owner.caller.mutation(open, room(campaign.id, 'DIRECT', other.userId))
    await expect(
      owner.caller.query(list, { campaignId: campaign.id, room: 'PARTY', limit: 50 })
    ).rejects.toThrow()
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', other.userId)
        )
        .unique()
      await ctx.db.patch(membership!._id, { status: 'LEFT', leftAt: new Date().toISOString() })
    })
    await expect(owner.caller.query(conversations, { campaignId: campaign.id })).resolves.toEqual(
      []
    )
    await expect(
      owner.caller.query(list, {
        campaignId: campaign.id,
        room: 'DIRECT',
        directUserId: other.userId,
        limit: 50
      })
    ).rejects.toThrow()
    expect(direct.participantUserIds).toContain(other.userId)
  })

  it('sends text with a snapshot, masks it for a player, and replays a nonce without fingerprinting body', async () => {
    const { owner, other, campaign, t } = await setup()
    await owner.caller.mutation(open, room(campaign.id, 'TABLE'))
    await other.caller.mutation(open, room(campaign.id, 'TABLE'))
    const command = chat(campaign.id, 'TABLE', 'fuck this')
    const first = await owner.caller.mutation(send, command)
    expect(first).toMatchObject({
      authorUsername: 'CampaignOwner',
      kind: 'CHAT',
      mode: 'OOC',
      characterId: null
    })
    expect(first.body).not.toBe('fuck this')
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('campaignConversationEntryPayloads')
          .withIndex('by_entryId', (q) => q.eq('entryId', first.id))
          .unique()
      )
    ).toMatchObject({ body: 'fuck this', authorUsername: 'CampaignOwner' })
    await owner.caller.mutation(api.account.updateProfile, { username: 'RenamedOwner', bio: null })
    expect(await owner.caller.mutation(send, { ...command, body: 'changed body' })).toEqual(first)
    const page = await other.caller.query(list, {
      campaignId: campaign.id,
      room: 'TABLE',
      limit: 50
    })
    expect(page.entries[0]).toMatchObject({ id: first.id, authorUsername: 'CampaignOwner' })
    expect(page.entries[0]?.body).not.toBe('fuck this')
    await expect(owner.caller.mutation(send, { ...command, room: 'PARTY' })).rejects.toThrow()
    await expect(
      owner.caller.mutation(send, { ...command, body: 'x'.repeat(2001), clientNonce: nonce() })
    ).rejects.toThrow()
  })

  it('masks a removed profile while retaining OOC, roleplay, and roll snapshots', async () => {
    const { owner, other, campaign, t } = await setup()
    await owner.caller.mutation(open, room(campaign.id, 'TABLE'))
    await other.caller.mutation(open, room(campaign.id, 'TABLE'))
    const ooc = await other.caller.mutation(send, chat(campaign.id, 'TABLE', 'Retained OOC'))
    const roleplayId = crypto.randomUUID()
    const rollId = crypto.randomUUID()
    const characterId = crypto.randomUUID()
    const now = new Date().toISOString()
    await t.run(async (ctx) => {
      for (const [id, payload] of [
        [
          roleplayId,
          {
            entryId: roleplayId,
            kind: 'CHAT' as const,
            mode: 'ROLEPLAY' as const,
            body: 'Retained roleplay',
            roll: null,
            authorUsername: 'CampaignPlayer',
            characterId,
            characterLabel: 'Retained Ranger',
            editedAt: null,
            unsentAt: null
          }
        ],
        [
          rollId,
          {
            entryId: rollId,
            kind: 'ROLL' as const,
            mode: null,
            body: null,
            authorUsername: 'CampaignPlayer',
            characterId,
            characterLabel: 'Retained Ranger',
            editedAt: null,
            unsentAt: null,
            roll: {
              id: rollId,
              normalizedExpression: '1d20',
              characterId,
              characterLabel: 'Retained Ranger',
              source: { kind: 'MANUAL' as const, label: 'Retained attack' },
              ruleset: { systemId: 'srd', code: 'srd', version: '1' },
              createdAt: now,
              evidence: {
                terms: [{ count: 1, die: 20, rolls: [10], subtotal: 10 }],
                modifier: 0,
                mode: 'NORMAL' as const,
                subtotal: 10,
                transform: { kind: 'NONE' as const },
                total: 10
              }
            }
          }
        ]
      ] as const) {
        await ctx.db.insert('campaignConversationEntries', {
          id,
          campaignId: campaign.id,
          conversationId: ooc.conversationId,
          authorUserId: other.userId,
          clientNonce: nonce(),
          createdAt: now
        })
        await ctx.db.insert(
          'campaignConversationEntryPayloads',
          campaignStoredEntryPayloadSchema.parse(payload)
        )
      }
    })
    const snapshot = () =>
      t.run(async (ctx) => ({
        headers: await ctx.db
          .query('campaignConversationEntries')
          .withIndex('by_conversationId_createdAt_id', (q) =>
            q.eq('conversationId', ooc.conversationId)
          )
          .collect(),
        payloads: await ctx.db.query('campaignConversationEntryPayloads').collect()
      }))
    const before = await snapshot()
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', other.userId))
        .unique()
      if (!profile) throw new Error('Missing player profile.')
      await ctx.db.delete(profile._id)
    })
    const page = await owner.caller.query(list, {
      campaignId: campaign.id,
      room: 'TABLE',
      limit: 50
    })
    for (const id of [ooc.id, roleplayId, rollId])
      expect(page.entries.find((entry) => entry.id === id)).toMatchObject({
        authorUsername: 'Deleted user'
      })
    await expect(
      other.caller.query(list, { campaignId: campaign.id, room: 'TABLE', limit: 50 })
    ).rejects.toThrow('profile is missing')
    await expect(
      t.query(list, { campaignId: campaign.id, room: 'TABLE', limit: 50 })
    ).rejects.toThrow('Unauthenticated')
    await expect(
      owner.caller.query(list, { campaignId: campaign.id, room: 'PARTY', limit: 50 })
    ).rejects.toThrow('Conversation not found')
    expect(await snapshot()).toEqual(before)
  })
  it('uses epoch cutoffs, monotonic read timestamps, cursor pagination, and counts own messages', async () => {
    vi.useFakeTimers()
    const baseTime = new Date('2026-01-01T00:00:00.000Z')
    vi.setSystemTime(baseTime)
    const { owner, other, campaign, t } = await setup()
    await owner.caller.mutation(open, room(campaign.id, 'TABLE'))
    await other.caller.mutation(open, room(campaign.id, 'TABLE'))
    vi.setSystemTime(new Date(baseTime.getTime() + 1000))
    const first = await owner.caller.mutation(send, chat(campaign.id, 'TABLE', 'one'))
    vi.setSystemTime(new Date(baseTime.getTime() + 2000))
    const second = await owner.caller.mutation(send, chat(campaign.id, 'TABLE', 'two'))
    const ownPage = await owner.caller.query(list, {
      campaignId: campaign.id,
      room: 'TABLE',
      limit: 50
    })
    expect(ownPage.unreadCount).toBe(2)
    const page = await other.caller.query(list, {
      campaignId: campaign.id,
      room: 'TABLE',
      limit: 1
    })
    expect(page.entries).toEqual([expect.objectContaining({ id: second.id })])
    expect(page.unreadCount).toBe(2)
    await other.caller.mutation(markRead, {
      campaignId: campaign.id,
      conversationId: first.conversationId,
      entryId: second.id
    })
    const readAfterSecond = await other.caller.query(list, {
      campaignId: campaign.id,
      room: 'TABLE',
      limit: 50
    })
    await other.caller.mutation(markRead, {
      campaignId: campaign.id,
      conversationId: first.conversationId,
      entryId: first.id
    })
    expect(
      (await other.caller.query(list, { campaignId: campaign.id, room: 'TABLE', limit: 50 }))
        .lastReadAt
    ).toBe(readAfterSecond.lastReadAt)
    const after = await other.caller.query(list, {
      campaignId: campaign.id,
      room: 'TABLE',
      cursor: page.nextCursor ?? undefined,
      limit: 50
    })
    expect(after.entries.map((entry) => entry.id)).toEqual([first.id])
    expect(after.unreadCount).toBe(0)
    vi.setSystemTime(new Date(baseTime.getTime() + 3000))
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', other.userId)
        )
        .unique()
      await ctx.db.patch(membership!._id, { accessStartedAt: new Date().toISOString() })
    })
    await expect(
      other.caller.query(list, { campaignId: campaign.id, room: 'TABLE', limit: 50 })
    ).rejects.toThrow()
    await expect(
      other.caller.mutation(markRead, {
        campaignId: campaign.id,
        conversationId: first.conversationId,
        entryId: first.id
      })
    ).rejects.toThrow()
    await other.caller.mutation(open, room(campaign.id, 'TABLE'))
    const reset = await other.caller.query(list, {
      campaignId: campaign.id,
      room: 'TABLE',
      limit: 50
    })
    expect(reset.entries).toEqual([])
    expect(reset.unreadCount).toBe(0)
    vi.setSystemTime(new Date(baseTime.getTime() + 4000))
    const fresh = await owner.caller.mutation(send, chat(campaign.id, 'TABLE', 'new epoch'))
    expect(
      (
        await other.caller.query(list, { campaignId: campaign.id, room: 'TABLE', limit: 50 })
      ).entries.map((entry) => entry.id)
    ).toEqual([fresh.id])
  })

  it('allows only the author to edit or unsend, retains tombstones, and keeps roll payloads immutable', async () => {
    vi.useFakeTimers()
    const baseTime = new Date('2026-01-01T00:00:00.000Z')
    vi.setSystemTime(baseTime)
    const { owner, other, campaign, t } = await setup()
    await owner.caller.mutation(open, room(campaign.id, 'TABLE'))
    const entry = await owner.caller.mutation(send, chat(campaign.id, 'TABLE', 'original'))
    await expect(
      other.caller.mutation(edit, { campaignId: campaign.id, entryId: entry.id, body: 'nope' })
    ).rejects.toThrow()
    vi.setSystemTime(new Date(baseTime.getTime() + 15 * 60_000))
    const edited = await owner.caller.mutation(edit, {
      campaignId: campaign.id,
      entryId: entry.id,
      body: 'edited'
    })
    expect(edited).toMatchObject({ id: entry.id, body: 'edited', editedAt: expect.any(String) })
    vi.setSystemTime(new Date(baseTime.getTime() + 15 * 60_000 + 1))
    await expect(
      owner.caller.mutation(edit, {
        campaignId: campaign.id,
        entryId: entry.id,
        body: 'late'
      })
    ).rejects.toThrow(/edit|15/i)
    const unsendable = await owner.caller.mutation(send, chat(campaign.id, 'TABLE', 'unsendable'))
    vi.setSystemTime(new Date(Date.parse(unsendable.createdAt) + 5 * 60_000))
    const tombstone = await owner.caller.mutation(unsend, {
      campaignId: campaign.id,
      entryId: unsendable.id
    })
    expect(tombstone).toMatchObject({ id: unsendable.id, body: null, unsentAt: expect.any(String) })
    const tooLateUnsend = await owner.caller.mutation(
      send,
      chat(campaign.id, 'TABLE', 'late unsend')
    )
    vi.setSystemTime(new Date(Date.parse(tooLateUnsend.createdAt) + 5 * 60_000 + 1))
    await expect(
      owner.caller.mutation(unsend, { campaignId: campaign.id, entryId: tooLateUnsend.id })
    ).rejects.toThrow(/unsend|5/i)
    const rollId = crypto.randomUUID()
    await t.run(async (ctx) => {
      const now = new Date().toISOString()
      await ctx.db.insert('campaignConversationEntries', {
        id: rollId,
        campaignId: campaign.id,
        conversationId: entry.conversationId,
        authorUserId: owner.userId,
        createdAt: now,
        clientNonce: nonce()
      })
      await ctx.db.insert('campaignConversationEntryPayloads', {
        entryId: rollId,
        kind: 'ROLL',
        mode: null,
        body: null,
        editedAt: null,
        unsentAt: null,
        authorUsername: 'CampaignOwner',
        characterId: null,
        characterLabel: null,
        roll: {
          id: rollId,
          normalizedExpression: '1d20',
          characterId: null,
          characterLabel: '',
          source: { kind: 'MANUAL', label: 'Test' },
          ruleset: { systemId: 'srd', code: 'srd', version: '1' },
          createdAt: now,
          evidence: {
            terms: [{ count: 1, die: 20, rolls: [10], subtotal: 10 }],
            modifier: 0,
            mode: 'NORMAL',
            subtotal: 10,
            transform: { kind: 'NONE' },
            total: 10
          }
        }
      })
    })
    await expect(
      owner.caller.mutation(edit, { campaignId: campaign.id, entryId: rollId, body: 'no' })
    ).rejects.toThrow('Chat entry cannot be changed')
    await expect(
      owner.caller.mutation(unsend, { campaignId: campaign.id, entryId: rollId })
    ).rejects.toThrow('Chat entry cannot be changed')
  })

  it('enforces active-only writes and ROLEPLAY assignment requirements', async () => {
    const { owner, campaign, t } = await setup()
    await owner.caller.mutation(open, room(campaign.id, 'TABLE'))
    await expect(
      owner.caller.mutation(send, { ...chat(campaign.id, 'TABLE', 'roleplay'), mode: 'ROLEPLAY' })
    ).rejects.toThrow()
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      await ctx.db.patch(row!._id, { status: 'ARCHIVED' })
    })
    await expect(
      owner.caller.mutation(send, chat(campaign.id, 'TABLE', 'blocked'))
    ).rejects.toThrow()
    await expect(
      owner.caller.query(list, { campaignId: campaign.id, room: 'TABLE', limit: 50 })
    ).resolves.toBeDefined()
  })

  it('limits rolling sends across retained entries while nonce replay remains free', async () => {
    vi.useFakeTimers()
    const baseTime = new Date('2026-01-01T00:00:00.000Z')
    vi.setSystemTime(baseTime)
    const { owner, other, campaign } = await setup()
    await owner.caller.mutation(open, room(campaign.id, 'TABLE'))
    const direct = await owner.caller.mutation(open, room(campaign.id, 'DIRECT', other.userId))
    const commands = Array.from({ length: 15 }, (_, index) =>
      chat(campaign.id, 'TABLE', `message ${index}`)
    )
    commands.push(
      ...Array.from({ length: 15 }, (_, index) =>
        chat(campaign.id, 'DIRECT', `direct ${index}`, other.userId)
      )
    )
    for (const command of commands) await owner.caller.mutation(send, command)
    await expect(
      owner.caller.mutation(send, chat(campaign.id, 'TABLE', 'rate limited'))
    ).rejects.toThrow(/rate|30|limit/i)
    await expect(owner.caller.mutation(send, commands[0]!)).resolves.toMatchObject({
      body: 'message 0'
    })
    await owner.caller.mutation(unsend, {
      campaignId: campaign.id,
      entryId: (
        await owner.caller.query(list, { campaignId: campaign.id, room: 'TABLE', limit: 50 })
      ).entries[0]!.id
    })
    vi.setSystemTime(new Date(baseTime.getTime() + 60_001))
    await expect(
      owner.caller.mutation(send, chat(campaign.id, 'DIRECT', 'after reset', other.userId))
    ).resolves.toMatchObject({ conversationId: direct.id })
  })

  it('retains only the newest 500 entries by createdAt and id tie ordering', async () => {
    vi.useFakeTimers()
    const baseTime = new Date('2026-01-01T00:00:00.000Z')
    vi.setSystemTime(new Date(baseTime.getTime() - 120_000))
    const { owner, campaign, t } = await setup()
    const conversation = await owner.caller.mutation(open, room(campaign.id, 'TABLE'))
    vi.setSystemTime(baseTime)
    await t.run(async (ctx) => {
      const old = new Date(baseTime.getTime() - 120_000).toISOString()
      for (let index = 0; index < 500; index++) {
        const id = `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
        await ctx.db.insert('campaignConversationEntries', {
          id,
          campaignId: campaign.id,
          conversationId: conversation.id,
          authorUserId: owner.userId,
          createdAt: old,
          clientNonce: nonce()
        })
        await ctx.db.insert('campaignConversationEntryPayloads', {
          entryId: id,
          kind: 'CHAT',
          mode: 'OOC',
          body: `seed ${index}`,
          roll: null,
          authorUsername: 'CampaignOwner',
          characterId: null,
          characterLabel: null,
          editedAt: null,
          unsentAt: null
        })
      }
    })
    vi.setSystemTime(new Date(baseTime.getTime() + 1_000))
    const newest = await owner.caller.mutation(send, chat(campaign.id, 'TABLE', '501'))
    const rows = await t.run((ctx) => ctx.db.query('campaignConversationEntries').collect())
    expect(rows).toHaveLength(500)
    const oldestId = '00000000-0000-4000-8000-000000000000'
    expect(rows.map((row) => row.id)).not.toContain(oldestId)
    expect(rows.map((row) => row.id)).toContain(newest.id)
    const payloads = await t.run((ctx) =>
      ctx.db.query('campaignConversationEntryPayloads').collect()
    )
    expect(payloads).toHaveLength(500)
    expect(payloads.map((payload) => payload.entryId)).not.toContain(oldestId)
    expect(payloads.map((payload) => payload.entryId)).toContain(newest.id)
    expect(payloads.map((payload) => payload.entryId).sort()).toEqual(
      rows.map((row) => row.id).sort()
    )
    const seen: string[] = []
    let cursor: string | undefined
    for (let pageIndex = 0; pageIndex < 6; pageIndex++) {
      const page = await owner.caller.query(list, {
        campaignId: campaign.id,
        room: 'TABLE',
        cursor,
        limit: 100
      })
      seen.push(...page.entries.map((entry) => entry.id))
      if (!page.nextCursor) break
      cursor = page.nextCursor
    }
    expect(seen).toHaveLength(500)
    expect(seen[0]).toBe(newest.id)
    expect(seen.slice(1)).toEqual(
      Array.from(
        { length: 499 },
        (_, index) => `00000000-0000-4000-8000-${(499 - index).toString(16).padStart(12, '0')}`
      )
    )
  })
})
