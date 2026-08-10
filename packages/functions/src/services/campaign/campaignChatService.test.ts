import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const id = '00000000-0000-4000-8000-000000000001'
const userId = '00000000-0000-4000-8000-000000000002'
const characterId = '00000000-0000-4000-8000-000000000003'

const mocks = vi.hoisted(() => ({
  authority: vi.fn(),
  entries: {
    findIdempotentRoomEntry: vi.fn(),
    findRoomEntry: vi.fn(),
    countAuthorEntriesSince: vi.fn(),
    insertRoomEntry: vi.fn(),
    tombstoneChat: vi.fn(),
    listConversations: vi.fn(),
    getConversationReadState: vi.fn(),
    isConversationMember: vi.fn(),
    markConversationRead: vi.fn()
  },
  profile: vi.fn(),
  listAssignedSystemIdsExceptUser: vi.fn(),
  findRuleset: vi.fn(),
  insertRoll: vi.fn(),
  broadcast: vi.fn(),
  lockCampaign: vi.fn(),
  assertCampaignWritable: vi.fn(),
  assertCampaignOwner: vi.fn(),
  steps: [] as string[]
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createAccountProfileRepository: () => ({ findForUser: mocks.profile }),
    createCampaignCollaborationRepository: () => mocks.entries,
    createCampaignRepository: () => ({
      lockCampaign: mocks.lockCampaign,
      listAssignedSystemIdsExceptUser: mocks.listAssignedSystemIdsExceptUser,
      findMembership: vi.fn()
    }),
    createRollHistoryRepository: () => ({
      findRuleset: mocks.findRuleset,
      insertAndTrim: mocks.insertRoll
    }),
    withTransaction: async (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) => {
      mocks.steps.push('transaction')
      const result = await callback({} as DBLike)
      mocks.steps.push('commit')
      return result
    }
  }
})

vi.mock('./campaignService.js', () => ({
  CampaignAccessError: class CampaignAccessError extends Error {},
  CampaignConflictError: class CampaignConflictError extends Error {},
  resolveCampaignAuthority: mocks.authority,
  assertActiveCampaignMember: vi.fn(),
  assertCampaignWritable: mocks.assertCampaignWritable,
  assertCampaignOwner: mocks.assertCampaignOwner,
  CampaignNotFoundError: class CampaignNotFoundError extends Error {}
}))

vi.mock('./realtimeService.js', () => ({ broadcastCampaignInvalidation: mocks.broadcast }))
vi.mock('../rolls/rollService.js', () => ({ evaluateRollForUser: vi.fn() }))

const {
  listCampaignChatEntries,
  listCampaignConversations,
  markCampaignConversationRead,
  sendCampaignChatEntry,
  executeCampaignRoll,
  executeCampaignPrivateRoll,
  unsendCampaignChatEntry
} = await import('./campaignChatService.js')

function authority(role: 'OWNER' | 'PLAYER') {
  return {
    campaign: { id, status: 'ACTIVE' },
    membership: { role, status: 'ACTIVE', accessStartedAt: '2026-08-01T00:00:00.000Z' },
    assignedCharacter: {
      id: characterId,
      label: 'Rook',
      systemId: '00000000-0000-4000-8000-000000000004'
    }
  }
}

describe('Campaign chat service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.steps.length = 0
    mocks.lockCampaign.mockImplementation(async () => {
      mocks.steps.push('lock')
      return { id }
    })
    mocks.broadcast.mockImplementation(async () => {
      mocks.steps.push('broadcast')
    })
    mocks.assertCampaignOwner.mockImplementation(() => {
      mocks.steps.push('owner')
    })
    mocks.assertCampaignWritable.mockImplementation(() => {
      mocks.steps.push('writable')
    })
  })

  it('stores an owner private roll with the Campaign Character ruleset', async () => {
    const systemId = '00000000-0000-4000-8000-000000000004'
    const ruleset = { systemId, code: 'dnd5e', version: '2014' }
    mocks.authority.mockResolvedValue(authority('OWNER'))
    mocks.profile.mockResolvedValue({ username: 'gm' })
    mocks.listAssignedSystemIdsExceptUser.mockResolvedValue([systemId])
    mocks.findRuleset.mockResolvedValue(ruleset)
    mocks.insertRoll.mockImplementation(async (_userId: string, record: unknown) => record)

    const roll = await executeCampaignPrivateRoll(
      {} as DBLike,
      {
        campaignId: id,
        roll: {
          characterId: null,
          expression: '1d20 + 4',
          rollMode: 'NORMAL',
          source: { kind: 'MANUAL', label: 'Manual roll' }
        }
      },
      userId
    )

    expect(roll?.ruleset).toEqual(ruleset)
    expect(mocks.insertRoll).toHaveBeenCalledWith(userId, expect.objectContaining({ ruleset }))
  })

  it('keeps PARTY chat inaccessible to the owner', async () => {
    mocks.authority.mockResolvedValue(authority('OWNER'))

    await expect(
      listCampaignChatEntries({} as DBLike, { campaignId: id, room: 'PARTY', limit: 50 }, userId)
    ).rejects.toThrow()
  })

  it('excludes stale PARTY conversations before reading an owner state', async () => {
    mocks.authority.mockResolvedValue(authority('OWNER'))
    mocks.entries.listConversations.mockResolvedValue([
      {
        id,
        campaignId: id,
        kind: 'TABLE',
        participantUserIds: [],
        createdAt: '2026-08-01T00:00:00.000Z'
      },
      {
        id: '00000000-0000-4000-8000-000000000004',
        campaignId: id,
        kind: 'PARTY',
        participantUserIds: [],
        createdAt: '2026-08-01T00:00:00.000Z'
      }
    ])
    mocks.entries.getConversationReadState.mockResolvedValue({ lastReadAt: null, unreadCount: 0 })

    await expect(listCampaignConversations({} as DBLike, id, userId)).resolves.toHaveLength(1)
    expect(mocks.entries.getConversationReadState).toHaveBeenCalledTimes(1)
    expect(mocks.entries.getConversationReadState).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: id })
    )
  })

  it('prevents a promoted owner from marking stale PARTY conversation state as read', async () => {
    mocks.authority.mockResolvedValue(authority('OWNER'))
    mocks.entries.findRoomEntry.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000005',
      conversationId: '00000000-0000-4000-8000-000000000006',
      room: 'PARTY',
      createdAt: '2026-08-01T00:00:00.000Z'
    })

    await expect(
      markCampaignConversationRead(
        {} as DBLike,
        {
          campaignId: id,
          entryId: '00000000-0000-4000-8000-000000000005',
          conversationId: '00000000-0000-4000-8000-000000000006'
        },
        userId
      )
    ).rejects.toThrow()
    expect(mocks.entries.isConversationMember).not.toHaveBeenCalled()
    expect(mocks.entries.markConversationRead).not.toHaveBeenCalled()
  })

  it('allows a direct-conversation member to mark an entry as read', async () => {
    mocks.authority.mockResolvedValue(authority('PLAYER'))
    mocks.entries.findRoomEntry.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000005',
      conversationId: '00000000-0000-4000-8000-000000000006',
      room: 'DIRECT',
      createdAt: '2026-08-02T00:00:00.000Z'
    })
    mocks.entries.isConversationMember.mockResolvedValue(true)
    mocks.entries.markConversationRead.mockResolvedValue(undefined)

    await expect(
      markCampaignConversationRead(
        {} as DBLike,
        {
          campaignId: id,
          entryId: '00000000-0000-4000-8000-000000000005',
          conversationId: '00000000-0000-4000-8000-000000000006'
        },
        userId
      )
    ).resolves.toEqual({ ok: true })
    expect(mocks.entries.markConversationRead).toHaveBeenCalledOnce()
  })

  it('uses a character display only for the assigned character', async () => {
    mocks.authority.mockResolvedValue(authority('PLAYER'))
    mocks.entries.findIdempotentRoomEntry.mockResolvedValue(null)
    mocks.entries.countAuthorEntriesSince.mockResolvedValue(0)
    mocks.profile.mockResolvedValue({ username: 'player' })
    mocks.entries.insertRoomEntry.mockImplementation(async (input: Record<string, unknown>) => ({
      id: '00000000-0000-4000-8000-000000000005',
      ...input,
      editedAt: null,
      unsentAt: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      rollPayload: null
    }))

    await sendCampaignChatEntry(
      {} as DBLike,
      {
        campaignId: id,
        room: 'TABLE',
        mode: 'OOC',
        body: 'Hello',
        assignedCharacterId: '00000000-0000-4000-8000-000000000099',
        clientNonce: '00000000-0000-4000-8000-000000000006'
      },
      userId
    )

    expect(mocks.entries.insertRoomEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        authorCharacterId: null,
        characterNameSnapshot: null,
        usernameSnapshot: 'player'
      })
    )
    expect(mocks.lockCampaign).toHaveBeenCalledWith(id)
    expect(mocks.steps).toEqual(['transaction', 'lock', 'writable', 'commit', 'broadcast'])
    expect(mocks.broadcast).toHaveBeenCalledWith(
      expect.anything(),
      id,
      expect.not.objectContaining({ conversationId: expect.anything() })
    )
  })

  it('rejects a nonce replayed into another room', async () => {
    mocks.authority.mockResolvedValue(authority('PLAYER'))
    mocks.entries.findIdempotentRoomEntry.mockResolvedValue({ room: 'TABLE', kind: 'CHAT' })

    await expect(
      sendCampaignChatEntry(
        {} as DBLike,
        {
          campaignId: id,
          room: 'PARTY',
          mode: 'OOC',
          body: 'Hello',
          clientNonce: '00000000-0000-4000-8000-000000000006'
        },
        userId
      )
    ).rejects.toThrow()
  })

  it('rejects a player ROLEPLAY entry with an invalid assigned Character', async () => {
    mocks.authority.mockResolvedValue(authority('PLAYER'))

    await expect(
      sendCampaignChatEntry(
        {} as DBLike,
        {
          campaignId: id,
          room: 'TABLE',
          mode: 'ROLEPLAY',
          body: 'I draw steel.',
          assignedCharacterId: '00000000-0000-4000-8000-000000000099',
          clientNonce: '00000000-0000-4000-8000-000000000010'
        },
        userId
      )
    ).rejects.toThrow()
    expect(mocks.entries.insertRoomEntry).not.toHaveBeenCalled()
  })

  it('publishes an owner manual TABLE roll without a Character snapshot', async () => {
    const systemId = '00000000-0000-4000-8000-000000000004'
    mocks.authority.mockResolvedValue({ ...authority('OWNER'), assignedCharacter: null })
    mocks.entries.findIdempotentRoomEntry.mockResolvedValue(null)
    mocks.entries.countAuthorEntriesSince.mockResolvedValue(0)
    mocks.profile.mockResolvedValue({ username: 'gm' })
    mocks.listAssignedSystemIdsExceptUser.mockResolvedValue([systemId])
    mocks.findRuleset.mockResolvedValue({ systemId, code: 'dnd5e', version: '2014' })
    mocks.entries.insertRoomEntry.mockImplementation(async (input: Record<string, unknown>) => ({
      id: '00000000-0000-4000-8000-000000000011',
      ...input,
      mode: null,
      body: null,
      rollPayload: input.rollPayload,
      editedAt: null,
      unsentAt: null,
      createdAt: '2026-08-01T00:00:00.000Z'
    }))

    const result = await executeCampaignRoll(
      {} as DBLike,
      {
        campaignId: id,
        room: 'TABLE',
        clientNonce: '00000000-0000-4000-8000-000000000012',
        roll: {
          characterId: null,
          expression: '1d20',
          source: { kind: 'MANUAL', label: 'Campaign roll' }
        }
      },
      userId
    )

    expect(result.characterId).toBeNull()
    expect(result.characterLabel).toBeNull()
    expect(mocks.entries.insertRoomEntry).toHaveBeenCalledWith(
      expect.objectContaining({ authorCharacterId: null, characterNameSnapshot: null })
    )
  })

  it('rejects unsending chat after five minutes', async () => {
    mocks.authority.mockResolvedValue(authority('PLAYER'))
    mocks.entries.findRoomEntry.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000005',
      campaignId: id,
      room: 'TABLE',
      kind: 'CHAT',
      authorUserId: userId,
      unsentAt: null,
      createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString()
    })

    await expect(
      unsendCampaignChatEntry(
        {} as DBLike,
        { campaignId: id, entryId: '00000000-0000-4000-8000-000000000005' },
        userId
      )
    ).rejects.toThrow('5 minutes')
    expect(mocks.entries.tombstoneChat).not.toHaveBeenCalled()
  })
})
