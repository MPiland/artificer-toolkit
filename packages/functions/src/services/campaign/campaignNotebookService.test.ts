import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const id = '00000000-0000-4000-8000-000000000001'
const userId = '00000000-0000-4000-8000-000000000002'

const mocks = vi.hoisted(() => ({
  authority: vi.fn(),
  entries: {
    insertCampaignNoteSection: vi.fn(),
    listCampaignNoteSections: vi.fn(),
    updateCampaignNoteSection: vi.fn(),
    deleteCampaignNoteSection: vi.fn()
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
    createCampaignRepository: () => ({ lockCampaign: mocks.lockCampaign }),
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

const {
  createCampaignNotebookSection,
  updateCampaignNotebookSection,
  deleteCampaignNotebookSection
} = await import('./campaignNotebookService.js')

function authority(role: 'OWNER' | 'PLAYER') {
  return {
    campaign: { id, status: 'ACTIVE' },
    membership: { role, status: 'ACTIVE', accessStartedAt: '2026-08-01T00:00:00.000Z' },
    assignedCharacter: null
  }
}

describe('Campaign notebook service', () => {
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
})
