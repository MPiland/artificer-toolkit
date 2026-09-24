import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignChatEntryDto,
  CampaignChatPageDto,
  CampaignConversationDto,
  SendCampaignChatEntryInput
} from '@artificer-toolkit/schema/api/campaignCommunication'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { api, components, internal } from '../_generated/api'

const create = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const send = makeFunctionReference<'mutation', SendCampaignChatEntryInput, CampaignChatEntryDto>(
  'campaigns/chat:send'
)
const list = makeFunctionReference<
  'query',
  { campaignId: string; room: 'TABLE' | 'PARTY' | 'DIRECT'; directUserId?: string },
  CampaignChatPageDto
>('campaigns/chat:list')
const rooms = makeFunctionReference<'query', { campaignId: string }, CampaignConversationDto[]>(
  'campaigns/conversations:list'
)
const markRead = makeFunctionReference<
  'mutation',
  { campaignId: string; conversationId: string; entryId: string },
  { ok: true }
>('campaigns/conversations:markRead')
const campaignInput: CreateCampaignInput = {
  name: 'Chat authority',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}

describe('native conversation authority', () => {
  it('excludes nonparticipant GM traffic and rolls back a cross-DIRECT nonce replay', async () => {
    const { t, owner, other: player } = await fixture()
    await player.caller.mutation(api.account.updateProfile, { username: 'FirstPlayer', bio: null })
    const campaign = await owner.caller.mutation(create, campaignInput)
    const peerAccount = await t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'user',
          data: {
            name: 'Peer',
            email: 'peer@example.invalid',
            emailVerified: true,
            username: 'peerplayer',
            displayUsername: 'PeerPlayer',
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        },
        onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
      })
    )
    const peerSession = await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'session',
          data: {
            userId: peerAccount._id,
            token: crypto.randomUUID(),
            expiresAt: Date.now() + 60000,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
    )
    const peerCaller = t.withIdentity({ subject: peerAccount._id, sessionId: peerSession._id })
    const peer = await peerCaller.query(api.account.identity, {})
    await t.run(async (ctx) => {
      for (const userId of [player.userId, peer.userId])
        await ctx.db.insert('campaignMemberships', {
          campaignId: campaign.id,
          userId,
          role: 'PLAYER',
          status: 'ACTIVE',
          accessStartedAt: campaign.createdAt,
          joinedAt: campaign.createdAt,
          leftAt: null
        })
    })
    await player.caller.mutation(send, {
      campaignId: campaign.id,
      room: 'PARTY',
      mode: 'OOC',
      body: 'Private party',
      clientNonce: crypto.randomUUID()
    })
    const command: SendCampaignChatEntryInput = {
      campaignId: campaign.id,
      room: 'DIRECT',
      directUserId: peer.userId,
      mode: 'OOC',
      body: 'Private direct',
      clientNonce: crypto.randomUUID().toUpperCase()
    }
    const entry = await player.caller.mutation(send, command)
    expect(
      (
        await peerCaller.query(list, {
          campaignId: campaign.id,
          room: 'DIRECT',
          directUserId: player.userId
        })
      ).entries
    ).toEqual([entry])
    expect(await owner.caller.query(rooms, { campaignId: campaign.id })).toEqual([])
    await expect(
      owner.caller.query(list, { campaignId: campaign.id, room: 'PARTY' })
    ).rejects.toThrow('Conversation not found')
    await expect(
      owner.caller.mutation(markRead, {
        campaignId: campaign.id,
        conversationId: entry.conversationId,
        entryId: entry.id
      })
    ).rejects.toThrow('Conversation not found')
    await expect(
      player.caller.mutation(send, { ...command, directUserId: owner.userId })
    ).rejects.toThrow('another conversation')
    expect(await owner.caller.query(rooms, { campaignId: campaign.id })).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('campaignConversations').collect())).toHaveLength(2)
    expect(
      await player.caller.mutation(send, {
        ...command,
        clientNonce: command.clientNonce.toLowerCase()
      })
    ).toEqual(entry)
    await t.run(async (ctx) => {
      const member = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', peer.userId)
        )
        .unique()
      await ctx.db.patch(member!._id, { status: 'LEFT', leftAt: new Date().toISOString() })
    })
    await expect(
      player.caller.query(list, {
        campaignId: campaign.id,
        room: 'DIRECT',
        directUserId: peer.userId
      })
    ).rejects.toThrow('Campaign not found')
    await expect(player.caller.mutation(send, command)).rejects.toThrow('Campaign not found')
  })

  it('binds ROLEPLAY to the current assigned Character and retains its message-time attribution', async () => {
    const { t, owner: player, other: gm, createCharacter } = await readyCharacterFixture()
    await player.caller.mutation(api.account.updateProfile, {
      username: 'CharacterPlayer',
      bio: null
    })
    const campaign = await gm.caller.mutation(create, campaignInput)
    const { draft, character } = await createCharacter()
    await player.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
    })
    const assignmentId = await t.run(async (ctx) => {
      await ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: player.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
      return ctx.db.insert('campaignCharacterAssignments', {
        campaignId: campaign.id,
        userId: player.userId,
        characterId: character.id,
        assignedAt: campaign.createdAt
      })
    })
    const command: SendCampaignChatEntryInput = {
      campaignId: campaign.id,
      room: 'TABLE',
      mode: 'ROLEPLAY',
      body: 'Ready for play',
      assignedCharacterId: character.id.toUpperCase(),
      clientNonce: crypto.randomUUID()
    }
    const entry = await player.caller.mutation(send, command)
    expect(entry).toMatchObject({
      characterId: character.id,
      characterLabel: 'Aria',
      authorUserId: player.userId,
      authorUsername: 'CharacterPlayer'
    })
    await expect(
      gm.caller.mutation(send, { ...command, clientNonce: crypto.randomUUID() })
    ).rejects.toThrow('Assigned Character is unavailable')
    await expect(
      player.caller.mutation(send, {
        ...command,
        assignedCharacterId: crypto.randomUUID(),
        clientNonce: crypto.randomUUID()
      })
    ).rejects.toThrow('Assigned Character is unavailable')
    await t.run((ctx) => ctx.db.delete(assignmentId))
    await expect(
      player.caller.mutation(send, { ...command, clientNonce: crypto.randomUUID() })
    ).rejects.toThrow('Assigned Character is unavailable')
    expect(
      (await player.caller.query(list, { campaignId: campaign.id, room: 'TABLE' })).entries
    ).toEqual([entry])
  })
})
