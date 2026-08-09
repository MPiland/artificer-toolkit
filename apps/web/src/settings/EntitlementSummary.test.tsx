import { screen } from '@testing-library/react'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { EntitlementSummary } from './EntitlementSummary'

describe('EntitlementSummary', () => {
  it('shows tier pricing, unlimited limits, storage, seats, and platform fee metadata', () => {
    renderWithAppProviders(
      <EntitlementSummary
        entitlements={{
          tier: 'PRO_GM',
          pricing: { currency: 'USD', monthlyPriceCents: 4999, annualPriceCents: 49999 },
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
            activeHostedCampaigns: null,
            playerSeatsPerCampaign: 12,
            publicListings: null,
            savedEncounters: null,
            paidTablesEnabled: true,
            platformFeeBasisPoints: 0
          }
        }}
      />
    )

    expect(screen.getByText('Pro GM')).toBeInTheDocument()
    expect(screen.getByText(/\$49\.99\/month/)).toBeInTheDocument()
    expect(screen.getAllByText('Unlimited')).toHaveLength(5)
    expect(screen.getByText('25 GB')).toBeInTheDocument()
    expect(screen.getByText('Payment-processing costs still apply.')).toBeInTheDocument()
  })
})
