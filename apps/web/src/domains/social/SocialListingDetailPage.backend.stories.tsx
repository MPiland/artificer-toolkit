import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@artificer-toolkit/apis/convex/api'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { writesTo } from '#app/test/storybook/storyWrites'
import {
  STORY_CAMPAIGN,
  type StoryAccountKey
} from '../../../../apis/tests/developmentReviewDataScenarios'
import { SeededAppliedListing, SeededHostedListing } from './stories/SeededSocialListing'
import { readSeededListing } from './stories/seededListing'
import { socialStoryLoadTimeout } from './stories/storyLoad'
import { SocialListingDetailPage } from './SocialListingDetailPage'

function SeededListingDetail({ viewer }: { viewer: 'applicant' | 'host' }) {
  // The page shows the host no actions only once this read settles, so the marker tells a play
  // function that the absence is real.
  const eligibility = useQuery(convexQuery(api.social.profiles.getEligibility, {}))
  return (
    <div data-eligibility={eligibility.isSuccess ? 'loaded' : 'loading'}>
      <SeededDetail viewer={viewer} />
    </div>
  )
}

function SeededDetail({ viewer }: { viewer: 'applicant' | 'host' }) {
  return viewer === 'host' ? (
    <SeededHostedListing title={STORY_CAMPAIGN.name}>
      {({ listingPublicId }) => (
        <SocialListingDetailPage listingPublicId={listingPublicId.toUpperCase()} />
      )}
    </SeededHostedListing>
  ) : (
    <SeededAppliedListing>
      {({ listingPublicId }) => (
        <SocialListingDetailPage listingPublicId={listingPublicId.toUpperCase()} />
      )}
    </SeededAppliedListing>
  )
}

// Reads the story account's seeded listing (D218, D221): the peer as an applicant, the reader as
// its host. Writes are spies.
const meta = {
  title: 'Social/Listing/Native detail',
  component: SeededListingDetail
} satisfies Meta<typeof SeededListingDetail>
export default meta
type Story = StoryObj<typeof meta>

export const ApplicantSendsApplication: Story = {
  args: { viewer: 'applicant' },
  parameters: { storyAccount: 'peer' satisfies StoryAccountKey },
  play: async ({ canvas, canvasElement }) => {
    const listing = await readSeededListing(canvas)
    await canvas.findByRole('heading', { name: listing.title }, { timeout: socialStoryLoadTimeout })
    await userEvent.click(
      await canvas.findByRole(
        'button',
        { name: 'Apply to join' },
        { timeout: socialStoryLoadTimeout }
      )
    )
    const body = within(canvasElement.ownerDocument.body)
    const dialog = within(await body.findByRole('dialog'))
    await userEvent.type(
      await dialog.findByRole('textbox', { name: /Message to the host/ }),
      'I would like to join this table.'
    )
    await userEvent.click(dialog.getByRole('button', { name: 'Send application' }))
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument())
    expect(writesTo(api.social.applications.submit)).toEqual([
      {
        listingPublicId: listing.listingPublicId,
        expectedListingVersion: listing.version,
        message: 'I would like to join this table.'
      }
    ])
  }
}

export const HostCannotApply: Story = {
  args: { viewer: 'host' },
  play: async ({ canvas, canvasElement }) => {
    const listing = await readSeededListing(canvas)
    await canvas.findByRole('heading', { name: listing.title }, { timeout: socialStoryLoadTimeout })
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-eligibility]')).toHaveAttribute(
        'data-eligibility',
        'loaded'
      )
    )
    await expect(canvas.queryByRole('button', { name: 'Apply to join' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Report' })).not.toBeInTheDocument()
  }
}
