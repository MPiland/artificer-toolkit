import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignAnnouncements } from './CampaignAnnouncements'

const partyAnnouncement = {
  announcementPublicId: '22222222-2222-4222-8222-222222222222',
  campaignId: '11111111-1111-4111-8111-111111111111',
  authorUserId: '33333333-3333-4333-8333-333333333333',
  scope: 'PARTY' as const,
  partyId: '44444444-4444-4444-8444-444444444444',
  title: 'Party plan',
  body: 'Meet early.',
  createdAt: '2026-09-01T00:00:00.000Z'
}

const mocks = vi.hoisted(() => ({
  announcements: {
    results: [
      {
        announcementPublicId: '55555555-5555-4555-8555-555555555555',
        campaignId: '11111111-1111-4111-8111-111111111111',
        authorUserId: '33333333-3333-4333-8333-333333333333',
        scope: 'TABLE' as const,
        partyId: null,
        title: 'Table plan',
        body: 'Bring dice.',
        createdAt: '2026-09-01T00:00:00.000Z'
      }
    ],
    status: 'CanLoadMore' as 'CanLoadMore' | 'Exhausted' | 'LoadingFirstPage' | 'LoadingMore',
    loadMore: vi.fn()
  },
  deepLinked: undefined as typeof partyAnnouncement | undefined,
  listCalls: vi.fn(),
  getCalls: vi.fn(),
  deepLinkError: false,
  create: vi.fn()
}))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (...args: unknown[]) => {
    mocks.getCalls(...args)
    return { queryKey: ['announcement-deep-link'] }
  }
}))

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: () => ({ data: mocks.deepLinked, isError: mocks.deepLinkError })
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    if (getFunctionName(reference) === 'campaigns/announcements:create') return mocks.create
    throw new Error(`Unexpected mutation: ${getFunctionName(reference)}`)
  },
  usePaginatedQuery: (...args: unknown[]) => {
    mocks.listCalls(...args)
    return mocks.announcements
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

describe('CampaignAnnouncements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.announcements.status = 'CanLoadMore'
    mocks.deepLinked = partyAnnouncement
    mocks.deepLinkError = false
    mocks.create.mockResolvedValue(partyAnnouncement)
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('uses native pagination, direct deep links, and creates PARTY announcements without a private id', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignAnnouncements
        campaign={campaign}
        announcementPublicId={partyAnnouncement.announcementPublicId}
      />
    )

    expect(mocks.listCalls).toHaveBeenCalledWith(
      expect.anything(),
      { campaignId: campaign.id },
      { initialNumItems: 48 }
    )
    expect(mocks.getCalls).toHaveBeenCalledWith(expect.anything(), {
      campaignId: campaign.id,
      announcementPublicId: partyAnnouncement.announcementPublicId
    })
    expect(screen.getAllByRole('article')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Load more announcements' }))
    expect(mocks.announcements.loadMore).toHaveBeenCalledWith(48)

    await user.click(screen.getByRole('combobox', { name: 'Audience' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Party note')
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Ready up')
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: campaign.id,
          scope: 'PARTY',
          partyId: null,
          title: 'Party note',
          body: 'Ready up'
        })
      )
    )
  })

  it('keeps the list usable when a deep-linked announcement is unavailable', async () => {
    mocks.deepLinked = undefined
    mocks.deepLinkError = true
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignAnnouncements
        campaign={campaign}
        announcementPublicId='66666666-6666-4666-8666-666666666666'
      />
    )

    expect(screen.getByText('That announcement is unavailable.')).toBeVisible()
    expect(screen.getByText('Table plan')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Load more announcements' }))
    expect(mocks.announcements.loadMore).toHaveBeenCalledWith(48)
  })
})
