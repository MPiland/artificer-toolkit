import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const id = '00000000-0000-4000-8000-000000000001'
const userId = '00000000-0000-4000-8000-000000000002'

const mocks = vi.hoisted(() => ({
  authority: vi.fn(),
  entries: {
    listCampaignSessions: vi.fn(),
    updateCampaignSession: vi.fn(),
    insertSessionNoteSection: vi.fn(),
    listSessionNoteSections: vi.fn(),
    upsertSessionRsvp: vi.fn()
  },
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
    createCampaignCollaborationRepository: () => mocks.entries,
    createCampaignRepository: () => ({
      lockCampaign: mocks.lockCampaign,
      listAssignmentCharacterIds: vi.fn()
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
  CampaignNotFoundError: class CampaignNotFoundError extends Error {},
  resolveCampaignAuthority: mocks.authority,
  assertActiveCampaignMember: vi.fn(),
  assertCampaignWritable: mocks.assertCampaignWritable,
  assertCampaignOwner: mocks.assertCampaignOwner
}))

vi.mock('./realtimeService.js', () => ({ broadcastCampaignInvalidation: mocks.broadcast }))

const {
  updateCampaignSession,
  createCampaignSessionNoteSection,
  listCampaignSessionNoteSections,
  setCampaignSessionRsvp
} = await import('./campaignSessionService.js')

function authority(role: 'OWNER' | 'PLAYER') {
  return {
    campaign: { id, status: 'ACTIVE' },
    membership: { role, status: 'ACTIVE', accessStartedAt: '2026-08-01T00:00:00.000Z' },
    assignedCharacter: null
  }
}

describe('Campaign session service', () => {
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
      'broadcast',
      'authority'
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
      'broadcast',
      'authority'
    ])
  })
})
