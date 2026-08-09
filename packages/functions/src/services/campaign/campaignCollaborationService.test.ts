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
    insertCampaignNoteSection: vi.fn(),
    listCampaignNoteSections: vi.fn(),
    updateCampaignNoteSection: vi.fn(),
    deleteCampaignNoteSection: vi.fn(),
    listCampaignSessions: vi.fn(),
    updateCampaignSession: vi.fn(),
    insertSessionNoteSection: vi.fn(),
    listSessionNoteSections: vi.fn(),
    upsertSessionRsvp: vi.fn()
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
      listAssignedSystemIdsExceptUser: mocks.listAssignedSystemIdsExceptUser
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
  assertCampaignOwner: mocks.assertCampaignOwner
}))

vi.mock('./realtimeService.js', () => ({ broadcastCampaignInvalidation: mocks.broadcast }))
vi.mock('../rolls/rollService.js', () => ({ evaluateRollForUser: vi.fn() }))

const {
  listCampaignChatEntries,
  sendCampaignChatEntry,
  executeCampaignRoll,
  executeCampaignPrivateRoll,
  unsendCampaignChatEntry,
  createCampaignNotebookSection,
  updateCampaignNotebookSection,
  deleteCampaignNotebookSection,
  updateCampaignSession,
  createCampaignSessionNoteSection,
  listCampaignSessionNoteSections,
  setCampaignSessionRsvp
} = await import('./campaignCollaborationService.js')

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

describe('Campaign collaboration service', () => {
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

  it('invalidates both notebook scopes when a note is published', async () => {
    mocks.authority.mockResolvedValue(authority('OWNER'))
    mocks.entries.listCampaignNoteSections.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000007',
        campaignId: id,
        title: 'Secret',
        content: 'Hidden',
        visibility: 'GM_PRIVATE',
        category: 'GENERAL',
        sortOrder: 0,
        version: 1,
        createdBy: userId,
        updatedBy: userId,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z'
      }
    ])
    mocks.entries.updateCampaignNoteSection.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000007',
      campaignId: id,
      title: 'Shared',
      content: 'Visible',
      visibility: 'SHARED',
      category: 'GENERAL',
      sortOrder: 0,
      version: 2,
      createdBy: userId,
      updatedBy: userId,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:01:00.000Z'
    })

    await updateCampaignNotebookSection(
      {} as DBLike,
      {
        campaignId: id,
        sectionId: '00000000-0000-4000-8000-000000000007',
        visibility: 'SHARED',
        expectedVersion: 1
      },
      userId
    )

    expect(mocks.broadcast.mock.calls.map(([, , payload]) => payload.scope)).toEqual([
      'OWNER',
      'TABLE'
    ])
  })

  it('keeps Campaign notebook mutations owner-only', async () => {
    mocks.authority.mockResolvedValue(authority('PLAYER'))
    mocks.assertCampaignOwner.mockImplementation(() => {
      throw new Error('Campaign owner access required.')
    })
    await expect(
      createCampaignNotebookSection(
        {} as DBLike,
        {
          campaignId: id,
          title: 'Rook',
          content: '<p>Here</p>',
          visibility: 'SHARED',
          category: 'PEOPLE'
        },
        userId
      )
    ).rejects.toThrow()
    await expect(
      updateCampaignNotebookSection(
        {} as DBLike,
        {
          campaignId: id,
          sectionId: '00000000-0000-4000-8000-000000000007',
          content: '<p>There</p>',
          expectedVersion: 0
        },
        userId
      )
    ).rejects.toThrow()
    await expect(
      deleteCampaignNotebookSection(
        {} as DBLike,
        { campaignId: id, sectionId: '00000000-0000-4000-8000-000000000007' },
        userId
      )
    ).rejects.toThrow()

    expect(mocks.entries.insertCampaignNoteSection).not.toHaveBeenCalled()
    expect(mocks.entries.updateCampaignNoteSection).not.toHaveBeenCalled()
    expect(mocks.entries.deleteCampaignNoteSection).not.toHaveBeenCalled()
    expect(mocks.assertCampaignOwner).toHaveBeenCalledTimes(3)
  })

  it('denies player changes to private notes', async () => {
    mocks.authority.mockResolvedValue(authority('PLAYER'))
    mocks.assertCampaignOwner.mockImplementation(() => {
      throw new Error('Campaign owner access required.')
    })

    await expect(
      createCampaignNotebookSection(
        {} as DBLike,
        { campaignId: id, title: 'Secret', content: '<p>Hidden</p>' },
        userId
      )
    ).rejects.toThrow()
  })

  it('locks, re-authorizes, and checks writability before updating a session', async () => {
    mocks.authority.mockImplementation(async () => {
      mocks.steps.push('authority')
      return authority('OWNER')
    })
    mocks.entries.listCampaignSessions.mockImplementation(async () => {
      mocks.steps.push('session-read')
      return [
        {
          id: '00000000-0000-4000-8000-000000000008',
          campaignId: id,
          sessionNumber: 1,
          title: 'Session one',
          scheduledStartAt: null,
          scheduledEndAt: null,
          timeZone: null,
          status: 'OPEN',
          finishedAt: null,
          version: 1,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z'
        }
      ]
    })
    mocks.entries.updateCampaignSession.mockImplementation(async () => {
      mocks.steps.push('session-write')
      return {
        id: '00000000-0000-4000-8000-000000000008',
        campaignId: id,
        title: 'Session one',
        sessionNumber: 1,
        scheduledStartAt: null,
        scheduledEndAt: null,
        timeZone: null,
        status: 'OPEN',
        finishedAt: null,
        version: 2,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:01:00.000Z'
      }
    })

    await updateCampaignSession(
      {} as DBLike,
      {
        campaignId: id,
        sessionId: '00000000-0000-4000-8000-000000000008',
        expectedVersion: 1
      },
      userId
    )

    expect(mocks.steps).toEqual([
      'transaction',
      'lock',
      'authority',
      'owner',
      'writable',
      'session-read',
      'session-write',
      'commit',
      'broadcast'
    ])
  })

  it('writes only the caller RSVP identity while a session is open', async () => {
    const sessionId = '00000000-0000-4000-8000-000000000008'
    mocks.authority.mockResolvedValue(authority('PLAYER'))
    mocks.entries.listCampaignSessions.mockResolvedValue([
      {
        id: sessionId,
        campaignId: id,
        sessionNumber: 1,
        title: null,
        scheduledStartAt: null,
        scheduledEndAt: null,
        timeZone: null,
        status: 'OPEN',
        finishedAt: null,
        version: 1,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z'
      }
    ])
    mocks.entries.upsertSessionRsvp.mockResolvedValue({
      campaignId: id,
      sessionId,
      userId,
      response: 'YES',
      updatedAt: '2026-08-01T00:01:00.000Z'
    })

    await setCampaignSessionRsvp(
      {} as DBLike,
      { campaignId: id, sessionId, response: 'YES' },
      userId
    )

    expect(mocks.entries.upsertSessionRsvp).toHaveBeenCalledWith({
      campaignId: id,
      sessionId,
      userId,
      response: 'YES'
    })
  })

  it('rejects RSVP changes after a session is finished', async () => {
    const sessionId = '00000000-0000-4000-8000-000000000008'
    mocks.authority.mockResolvedValue(authority('PLAYER'))
    mocks.entries.listCampaignSessions.mockResolvedValue([
      {
        id: sessionId,
        campaignId: id,
        sessionNumber: 1,
        title: null,
        scheduledStartAt: null,
        scheduledEndAt: null,
        timeZone: null,
        status: 'FINISHED',
        finishedAt: '2026-08-01T02:00:00.000Z',
        version: 2,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T02:00:00.000Z'
      }
    ])

    await expect(
      setCampaignSessionRsvp({} as DBLike, { campaignId: id, sessionId, response: 'NO' }, userId)
    ).rejects.toThrow('Finished sessions cannot receive RSVPs.')
    expect(mocks.entries.upsertSessionRsvp).not.toHaveBeenCalled()
  })

  it('omits GM-private Session sections from a player read', async () => {
    const sessionId = '00000000-0000-4000-8000-000000000008'
    const sectionBase = {
      sessionId,
      content: '<p>Text</p>',
      sortOrder: 0,
      version: 1,
      createdBy: userId,
      updatedBy: userId,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z'
    }
    mocks.authority.mockResolvedValue(authority('PLAYER'))
    mocks.entries.listCampaignSessions.mockResolvedValue([
      {
        id: sessionId,
        campaignId: id,
        sessionNumber: 1,
        title: null,
        scheduledStartAt: null,
        scheduledEndAt: null,
        timeZone: null,
        status: 'OPEN',
        finishedAt: null,
        version: 1,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z'
      }
    ])
    mocks.entries.listSessionNoteSections.mockResolvedValue([
      {
        ...sectionBase,
        id: '00000000-0000-4000-8000-000000000009',
        title: 'Shared notes',
        visibility: 'SHARED',
        kind: 'SHARED_NOTE'
      },
      {
        ...sectionBase,
        id: '00000000-0000-4000-8000-000000000010',
        title: 'Secret clue',
        visibility: 'GM_PRIVATE',
        kind: 'SECRET'
      }
    ])

    const sections = await listCampaignSessionNoteSections(
      {} as DBLike,
      { campaignId: id, sessionId },
      userId
    )

    expect(sections.map((section) => section.title)).toEqual(['Shared notes'])
  })

  it('locks, re-authorizes, and checks writability before creating a session note', async () => {
    mocks.authority.mockImplementation(async () => {
      mocks.steps.push('authority')
      return authority('PLAYER')
    })
    mocks.entries.listCampaignSessions.mockImplementation(async () => {
      mocks.steps.push('session-read')
      return [
        {
          id: '00000000-0000-4000-8000-000000000008',
          campaignId: id,
          sessionNumber: 1,
          title: 'Session one',
          scheduledStartAt: null,
          scheduledEndAt: null,
          timeZone: null,
          status: 'OPEN',
          finishedAt: null,
          version: 1,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z'
        }
      ]
    })
    mocks.entries.insertSessionNoteSection.mockImplementation(async () => {
      mocks.steps.push('note-write')
      return {
        id: '00000000-0000-4000-8000-000000000009',
        sessionId: '00000000-0000-4000-8000-000000000008',
        title: 'Recap',
        content: 'We met.',
        visibility: 'SHARED',
        kind: 'SHARED_NOTE',
        sortOrder: 0,
        version: 1,
        createdBy: userId,
        updatedBy: userId,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z'
      }
    })

    await createCampaignSessionNoteSection(
      {} as DBLike,
      {
        campaignId: id,
        sessionId: '00000000-0000-4000-8000-000000000008',
        title: 'Recap',
        content: 'We met.',
        visibility: 'SHARED',
        kind: 'SHARED_NOTE'
      },
      userId
    )

    expect(mocks.steps).toEqual([
      'transaction',
      'lock',
      'authority',
      'writable',
      'session-read',
      'note-write',
      'commit',
      'broadcast'
    ])
  })
})
