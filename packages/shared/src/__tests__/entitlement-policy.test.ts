import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_CONTENT_SAFETY_CAPS,
  ENTITLEMENT_LIMITS,
  ENTITLEMENT_PRICING
} from '../domains/account/entitlementPolicy.js'

const MEBIBYTE = 1024 * 1024
const GIBIBYTE = 1024 * MEBIBYTE

describe('entitlement policy (Q18 tier matrix)', () => {
  it('prices each tier monthly and annually', () => {
    expect(ENTITLEMENT_PRICING).toEqual({
      FREE: { currency: 'USD', monthlyPriceCents: 0, annualPriceCents: 0 },
      PLAYER: { currency: 'USD', monthlyPriceCents: 299, annualPriceCents: 2999 },
      GM: { currency: 'USD', monthlyPriceCents: 999, annualPriceCents: 9999 },
      PRO_GM: { currency: 'USD', monthlyPriceCents: 2499, annualPriceCents: 24999 }
    })
  })

  it('sets the owned, hosted and per-Campaign limits', () => {
    expect(ENTITLEMENT_LIMITS).toEqual({
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
    })
  })

  it('keeps hidden safety caps above every finite per-Campaign plan limit', () => {
    for (const limits of Object.values(ENTITLEMENT_LIMITS)) {
      for (const resource of ['campaignEntriesPerCampaign', 'scenesPerCampaign'] as const) {
        const limit = limits[resource]
        if (limit !== null) expect(CAMPAIGN_CONTENT_SAFETY_CAPS[resource]).toBeGreaterThan(limit)
      }
    }
  })
})
