import { describe, expect, it } from 'vitest'

import { createCampaignInviteInputSchema, campaignInviteDtoSchema } from '../api/campaignCore.js'
import {
  createSocialListingInputSchema,
  socialListingDtoSchema,
  submitSocialApplicationInputSchema,
  updateSocialContentPreferenceInputSchema
} from '../api/socialHub.js'
import { socialStoredBlockSchema } from '../projections/socialPersistence.js'
import {
  socialBrowseInputSchema,
  socialSearchInputSchema,
  socialSearchBackfillInputSchema
} from '../api/socialDiscovery.js'
import {
  socialAdmissionListInputSchema,
  socialListingAdmissionListInputSchema,
  socialInvitationListInputSchema,
  socialListingInvitationListInputSchema,
  socialApplicationPageSchema,
  socialInvitationPageSchema
} from '../api/socialAdmissionLists.js'

const id = 'f3e3a390-5b22-4a1f-8a0b-bf7f184bd7c9'

const expectations = {
  contentGuidance: 'Fantasy violence',
  attendancePolicy: 'Give 24 hours notice when possible.',
  allowedContentRules: 'Published first-party options.',
  tableConduct: 'Share the spotlight and respect boundaries.',
  contentBoundaries: 'No sexual violence.',
  safetyPractices: ['SESSION_ZERO', 'X_CARD'] as const,
  safetyDetails: 'We review lines and veils before play.'
}

const createListing = {
  campaignId: id,
  summary: 'A fortnightly journey through a haunted frontier.',
  audience: 'PUBLIC' as const,
  systemId: id,
  playMode: 'ONLINE' as const,
  capacity: 5,
  schedule: {
    kind: 'RECURRING' as const,
    timeZone: 'America/Chicago',
    summary: 'Every other Thursday evening',
    weekday: 4,
    localStartTime: '19:00',
    recurrence: 'BIWEEKLY' as const
  },
  location: null,
  expectations
}

describe('Social Hub contracts', () => {
  it('bounds native discovery terms and pagination without accepting owner or search metadata', () => {
    const input = { paginationOpts: { cursor: null, numItems: 8 } }
    expect(socialBrowseInputSchema.parse(input)).toEqual(input)
    expect(
      socialSearchInputSchema.safeParse({
        ...input,
        query: 'table',
        paginationOpts: { cursor: null, numItems: 9 }
      }).success
    ).toBe(false)
    expect(socialSearchInputSchema.parse({ ...input, query: '  héroic table  ' }).query).toBe(
      'héroic table'
    )
    expect(socialSearchInputSchema.safeParse({ ...input, query: 'a'.repeat(200) }).success).toBe(
      true
    )
    for (const query of [
      '',
      '---',
      'a'.repeat(201),
      Array.from({ length: 17 }, () => 'word').join(' ')
    ])
      expect(socialSearchInputSchema.safeParse({ ...input, query }).success).toBe(false)
    for (const extra of [
      { ownerUserId: id },
      { query: 'table' },
      { limit: 20 },
      { search: { version: 1, text: 'table' } }
    ])
      expect(socialBrowseInputSchema.safeParse({ ...input, ...extra }).success).toBe(false)
    for (const numItems of [0, 49, 1.5])
      expect(
        socialBrowseInputSchema.safeParse({ paginationOpts: { cursor: null, numItems } }).success
      ).toBe(false)
    expect(
      socialSearchBackfillInputSchema.safeParse({ paginationOpts: { cursor: null, numItems: 8 } })
        .success
    ).toBe(true)
    expect(
      socialSearchBackfillInputSchema.safeParse({ paginationOpts: { cursor: null, numItems: 9 } })
        .success
    ).toBe(false)
    expect(
      createSocialListingInputSchema.safeParse({
        ...createListing,
        search: { version: 1, text: 'spoof' }
      }).success
    ).toBe(false)
  })

  it('bounds admission inbox requests and rejects caller-supplied identities', () => {
    const input = { group: 'PENDING', paginationOpts: { cursor: null, numItems: 8 } }
    expect(socialAdmissionListInputSchema.parse(input)).toEqual(input)
    expect(socialListingAdmissionListInputSchema.parse({ ...input, listingPublicId: id })).toEqual({
      ...input,
      listingPublicId: id
    })
    for (const numItems of [0, 49, 1.5]) {
      expect(
        socialAdmissionListInputSchema.safeParse({
          ...input,
          paginationOpts: { cursor: null, numItems }
        }).success
      ).toBe(false)
    }
    expect(socialAdmissionListInputSchema.safeParse({ ...input, userId: id }).success).toBe(false)
    const asOf = '2026-09-08T12:00:00.000Z'
    expect(socialInvitationListInputSchema.parse({ ...input, asOf })).toEqual({ ...input, asOf })
    expect(
      socialListingInvitationListInputSchema.parse({ ...input, asOf, listingPublicId: id })
    ).toEqual({ ...input, asOf, listingPublicId: id })
    for (const invalid of [undefined, 'invalid', '2026-09-08', 0]) {
      expect(socialInvitationListInputSchema.safeParse({ ...input, asOf: invalid }).success).toBe(
        false
      )
      expect(
        socialListingInvitationListInputSchema.safeParse({
          ...input,
          listingPublicId: id,
          asOf: invalid
        }).success
      ).toBe(false)
    }
    expect(
      socialListingAdmissionListInputSchema.safeParse({ ...input, listingPublicId: 'invalid' })
        .success
    ).toBe(false)
  })

  it('keeps inbox envelopes closed and preserves only the existing application/invitation DTOs', () => {
    const page = {
      page: [],
      isDone: false,
      continueCursor: 'opaque',
      splitCursor: null,
      pageStatus: null
    }
    expect(socialApplicationPageSchema.parse(page)).toEqual(page)
    expect(socialInvitationPageSchema.parse(page)).toEqual(page)
    for (const forbidden of ['campaignId', 'userId', 'email', 'totalCount']) {
      expect(socialApplicationPageSchema.safeParse({ ...page, [forbidden]: id }).success).toBe(
        false
      )
      expect(socialInvitationPageSchema.safeParse({ ...page, [forbidden]: id }).success).toBe(false)
    }
    expect(
      socialApplicationPageSchema.safeParse({
        ...page,
        page: [{ applicationPublicId: id, message: 'private' }]
      }).success
    ).toBe(false)
    expect(
      socialInvitationPageSchema.safeParse({
        ...page,
        page: [{ invitePublicId: id, token: 'secret' }]
      }).success
    ).toBe(false)
  })

  it('stores canonical directional block identities and rejects self-blocks or extra private data', () => {
    const block = {
      blockerProfileId: id.toUpperCase(),
      blockedProfileId: '10000000-0000-4000-8000-000000000001',
      createdAt: '2026-09-08T12:00:00.000Z'
    }
    expect(socialStoredBlockSchema.parse(block)).toEqual({ ...block, blockerProfileId: id })
    expect(socialStoredBlockSchema.safeParse({ ...block, blockedProfileId: id }).success).toBe(
      false
    )
    expect(
      socialStoredBlockSchema.safeParse({ ...block, blockerProfileId: 'invalid' }).success
    ).toBe(false)
    expect(
      socialStoredBlockSchema.safeParse({ ...block, email: 'private@example.invalid' }).success
    ).toBe(false)
  })

  it('keeps birth dates limited to the optional Mature self-attestation', () => {
    expect(
      updateSocialContentPreferenceInputSchema.safeParse({
        contentPreference: 'MATURE',
        birthDate: '2000-01-01'
      }).success
    ).toBe(true)
    expect(
      updateSocialContentPreferenceInputSchema.safeParse({
        contentPreference: 'STANDARD',
        birthDate: '2000-01-01'
      }).success
    ).toBe(false)
  })

  it('validates schedule and public location together without accepting language ownership', () => {
    expect(createSocialListingInputSchema.safeParse(createListing).success).toBe(true)
    expect(
      createSocialListingInputSchema.safeParse({ ...createListing, languageCode: 'en-US' }).success
    ).toBe(false)
    expect(
      createSocialListingInputSchema.safeParse({
        ...createListing,
        playMode: 'IN_PERSON',
        location: null
      }).success
    ).toBe(false)
    expect(
      createSocialListingInputSchema.safeParse({
        ...createListing,
        priceAmount: 1000,
        priceCurrency: 'USD'
      }).success
    ).toBe(false)
  })

  it('keeps internal identifiers and credentials out of public listing DTOs', () => {
    const listing = {
      listingPublicId: id,
      host: { profilePublicId: id, username: 'tablehost' },
      title: 'The Lantern Road',
      summary: createListing.summary,
      status: 'OPEN',
      audience: 'PUBLIC',
      moderationStatus: 'VISIBLE',
      system: {
        systemId: id,
        label: 'Dungeons & Dragons',
        rulesetCode: 'dnd-5e',
        rulesetVersion: '2024'
      },
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      toneDetails: 'Collaborative heroic fantasy',
      contentMaturity: 'STANDARD',
      playMode: createListing.playMode,
      capacity: createListing.capacity,
      availableSeats: 4,
      ageBand: '13_PLUS',
      schedule: createListing.schedule,
      location: null,
      expectations,
      isFree: true,
      publishedAt: '2026-08-10T12:00:00.000Z',
      version: 1
    }

    expect(socialListingDtoSchema.safeParse(listing).success).toBe(true)
    for (const forbidden of ['campaignId', 'userId', 'email', 'token', 'session']) {
      expect(socialListingDtoSchema.safeParse({ ...listing, [forbidden]: 'secret' }).success).toBe(
        false
      )
    }
  })

  it('uses authenticated inbox invitation identifiers, never bearer values', () => {
    const createInvite = {
      listingPublicId: id,
      expectedListingVersion: 2,
      username: 'invited-player'
    }
    expect(createCampaignInviteInputSchema.safeParse(createInvite).success).toBe(true)
    expect(
      createCampaignInviteInputSchema.safeParse({ ...createInvite, kind: 'LINK', token: 'secret' })
        .success
    ).toBe(false)

    const invite = {
      invitePublicId: id,
      listingPublicId: id,
      listingTitle: 'The Lantern Road',
      hostProfilePublicId: id,
      hostUsername: 'tablehost',
      recipientUsername: 'invited-player',
      status: 'PENDING',
      expiresAt: '2026-08-17T12:00:00.000Z',
      respondedAt: null,
      createdAt: '2026-08-10T12:00:00.000Z',
      version: 0
    }
    expect(campaignInviteDtoSchema.safeParse(invite).success).toBe(true)
    expect(campaignInviteDtoSchema.safeParse({ ...invite, token: 'secret' }).success).toBe(false)
  })

  it('requires the listing version when an application is submitted', () => {
    expect(
      submitSocialApplicationInputSchema.safeParse({
        listingPublicId: id,
        expectedListingVersion: 3,
        message: 'I enjoy character-focused campaigns and can attend consistently.'
      }).success
    ).toBe(true)
  })
})
