import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignTabletopMovementReadout } from './CampaignTabletopMovementReadout'

describe('CampaignTabletopMovementReadout', () => {
  it('shows the movement spent against the walking-speed budget', () => {
    renderWithAppProviders(
      <CampaignTabletopMovementReadout automationMode='ASSISTED' budget={30} used={15} />
    )
    expect(screen.getByText('Movement 15 / 30 ft')).toBeInTheDocument()
  })

  it('warns softly past the budget in Assisted mode', () => {
    renderWithAppProviders(
      <CampaignTabletopMovementReadout automationMode='ASSISTED' budget={30} used={35} />
    )
    expect(
      screen.getByText('Movement 35 / 30 ft · 5 ft over').closest('[data-variant]')
    ).toHaveAttribute('data-variant', 'light')
  })

  it('shows the number only past the budget in Manual mode', () => {
    renderWithAppProviders(
      <CampaignTabletopMovementReadout automationMode='MANUAL' budget={30} used={35} />
    )
    expect(screen.getByText('Movement 35 / 30 ft').closest('[data-variant]')).toHaveAttribute(
      'data-variant',
      'default'
    )
    expect(screen.queryByText(/over/)).not.toBeInTheDocument()
  })
})
