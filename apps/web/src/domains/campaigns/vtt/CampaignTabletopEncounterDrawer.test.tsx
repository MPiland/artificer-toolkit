import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignTabletopEncounterDrawer } from './CampaignTabletopEncounterDrawer'
import { tabletopGmEncounter, tabletopPlayerEncounter } from './CampaignTabletop.stories.fixtures'

describe('CampaignTabletopEncounterDrawer', () => {
  it('shows the private player turn order without GM controls', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignTabletopEncounterDrawer
        connected
        encounter={tabletopPlayerEncounter}
        pending={false}
        role='PLAYER'
        onCommand={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open turn order' }))

    expect(screen.getByRole('dialog', { name: 'Turn order' })).toBeInTheDocument()
    expect(screen.getByText("Ember's Wake")).toBeInTheDocument()
    expect(screen.getByText('Vault Warden')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next turn' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Current turn')).not.toBeInTheDocument()
  })

  it('sends an authoritative versioned turn command for the GM', async () => {
    const user = userEvent.setup()
    const onCommand = vi.fn()
    renderWithAppProviders(
      <CampaignTabletopEncounterDrawer
        connected
        encounter={tabletopGmEncounter}
        pending={false}
        role='OWNER'
        onCommand={onCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open turn order' }))
    await user.click(await screen.findByRole('button', { name: 'Next turn' }))

    expect(onCommand).toHaveBeenCalledWith({
      commandId: expect.any(String),
      encounterId: tabletopGmEncounter.id,
      expectedVersion: tabletopGmEncounter.version,
      type: 'ADVANCE_TURN'
    })
  })

  it('keeps commands unavailable while the live session reconnects', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignTabletopEncounterDrawer
        connected={false}
        encounter={tabletopGmEncounter}
        pending={false}
        role='OWNER'
        onCommand={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open turn order' }))

    expect(screen.getByText(/turn controls will return/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next turn' })).toBeDisabled()
  })
})
