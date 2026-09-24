import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { SocialListingDto } from '@artificer-toolkit/schema/api/socialHub'
import { usePaginatedQuery } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { expect, fn, mocked, userEvent, waitFor, within } from 'storybook/test'
import type { SocialHubSearch } from '../socialSearch'
import { SocialDiscoveryView } from './SocialDiscoveryView'
import { SocialHostingView } from './SocialHostingView'
const listing: SocialListingDto = {
  listingPublicId: 'aaaaaaaa-1111-4111-8111-111111111111',
  host: { profilePublicId: 'bbbbbbbb-2222-4222-8222-222222222222', username: 'HarborHost' },
  title: 'The Glass Harbor',
  summary: 'Weekly adventures in a coastal city.',
  status: 'OPEN',
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
  publishedAt: '2024-03-01T12:00:00.000Z',
  version: 2
}
const reads = fn()
const more = fn()
function Fixture({
  view = 'discovery',
  empty = false
}: {
  view?: 'discovery' | 'hosting'
  empty?: boolean
}) {
  const [search, setSearch] = useState<SocialHubSearch>({ view: 'discover' })
  const [loaded, setLoaded] = useState(false)
  const queryClient = useQueryClient()
  queryClient.setQueryDefaults(['convexQuery', 'content/systems:list'], {
    queryFn: async () => ({ page: [], isDone: true, continueCursor: '' })
  })
  mocked(usePaginatedQuery).mockImplementation((reference, args, options) => {
    const name = getFunctionName(reference)
    reads(name, args, options)
    if (args === 'skip')
      return { results: [], status: 'Exhausted', isLoading: false, loadMore: fn() }
    return {
      results: loaded && !empty ? [listing] : [],
      status: loaded || empty ? 'Exhausted' : 'CanLoadMore',
      isLoading: false,
      loadMore: (count: number) => {
        more(name, count)
        setLoaded(true)
      }
    }
  })
  if (view === 'hosting') return <SocialHostingView />
  return (
    <SocialDiscoveryView
      search={search}
      onSearchChange={(next) => {
        setSearch(next)
        setLoaded(false)
      }}
    />
  )
}

const meta = {
  title: 'Social/Native discovery and hosting',
  component: Fixture,
  parameters: { layout: 'fullscreen' },
  beforeEach: () => {
    reads.mockClear()
    more.mockClear()
  }
} satisfies Meta<typeof Fixture>
export default meta
type Story = StoryObj<typeof meta>

export const BrowseThenSearch: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryByText('No tables match')).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Load more tables' }))
    await expect(await canvas.findByRole('link', { name: listing.title })).toBeVisible()
    await expect(more).toHaveBeenCalledWith('social/discoveryLists:browse', 8)
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Search table titles and summaries' }),
      'harbor'
    )
    await expect(reads).toHaveBeenCalledWith(
      'social/discoveryLists:search',
      expect.objectContaining({ query: 'harbor' }),
      { initialNumItems: 8 }
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Load more tables' }))
    await expect(more).toHaveBeenCalledWith('social/discoveryLists:search', 8)
    await userEvent.click(canvas.getByRole('button', { name: 'Filters' }))
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() =>
      expect(body.getByRole('dialog', { name: 'Discovery filters' })).toBeVisible()
    )
    await userEvent.click(body.getByRole('button', { name: 'Close discovery filters' }))
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument())
  }
}
export const ExhaustedSearch: Story = {
  args: { empty: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No tables match')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Load more tables' })).not.toBeInTheDocument()
  }
}
export const HostedPage: Story = {
  args: { view: 'hosting' },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryByText('No hosted listings')).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Load more hosted listings' }))
    await expect(await canvas.findByRole('link', { name: listing.title })).toBeVisible()
    await expect(more).toHaveBeenCalledWith('social/listings:listOwned', 8)
    await expect(canvas.getByRole('button', { name: 'Edit listing' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Review applications' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Invite player' }))
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByRole('dialog')).toBeVisible())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument())
  }
}
