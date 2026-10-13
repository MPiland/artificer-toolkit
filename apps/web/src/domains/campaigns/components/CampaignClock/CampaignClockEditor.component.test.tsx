import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  campaignClockDtoSchema,
  type CampaignClockDto
} from '@artificer-toolkit/schema/api/campaignSessions'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { createTabletopCampaign } from '../../vtt/CampaignTabletop.stories.fixtures'
import { CampaignClockEditor } from './CampaignClockEditor'

const campaign = createTabletopCampaign('OWNER')
const clock = campaignClockDtoSchema.parse({
  campaignId: campaign.id,
  day: 2,
  minuteOfDay: 480,
  running: false,
  runningSince: null,
  dawnMinute: 360,
  duskMinute: 1080,
  processedBoundaryAbsoluteMinute: 0,
  pausedForCombat: false,
  version: 4,
  updatedAt: '2026-08-15T22:25:00.000Z'
})

function editor(current: CampaignClockDto) {
  return <CampaignClockEditor campaign={campaign} clock={current} />
}

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Adjust' }))
  await screen.findByText('World time')
}

describe('CampaignClockEditor in-progress edits', () => {
  it('keeps an edit when the clock advances, and shows the advanced time', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithAppProviders(editor(clock))
    await openEditor(user)

    fireEvent.change(screen.getByLabelText('Reset day'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Dawn'), { target: { value: '07:30' } })
    rerender(editor({ ...clock, minuteOfDay: 500, version: 5 }))

    expect(screen.getByLabelText('Reset day')).toHaveValue('5')
    expect(screen.getByLabelText('Dawn')).toHaveValue('07:30')
    expect(screen.getByLabelText('Reset time')).toHaveValue('08:20')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('surfaces a server change to the edited field and keeps the edit until the user chooses', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithAppProviders(editor(clock))
    await openEditor(user)

    fireEvent.change(screen.getByLabelText('Dawn'), { target: { value: '07:30' } })
    rerender(editor({ ...clock, dawnMinute: 330, version: 5 }))

    expect(screen.getByLabelText('Dawn')).toHaveValue('07:30')
    expect(screen.getByRole('alert')).toHaveTextContent(/Dawn.*05:30/)

    await user.click(screen.getByRole('button', { name: 'Use latest' }))
    expect(screen.getByLabelText('Dawn')).toHaveValue('05:30')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the edit and clears the notice when the user keeps theirs', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithAppProviders(editor(clock))
    await openEditor(user)

    fireEvent.change(screen.getByLabelText('Dawn'), { target: { value: '07:30' } })
    rerender(editor({ ...clock, dawnMinute: 330, version: 5 }))
    await user.click(screen.getByRole('button', { name: 'Keep mine' }))

    expect(screen.getByLabelText('Dawn')).toHaveValue('07:30')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
