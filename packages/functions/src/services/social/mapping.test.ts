import { describe, expect, it } from 'vitest'
import type { SocialListingRecord } from '@artificer-toolkit/db'
import { mapSocialListing } from './mapping.js'

const listing = {
  id: '00000000-0000-4000-8000-000000000001',
  campaignId: '00000000-0000-4000-8000-000000000002',
  campaignOwnerUserId: '00000000-0000-4000-8000-000000000003',
  campaignStatus: 'ACTIVE',
  hostProfileId: '00000000-0000-4000-8000-000000000004',
  hostUsername: 'host-user',
  status: 'OPEN',
  audience: 'PUBLIC',
  moderationStatus: 'VISIBLE',
  systemId: '00000000-0000-4000-8000-000000000005',
  systemLabel: 'System',
  rulesetCode: 'RULESET',
  rulesetVersion: '1',
  title: 'Shit-Forged Table',
  summary: 'A shitstorm-fueled one-shot.',
  campaignFormat: 'ONE_SHOT',
  toneTags: ['GRITTY'],
  toneDetails: 'Dark shit happens.',
  contentMaturity: 'MATURE',
  playMode: 'ONLINE',
  capacity: 5,
  activePlayerCount: 0,
  scheduleKind: 'FLEXIBLE',
  timeZone: 'America/Chicago',
  scheduleSummary: 'One shitstorm evening.',
  startsAt: null,
  weekday: null,
  localStartTime: null,
  recurrence: null,
  city: null,
  stateCode: null,
  contentGuidance: 'Strong shit.',
  attendancePolicy: 'Be on time.',
  allowedContentRules: 'Ask first.',
  tableConduct: 'Respect everyone.',
  contentBoundaries: 'No harassment.',
  safetyPractices: ['SESSION_ZERO'],
  safetyDetails: 'Use the X-card.',
  isFree: true,
  priceAmount: null,
  priceCurrency: null,
  publishedAt: '2026-08-10T12:00:00.000Z',
  version: 1,
  createdAt: '2026-08-10T12:00:00.000Z',
  updatedAt: '2026-08-10T12:00:00.000Z'
} satisfies SocialListingRecord

describe('Social maturity presentation', () => {
  it('masks Mature Social text for the default Standard preference', () => {
    const presented = mapSocialListing(listing)

    expect(presented.title).toBe('****-Forged Table')
    expect(presented.summary).toBe('A ****storm-fueled one-shot.')
  })

  it('shows Mature Social text for an opted-in viewer', () => {
    expect(mapSocialListing(listing, { showMatureText: true }).summary).toBe(listing.summary)
  })

  it('still masks Standard shared text when the viewer opted into Mature content', () => {
    const standard = { ...listing, contentMaturity: 'STANDARD' as const }

    expect(mapSocialListing(standard, { showMatureText: true }).summary).toBe(
      'A ****storm-fueled one-shot.'
    )
    expect(mapSocialListing(standard, { privateOwnerView: true }).summary).toBe(listing.summary)
  })
})
