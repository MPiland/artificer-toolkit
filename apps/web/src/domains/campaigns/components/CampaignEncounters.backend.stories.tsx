import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Stack } from '@mantine/core'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import {
  createEncounterInputDtoSchema,
  deletePreparedEncounterInputDtoSchema
} from '@artificer-toolkit/schema/api/encounterData'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { getCampaignEncounters } from '#app/data/encounters/queries'
import { storyMutation, writesTo } from '#app/test/storybook/storyWrites'
import type { StoryQueryOverride } from '#app/test/storybook/storyQueryOverride'
import { STORY_CAMPAIGN } from '../../../../../apis/tests/developmentReviewDataScenarios'
import { SeededCampaign } from '../stories/SeededCampaign'
import { CampaignEncounters } from './CampaignEncounters'

const NO_ENCOUNTERS = 'No encounters have been added to this Campaign.'

function SeededEncounters({ campaign }: { campaign: CampaignDetailDto }) {
  const { data: session } = useSuspenseQuery(convexQuery(api.account.session, {}))
  const encounters = useQuery(getCampaignEncounters(campaign.id))
  const run = encounters.data?.find(({ status }) => status === 'PREPARED')
  return (
    <Stack
      p='xl'
      data-testid='seeded-campaign'
      data-campaign-id={campaign.id}
      data-encounter-id={run?.id}
      data-encounter-version={run?.version}
    >
      <CampaignEncounters
        campaign={campaign}
        currentUserId={session.user?.userId ?? ''}
        liveSummary={null}
        mode='PREPARE'
      />
    </Stack>
  )
}

function EncountersFixture() {
  return <SeededCampaign>{(campaign) => <SeededEncounters campaign={campaign} />}</SeededCampaign>
}

// Reads the story account's seeded Campaign, Run and Blueprints (D218, D221); writes are spies.
const meta = {
  title: 'Domains/Campaigns/Encounter Runs',
  component: EncountersFixture,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof EncountersFixture>

export default meta

type Story = StoryObj<typeof meta>

/** Picks the seeded prepared Run beside the started one in the Session workspace's picker. */
async function selectPreparedRun(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const page = within(canvasElement.ownerDocument.body)
  await userEvent.click(await canvas.findByLabelText('Encounter', { selector: 'input' }))
  await userEvent.click(
    await page.findByRole('option', { name: STORY_CAMPAIGN.preparedBlueprintName })
  )
}

/** The seeded Campaign's prepared Run, beside the started one, as the Session workspace lists it. */
export const AddedEncounter: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await selectPreparedRun(canvasElement)
    await waitFor(() => expect(canvas.getByText('Ready')).toBeVisible())
    await expect(canvas.queryByText(NO_ENCOUNTERS)).not.toBeInTheDocument()
  }
}

/** Confirms the delete on the prepared Run; the write is recorded with the Run's id and version. */
export const DeleteEncounter: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    await selectPreparedRun(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Delete encounter' }))
    const dialog = within(await page.findByRole('dialog', { name: 'Delete encounter?' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Delete encounter' }))
    await waitFor(() => expect(writesTo(api.encounters.runs.deletePrepared)).toHaveLength(1))
    const [write] = writesTo(api.encounters.runs.deletePrepared)
    const seeded = await canvas.findByTestId('seeded-campaign')
    expect(deletePreparedEncounterInputDtoSchema.parse(write)).toMatchObject({
      campaignId: seeded.dataset.campaignId,
      encounterId: seeded.dataset.encounterId,
      expectedVersion: Number(seeded.dataset.encounterVersion)
    })
    await waitFor(() =>
      expect(page.queryByRole('dialog', { name: 'Delete encounter?' })).not.toBeInTheDocument()
    )
  }
}

/** A Campaign with no Run yet, a state the seeded Campaign does not reach. */
export const NoEncountersYet: Story = {
  parameters: {
    queryOverride: {
      query: getFunctionName(api.encounters.projectionReads.list),
      value: []
    } satisfies StoryQueryOverride
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    await expect(await canvas.findByText(NO_ENCOUNTERS, {}, { timeout: 10_000 })).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Add encounter' }))
    // The saved Blueprints load as a subscription after the adder opens; the select stays disabled until they do.
    const blueprint = await canvas.findByLabelText('Encounter Blueprint')
    await waitFor(() => expect(blueprint).toBeEnabled(), { timeout: 10_000 })
    await userEvent.click(blueprint)
    await userEvent.click(
      await page.findByRole('option', { name: `${STORY_CAMPAIGN.blueprintName} · 1 enemy` })
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Add encounter' }))
    await waitFor(() => expect(writesTo(api.encounters.runs.create)).toHaveLength(1))
    const [write] = writesTo(api.encounters.runs.create)
    const seeded = await canvas.findByTestId('seeded-campaign')
    expect(createEncounterInputDtoSchema.parse(write)).toMatchObject({
      campaignId: seeded.dataset.campaignId
    })
    await waitFor(() => expect(storyMutation.mock.settledResults).toHaveLength(1), {
      timeout: 10_000
    })
    expect(storyMutation.mock.settledResults[0]).toMatchObject({ type: 'fulfilled' })
    // The created Run closes the adder; the served list stays empty.
    await waitFor(
      () => expect(canvas.queryByLabelText('Encounter Blueprint')).not.toBeInTheDocument(),
      { timeout: 10_000 }
    )
  }
}
