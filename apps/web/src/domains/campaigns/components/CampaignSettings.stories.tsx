import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Stack } from '@mantine/core'
import { HttpResponse, http } from 'msw'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type {
  CampaignPlaySettingsDto,
  CampaignPlaySettingsOptionsDto
} from '@artificer-toolkit/schema/api/campaigns'
import { authoredRouteStoryUser } from '#domains/authoredRouteStory.fixtures'
import { createTabletopCampaign } from '../vtt/CampaignTabletop.stories.fixtures'
import { CampaignSettings } from './CampaignSettings'
import { CampaignTableSettings } from './CampaignTableSettings/CampaignTableSettings'

const campaign = createTabletopCampaign('OWNER')
const catalogueId = campaign.primaryRulesCatalogueId
const extraCatalogueId = '77777777-7777-4777-8777-777777777702'
const initiativePolicyId = '77777777-7777-4777-8777-777777777703'
const initiativeTieId = '77777777-7777-4777-8777-777777777704'
const optionalRuleId = '77777777-7777-4777-8777-777777777705'
const authorUserId = '99999999-9999-4999-8999-999999999999'

const systems = [
  {
    id: campaign.gameSystemId,
    label: 'D&D 5e SRD',
    description: 'Seed-derived rules System.',
    rulesetCode: 'dnd5e',
    rulesetVersion: '2014',
    userId: authorUserId,
    rulesCatalogues: [
      { id: catalogueId, label: '2014 SRD', description: 'Primary open rules.' },
      { id: extraCatalogueId, label: 'Table additions', description: 'Campaign additions.' }
    ]
  }
]

const playSettings = {
  campaignId: campaign.id,
  normalCadenceDays: 14,
  expectedDurationMinutes: 240,
  quorum: 3,
  absentCharacterPolicy: null,
  contentGuidance: null,
  allowedContentRules: null,
  tableConduct: null,
  contentBoundaries: null,
  safetyPractices: ['SESSION_ZERO'],
  liveSafetyMethod: null,
  automationMode: 'ASSISTED',
  manualReminderMode: 'SUBTLE',
  initiativePolicyDefinitionId: initiativePolicyId,
  initiativeTieDefinitionId: initiativeTieId,
  optionalCombatRuleDefinitionIds: [optionalRuleId],
  version: 1,
  updatedAt: '2026-08-30T00:00:00.000Z'
} satisfies CampaignPlaySettingsDto

const playSettingsOptions = {
  initiativePolicies: [
    {
      definitionId: initiativePolicyId,
      label: 'Standard initiative',
      defaultTieResolverDefinitionId: initiativeTieId,
      tieResolvers: [{ definitionId: initiativeTieId, label: 'Dexterity priority' }]
    }
  ],
  optionalCombatRules: [{ definitionId: optionalRuleId, label: 'Flanking', kind: 'FLANKING' }]
} satisfies CampaignPlaySettingsOptionsDto

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
            procedure === 'campaigns.getSettings'
              ? campaign
              : procedure === 'systems.list'
                ? systems
                : procedure === 'campaigns.playSettings.get'
                  ? playSettings
                  : procedure === 'campaigns.playSettings.options'
                    ? playSettingsOptions
                    : null
        }
      }))
    )
  }),
  http.post('*/api/trpc/campaigns.playSettings.save*', () =>
    trpcJson({
      ...playSettings,
      automationMode: 'MANUAL',
      version: 2,
      updatedAt: '2026-08-30T00:01:00.000Z'
    })
  )
]

function CampaignSettingsFixture() {
  return (
    <Stack p='xl'>
      <CampaignSettings campaign={campaign} />
      <CampaignTableSettings campaign={campaign} />
    </Stack>
  )
}

const meta = {
  title: 'Domains/Campaigns/Settings',
  component: CampaignSettingsFixture,
  parameters: {
    layout: 'fullscreen',
    msw: { handlers },
    tanstack: { router: { context: { user: authoredRouteStoryUser } } }
  }
} satisfies Meta<typeof CampaignSettingsFixture>

export default meta

type Story = StoryObj<typeof meta>

export const RulesAndAutomation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    await expect(await canvas.findByLabelText('Game System')).toHaveValue('D&D 5e SRD')
    await expect(await canvas.findByLabelText(/Primary Rules Catalogue/i)).toHaveValue('2014 SRD')
    await expect(await canvas.findByLabelText('Automation mode')).toHaveValue('Assisted')
    await expect(await canvas.findByLabelText('Manual reminders')).toHaveValue('Subtle reminders')
    await expect(await canvas.findByLabelText('Initiative policy')).toHaveValue(
      'Standard initiative'
    )
    await expect(await canvas.findByLabelText('Initiative tie resolver')).toHaveValue(
      'Dexterity priority'
    )
    await expect(await canvas.findByText('Flanking')).toBeVisible()

    await userEvent.click(canvas.getByLabelText('Automation mode'))
    await userEvent.click(await page.findByRole('option', { name: 'Manual' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save table settings' }))
    await waitFor(async () =>
      expect(await canvas.findByLabelText('Automation mode')).toHaveValue('Manual')
    )
  }
}
