import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation as useConvexMutation } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  submitSocialApplicationInputSchema,
  type SocialListingDto
} from '@artificer-toolkit/schema/api/socialHub'
import { expect, fn, mocked, userEvent, waitFor, within } from 'storybook/test'
import { SocialListingDetailPage } from './SocialListingDetailPage'

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
const submit = fn<(input: unknown) => Promise<null>>()
const meta = {
  title: 'Social/Listing/Native detail',
  component: SocialListingDetailPage,
  args: { listingPublicId: listing.listingPublicId.toUpperCase() },
  beforeEach: () => {
    submit.mockReset().mockResolvedValue(null)
  },
  decorators: [
    (Story, context) => {
      const queryClient = useQueryClient()
      queryClient.setQueryDefaults(
        convexQuery(api.social.discovery.getListing, { listingPublicId: listing.listingPublicId })
          .queryKey,
        { queryFn: async () => listing }
      )
      queryClient.setQueryDefaults(convexQuery(api.social.profiles.getEligibility, {}).queryKey, {
        queryFn: async () => ({
          eligible: true,
          status: 'ACTIVE',
          profilePublicId: context.parameters.isHost
            ? listing.host.profilePublicId
            : 'dddddddd-4444-4444-8444-444444444444',
          contentPreference: 'STANDARD',
          adultAttestedAt: null
        })
      })
      mocked(useConvexMutation).mockImplementation((reference) => {
        const mutate: ReturnType<typeof useConvexMutation> = Object.assign(
          async (input?: unknown) => {
            if (getFunctionName(reference) !== 'social/applications:submit')
              throw new Error('Unexpected native mutation')
            return submit(submitSocialApplicationInputSchema.parse(input))
          },
          { withOptimisticUpdate: () => mutate }
        )
        return mutate
      })
      return <Story />
    }
  ]
} satisfies Meta<typeof SocialListingDetailPage>
export default meta
type Story = StoryObj<typeof meta>

export const ApplicantSendsApplication: Story = {
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole('heading', { name: listing.title })
    await userEvent.click(await canvas.findByRole('button', { name: 'Apply to join' }))
    const body = within(canvasElement.ownerDocument.body)
    const dialog = within(await body.findByRole('dialog'))
    await userEvent.type(
      await dialog.findByRole('textbox', { name: /Message to the host/ }),
      'I would like to join this table.'
    )
    await userEvent.click(dialog.getByRole('button', { name: 'Send application' }))
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument())
    await expect(submit).toHaveBeenCalledWith({
      listingPublicId: listing.listingPublicId,
      expectedListingVersion: 2,
      message: 'I would like to join this table.'
    })
  }
}

export const HostCannotApply: Story = {
  parameters: { isHost: true },
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: listing.title })
    await expect(canvas.queryByRole('button', { name: 'Apply to join' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Report' })).not.toBeInTheDocument()
  }
}
