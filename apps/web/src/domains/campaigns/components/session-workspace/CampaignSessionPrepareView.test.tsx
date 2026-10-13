import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  campaignSessionDtoSchema,
  type CampaignSessionDto
} from '@artificer-toolkit/schema/api/campaignSessions'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { createTabletopCampaign } from '../../vtt/CampaignTabletop.stories.fixtures'
import { CampaignSessionPrepareView } from './CampaignSessionPrepareView'

// Siblings of the schedule panel own their own data; only the panel's remount on Session change is under test.
vi.mock('../CampaignEncounters', () => ({ CampaignEncounters: () => null }))
vi.mock('../CampaignSessionReferences', () => ({ CampaignSessionReferences: () => null }))
vi.mock('../CampaignSessionSectionGroup', () => ({ CampaignSessionSectionGroup: () => null }))
vi.mock('../../vtt/CampaignScenePreparation', () => ({ CampaignScenePreparation: () => null }))
vi.mock('../../vtt/useCampaignLiveSummary', () => ({ useCampaignLiveSummary: () => null }))

const campaign = createTabletopCampaign('PLAYER')
const firstSession = campaignSessionDtoSchema.parse({
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
const secondSession: CampaignSessionDto = {
  ...firstSession,
  id: '99999999-9999-4999-8999-999999999912',
  sessionNumber: 4,
  scheduledStartAt: '2026-09-08T18:00:00.000Z',
  scheduledEndAt: '2026-09-08T21:00:00.000Z'
}

function prepareView(session: CampaignSessionDto) {
  return (
    <CampaignSessionPrepareView
      campaign={campaign}
      currentUserId='user-1'
      session={session}
      onUpdated={() => undefined}
    />
  )
}

describe('CampaignSessionPrepareView', () => {
  it('starts the schedule panel from the next Session instead of carrying an edit over', () => {
    const { rerender } = renderWithAppProviders(prepareView(firstSession))

    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-09-02T18:00' } })
    rerender(prepareView(secondSession))

    expect(screen.getByLabelText('Starts')).toHaveValue('2026-09-08T18:00')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
