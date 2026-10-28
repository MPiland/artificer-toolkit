import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { absoluteMinute } from '@artificer-toolkit/rules-runtime/campaignClock'
import type { ActiveGrantListingDto } from '@artificer-toolkit/schema/shared/activeGrantListing'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { ActiveGrantList } from './ActiveGrantList'

const grant = (overrides: Partial<ActiveGrantListingDto>): ActiveGrantListingDto => ({
  effectId: '11111111-1111-4111-8111-111111111101',
  label: 'Aid',
  sourceHidden: false,
  sourceActorId: null,
  remainingTicks: 3,
  expiresAtCampaignMinute: null,
  polarity: 'BENEFICIAL',
  ...overrides
})

describe('ActiveGrantList', () => {
  it('lists each grant with its source and what is left of it', () => {
    renderWithAppProviders(
      <ActiveGrantList
        label='Active grants'
        grants={[
          grant({}),
          grant({
            effectId: '11111111-1111-4111-8111-111111111102',
            label: 'Antitoxin (vial)',
            remainingTicks: 1
          }),
          grant({
            effectId: '11111111-1111-4111-8111-111111111103',
            label: 'Bless',
            remainingTicks: null,
            expiresAtCampaignMinute: absoluteMinute(2, 605)
          }),
          grant({
            effectId: '11111111-1111-4111-8111-111111111104',
            label: 'Ward',
            remainingTicks: null
          })
        ]}
      />
    )

    const items = screen.getAllByRole('listitem').map((item) => item.textContent)
    expect(items).toEqual([
      'Aid · 3 rounds left',
      'Antitoxin (vial) · 1 round left',
      'Bless · Until day 2, 10:05',
      'Ward · Until ended'
    ])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('names a hidden source neutrally', () => {
    renderWithAppProviders(
      <ActiveGrantList
        label='Active grants'
        grants={[grant({ label: null, sourceHidden: true, remainingTicks: 2 })]}
      />
    )

    expect(screen.getByRole('listitem')).toHaveTextContent('Hidden source · 2 rounds left')
  })

  it('offers End only when the caller supplies it, and ends that grant', async () => {
    const user = userEvent.setup()
    const onEnd = vi.fn()
    renderWithAppProviders(
      <ActiveGrantList grants={[grant({})]} label='Active grants' onEnd={onEnd} />
    )

    await user.click(screen.getByRole('button', { name: 'End Aid' }))

    expect(onEnd).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111101')
  })

  it('renders nothing without grants', () => {
    renderWithAppProviders(<ActiveGrantList grants={[]} label='Active grants' />)

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
