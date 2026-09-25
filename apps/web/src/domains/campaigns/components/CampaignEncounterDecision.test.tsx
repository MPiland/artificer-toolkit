import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  EncounterCommandResultDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { tabletopGmEncounter } from '../vtt/CampaignTabletop.stories.fixtures'

const occurrenceId = '77777777-7777-4777-8777-777777777790'
const pending = {
  kind: 'INITIATIVE_DECLARATION',
  occurrenceId,
  occurrenceVersion: 2,
  encounterVersion: tabletopGmEncounter.version,
  actorId: tabletopGmEncounter.actors[0]!.id,
  requestId: 'speed-factor-declaration',
  primaryOptions: [
    {
      kind: 'CHARACTER_ACTION' as const,
      optionId: 'action:longsword',
      label: 'Longsword',
      selectionContract: 'a'.repeat(64)
    }
  ],
  bonusOptions: [],
  adjudicationFields: [],
  allowedResponses: ['INITIATIVE_DECLARATION']
} satisfies PendingEncounterRuleOccurrenceSummaryDto

const result: EncounterCommandResultDto = {
  projection: tabletopGmEncounter,
  roll: null,
  resolution: null,
  occurrence: null
}

const mocks = vi.hoisted(() => ({
  sendCommand: vi.fn(),
  convexQuery: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn()
}))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: mocks.convexQuery
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useMutation: mocks.useMutation,
  useQuery: mocks.useQuery
}))

import { CampaignEncounterDecision } from './CampaignEncounterDecision'

describe('CampaignEncounterDecision', () => {
  let currentPending: PendingEncounterRuleOccurrenceSummaryDto | null

  beforeEach(() => {
    vi.clearAllMocks()
    currentPending = pending
    mocks.convexQuery.mockReturnValue({ queryKey: ['pending-rule-occurrence'] })
    mocks.useQuery.mockImplementation(() => ({ data: currentPending }))
    mocks.useMutation.mockImplementation((options) => ({
      isPending: false,
      mutateAsync: async (command: ResolveRuleOccurrenceInputDto) => {
        const next = await options.mutationFn(command)
        options.onSuccess?.(next)
        return next
      }
    }))
    mocks.sendCommand.mockResolvedValue(result)
  })

  it('submits the actual initiative declaration and disappears after the reactive pending update', async () => {
    const user = userEvent.setup()
    const view = renderWithAppProviders(
      <CampaignEncounterDecision
        campaignId={tabletopGmEncounter.campaignId}
        connected
        encounter={tabletopGmEncounter}
        sendCommand={mocks.sendCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    await user.click(await screen.findByRole('combobox', { name: 'Primary action' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('button', { name: 'Declare actions' }))

    await waitFor(() =>
      expect(mocks.sendCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: tabletopGmEncounter.id,
          occurrenceId,
          expectedOccurrenceVersion: 2,
          resolution: {
            kind: 'INITIATIVE_DECLARATION',
            requestId: 'speed-factor-declaration',
            primary: { kind: 'CHARACTER_ACTION', optionId: 'action:longsword' },
            bonus: null
          }
        })
      )
    )

    currentPending = null
    view.rerender(
      <CampaignEncounterDecision
        campaignId={tabletopGmEncounter.campaignId}
        connected
        encounter={tabletopGmEncounter}
        sendCommand={mocks.sendCommand}
      />
    )
    expect(screen.queryByRole('button', { name: 'Open pending decision' })).not.toBeInTheDocument()
  })

  it('keeps declaration controls readonly while disconnected', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignEncounterDecision
        campaignId={tabletopGmEncounter.campaignId}
        connected={false}
        encounter={tabletopGmEncounter}
        sendCommand={mocks.sendCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(screen.getByRole('button', { name: 'Declare actions' })).toBeDisabled()
  })
})
