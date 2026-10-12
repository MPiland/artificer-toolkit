import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  campaignCopyProgressSchema,
  type CampaignCopyProgress
} from '@artificer-toolkit/schema/api/campaignCopy'
import {
  campaignSummaryDtoSchema,
  type CampaignSummaryDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { getCampaignCapabilities } from '@artificer-toolkit/shared/campaign/capabilities'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignCopy } from './CampaignCopy'

const campaign = campaignSummaryDtoSchema.parse({
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  publicId: 'campaign-source',
  name: 'Source Campaign',
  description: null,
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  toneDetails: null,
  contentMaturity: 'STANDARD',
  gameSystemId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  primaryRulesCatalogueId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  additionalRulesCatalogueIds: [],
  status: 'ACTIVE',
  role: 'OWNER',
  version: 4,
  memberCount: 2,
  playerCount: 1,
  createdAt: '2026-09-18T00:00:00.000Z',
  updatedAt: '2026-09-18T00:00:00.000Z',
  capabilities: getCampaignCapabilities('ACTIVE', 'OWNER'),
  assignedCharacter: null
})

const runningCopy = campaignCopyProgressSchema.parse({
  copyId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  sourceCampaignId: campaign.id,
  sourceName: campaign.name,
  status: 'RUNNING',
  notebookCategories: ['PEOPLE'],
  copiedSections: 2,
  failureReason: null,
  destination: null,
  createdAt: '2026-09-18T00:00:00.000Z',
  updatedAt: '2026-09-18T00:00:00.000Z'
})

const mocks = vi.hoisted(() => ({
  begin: vi.fn(),
  progress: vi.fn(),
  cancel: vi.fn(),
  jobs: {
    results: [] as CampaignCopyProgress[],
    status: 'Exhausted' as 'CanLoadMore' | 'Exhausted' | 'LoadingFirstPage' | 'LoadingMore',
    loadMore: vi.fn()
  }
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  usePaginatedQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
    options: unknown
  ) => {
    if (getFunctionName(reference) !== getFunctionName(api.campaigns.copyJobs.list))
      throw new Error(`Unexpected copy-job query ${getFunctionName(reference)}`)
    expect(args).toEqual({})
    expect(options).toEqual({ initialNumItems: 8 })
    return mocks.jobs
  },
  useConvex: () => ({
    query: (reference: Parameters<typeof getFunctionName>[0], args: { copyId: string }) => {
      if (getFunctionName(reference) !== getFunctionName(api.campaigns.copyJobs.progress))
        throw new Error(`Unexpected copy-job query ${getFunctionName(reference)}`)
      return mocks.progress(args)
    }
  }),
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    switch (getFunctionName(reference)) {
      case getFunctionName(api.campaigns.copyJobs.begin):
        return mocks.begin
      case getFunctionName(api.campaigns.copyJobs.cancel):
        return mocks.cancel
      default:
        throw new Error(`Unexpected copy-job mutation ${getFunctionName(reference)}`)
    }
  }
}))

function renderCopy(source: CampaignSummaryDto | null = campaign) {
  const onClose = vi.fn()
  const onOpen = vi.fn()
  renderWithAppProviders(
    <CampaignCopy campaigns={[campaign]} source={source} onClose={onClose} onOpen={onOpen} />
  )
  return { onClose, onOpen }
}

describe('CampaignCopy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.jobs.results = []
    mocks.jobs.status = 'Exhausted'
    mocks.begin.mockReset().mockResolvedValue(runningCopy)
    mocks.progress.mockReset()
    mocks.cancel.mockReset().mockResolvedValue({ ...runningCopy, status: 'CLEANING' })
  })

  it('starts with no notebook content selected and sends only explicit categories', async () => {
    const user = userEvent.setup()
    renderCopy()

    expect(screen.getByRole('checkbox', { name: 'Notes' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'People / NPC notes' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Places / cities' })).not.toBeChecked()

    await user.click(screen.getByRole('checkbox', { name: 'People / NPC notes' }))
    expect(screen.getByRole('checkbox', { name: 'People / NPC notes' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Copy Campaign' }))

    await waitFor(() =>
      expect(mocks.begin).toHaveBeenCalledWith({
        campaignId: campaign.id,
        expectedVersion: campaign.version,
        commandId: expect.any(String),
        notebookCategories: ['PEOPLE']
      })
    )
    expect(
      screen.getByText('Copying Source Campaign in the background. You can close this window.')
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Copy Campaign' })).toBeDisabled()
  })

  it('keeps the picker open while a copy request is pending', async () => {
    let resolveBegin: (copy: CampaignCopyProgress) => void = () => undefined
    mocks.begin.mockReturnValueOnce(
      new Promise<CampaignCopyProgress>((resolve) => {
        resolveBegin = resolve
      })
    )
    const user = userEvent.setup()
    const { onClose } = renderCopy()

    await user.click(screen.getByRole('button', { name: 'Copy Campaign' }))

    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(cancel).toBeDisabled()
    await user.click(cancel)
    expect(onClose).not.toHaveBeenCalled()

    resolveBegin(runningCopy)
    await screen.findByText('Copying Source Campaign in the background. You can close this window.')
    expect(cancel).toBeEnabled()
  })
  it('keeps the exact copy input through the configured transport retry', async () => {
    mocks.begin
      .mockRejectedValueOnce(new Error('Temporary transport failure.'))
      .mockResolvedValueOnce(runningCopy)
    const user = userEvent.setup()
    renderCopy()

    await user.click(screen.getByRole('button', { name: 'Copy Campaign' }))

    await waitFor(() => expect(mocks.begin).toHaveBeenCalledTimes(2), { timeout: 2_000 })
    expect(mocks.begin.mock.calls[1]?.[0]).toEqual(mocks.begin.mock.calls[0]?.[0])
  })
  it('reuses the unchanged input command ID after retry exhaustion', async () => {
    mocks.begin
      .mockRejectedValueOnce(new Error('Temporary transport failure.'))
      .mockRejectedValueOnce(new Error('Temporary transport failure.'))
      .mockResolvedValueOnce(runningCopy)
    const user = userEvent.setup()
    renderCopy()

    await user.click(screen.getByRole('button', { name: 'Copy Campaign' }))
    await screen.findByText('Temporary transport failure.', undefined, { timeout: 5_000 })
    await user.click(screen.getByRole('button', { name: 'Copy Campaign' }))

    await waitFor(() => expect(mocks.begin).toHaveBeenCalledTimes(3), { timeout: 2_000 })
    expect(mocks.begin.mock.calls[2]?.[0]).toEqual(mocks.begin.mock.calls[0]?.[0])
  })
  it('persists running status, permits cancellation, and exposes the next page', async () => {
    mocks.jobs.results = [runningCopy]
    mocks.jobs.status = 'CanLoadMore'
    const user = userEvent.setup()
    renderCopy(null)

    expect(screen.getByText('Source Campaign')).toBeVisible()
    expect(screen.getByText('2 sections copied')).toBeVisible()
    expect(screen.getByText('Copying')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cancel copy' }))
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith({ copyId: runningCopy.copyId }))
    await user.click(screen.getByRole('button', { name: 'Load more copies' }))
    expect(mocks.jobs.loadMore).toHaveBeenCalledWith(8)
  })

  it('shows a finished failure and reopens the picker from its current source', async () => {
    mocks.jobs.results = [
      { ...runningCopy, status: 'FAILED', failureReason: 'Copy could not be completed.' }
    ]
    const user = userEvent.setup()
    const { onOpen } = renderCopy(null)

    expect(screen.getByText('Copy could not be completed.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Copy again' }))
    expect(onOpen).toHaveBeenCalledWith(campaign)
  })
  it('shows the entries limit refusal instead of the generic failure', () => {
    mocks.jobs.results = [
      {
        ...runningCopy,
        status: 'FAILED',
        failureReason: 'This Campaign has reached its entries limit.'
      }
    ]
    renderCopy(null)

    expect(screen.getByText('This Campaign has reached its entries limit.')).toBeVisible()
    expect(screen.queryByText('Copy could not be completed.')).not.toBeInTheDocument()
  })
  it('keeps a revoked completed destination inline instead of opening it', async () => {
    mocks.jobs.results = [{ ...runningCopy, status: 'COMPLETED' }]
    mocks.progress.mockRejectedValueOnce(new Error('This copied Campaign is no longer available.'))
    const user = userEvent.setup()
    renderCopy(null)

    await user.click(screen.getByRole('button', { name: 'Open' }))

    expect(await screen.findByText('This copied Campaign is no longer available.')).toBeVisible()
  })
})
