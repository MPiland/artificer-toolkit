import { act, screen, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type { CampaignContentUsageDto } from '@artificer-toolkit/schema/api/campaignCore'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignContentUsage } from './CampaignContentUsage'

const campaignId = '11111111-1111-4111-8111-111111111111'
const mocks = vi.hoisted(() => ({
  usage: null as CampaignContentUsageDto,
  read: vi.fn<(id: string) => void>()
}))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (reference: Parameters<typeof getFunctionName>[0], args: { id: string }) => {
    if (getFunctionName(reference) !== 'campaigns/queries:contentUsage')
      throw new Error(`Unexpected query ${getFunctionName(reference)}`)
    return {
      queryKey: ['contentUsage', args.id],
      queryFn: async () => {
        mocks.read(args.id)
        return mocks.usage
      }
    }
  }
}))

describe('CampaignContentUsage', () => {
  it('shows entries and Scenes against the host plan limits', async () => {
    mocks.usage = { entries: { used: 42, limit: 150 }, scenes: { used: 3, limit: 5 } }
    renderWithAppProviders(<CampaignContentUsage campaignId={campaignId} />)

    expect(await screen.findByText('Entries 42 / 150')).toBeVisible()
    expect(screen.getByText('Scenes 3 / 5')).toBeVisible()
  })

  it('shows nothing for an unlimited host plan', async () => {
    const unlimitedCampaignId = '22222222-2222-4222-8222-222222222222'
    mocks.usage = null
    renderWithAppProviders(<CampaignContentUsage campaignId={unlimitedCampaignId} />)

    await waitFor(() => expect(mocks.read).toHaveBeenCalledWith(unlimitedCampaignId))
    await act(async () => {})
    expect(screen.queryByText('Campaign usage')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Entries /)).not.toBeInTheDocument()
  })
})
