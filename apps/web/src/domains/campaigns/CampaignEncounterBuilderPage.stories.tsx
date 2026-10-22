import { Stack } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { ConvexReactClient, useConvex, usePaginatedQuery } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { expect, fn, mocked, spyOn, userEvent, waitFor, within } from 'storybook/test'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  contentSnapshotCatalogueManifestDtoSchema,
  contentSnapshotListObjectSchema
} from '@artificer-toolkit/schema/api/contentSnapshots'
import {
  encounterBlueprintDtoSchema,
  type EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { CREATURE_CATEGORY_CODE } from '@artificer-toolkit/shared/core'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import { getContentCatalogueManifest } from '#app/data/contentSnapshots/queries'
import { contentCatalogueQueryKey } from '#app/data/contentSnapshots/useContentCatalogue'
import { getCampaignEncounters, getEncounter } from '#app/data/encounters/queries'
import { authoredRouteStoryUser } from '#domains/authoredRouteStory.fixtures'
import { CampaignEncounterBuilderPage } from './CampaignEncounterBuilderPage'
import { CampaignEncounters } from './components/CampaignEncounters'
import {
  createTabletopCampaign,
  tabletopCurrentUserId,
  tabletopGmEncounter
} from './vtt/CampaignTabletop.stories.fixtures'

const summarizeEncounterProjection = (projection: EncounterGmProjectionDto) => ({
  id: projection.id,
  name: projection.name,
  status: projection.status,
  round: projection.round,
  actorCount: projection.actors.length,
  updatedAt: projection.updatedAt,
  version: projection.version
})

const campaign = createTabletopCampaign('OWNER')
const blueprintId = '99999999-9999-4999-8999-999999999903'
const createBlueprint = fn()
const createEncounterRun = fn()
const deleteEncounterRun = fn()
let storyQueryClient: QueryClient

const creatureId = '99999999-9999-4999-8999-999999999904'
const creatureScopeId = '99999999-9999-4999-8999-999999999905'
const creatureListSha = 'b'.repeat(64)
const objectRef = (sha256: string) => ({ sha256, byteLength: 100, rootCount: 1 })

// The creature list is read from a SOURCE `list` part named by the catalogue manifest.
const catalogueManifest = contentSnapshotCatalogueManifestDtoSchema.parse({
  userId: authoredRouteStoryUser.id,
  sources: [
    {
      contentSourceId: creatureScopeId,
      systemId: campaign.gameSystemId,
      kind: 'PLATFORM',
      head: {
        scope: 'SOURCE',
        scopeId: creatureScopeId,
        revision: 1,
        builtRevision: 1,
        kinds: {
          CREATURE: {
            index: objectRef('c'.repeat(64)),
            list: objectRef(creatureListSha),
            documents: objectRef('d'.repeat(64))
          }
        }
      }
    }
  ]
})

const creatureListObject = contentSnapshotListObjectSchema.parse({
  format: 3,
  scope: 'SOURCE',
  scopeId: creatureScopeId,
  kind: 'CREATURE',
  part: 'list',
  roots: [
    {
      id: creatureId,
      label: 'Iron Sentinel',
      publicId: 'iron-sentinel',
      category: CREATURE_CATEGORY_CODE.MONSTER
    }
  ]
})

const blueprint = encounterBlueprintDtoSchema.parse({
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
})

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
        liveSummary={null}
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
    mocked(usePaginatedQuery).mockReturnValue({
      isLoading: false,
      loadMore: () => undefined,
      results: [blueprint],
      status: 'Exhausted'
    })
    const client = new ConvexReactClient('https://story-fixture.convex.cloud', { logger: false })
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
            storyQueryClient.setQueryData(
              getEncounter(createdEncounter.id).queryKey,
              createdEncounter
            )
            storyQueryClient.setQueryData(getCampaignEncounters(campaign.id).queryKey, [
              summarizeEncounterProjection(createdEncounter)
            ])
            return createdEncounter
          }
          if (name === getFunctionName(convexApi.encounters.runs.deletePrepared)) {
            deleteEncounterRun(input)
            storyQueryClient.setQueryData(getCampaignEncounters(campaign.id).queryKey, [])
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
      storyQueryClient = queryClient
      queryClient.setQueryData(getCampaignEncounters(campaign.id).queryKey, [])
      const campaignQuery = getCampaignDetail(campaign.id)
      queryClient.setQueryDefaults(campaignQuery.queryKey, { queryFn: async () => campaign })
      queryClient.setQueryData(campaignQuery.queryKey, campaign)
      const manifestQuery = getContentCatalogueManifest()
      queryClient.setQueryDefaults(manifestQuery.queryKey, {
        queryFn: async () => catalogueManifest
      })
      queryClient.setQueryData(manifestQuery.queryKey, catalogueManifest)
      queryClient.setQueryData(
        contentCatalogueQueryKey(authoredRouteStoryUser.id, 'CREATURE', [creatureListSha]),
        [creatureListObject]
      )
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
          expect.objectContaining({ kind: 'CREATURE', sourceId: creatureId })
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
