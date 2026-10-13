import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import { socialListingDtoSchema } from '@artificer-toolkit/schema/api/socialHub'
import { renderWithAppProviders } from '#test/renderWithAppProviders'

const baseListing = socialListingDtoSchema.parse({
  listingPublicId: 'aaaaaaaa-1111-4111-8111-111111111111',
  host: { profilePublicId: 'bbbbbbbb-2222-4222-8222-222222222222', username: 'HarborHost' },
  title: 'The Glass Harbor',
  summary: 'Weekly adventures in a coastal city.',
  status: 'DRAFT',
  audience: 'PUBLIC',
  moderationStatus: 'VISIBLE',
  system: {
    systemId: 'cccccccc-3333-4333-8333-333333333333',
    label: 'Fifth Edition',
    rulesetCode: 'SRD',
    rulesetVersion: '2014'
  },
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  toneDetails: null,
  contentMaturity: 'STANDARD',
  playMode: 'ONLINE',
  capacity: 4,
  availableSeats: 2,
  ageBand: '13_PLUS',
  schedule: { kind: 'FLEXIBLE', timeZone: 'America/Chicago', summary: 'Agree a weekly evening' },
  location: null,
  expectations: {
    contentGuidance: 'Fantasy adventure',
    attendancePolicy: 'Tell us if you cannot attend.',
    allowedContentRules: 'SRD',
    tableConduct: 'Respect each other.',
    contentBoundaries: 'Discuss before play.',
    safetyPractices: ['LINES_AND_VEILS'],
    safetyDetails: 'Pause when needed.'
  },
  isFree: true,
  publishedAt: null,
  version: 2
})
const otherListing = {
  ...baseListing,
  listingPublicId: 'aaaaaaaa-5555-4555-8555-555555555555',
  title: 'The Iron Vault',
  summary: 'A heist campaign under the mountain.'
}
const listings = new Map([baseListing, otherListing].map((entry) => [entry.listingPublicId, entry]))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (getFunctionName(reference) !== getFunctionName(api.social.listings.getOwned))
      throw new Error(`Unexpected query ${getFunctionName(reference)}`)
    const { listingPublicId } = args as { listingPublicId: string }
    return {
      queryKey: ['listing', listingPublicId],
      queryFn: async () => listings.get(listingPublicId),
      refetchInterval: 20
    }
  }
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  usePaginatedQuery: () => ({
    results: [],
    isLoading: false,
    status: 'Exhausted',
    loadMore: vi.fn()
  }),
  useMutation: () => vi.fn()
}))

vi.mock('#app/data/systems/useSystemList', () => ({
  useSystemList: () => ({
    isPending: false,
    isError: false,
    data: [
      {
        id: baseListing.system.systemId,
        label: baseListing.system.label,
        rulesCatalogues: []
      }
    ]
  })
}))

import { SocialListingFormPage } from './SocialListingFormPage'

describe('SocialListingFormPage', () => {
  it('seeds the form from the loaded listing and keeps later typing', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<SocialListingFormPage listingPublicId={baseListing.listingPublicId} />)

    const summary = await screen.findByRole('textbox', { name: /Summary/ })
    expect(summary).toHaveValue(baseListing.summary)
    await user.type(summary, ' More.')

    expect(screen.getByRole('textbox', { name: /Summary/ })).toHaveValue(
      `${baseListing.summary} More.`
    )
  })

  it('keeps typing when the same listing refetches with new data', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<SocialListingFormPage listingPublicId={baseListing.listingPublicId} />)
    await user.type(await screen.findByRole('textbox', { name: /Summary/ }), ' Unsaved.')

    listings.set(baseListing.listingPublicId, {
      ...baseListing,
      title: 'The Glass Harbor Reborn',
      summary: 'Rewritten elsewhere.',
      version: 3
    })

    try {
      expect(
        await screen.findByRole('heading', { name: 'Manage The Glass Harbor Reborn' })
      ).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /Summary/ })).toHaveValue(
        `${baseListing.summary} Unsaved.`
      )
    } finally {
      listings.set(baseListing.listingPublicId, baseListing)
    }
  })

  it('starts from the other listing’s values when a different listing is opened', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithAppProviders(
      <SocialListingFormPage listingPublicId={baseListing.listingPublicId} />
    )
    await user.type(await screen.findByRole('textbox', { name: /Summary/ }), ' Unsaved.')

    rerender(<SocialListingFormPage listingPublicId={otherListing.listingPublicId} />)

    expect(await screen.findByDisplayValue(otherListing.summary)).toBeInTheDocument()
    expect(screen.queryByDisplayValue(/Unsaved/)).not.toBeInTheDocument()
  })
})
