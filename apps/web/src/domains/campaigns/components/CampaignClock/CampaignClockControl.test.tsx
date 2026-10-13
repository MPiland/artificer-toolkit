import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { campaignClockDtoSchema } from '@artificer-toolkit/schema/api/campaignSessions'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { createTabletopCampaign } from '../../vtt/CampaignTabletop.stories.fixtures'
import { CampaignClockControl } from './CampaignClockControl'

const firstCampaign = createTabletopCampaign('OWNER')
const secondCampaign = { ...firstCampaign, id: '99999999-9999-4999-8999-999999999922' }

function clockFor(campaignId: string, dawnMinute: number) {
  return campaignClockDtoSchema.parse({
    campaignId,
    day: 2,
    minuteOfDay: 480,
    running: false,
    runningSince: null,
    dawnMinute,
    duskMinute: 1080,
    processedBoundaryAbsoluteMinute: 0,
    pausedForCombat: false,
    version: 4,
    updatedAt: '2026-08-15T22:25:00.000Z'
  })
}

const clocks: Record<string, ReturnType<typeof clockFor>> = {
  [firstCampaign.id]: clockFor(firstCampaign.id, 360),
  [secondCampaign.id]: clockFor(secondCampaign.id, 300)
}

vi.mock('#app/data/campaigns/queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#app/data/campaigns/queries')>()),
  getCampaignClock: (campaignId: string) => ({
    queryKey: ['test-campaign-clock', campaignId],
    queryFn: async () => clocks[campaignId]
  })
}))

describe('CampaignClockControl', () => {
  it('starts the editor from the next Campaign clock instead of carrying an edit over', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithAppProviders(<CampaignClockControl campaign={firstCampaign} />)

    await user.click(await screen.findByRole('button', { name: 'Adjust' }))
    fireEvent.change(await screen.findByLabelText('Dawn'), { target: { value: '07:30' } })
    rerender(<CampaignClockControl campaign={secondCampaign} />)

    await user.click(await screen.findByRole('button', { name: 'Adjust' }))
    expect(await screen.findByLabelText('Dawn')).toHaveValue('05:00')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
