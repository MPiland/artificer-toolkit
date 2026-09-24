import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignContent } from './CampaignContent'

const mocks = vi.hoisted(() => ({
  content: {
    results: [
      {
        subjectKind: 'SPELL' as const,
        subjectId: '33333333-3333-4333-8333-333333333333',
        document: { label: 'Ashen Spark' },
        sharedBy: '22222222-2222-4222-8222-222222222222',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z'
      },
      {
        subjectKind: 'FEAT' as const,
        subjectId: '55555555-5555-4555-8555-555555555555',
        document: { label: 'Cinder Guard' },
        sharedBy: '22222222-2222-4222-8222-222222222222',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z'
      }
    ],
    status: 'CanLoadMore' as 'CanLoadMore' | 'Exhausted' | 'LoadingFirstPage' | 'LoadingMore',
    loadMore: vi.fn()
  },
  candidates: {
    results: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        label: 'Ember Ward'
      }
    ],
    status: 'CanLoadMore' as 'CanLoadMore' | 'Exhausted' | 'LoadingFirstPage' | 'LoadingMore',
    loadMore: vi.fn()
  },
  share: vi.fn(),
  unshare: vi.fn(),
  contentCalls: vi.fn(),
  candidateCalls: vi.fn()
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === 'campaigns/contentShares:share' ? mocks.share : mocks.unshare,
  usePaginatedQuery: (...args: unknown[]) => {
    mocks.contentCalls(...args)
    return mocks.content
  }
}))

vi.mock('convex-helpers/react', () => ({
  usePaginatedQuery: (...args: unknown[]) => {
    mocks.candidateCalls(...args)
    return mocks.candidates
  }
}))

const campaign = {
  id: '11111111-1111-4111-8111-111111111111',
  publicId: 'ashen-road',
  name: 'The Ashen Road',
  description: null,
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  toneDetails: null,
  contentMaturity: 'STANDARD',
  gameSystemId: '00000000-0000-4000-8000-000000000001',
  primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
  additionalRulesCatalogueIds: [],
  status: 'ACTIVE',
  role: 'OWNER',
  version: 1,
  memberCount: 1,
  playerCount: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  attunementSlotOverride: null,
  assignedCharacter: null,
  memberships: [],
  capabilities: {
    edit: true,
    archive: true,
    delete: true,
    invite: true,
    manageMembers: true,
    manageCharacters: true,
    assignOwnCharacter: false,
    manageSharedContent: true,
    shareOwnedContent: true,
    managePartyInventory: true,
    transferOwnInventory: true,
    manageNotes: true,
    contributeSessionNotes: true,
    readTableChat: true,
    readPartyChat: true
  }
} satisfies CampaignDetailDto

describe('CampaignContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.content.status = 'CanLoadMore'
    mocks.candidates.status = 'CanLoadMore'
  })

  it('uses native paginated content and removes content through Convex', async () => {
    const user = userEvent.setup()
    const view = renderWithAppProviders(
      <CampaignContent campaign={campaign} currentUserId='22222222-2222-4222-8222-222222222222' />
    )

    expect(mocks.contentCalls).toHaveBeenCalledWith(
      expect.anything(),
      { campaignId: campaign.id },
      { initialNumItems: 48 }
    )
    expect(mocks.candidateCalls).toHaveBeenCalledWith(expect.anything(), 'skip', {
      initialNumItems: 48
    })

    await user.click(screen.getByRole('combobox', { name: 'Content type' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await waitFor(() =>
      expect(mocks.candidateCalls).toHaveBeenLastCalledWith(
        expect.anything(),
        { subjectKind: 'BACKGROUND', source: 'OWNED', sort: 'name' },
        { initialNumItems: 48 }
      )
    )
    await waitFor(() => expect(mocks.candidates.loadMore).toHaveBeenCalledWith(48))

    mocks.candidates.status = 'LoadingMore'
    view.rerender(
      <CampaignContent campaign={campaign} currentUserId='22222222-2222-4222-8222-222222222222' />
    )
    mocks.candidates.status = 'CanLoadMore'
    view.rerender(
      <CampaignContent campaign={campaign} currentUserId='22222222-2222-4222-8222-222222222222' />
    )
    await waitFor(() => expect(mocks.candidates.loadMore).toHaveBeenCalledTimes(2))

    mocks.candidates.status = 'Exhausted'
    view.rerender(
      <CampaignContent campaign={campaign} currentUserId='22222222-2222-4222-8222-222222222222' />
    )
    await user.click(screen.getByRole('combobox', { name: 'Owned homebrew' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('button', { name: 'Share' }))
    await waitFor(() =>
      expect(mocks.share).toHaveBeenCalledWith({
        campaignId: campaign.id,
        subjectKind: 'BACKGROUND',
        subjectId: '44444444-4444-4444-8444-444444444444'
      })
    )

    await user.click(screen.getByRole('button', { name: 'Load more content' }))
    expect(mocks.content.loadMore).toHaveBeenCalledWith(48)

    await user.click(screen.getAllByRole('button', { name: 'Remove share' })[0]!)
    await waitFor(() =>
      expect(mocks.unshare).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          campaignId: campaign.id,
          subjectKind: 'SPELL',
          subjectId: '33333333-3333-4333-8333-333333333333',
          sharedBy: '22222222-2222-4222-8222-222222222222',
          expectedCampaignVersion: campaign.version
        })
      )
    )
    view.rerender(
      <CampaignContent
        campaign={{ ...campaign, version: 2 }}
        currentUserId='22222222-2222-4222-8222-222222222222'
      />
    )
    await user.click(screen.getAllByRole('button', { name: 'Remove share' })[1]!)
    await waitFor(() =>
      expect(mocks.unshare).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          campaignId: campaign.id,
          subjectKind: 'FEAT',
          subjectId: '55555555-5555-4555-8555-555555555555',
          sharedBy: '22222222-2222-4222-8222-222222222222',
          expectedCampaignVersion: 2
        })
      )
    )
  })
})
