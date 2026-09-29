import { Stack } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { ConvexReactClient, useConvex } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { expect, fn, mocked, spyOn, userEvent, waitFor, within } from 'storybook/test'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { AuthoredCataloguePage } from '@artificer-toolkit/schema/api/authoredCatalogue'
import type { EncounterBlueprintDto } from '@artificer-toolkit/schema/api/encounters'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import { summarizeEncounterProjection } from '#app/data/encounters/summaries'
import { authoredRouteStoryUser } from '#domains/authoredRouteStory.fixtures'
import { CampaignEncounterBuilderPage } from './CampaignEncounterBuilderPage'
import { CampaignEncounters } from './components/CampaignEncounters'
import {
  createTabletopCampaign,
  tabletopCurrentUserId,
  tabletopGmEncounter
} from './vtt/CampaignTabletop.stories.fixtures'

const campaign = createTabletopCampaign('OWNER')
const blueprintId = '99999999-9999-4999-8999-999999999903'
const createBlueprint = fn()
const createEncounterRun = fn()
const deleteEncounterRun = fn()
let encounterRunCreated = false

const creatureCatalogue = {
  page: [
    {
      id: '99999999-9999-4999-8999-999999999904',
      publicId: 'iron-sentinel',
      systemId: campaign.gameSystemId,
      label: 'Iron Sentinel',
      description: null,
      status: 'ACTIVE',
      activeUpdatedAt: '2026-08-30T00:00:00.000Z',
      provenance: { kind: 'MASTER', ownerUserId: null },
      permissions: { canView: true, canEdit: false, canCopy: true, canDelete: false }
    }
  ],
  isDone: true,
  continueCursor: ''
} satisfies AuthoredCataloguePage

const blueprint = {
  id: blueprintId,
  gameSystemId: campaign.gameSystemId,
  name: 'Vault sentries',
  version: 1,
  enemies: [
    {
      kind: 'CUSTOM',
      sourceId: null,
      sourceRevision: null,
      label: 'Clockwork Sentry',
      systemId: null,
      maxHitPoints: 18,
      snapshot: {}
    }
  ],
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
  setupChecksum: 'a'.repeat(64)
} satisfies EncounterBlueprintDto

const createdEncounter = {
  ...tabletopGmEncounter,
  name: blueprint.name,
  status: 'PREPARED',
  blueprintId: blueprint.id,
  blueprintVersion: blueprint.version,
  blueprintChecksum: blueprint.setupChecksum,
  currentActorId: null,
  round: 1,
  updatedAt: '2026-08-30T00:01:00.000Z',
  version: 1
} as const

function EncounterRunFixture() {
  return (
    <Stack p='xl'>
      <CampaignEncounters
        campaign={campaign}
        currentUserId={tabletopCurrentUserId}
        mode='PREPARE'
      />
    </Stack>
  )
}

const meta = {
  title: 'Domains/Campaigns/Encounter Blueprints',
  component: CampaignEncounterBuilderPage,
  beforeEach: () => {
    createBlueprint.mockClear()
    createEncounterRun.mockClear()
    deleteEncounterRun.mockClear()
    encounterRunCreated = false
    const client = new ConvexReactClient('https://story-fixture.convex.cloud', { logger: false })
    Object.defineProperty(client, 'query', {
      value: fn<ConvexReactClient['query']>().mockImplementation(async (...[reference]) => {
        const name = getFunctionName(reference)
        if (name === getFunctionName(convexApi.content.catalogue.list)) {
          return creatureCatalogue
        }
        if (name === getFunctionName(convexApi.encounters.blueprints.list)) {
          return { page: [blueprint], isDone: true, continueCursor: '' }
        }
        if (name === getFunctionName(convexApi.encounters.projectionReads.list))
          return encounterRunCreated ? [summarizeEncounterProjection(createdEncounter)] : []
        if (name === getFunctionName(convexApi.encounters.projectionReads.get))
          return createdEncounter
        throw new Error(`Unexpected encounter fixture query: ${name}`)
      })
    })
    Object.defineProperty(client, 'mutation', {
      value: fn<ConvexReactClient['mutation']>().mockImplementation(
        async (...[reference, input]) => {
          const name = getFunctionName(reference)
          if (name === getFunctionName(convexApi.encounters.blueprints.create)) {
            createBlueprint(input)
            return blueprint
          }
          if (name === getFunctionName(convexApi.encounters.runs.create)) {
            createEncounterRun(input)
            encounterRunCreated = true
            return createdEncounter
          }
          if (name === getFunctionName(convexApi.encounters.runs.deletePrepared)) {
            deleteEncounterRun(input)
            encounterRunCreated = false
            return { campaignId: campaign.id, encounterId: createdEncounter.id }
          }
          throw new Error(`Unexpected encounter fixture mutation: ${name}`)
        }
      )
    })
    mocked(useConvex).mockReturnValue(client)
    return () => client.close()
  },
  decorators: [
    (Story) => {
      const queryClient = useQueryClient()
      const campaignQuery = getCampaignDetail(campaign.id)
      queryClient.setQueryDefaults(campaignQuery.queryKey, { queryFn: async () => campaign })
      queryClient.setQueryData(campaignQuery.queryKey, campaign)
      return <Story />
    }
  ],
  parameters: {
    layout: 'fullscreen',
    tanstack: { router: { context: { user: authoredRouteStoryUser } } }
  }
} satisfies Meta<typeof CampaignEncounterBuilderPage>

export default meta

type Story = StoryObj<typeof meta>

export const AuthorBlueprint: Story = {
  args: { campaignId: campaign.id },
  play: async ({ canvasElement }) => {
    const historyBack = spyOn(window.history, 'back').mockImplementation(() => undefined)
    const canvas = within(canvasElement)

    await expect(await canvas.findByRole('heading', { name: 'Build an encounter' })).toBeVisible()
    await expect(await canvas.findByText('Vault sentries')).toBeVisible()
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('combobox', { name: 'Bestiary creature' }))
    await userEvent.click(await page.findByRole('option', { name: 'Iron Sentinel' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Add creature' }))
    await expect(canvas.getByText('Iron Sentinel')).toBeVisible()
    await userEvent.type(canvas.getByLabelText('Encounter name'), 'Clockwork patrol')
    await userEvent.type(canvas.getByLabelText('Custom enemy name'), 'Brass Defender')
    await userEvent.clear(canvas.getByLabelText('Max HP'))
    await userEvent.type(canvas.getByLabelText('Max HP'), '24')
    await userEvent.click(canvas.getByRole('button', { name: 'Add custom enemy' }))
    await expect(canvas.getByText('Custom · 24 HP')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Save encounter' }))
    await waitFor(() => expect(createBlueprint).toHaveBeenCalledTimes(1))
    await expect(createBlueprint).toHaveBeenCalledWith(
      expect.objectContaining({
        enemies: expect.arrayContaining([
          expect.objectContaining({ kind: 'CREATURE', sourceId: creatureCatalogue.page[0].id })
        ])
      })
    )
    await waitFor(() => expect(historyBack).toHaveBeenCalledTimes(1))
    historyBack.mockRestore()
  }
}

export const CreateEncounterRun: Story = {
  args: { campaignId: campaign.id },
  render: () => <EncounterRunFixture />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)

    await expect(
      await canvas.findByText('No encounters have been added to this Campaign.')
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Add encounter' }))
    await userEvent.click(await canvas.findByLabelText('Encounter Blueprint'))
    await userEvent.click(await page.findByRole('option', { name: 'Vault sentries · 1 enemy' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Add encounter' }))

    await waitFor(() => expect(createEncounterRun).toHaveBeenCalledTimes(1))
    await expect(await canvas.findByRole('heading', { name: 'Vault sentries' })).toBeVisible()
    await expect(canvas.getByText('Ready')).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Delete encounter' }))
    const dialog = within(await page.findByRole('dialog', { name: 'Delete encounter?' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Delete encounter' }))
    await waitFor(() =>
      expect(deleteEncounterRun).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: campaign.id,
          encounterId: createdEncounter.id,
          expectedVersion: createdEncounter.version
        })
      )
    )
    await expect(
      await canvas.findByText('No encounters have been added to this Campaign.')
    ).toBeVisible()
  }
}
