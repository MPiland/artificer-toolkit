import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { createTabletopCampaign } from '../vtt/CampaignTabletop.stories.fixtures'
import { CampaignSettings } from './CampaignSettings'

const campaign = createTabletopCampaign('OWNER')
const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  remove: vi.fn()
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => mocks.navigate
}))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
    if (getFunctionName(reference) !== 'campaigns/queries:settings')
      throw new Error(`Unexpected query ${getFunctionName(reference)}`)
    return { queryKey: ['settings', campaign.id], queryFn: async () => campaign }
  }
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    if (getFunctionName(reference) === 'campaigns/deletion:remove') return mocks.remove
    return vi.fn()
  }
}))

vi.mock('#app/data/systems/useSystemList', () => ({
  useSystemList: () => ({
    isPending: false,
    isError: false,
    data: [{ id: campaign.gameSystemId, label: 'System', rulesCatalogues: [] }]
  })
}))

vi.mock('#app/ui/primitives/RichTextEditor/RichTextEditor', () => ({
  default: () => null
}))

vi.mock('./CampaignMetadataFields', () => ({ CampaignMetadataFields: () => null }))

describe('CampaignSettings deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.remove.mockResolvedValue({ ok: true })
    mocks.navigate.mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('keeps DELETE confirmation and navigates with the deletion job ID', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<CampaignSettings campaign={campaign} />)

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({
        campaignId: campaign.id,
        expectedVersion: campaign.version,
        confirmation: 'DELETE'
      })
    )
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/campaigns',
        search: { campaignId: campaign.id }
      })
    )
  })
})
