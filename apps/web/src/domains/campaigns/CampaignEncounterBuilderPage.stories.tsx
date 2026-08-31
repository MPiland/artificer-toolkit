import { Stack } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { HttpResponse, http } from 'msw'
import { expect, fn, spyOn, userEvent, waitFor, within } from 'storybook/test'
import type { EncounterBlueprintDto } from '@artificer-toolkit/schema/api/encounters'
import { authoredRouteStoryUser } from '#domains/authoredRouteStory.fixtures'
import { CampaignEncounterBuilderPage } from './CampaignEncounterBuilderPage'
import { CampaignSessionEncounters } from './components/CampaignSessionEncounters'
import {
  createTabletopCampaign,
  tabletopCurrentUserId,
  tabletopGmEncounter,
  tabletopSession
} from './vtt/CampaignTabletop.stories.fixtures'

const campaign = createTabletopCampaign('OWNER')
const blueprintId = '99999999-9999-4999-8999-999999999903'
const createBlueprint = fn()
const createEncounterRun = fn()
let encounterRunCreated = false

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

const emptyCreaturePage = {
  items: [],
  drafts: [],
  page: { nextCursor: null, previousCursor: null, totalCount: 0 },
  summary: { activeCount: 0, masterCount: 0, ownedCount: 0 }
}

function trpcJson(data: unknown) {
  return HttpResponse.json([{ result: { data } }])
}

const handlers = [
  http.get('*/api/trpc/*', ({ request }) => {
    const procedures = new URL(request.url).pathname.split('/').at(-1)?.split(',') ?? []
    return HttpResponse.json(
      procedures.map((procedure) => ({
        result: {
          data:
            procedure === 'campaigns.get'
              ? campaign
              : procedure === 'encounters.blueprints.list'
                ? [blueprint]
                : procedure === 'content.creatures.list'
                  ? emptyCreaturePage
                  : procedure === 'encounters.list'
                    ? encounterRunCreated
                      ? [createdEncounter]
                      : []
                    : procedure === 'encounters.timeline'
                      ? { entries: [], nextCursor: null }
                      : null
        }
      }))
    )
  }),
  http.post('*/api/trpc/encounters.blueprints.create*', async ({ request }) => {
    createBlueprint(await request.json())
    return trpcJson(blueprint)
  }),
  http.post('*/api/trpc/encounters.create*', async ({ request }) => {
    createEncounterRun(await request.json())
    encounterRunCreated = true
    return trpcJson(createdEncounter)
  })
]

function EncounterRunFixture() {
  return (
    <Stack p='xl'>
      <CampaignSessionEncounters
        campaign={campaign}
        currentUserId={tabletopCurrentUserId}
        mode='PREPARE'
        session={tabletopSession}
      />
    </Stack>
  )
}

const meta = {
  title: 'Domains/Campaigns/Encounter Blueprints',
  component: CampaignEncounterBuilderPage,
  parameters: {
    layout: 'fullscreen',
    msw: { handlers },
    tanstack: { router: { context: { user: authoredRouteStoryUser } } }
  }
} satisfies Meta<typeof CampaignEncounterBuilderPage>

export default meta

type Story = StoryObj<typeof meta>

export const AuthorBlueprint: Story = {
  args: { campaignId: campaign.id },
  play: async ({ canvasElement }) => {
    createBlueprint.mockClear()
    const historyBack = spyOn(window.history, 'back').mockImplementation(() => undefined)
    const canvas = within(canvasElement)

    await expect(await canvas.findByRole('heading', { name: 'Build an encounter' })).toBeVisible()
    await expect(await canvas.findByText('Vault sentries')).toBeVisible()
    await userEvent.type(canvas.getByLabelText('Encounter name'), 'Clockwork patrol')
    await userEvent.type(canvas.getByLabelText('Custom enemy name'), 'Brass Defender')
    await userEvent.clear(canvas.getByLabelText('Max HP'))
    await userEvent.type(canvas.getByLabelText('Max HP'), '24')
    await userEvent.click(canvas.getByRole('button', { name: 'Add custom enemy' }))
    await expect(canvas.getByText('Custom · 24 HP')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Save encounter' }))
    await waitFor(() => expect(createBlueprint).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(historyBack).toHaveBeenCalledTimes(1))
    historyBack.mockRestore()
  }
}

export const CreateEncounterRun: Story = {
  args: { campaignId: campaign.id },
  render: () => <EncounterRunFixture />,
  play: async ({ canvasElement }) => {
    encounterRunCreated = false
    createEncounterRun.mockClear()
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)

    await expect(
      await canvas.findByText('No encounters have been added to this Session.')
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Add encounter' }))
    await userEvent.click(await canvas.findByLabelText('Encounter Blueprint'))
    await userEvent.click(await page.findByRole('option', { name: 'Vault sentries · 1 enemy' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Add encounter' }))

    await waitFor(() => expect(createEncounterRun).toHaveBeenCalledTimes(1))
    await expect(await canvas.findByRole('heading', { name: 'Vault sentries' })).toBeVisible()
    await expect(canvas.getByText('Ready')).toBeVisible()
  }
}
