import { fireEvent, screen } from '@testing-library/react'
import {
  campaignSessionDtoSchema,
  type CampaignSessionDto
} from '@artificer-toolkit/schema/api/campaignSessions'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { createTabletopCampaign } from '../../vtt/CampaignTabletop.stories.fixtures'
import { CampaignSessionHeader } from './CampaignSessionHeader'

vi.mock('../CampaignLiveControls', () => ({ CampaignLiveControls: () => null }))
vi.mock('../CampaignChatDrawer', () => ({ CampaignChatDrawer: () => null }))

const campaign = createTabletopCampaign('OWNER')
const session = campaignSessionDtoSchema.parse({
  id: '99999999-9999-4999-8999-999999999911',
  campaignId: campaign.id,
  sessionNumber: 3,
  title: 'The vault',
  scheduledStartAt: null,
  scheduledEndAt: null,
  timeZone: null,
  status: 'OPEN',
  finishedAt: null,
  version: 2,
  createdAt: '2026-08-15T22:05:00.000Z',
  updatedAt: '2026-08-15T22:25:00.000Z'
})

function header(current: CampaignSessionDto) {
  return (
    <CampaignSessionHeader
      campaign={campaign}
      currentUserId='user-1'
      session={current}
      onUpdated={() => undefined}
    />
  )
}

function titleInput() {
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Session name' })
}

describe('CampaignSessionHeader title', () => {
  it('keeps an in-progress title edit when the Session re-renders with the same title', () => {
    const { rerender } = renderWithAppProviders(header(session))
    expect(titleInput()).toHaveValue('The vault')

    fireEvent.change(titleInput(), { target: { value: 'The vault, part two' } })
    rerender(header({ ...session, version: 3, updatedAt: '2026-08-15T22:30:00.000Z' }))

    expect(titleInput()).toHaveValue('The vault, part two')
  })

  it('replaces the title, discarding an edit, when the saved title changes', () => {
    const { rerender } = renderWithAppProviders(header(session))
    fireEvent.change(titleInput(), { target: { value: 'Unsaved draft' } })

    rerender(header({ ...session, title: 'The flooded vault', version: 3 }))

    expect(titleInput()).toHaveValue('The flooded vault')
  })

  it('clears the field when the saved title is removed', () => {
    const { rerender } = renderWithAppProviders(header(session))

    rerender(header({ ...session, title: null, version: 3 }))

    expect(titleInput()).toHaveValue('')
  })
})
