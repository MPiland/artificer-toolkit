import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  createTabletopCampaign,
  tabletopCurrentUserId
} from './vtt/CampaignTabletop.stories.fixtures'
import { CampaignDetailPage } from './CampaignDetailPage'

const campaign = createTabletopCampaign('OWNER')
const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  navigate: vi.fn()
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => mocks.navigate
}))

vi.mock('#app/data/campaigns/queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#app/data/campaigns/queries')>()),
  useCampaignDetailOrNull: () => mocks.detail()
}))

vi.mock('./components/CampaignSessions', () => ({ CampaignSessions: () => null }))
vi.mock('./components/CampaignLiveControls', () => ({ CampaignLiveControls: () => null }))
vi.mock('./components/CampaignGmRoller', () => ({ CampaignGmRoller: () => null }))
vi.mock('./components/CampaignSettings', () => ({
  CampaignSettings: ({ onDeleteConfirmed }: { onDeleteConfirmed: () => void }) => (
    <button onClick={onDeleteConfirmed}>Confirm deletion</button>
  )
}))

describe('Campaign detail deletion navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.detail.mockReturnValue(campaign)
    mocks.navigate.mockResolvedValue(undefined)
  })

  it('carries the owner-confirmed deletion ID if the detail vanishes before mutation success', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithAppProviders(
      <CampaignDetailPage campaignId={campaign.id} currentUserId={tabletopCurrentUserId} />
    )
    await user.click(await screen.findByRole('tab', { name: /settings/i }))
    await user.click(await screen.findByRole('button', { name: 'Confirm deletion' }))

    mocks.detail.mockReturnValue(null)
    rerender(<CampaignDetailPage campaignId={campaign.id} currentUserId={tabletopCurrentUserId} />)
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/campaigns',
        replace: true,
        search: { campaignId: campaign.id }
      })
    )
  })

  it('does not claim deletion when Campaign access disappears for another reason', async () => {
    mocks.detail.mockReturnValue(null)
    renderWithAppProviders(
      <CampaignDetailPage campaignId={campaign.id} currentUserId={tabletopCurrentUserId} />
    )
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/campaigns',
        replace: true,
        search: {}
      })
    )
  })
})
