import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { campaignDeletionStatusSchema } from '@artificer-toolkit/schema/api/campaignDeletion'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { createTabletopCampaign } from './vtt/CampaignTabletop.stories.fixtures'
import { CampaignListPage } from './CampaignListPage'
import { campaignListSearchSchema } from './campaignListSearch'

const campaign = createTabletopCampaign('OWNER')
const deletedCampaignId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const failedStatus = campaignDeletionStatusSchema.parse({
  campaignId: deletedCampaignId,
  expectedVersion: 7,
  status: 'FAILED',
  error: 'Campaign cleanup failed. Retry deletion to resume.',
  updatedAt: '2026-09-23T00:00:00.000Z'
})

const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  remove: vi.fn()
}))

vi.mock('#app/data/campaigns/queries', () => ({
  useGetCampaignList: () => ({ data: [campaign], isLoading: false })
}))

vi.mock('./components/CampaignCopy', () => ({ CampaignCopy: () => null }))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (reference: Parameters<typeof getFunctionName>[0], args: { campaignId: string }) => {
    if (getFunctionName(reference) !== 'campaigns/deletion:status')
      throw new Error(`Unexpected query ${getFunctionName(reference)}`)
    return { queryKey: ['campaignDeletion', args.campaignId], queryFn: () => mocks.status(args) }
  }
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    if (getFunctionName(reference) !== 'campaigns/deletion:remove')
      throw new Error(`Unexpected mutation ${getFunctionName(reference)}`)
    return mocks.remove
  }
}))

describe('Campaign deletion progress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.status.mockResolvedValue(failedStatus)
    mocks.remove.mockResolvedValue({ ok: true })
  })

  it('keeps the deletion ID through validated search and retries with its original version', async () => {
    expect(campaignListSearchSchema.parse({ campaignId: deletedCampaignId })).toEqual({
      campaignId: deletedCampaignId
    })
    const user = userEvent.setup()
    renderWithAppProviders(<CampaignListPage deletingCampaignId={deletedCampaignId} />)

    expect(
      await screen.findByText('Campaign cleanup failed. Retry deletion to resume.')
    ).toBeVisible()
    expect(screen.getByTestId(`campaign-${campaign.publicId}`)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Retry deletion' }))
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({
        campaignId: deletedCampaignId,
        expectedVersion: 7,
        confirmation: 'DELETE'
      })
    )
  })

  it('shows a spinner during cleanup while the remaining Campaign list stays usable', async () => {
    mocks.status.mockResolvedValue({ ...failedStatus, status: 'DELETING', error: null })
    const { rerender } = renderWithAppProviders(
      <CampaignListPage deletingCampaignId={deletedCampaignId} />
    )
    expect(await screen.findByLabelText('Deleting Campaign')).toBeVisible()
    expect(
      await screen.findByText('The Campaign is inaccessible while its data is removed.')
    ).toBeVisible()
    expect(screen.getByTestId(`campaign-${campaign.publicId}`)).toBeVisible()

    rerender(<CampaignListPage deletingCampaignId={undefined} />)
    expect(screen.queryByLabelText('Campaign deletion progress')).not.toBeInTheDocument()
  })

  it('shows completion after the job finishes', async () => {
    mocks.status.mockResolvedValue({ ...failedStatus, status: 'DELETED', error: null })
    renderWithAppProviders(<CampaignListPage deletingCampaignId={deletedCampaignId} />)
    expect(await screen.findByText('Campaign deleted.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Retry deletion' })).not.toBeInTheDocument()
  })

  it('drops invalid search IDs before requesting owner-only status', () => {
    expect(campaignListSearchSchema.parse({ campaignId: 'invalid' })).toEqual({
      campaignId: undefined
    })
    renderWithAppProviders(<CampaignListPage />)
    expect(mocks.status).not.toHaveBeenCalled()
  })
})
