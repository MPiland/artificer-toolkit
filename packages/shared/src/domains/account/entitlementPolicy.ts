const MEBIBYTE = 1024 * 1024
const GIBIBYTE = 1024 * MEBIBYTE

export const ENTITLEMENT_LIMITS = {
  FREE: {
    storageBytes: 250 * MEBIBYTE,
    personalCharacters: 6,
    homebrewRoots: 20,
    activeHostedCampaigns: 1,
    playerSeatsPerCampaign: 5,
    publicListings: 1,
    savedEncounters: 3,
    paidTablesEnabled: false,
    platformFeeBasisPoints: 0
  },
  PLAYER: {
    storageBytes: GIBIBYTE,
    personalCharacters: null,
    homebrewRoots: null,
    activeHostedCampaigns: 1,
    playerSeatsPerCampaign: 5,
    publicListings: 1,
    savedEncounters: 3,
    paidTablesEnabled: false,
    platformFeeBasisPoints: 0
  },
  GM: {
    storageBytes: 5 * GIBIBYTE,
    personalCharacters: null,
    homebrewRoots: null,
    activeHostedCampaigns: 5,
    playerSeatsPerCampaign: 12,
    publicListings: 5,
    savedEncounters: null,
    paidTablesEnabled: true,
    platformFeeBasisPoints: 1000
  },
  PRO_GM: {
    storageBytes: 25 * GIBIBYTE,
    personalCharacters: null,
    homebrewRoots: null,
    activeHostedCampaigns: null,
    playerSeatsPerCampaign: 12,
    publicListings: null,
    savedEncounters: null,
    paidTablesEnabled: true,
    platformFeeBasisPoints: 0
  }
} as const

export const ENTITLEMENT_PRICING = {
  FREE: { currency: 'USD', monthlyPriceCents: 0, annualPriceCents: 0 },
  PLAYER: { currency: 'USD', monthlyPriceCents: 499, annualPriceCents: 4999 },
  GM: { currency: 'USD', monthlyPriceCents: 999, annualPriceCents: 9999 },
  PRO_GM: { currency: 'USD', monthlyPriceCents: 4999, annualPriceCents: 49999 }
} as const
