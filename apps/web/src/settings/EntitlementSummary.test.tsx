import { screen } from '@testing-library/react'
import {
  ENTITLEMENT_LIMITS,
  ENTITLEMENT_PRICING
} from '@artificer-toolkit/shared/account/entitlements'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { EntitlementSummary } from './EntitlementSummary'

describe('EntitlementSummary', () => {
  it('shows tier pricing, unlimited limits, storage, seats, and platform fee metadata', () => {
    renderWithAppProviders(
      <EntitlementSummary
        entitlements={{
          tier: 'PRO_GM',
          pricing: { currency: 'USD', monthlyPriceCents: 2499, annualPriceCents: 24999 },
          usage: {
            storageBytes: 1024 ** 3,
            personalCharacters: 14,
            homebrewRoots: 22,
            activeHostedCampaigns: 6,
            publicListings: 4,
            savedEncounters: 9
          },
          limits: {
            storageBytes: 25 * 1024 ** 3,
            personalCharacters: null,
            homebrewRoots: null,
            activeHostedCampaigns: 25,
            playerSeatsPerCampaign: 12,
            publicListings: null,
            savedEncounters: null,
            campaignEntriesPerCampaign: null,
            scenesPerCampaign: null,
            paidTablesEnabled: true,
            platformFeeBasisPoints: 0
          }
        }}
      />
    )

    expect(screen.getByText('Pro GM')).toBeInTheDocument()
    expect(screen.getByText(/\$24\.99\/month · \$249\.99\/year/)).toBeInTheDocument()
    expect(screen.getAllByText('Unlimited')).toHaveLength(6)
    expect(screen.getByRole('row', { name: /Active hosted Campaigns/ })).toHaveTextContent('625')
    expect(screen.getByRole('row', { name: /Campaign entries per Campaign/ })).toHaveTextContent(
      'Unlimited'
    )
    expect(screen.getByRole('row', { name: /Scenes per Campaign/ })).toHaveTextContent('Unlimited')
    expect(screen.getByText('25 GB')).toBeInTheDocument()
    expect(screen.getByText('Payment-processing costs still apply.')).toBeInTheDocument()
  })

  it('shows the Free per-Campaign entry and Scene limits and the 100 MB media quota', () => {
    renderWithAppProviders(
      <EntitlementSummary
        entitlements={{
          tier: 'FREE',
          pricing: ENTITLEMENT_PRICING.FREE,
          usage: {
            storageBytes: 0,
            personalCharacters: 0,
            homebrewRoots: 0,
            activeHostedCampaigns: 1,
            publicListings: 0,
            savedEncounters: 0
          },
          limits: ENTITLEMENT_LIMITS.FREE
        }}
      />
    )

    expect(screen.getByRole('row', { name: /Storage/ })).toHaveTextContent('100 MB')
    expect(screen.getByRole('row', { name: /Saved Encounters/ })).toHaveTextContent('010')
    expect(screen.getByRole('row', { name: /Campaign entries per Campaign/ })).toHaveTextContent(
      '150'
    )
    expect(screen.getByRole('row', { name: /Scenes per Campaign/ })).toHaveTextContent('5')
  })
})
