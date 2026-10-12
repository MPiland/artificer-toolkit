import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Button } from '@mantine/core'
import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import { z } from 'zod'
import {
  createSocialListingInputSchema,
  updateSocialListingInputSchema,
  socialListingDtoSchema,
  socialListingVersionInputSchema
} from '@artificer-toolkit/schema/api/socialHub'
import { expect, fn, mocked, userEvent, waitFor, within } from 'storybook/test'
import { SocialListingFormPage } from './SocialListingFormPage'

const listing = socialListingDtoSchema.parse({
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
const names = {
  create: getFunctionName(api.social.listingDrafts.create),
  remove: getFunctionName(api.social.listingDrafts.remove),
  update: getFunctionName(api.social.listings.update),
  open: getFunctionName(api.social.listings.open),
  close: getFunctionName(api.social.listings.close)
}
const writes = fn()
const more = fn()
function Fixture({ creating = false }: { creating?: boolean }) {
  const queryClient = useQueryClient()
  const server = useRef(listing)
  const [campaignsLoaded, setCampaignsLoaded] = useState(false)
  const listingKey = convexQuery(api.social.listings.getOwned, {
    listingPublicId: listing.listingPublicId
  }).queryKey
  queryClient.setQueryDefaults(listingKey, { queryFn: async () => server.current })
  queryClient.setQueryDefaults(['convexQuery', getFunctionName(api.content.systems.list)], {
    queryFn: async () => ({
      page: [
        {
          id: listing.system.systemId,
          label: listing.system.label,
          rulesetCode: 'SRD',
          rulesetVersion: '2014'
        }
      ],
      isDone: true,
      continueCursor: ''
    })
  })
  mocked(usePaginatedQuery).mockImplementation((reference, args) => {
    if (getFunctionName(reference) !== getFunctionName(api.campaigns.queries.list))
      throw new Error('Unexpected native list')
    return {
      results:
        campaignsLoaded && args !== 'skip'
          ? [
              {
                id: 'dddddddd-4444-4444-8444-444444444444',
                name: listing.title,
                role: 'OWNER',
                status: 'ACTIVE',
                format: 'ONGOING',
                toneTags: [],
                contentMaturity: 'STANDARD'
              }
            ]
          : [],
      isLoading: false,
      status: campaignsLoaded || args === 'skip' ? 'Exhausted' : 'CanLoadMore',
      loadMore: (count: number) => {
        more(count)
        setCampaignsLoaded(true)
      }
    }
  })
  mocked(useConvexMutation).mockImplementation((reference) => {
    const mutate: ReturnType<typeof useConvexMutation> = Object.assign(
      async (args?: unknown) => {
        const name = getFunctionName(reference)
        writes(name, args)
        if (name === names.create) {
          z.object({ input: createSocialListingInputSchema }).parse(args)
          throw new Error('Creation unavailable.')
        }
        if (name === names.remove) {
          socialListingVersionInputSchema.parse(args)
          throw new Error('Deletion unavailable.')
        }
        if (name === names.update) {
          const { input } = z.object({ input: updateSocialListingInputSchema }).parse(args)
          if (input.expectedVersion !== server.current.version)
            throw new Error('Listing changed. Reload before saving.')
          server.current = {
            ...server.current,
            summary: input.summary,
            status: server.current.status === 'CLOSED' ? 'DRAFT' : server.current.status,
            version: server.current.version + 1
          }
          return server.current
        }
        if (name !== names.open && name !== names.close)
          throw new Error('Unexpected native mutation')
        const input = socialListingVersionInputSchema.parse(args)
        if (input.expectedVersion !== server.current.version) throw new Error('Listing changed.')
        server.current = {
          ...server.current,
          status: name === names.open ? 'OPEN' : 'CLOSED',
          version: server.current.version + 1
        }
        return server.current
      },
      { withOptimisticUpdate: () => mutate }
    )
    return mutate
  })
  return (
    <>
      {!creating ? (
        <Button
          onClick={() => {
            server.current = {
              ...server.current,
              summary: 'Another editor saved this.',
              version: 10
            }
            queryClient.setQueryData(listingKey, server.current)
          }}
        >
          Simulate another editor
        </Button>
      ) : null}
      <SocialListingFormPage
        listingPublicId={creating ? undefined : listing.listingPublicId.toUpperCase()}
      />
    </>
  )
}
const meta = {
  title: 'Social/Listing/Native editor',
  component: Fixture,
  beforeEach: () => {
    writes.mockClear()
    more.mockClear()
  }
} satisfies Meta<typeof Fixture>
export default meta
type Story = StoryObj<typeof meta>

export const SaveOpenCloseAndReturnToDraft: Story = {
  play: async ({ canvas }) => {
    const summary = await canvas.findByRole('textbox', { name: /Summary/ })
    await waitFor(() => expect(summary).toHaveValue(listing.summary))
    await userEvent.type(summary, ' More adventures.')
    await expect(canvas.getByRole('button', { name: 'Open listing' })).toBeDisabled()
    await userEvent.click(canvas.getByRole('button', { name: 'Save listing' }))
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Open listing' })).toBeEnabled())
    await expect(writes).toHaveBeenCalledWith(
      names.update,
      expect.objectContaining({
        input: expect.objectContaining({
          listingPublicId: listing.listingPublicId,
          expectedVersion: 2,
          summary: `${listing.summary} More adventures.`
        })
      })
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Open listing' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Close listing' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Return to draft' }))
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Open listing' })).toBeEnabled())
    await expect(writes).toHaveBeenCalledWith(names.open, {
      listingPublicId: listing.listingPublicId,
      expectedVersion: 3
    })
    await expect(writes).toHaveBeenCalledWith(names.close, {
      listingPublicId: listing.listingPublicId,
      expectedVersion: 4
    })
    await expect(writes).toHaveBeenLastCalledWith(
      names.update,
      expect.objectContaining({ input: expect.objectContaining({ expectedVersion: 5 }) })
    )
  }
}
export const LiveConflictAndDeleteFailureKeepDraft: Story = {
  play: async ({ canvas }) => {
    const summary = await canvas.findByRole('textbox', { name: /Summary/ })
    await waitFor(() => expect(summary).toHaveValue(listing.summary))
    await userEvent.type(summary, ' Unsaved work.')
    await userEvent.click(canvas.getByRole('button', { name: 'Simulate another editor' }))
    await expect(summary).toHaveValue(`${listing.summary} Unsaved work.`)
    await userEvent.click(canvas.getByRole('button', { name: 'Save listing' }))
    await expect(await canvas.findByText('Listing changed. Reload before saving.')).toBeVisible()
    await expect(writes).toHaveBeenLastCalledWith(
      names.update,
      expect.objectContaining({ input: expect.objectContaining({ expectedVersion: 2 }) })
    )
    const originalConfirm = window.confirm
    window.confirm = () => true
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Delete draft' }))
      await expect(await canvas.findByText('Deletion unavailable.')).toBeVisible()
      await expect(summary).toHaveValue(`${listing.summary} Unsaved work.`)
      await expect(writes).toHaveBeenLastCalledWith(names.remove, {
        listingPublicId: listing.listingPublicId,
        expectedVersion: 2
      })
    } finally {
      window.confirm = originalConfirm
    }
  }
}
export const CreateFromLaterCampaignPage: Story = {
  args: { creating: true },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Load more Campaigns' }))
    await expect(more).toHaveBeenCalledWith(8)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('combobox', { name: 'Campaign' }))
    await userEvent.click(await body.findByRole('option', { name: listing.title }))
    await userEvent.click(canvas.getByRole('combobox', { name: 'System and ruleset' }))
    await userEvent.click(await body.findByRole('option', { name: 'Fifth Edition (SRD 2014)' }))
    for (const label of [
      'Summary',
      'Schedule summary',
      'Content guidance',
      'Attendance policy',
      'Allowed content and rules',
      'Table conduct',
      'Content boundaries',
      'How safety practices are used'
    ]) {
      await userEvent.type(
        canvas.getByRole('textbox', { name: new RegExp(`^${label}`) }),
        'A welcoming weekly table.'
      )
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Save listing' }))
    await expect(await canvas.findByText('Creation unavailable.')).toBeVisible()
    await expect(writes).toHaveBeenLastCalledWith(names.create, {
      input: expect.objectContaining({
        campaignId: 'dddddddd-4444-4444-8444-444444444444',
        systemId: listing.system.systemId,
        summary: 'A welcoming weekly table.'
      })
    })
  }
}
