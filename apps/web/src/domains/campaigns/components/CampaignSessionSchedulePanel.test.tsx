import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  campaignSessionDtoSchema,
  type CampaignSessionDto
} from '@artificer-toolkit/schema/api/campaignSessions'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { createTabletopCampaign } from '../vtt/CampaignTabletop.stories.fixtures'
import { CampaignSessionSchedulePanel } from './CampaignSessionSchedulePanel'

const campaign = createTabletopCampaign('PLAYER')
const session = campaignSessionDtoSchema.parse({
  id: '99999999-9999-4999-8999-999999999911',
  campaignId: campaign.id,
  sessionNumber: 3,
  title: 'The vault',
  scheduledStartAt: '2026-09-01T18:00:00.000Z',
  scheduledEndAt: '2026-09-01T21:00:00.000Z',
  timeZone: 'UTC',
  status: 'OPEN',
  finishedAt: null,
  version: 2,
  createdAt: '2026-08-15T22:05:00.000Z',
  updatedAt: '2026-08-15T22:25:00.000Z'
})

function panel(current: CampaignSessionDto) {
  return (
    <CampaignSessionSchedulePanel
      campaign={campaign}
      currentUserId='user-1'
      session={current}
      onUpdated={() => undefined}
    />
  )
}

describe('CampaignSessionSchedulePanel in-progress edits', () => {
  it('keeps an edit when the title changes elsewhere', () => {
    const { rerender } = renderWithAppProviders(panel(session))

    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-09-02T18:00' } })
    rerender(panel({ ...session, title: 'The vault, part two', version: 3 }))

    expect(screen.getByLabelText('Starts')).toHaveValue('2026-09-02T18:00')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('surfaces a server change to the edited field and keeps the edit until the user chooses', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithAppProviders(panel(session))

    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-09-02T18:00' } })
    rerender(panel({ ...session, scheduledStartAt: '2026-09-03T18:00:00.000Z', version: 3 }))

    expect(screen.getByLabelText('Starts')).toHaveValue('2026-09-02T18:00')
    expect(screen.getByRole('alert')).toHaveTextContent(/Starts.*2026-09-03T18:00/)

    await user.click(screen.getByRole('button', { name: 'Use latest' }))
    expect(screen.getByLabelText('Starts')).toHaveValue('2026-09-03T18:00')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a server change to a field nobody is editing', () => {
    const { rerender } = renderWithAppProviders(panel(session))

    rerender(panel({ ...session, scheduledEndAt: '2026-09-01T22:00:00.000Z', version: 3 }))

    expect(screen.getByLabelText('Ends')).toHaveValue('2026-09-01T22:00')
  })
})
