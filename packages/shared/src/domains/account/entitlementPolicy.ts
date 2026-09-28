const MEBIBYTE = 1024 * 1024
const GIBIBYTE = 1024 * MEBIBYTE

export const ENTITLEMENT_LIMITS = {
  FREE: {
    storageBytes: 100 * MEBIBYTE,
    personalCharacters: 6,
    homebrewRoots: 20,
    activeHostedCampaigns: 1,
    playerSeatsPerCampaign: 5,
    publicListings: 1,
    savedEncounters: 10,
    campaignEntriesPerCampaign: 150,
    scenesPerCampaign: 5,
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
    savedEncounters: 10,
    campaignEntriesPerCampaign: 150,
    scenesPerCampaign: 5,
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
    campaignEntriesPerCampaign: null,
    scenesPerCampaign: null,
    paidTablesEnabled: true,
    platformFeeBasisPoints: 1000
  },
  PRO_GM: {
    storageBytes: 25 * GIBIBYTE,
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
} as const

/**
 * Invisible abuse guards for the per-Campaign limits that plans present as unlimited (`null`).
 * Enforced server-side only; never part of the entitlement DTO or any plan copy.
 */
export const CAMPAIGN_CONTENT_SAFETY_CAPS = {
  campaignEntriesPerCampaign: 5_000,
  scenesPerCampaign: 250
} as const

export const ENTITLEMENT_PRICING = {
  FREE: { currency: 'USD', monthlyPriceCents: 0, annualPriceCents: 0 },
  PLAYER: { currency: 'USD', monthlyPriceCents: 299, annualPriceCents: 2999 },
  GM: { currency: 'USD', monthlyPriceCents: 999, annualPriceCents: 9999 },
  PRO_GM: { currency: 'USD', monthlyPriceCents: 2499, annualPriceCents: 24999 }
} as const
