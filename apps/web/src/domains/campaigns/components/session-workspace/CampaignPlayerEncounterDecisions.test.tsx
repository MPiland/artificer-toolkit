import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { getFunctionName } from 'convex/server'
import {
  encounterPlayerProjectionDtoSchema,
  type EncounterPlayerProjectionDto,
  type EncounterSummaryDto
} from '@artificer-toolkit/schema/api/encounters'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import type { HeldEncounterSession } from '../../vtt/useCampaignLiveSession'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  createTabletopCampaign,
  tabletopPlayerEncounter
} from '../../vtt/CampaignTabletop.stories.fixtures'

const pending = pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
  kind: 'INITIATIVE_DECLARATION',
  occurrenceId: '77777777-7777-4777-8777-777777777790',
  occurrenceVersion: 2,
  encounterVersion: tabletopPlayerEncounter.version,
  actorId: tabletopPlayerEncounter.actors[0]!.id,
  requestId: 'speed-factor-declaration',
  primaryOptions: [
    {
      kind: 'CHARACTER_ACTION',
      optionId: 'action:longsword',
      label: 'Longsword',
      selectionContract: 'a'.repeat(64)
    }
  ],
  bonusOptions: [],
  adjudicationFields: [],
  allowedResponses: ['INITIATIVE_DECLARATION']
})

const prepared = encounterPlayerProjectionDtoSchema.parse({
  ...tabletopPlayerEncounter,
  status: 'PREPARED'
})

const mocks = vi.hoisted(() => ({
  convexQuery: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
  encounterSession: null as HeldEncounterSession | null
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

vi.mock('../../vtt/useCampaignLiveSession', () => ({
  useCampaignLiveSession: () => ({
    campaignSummary: null,
    encounterSession: mocks.encounterSession,
    readEncounter: () => Promise.reject(new Error('Live play is not connected.'))
  })
}))

import { CampaignPlayerEncounterDecisions } from './CampaignPlayerEncounterDecisions'

describe('CampaignPlayerEncounterDecisions', () => {
  let listed: EncounterSummaryDto[]
  let pendingPrepared: { encounter: EncounterPlayerProjectionDto; pending: typeof pending }[]

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.encounterSession = null
    listed = []
    pendingPrepared = [{ encounter: prepared, pending }]
    mocks.convexQuery.mockImplementation((reference) => ({
      queryKey: [getFunctionName(reference)]
    }))
    mocks.useQuery.mockImplementation((options: { queryKey: readonly unknown[] }) => {
      const key = options.queryKey[0]
      if (key === getFunctionName(convexApi.encounters.projectionReads.pendingPrepared))
        return { data: pendingPrepared, error: null, isPending: false }
      return { data: listed, error: null, isPending: false }
    })
    mocks.useMutation.mockReturnValue({ isPending: false, mutateAsync: vi.fn() })
  })

  it('shows the eligible prepared decision and retains a newer active summary', async () => {
    const user = userEvent.setup()
    const view = renderWithAppProviders(
      <CampaignPlayerEncounterDecisions campaign={createTabletopCampaign('PLAYER')} />
    )

    expect(screen.getByText('Vault confrontation')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(await screen.findByRole('combobox', { name: 'Primary action' })).toBeVisible()

    listed = [
      {
        id: tabletopPlayerEncounter.id,
        name: tabletopPlayerEncounter.name,
        status: 'ACTIVE',
        round: tabletopPlayerEncounter.round,
        actorCount: null,
        updatedAt: tabletopPlayerEncounter.updatedAt,
        version: tabletopPlayerEncounter.version
      }
    ]
    view.rerender(<CampaignPlayerEncounterDecisions campaign={createTabletopCampaign('PLAYER')} />)

    expect(screen.getByText('In progress')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Open pending decision' })).not.toBeInTheDocument()
  })

  it('renders the prepared decision readonly when the Campaign is archived', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignPlayerEncounterDecisions
        campaign={{ ...createTabletopCampaign('PLAYER'), status: 'ARCHIVED' }}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open pending decision' }))
    expect(screen.getByRole('button', { name: 'Declare actions' })).toBeDisabled()
  })

  describe('Convex reads (ADR 0035 A28)', () => {
    const pendingPreparedName = getFunctionName(
      convexApi.encounters.projectionReads.pendingPrepared
    )
    const pendingPreparedArgs = () =>
      mocks.convexQuery.mock.calls.find(
        ([reference]) => getFunctionName(reference) === pendingPreparedName
      )?.[1]

    it('does not read prepared decisions from Convex while the room holds authority, and shows the room list', () => {
      mocks.encounterSession = {
        held: true,
        version: 4,
        state: {
          encounter: null,
          pending: null,
          waitingOn: null,
          turnMovement: [],
          halfSpeedFields: [],
          auras: [],
          movementCostZones: [],
          placedZones: [],
          pendingZoneSightings: []
        },
        preparedPending: [{ encounter: prepared, pending }],
        actorSides: null,
        settlement: null,
        timeline: null
      }
      pendingPrepared = []
      renderWithAppProviders(
        <CampaignPlayerEncounterDecisions campaign={createTabletopCampaign('PLAYER')} />
      )

      expect(pendingPreparedArgs()).toBe('skip')
      expect(screen.getByRole('button', { name: 'Open pending decision' })).toBeVisible()
    })

    it('reads prepared decisions from Convex when the room does not hold authority', () => {
      const campaign = createTabletopCampaign('PLAYER')
      renderWithAppProviders(<CampaignPlayerEncounterDecisions campaign={campaign} />)

      expect(pendingPreparedArgs()).toEqual({ campaignId: campaign.id })
    })
  })
})
