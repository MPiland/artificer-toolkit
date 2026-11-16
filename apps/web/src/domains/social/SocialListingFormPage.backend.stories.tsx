import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Button } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { SocialListingDto } from '@artificer-toolkit/schema/api/socialHub'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { storyMutation, writesTo } from '#app/test/storybook/storyWrites'
import {
  STORY_CAMPAIGN,
  STORY_SOCIAL,
  type StoryAccountKey
} from '../../../../apis/tests/developmentReviewDataScenarios'
import { SeededCampaign } from '../campaigns/stories/SeededCampaign'
import { SeededHostedListing } from './stories/SeededSocialListing'
import { readSeededListing } from './stories/seededListing'
import { socialStoryLoadTimeout } from './stories/storyLoad'
import { SocialListingFormPage } from './SocialListingFormPage'

/** The backend's own refusal of a write against a listing that has moved on. */
const versionConflict = 'Social listing version conflict.'

function SimulateAnotherEditor({ listing }: { listing: SocialListingDto }) {
  const queryClient = useQueryClient()
  return (
    <Button
      onClick={() =>
        // A push from the deployment, built from the listing as read.
        queryClient.setQueryData(
          convexQuery(api.social.listings.getOwned, { listingPublicId: listing.listingPublicId })
            .queryKey,
          { ...listing, summary: 'Another editor saved this.', version: listing.version + 1 }
        )
      }
    >
      Simulate another editor
    </Button>
  )
}

function SeededListingEditor({ table }: { table: 'draft' | 'open' | 'create' }) {
  if (table === 'create')
    return (
      <SeededCampaign>
        {(campaign) => (
          <div data-testid='seeded-campaign' data-campaign-id={campaign.id}>
            <SocialListingFormPage />
          </div>
        )}
      </SeededCampaign>
    )
  return (
    <SeededHostedListing
      title={table === 'draft' ? STORY_SOCIAL.peerTableName : STORY_CAMPAIGN.name}
    >
      {(listing) => (
        <>
          <SimulateAnotherEditor listing={listing} />
          <SocialListingFormPage listingPublicId={listing.listingPublicId.toUpperCase()} />
        </>
      )}
    </SeededHostedListing>
  )
}

/** The input the editor writes when it saves `summary` over the seeded listing. */
function updateInput(listing: SocialListingDto, summary: string) {
  return {
    input: {
      listingPublicId: listing.listingPublicId,
      expectedVersion: listing.version,
      summary,
      audience: listing.audience,
      systemId: listing.system.systemId,
      playMode: listing.playMode,
      capacity: listing.capacity,
      schedule: listing.schedule,
      location: listing.location,
      expectations: listing.expectations
    }
  }
}

// Reads the seeded listings (D218, D221): the peer's draft table, the reader's open table and the
// reader's Campaigns. Writes are spies, so each story ends at its write.
const meta = {
  title: 'Social/Listing/Native editor',
  component: SeededListingEditor
} satisfies Meta<typeof SeededListingEditor>
export default meta
type Story = StoryObj<typeof meta>

const peer = { storyAccount: 'peer' satisfies StoryAccountKey }

export const SaveThenOpenDraft: Story = {
  args: { table: 'draft' },
  parameters: peer,
  play: async ({ canvas }) => {
    const listing = await readSeededListing(canvas)
    const summary = await canvas.findByRole(
      'textbox',
      { name: /Summary/ },
      { timeout: socialStoryLoadTimeout }
    )
    await waitFor(() => expect(summary).toHaveValue(listing.summary), {
      timeout: socialStoryLoadTimeout
    })
    await userEvent.type(summary, ' More adventures.')
    await expect(canvas.getByRole('button', { name: 'Open listing' })).toBeDisabled()
    await userEvent.click(canvas.getByRole('button', { name: 'Save listing' }))
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Open listing' })).toBeEnabled())
    expect(writesTo(api.social.listings.update)).toEqual([
      updateInput(listing, `${listing.summary} More adventures.`)
    ])
    await userEvent.click(canvas.getByRole('button', { name: 'Open listing' }))
    await waitFor(() =>
      expect(writesTo(api.social.listings.open)).toEqual([
        { listingPublicId: listing.listingPublicId, expectedVersion: listing.version }
      ])
    )
  }
}

export const CloseOpenListing: Story = {
  args: { table: 'open' },
  play: async ({ canvas }) => {
    const listing = await readSeededListing(canvas)
    await userEvent.click(
      await canvas.findByRole(
        'button',
        { name: 'Close listing' },
        { timeout: socialStoryLoadTimeout }
      )
    )
    await waitFor(() =>
      expect(writesTo(api.social.listings.close)).toEqual([
        { listingPublicId: listing.listingPublicId, expectedVersion: listing.version }
      ])
    )
  }
}

export const LiveConflictKeepsDraft: Story = {
  args: { table: 'draft' },
  parameters: peer,
  play: async ({ canvas }) => {
    const listing = await readSeededListing(canvas)
    const summary = await canvas.findByRole(
      'textbox',
      { name: /Summary/ },
      { timeout: socialStoryLoadTimeout }
    )
    await waitFor(() => expect(summary).toHaveValue(listing.summary), {
      timeout: socialStoryLoadTimeout
    })
    await userEvent.type(summary, ' Unsaved work.')
    await userEvent.click(canvas.getByRole('button', { name: 'Simulate another editor' }))
    await expect(summary).toHaveValue(`${listing.summary} Unsaved work.`)
    storyMutation.mockRejectedValueOnce(new Error(versionConflict))
    await userEvent.click(canvas.getByRole('button', { name: 'Save listing' }))
    await expect(await canvas.findByText(versionConflict)).toBeVisible()
    expect(writesTo(api.social.listings.update)).toEqual([
      updateInput(listing, `${listing.summary} Unsaved work.`)
    ])
  }
}

export const DeleteFailureKeepsDraft: Story = {
  args: { table: 'draft' },
  parameters: peer,
  play: async ({ canvas }) => {
    const listing = await readSeededListing(canvas)
    const summary = await canvas.findByRole(
      'textbox',
      { name: /Summary/ },
      { timeout: socialStoryLoadTimeout }
    )
    await waitFor(() => expect(summary).toHaveValue(listing.summary), {
      timeout: socialStoryLoadTimeout
    })
    await userEvent.type(summary, ' Unsaved work.')
    storyMutation.mockRejectedValueOnce(new Error(versionConflict))
    const originalConfirm = window.confirm
    window.confirm = () => true
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Delete draft' }))
      await expect(await canvas.findByText(versionConflict)).toBeVisible()
      await expect(summary).toHaveValue(`${listing.summary} Unsaved work.`)
      expect(writesTo(api.social.listingDrafts.remove)).toEqual([
        { listingPublicId: listing.listingPublicId, expectedVersion: listing.version }
      ])
    } finally {
      window.confirm = originalConfirm
    }
  }
}

export const CreateForCampaignWithListing: Story = {
  args: { table: 'create' },
  play: async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const campaignId = (
      await canvas.findByTestId('seeded-campaign', {}, { timeout: socialStoryLoadTimeout })
    ).dataset.campaignId
    // The Campaign select stays disabled until its own paginated query returns the first page.
    const campaign = await canvas.findByRole('combobox', { name: 'Campaign' })
    await waitFor(() => expect(campaign).toBeEnabled(), { timeout: socialStoryLoadTimeout })
    await userEvent.click(campaign)
    await userEvent.click(await body.findByRole('option', { name: STORY_CAMPAIGN.name }))
    await userEvent.click(canvas.getByRole('combobox', { name: 'System and ruleset' }))
    await userEvent.click(
      await body.findByRole('option', {
        name: `${srdSystemRecord.label} (${srdSystemRecord.rulesetCode} ${srdSystemRecord.rulesetVersion})`
      })
    )
    const text = 'A welcoming weekly table.'
    for (const label of [
      'Summary',
      'Schedule summary',
      'Content guidance',
      'Attendance policy',
      'Allowed content and rules',
      'Table conduct',
      'Content boundaries',
      'How safety practices are used'
    ])
      await userEvent.type(canvas.getByRole('textbox', { name: new RegExp(`^${label}`) }), text)
    // The seeded Campaign already has its listing, so the deployment would refuse this creation.
    storyMutation.mockRejectedValueOnce(new Error('This Campaign already has a Social listing.'))
    await userEvent.click(canvas.getByRole('button', { name: 'Save listing' }))
    await expect(
      await canvas.findByText('This Campaign already has a Social listing.')
    ).toBeVisible()
    expect(writesTo(api.social.listingDrafts.create)).toEqual([
      {
        input: {
          campaignId,
          summary: text,
          audience: 'PRIVATE',
          systemId: srdSystemRecord.id,
          playMode: 'ONLINE',
          capacity: 5,
          schedule: {
            kind: 'FLEXIBLE',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            summary: text
          },
          location: null,
          expectations: {
            contentGuidance: text,
            attendancePolicy: text,
            allowedContentRules: text,
            tableConduct: text,
            contentBoundaries: text,
            safetyPractices: ['SESSION_ZERO'],
            safetyDetails: text
          }
        }
      }
    ])
  }
}
