import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Stack } from '@mantine/core'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { convexQuery } from '@convex-dev/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { getFunctionName } from 'convex/server'
import { useMutation as useConvexMutation } from 'convex/react'
import { getSystemListPage } from '#app/data/systems/queries'
import { expect, mocked, userEvent, waitFor, within } from 'storybook/test'
import {
  campaignPlaySettingsDtoSchema,
  campaignPlaySettingsOptionsDtoSchema
} from '@artificer-toolkit/schema/api/campaignSettings'
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

const playSettings = campaignPlaySettingsDtoSchema.parse({
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
  trackAmmunition: false,
  zoneNoticing: 'GM_PROMPT',
  initiativePolicyDefinitionId: initiativePolicyId,
  initiativeTieDefinitionId: initiativeTieId,
  optionalCombatRuleDefinitionIds: [optionalRuleId],
  version: 1,
  updatedAt: '2026-08-30T00:00:00.000Z'
})

const playSettingsOptions = campaignPlaySettingsOptionsDtoSchema.parse({
  initiativePolicies: [
    {
      definitionId: initiativePolicyId,
      label: 'Standard initiative',
      defaultTieResolverDefinitionId: initiativeTieId,
      tieResolvers: [{ definitionId: initiativeTieId, label: 'Dexterity priority' }]
    }
  ],
  optionalCombatRules: [{ definitionId: optionalRuleId, label: 'Flanking', kind: 'FLANKING' }]
})

let savedTableSettingsInput: unknown

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
  beforeEach: () => {
    savedTableSettingsInput = undefined
  },
  decorators: [
    (Story) => {
      const queryClient = useQueryClient()
      queryClient.setQueryDefaults(getSystemListPage().queryKey, {
        queryFn: async () => ({ page: systems, isDone: true, continueCursor: '' })
      })
      queryClient.setQueryDefaults(
        convexQuery(convexApi.campaigns.queries.settings, { id: campaign.id }).queryKey,
        { queryFn: async () => campaign }
      )
      queryClient.setQueryDefaults(
        convexQuery(convexApi.campaigns.queries.contentUsage, { id: campaign.id }).queryKey,
        {
          queryFn: async () => ({
            entries: { used: 42, limit: 150 },
            scenes: { used: 3, limit: 5 }
          })
        }
      )
      queryClient.setQueryDefaults(
        convexQuery(convexApi.campaigns.playSettings.get, { campaignId: campaign.id }).queryKey,
        { queryFn: async () => playSettings }
      )
      queryClient.setQueryDefaults(
        convexQuery(convexApi.campaigns.playSettings.options, { campaignId: campaign.id }).queryKey,
        { queryFn: async () => playSettingsOptions }
      )
      mocked(useConvexMutation).mockImplementation((reference) => {
        const mutate: ReturnType<typeof useConvexMutation> = Object.assign(
          async (input?: unknown) => {
            if (
              getFunctionName(reference) === getFunctionName(convexApi.campaigns.playSettings.save)
            ) {
              savedTableSettingsInput = input
              const updated = {
                ...playSettings,
                automationMode: 'MANUAL' as const,
                version: 2,
                updatedAt: '2026-08-30T00:01:00.000Z'
              }
              queryClient.setQueryData(
                convexQuery(convexApi.campaigns.playSettings.get, { campaignId: campaign.id })
                  .queryKey,
                updated
              )
              return updated
            }
            if (getFunctionName(reference) === getFunctionName(convexApi.campaigns.update.update))
              return campaign
            throw new Error(`Unconfigured native mutation: ${getFunctionName(reference)}`)
          },
          { withOptimisticUpdate: () => mutate }
        )
        return mutate
      })
      return <Story />
    }
  ],
  parameters: {
    layout: 'fullscreen',
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
    await expect(await canvas.findByText('Entries 42 / 150')).toBeVisible()
    await expect(await canvas.findByLabelText(/Primary Rules Catalogue/i)).toHaveValue('2014 SRD')
    await expect(await canvas.findByLabelText('Automation mode')).toHaveValue('Assisted')
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
    await expect(savedTableSettingsInput).toMatchObject({
      campaignId: campaign.id,
      expectedVersion: playSettings.version,
      automationMode: 'MANUAL'
    })
    await waitFor(async () =>
      expect(await canvas.findByLabelText('Automation mode')).toHaveValue('Manual')
    )
  }
}
