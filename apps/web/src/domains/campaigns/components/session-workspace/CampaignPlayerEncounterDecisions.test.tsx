import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { getFunctionName } from 'convex/server'
import type { EncounterPlayerProjectionDto } from '@artificer-toolkit/schema/api/encounters'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  createTabletopCampaign,
  tabletopPlayerEncounter
} from '../../vtt/CampaignTabletop.stories.fixtures'

const pending = {
  kind: 'INITIATIVE_DECLARATION',
  occurrenceId: '77777777-7777-4777-8777-777777777790',
  occurrenceVersion: 2,
  encounterVersion: tabletopPlayerEncounter.version,
  actorId: tabletopPlayerEncounter.actors[0]!.id,
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

const prepared = {
  ...tabletopPlayerEncounter,
  status: 'PREPARED' as const
} satisfies EncounterPlayerProjectionDto

const mocks = vi.hoisted(() => ({
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
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvex: () => ({ action: vi.fn() })
}))

import { CampaignSessionPlayerEncounters } from './CampaignSessionPlayerEncounters'

describe('CampaignSessionPlayerEncounters', () => {
  let listed: EncounterPlayerProjectionDto[]
  let pendingPrepared: EncounterPlayerProjectionDto[]

  beforeEach(() => {
    vi.clearAllMocks()
    listed = []
    pendingPrepared = [prepared]
    mocks.convexQuery.mockImplementation((reference) => ({
      queryKey: [getFunctionName(reference)]
    }))
    mocks.useQuery.mockImplementation((options: { queryKey: readonly unknown[] }) => {
      const key = options.queryKey[0]
      if (key === getFunctionName(convexApi.encounters.projectionReads.pendingPrepared))
        return { data: pendingPrepared, error: null, isPending: false }
      if (key === getFunctionName(convexApi.encounters.pendingReads.pendingRuleOccurrence))
        return { data: pending, error: null, isPending: false }
      return { data: listed, error: null, isPending: false }
    })
    mocks.useMutation.mockReturnValue({ isPending: false, mutateAsync: vi.fn() })
  })

  it('shows the eligible prepared decision and retains a newer active projection', async () => {
    const user = userEvent.setup()
    const view = renderWithAppProviders(
      <CampaignSessionPlayerEncounters campaign={createTabletopCampaign('PLAYER')} />
    )

    expect(screen.getByText('Vault confrontation')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(await screen.findByRole('combobox', { name: 'Primary action' })).toBeVisible()

    listed = [tabletopPlayerEncounter]
    view.rerender(<CampaignSessionPlayerEncounters campaign={createTabletopCampaign('PLAYER')} />)

    expect(screen.getByText('In progress')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Open pending decision' })).not.toBeInTheDocument()
  })

  it('renders the prepared decision readonly when the Campaign is archived', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignSessionPlayerEncounters
        campaign={{ ...createTabletopCampaign('PLAYER'), status: 'ARCHIVED' }}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(screen.getByRole('button', { name: 'Declare actions' })).toBeDisabled()
  })
})
