import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  campaignPlaySettingsDtoSchema,
  campaignPlaySettingsOptionsDtoSchema
} from '@artificer-toolkit/schema/api/campaignSettings'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { createTabletopCampaign } from '../../vtt/CampaignTabletop.stories.fixtures'
import { CampaignTableSettings } from './CampaignTableSettings'

const campaign = createTabletopCampaign('OWNER')
const serverState = vi.hoisted(() => ({
  settings: undefined as unknown,
  options: undefined as unknown
}))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference)
    if (name === getFunctionName(api.campaigns.playSettings.get))
      return { queryKey: ['table-settings', 'get'], queryFn: async () => serverState.settings }
    if (name === getFunctionName(api.campaigns.playSettings.options))
      return { queryKey: ['table-settings', 'options'], queryFn: async () => serverState.options }
    throw new Error(`Unexpected query ${name}`)
  }
}))

function settingsAtVersion(version: number, normalCadenceDays: number) {
  return campaignPlaySettingsDtoSchema.parse({
    campaignId: campaign.id,
    normalCadenceDays,
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
    automaticCover: true,
    initiativePolicyDefinitionId: null,
    initiativeTieDefinitionId: null,
    optionalCombatRuleDefinitionIds: [],
    version,
    updatedAt: '2026-08-30T00:00:00.000Z'
  })
}

function RefetchServerData() {
  const queryClient = useQueryClient()
  return (
    <button onClick={() => void queryClient.invalidateQueries({ queryKey: ['table-settings'] })}>
      refetch
    </button>
  )
}

function renderSettings() {
  return renderWithAppProviders(
    <>
      <CampaignTableSettings campaign={campaign} />
      <RefetchServerData />
    </>
  )
}

describe('CampaignTableSettings draft', () => {
  beforeEach(() => {
    serverState.settings = settingsAtVersion(1, 14)
    serverState.options = campaignPlaySettingsOptionsDtoSchema.parse({
      initiativePolicies: [],
      optionalCombatRules: []
    })
  })

  it('keeps an unsaved edit when a refetch returns the same settings', async () => {
    renderSettings()
    const cadence = await screen.findByLabelText('Normal cadence (days)')
    expect(cadence).toHaveValue('14')

    fireEvent.change(cadence, { target: { value: '21' } })
    fireEvent.click(screen.getByRole('button', { name: 'refetch' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'refetch' })).toBeEnabled())

    expect(screen.getByLabelText('Normal cadence (days)')).toHaveValue('21')
  })

  it('replaces the draft with the new settings when the saved settings change', async () => {
    renderSettings()
    const cadence = await screen.findByLabelText('Normal cadence (days)')
    fireEvent.change(cadence, { target: { value: '21' } })

    serverState.settings = settingsAtVersion(2, 7)
    fireEvent.click(screen.getByRole('button', { name: 'refetch' }))

    await waitFor(() => expect(screen.getByLabelText('Normal cadence (days)')).toHaveValue('7'))
  })

  it('keeps an unsaved edit when the parent re-renders with a new campaign object', async () => {
    const view = renderWithAppProviders(<CampaignTableSettings campaign={campaign} />)
    const cadence = await screen.findByLabelText('Normal cadence (days)')
    fireEvent.change(cadence, { target: { value: '21' } })

    view.rerender(<CampaignTableSettings campaign={{ ...campaign }} />)

    expect(screen.getByLabelText('Normal cadence (days)')).toHaveValue('21')
  })
})
