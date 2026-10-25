import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { EncounterConsequenceRollOfferDto } from '@artificer-toolkit/schema/shared/consequenceRolls'
import { renderWithAppProviders } from '#test/renderWithAppProviders'

import { CampaignTabletopConsequenceRolls } from './CampaignTabletopConsequenceRolls'

vi.mock('#app/settings/useGmRollVisibilityPreference', () => ({
  useGmRollVisibilityPreference: () => ({
    gmRollVisibility: 'PRIVATE',
    setGmRollVisibility: vi.fn()
  })
}))

const offer: EncounterConsequenceRollOfferDto = {
  sourceCommandId: '00000000-0000-4000-8000-0000000000d1',
  definitionId: '00000000-0000-4000-8000-0000000000d2',
  label: 'Lingering Injuries',
  triggers: [{ event: 'DAMAGED', critical: true }, { event: 'HIT_POINTS_ZERO' }],
  occurredAt: '2026-10-25T00:00:00.000Z'
}

function renderOffers(offers: readonly EncounterConsequenceRollOfferDto[]) {
  const onResolve = vi.fn()
  renderWithAppProviders(
    <CampaignTabletopConsequenceRolls
      actor={{ label: 'Aria', consequenceRollOffers: offers }}
      disabled={false}
      onResolve={onResolve}
    />
  )
  return { onResolve }
}

describe('Tabletop consequence table rolls', () => {
  it('lists every trigger the offer met and rolls with the GM’s roll visibility', async () => {
    const { onResolve } = renderOffers([offer])
    expect(
      screen.getByText('Lingering Injuries: Aria took a critical hit, dropped to 0 hit points')
    ).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Roll Lingering Injuries for Aria' }))
    expect(onResolve).toHaveBeenCalledWith({ offer, decision: 'ACCEPT', visibility: 'PRIVATE' })
  })

  it('declines an offer', async () => {
    const { onResolve } = renderOffers([
      { ...offer, triggers: [{ event: 'DEATH_SAVE_FAILED', byAtLeast: 5 }] }
    ])
    expect(
      screen.getByText('Lingering Injuries: Aria failed a death save by 5 or more')
    ).toBeTruthy()
    await userEvent.click(
      screen.getByRole('button', { name: 'Decline Lingering Injuries for Aria' })
    )
    expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ decision: 'DECLINE' }))
  })

  it('shows nothing without offers', () => {
    renderOffers([])
    expect(screen.queryByRole('group', { name: 'Table rolls for Aria' })).toBeNull()
  })
})
