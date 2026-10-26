import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { getFunctionName } from 'convex/server'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { createTabletopCampaign, tabletopCurrentUserId } from './CampaignTabletop.stories.fixtures'
import type { HeldEncounterSession } from './useCampaignLiveSession'

const mocks = vi.hoisted(() => ({
  convexQuery: vi.fn(),
  encounterSession: null as HeldEncounterSession | null
}))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: mocks.convexQuery
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useMutation: () => ({ isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() }),
  useQueries: () => [],
  useQuery: () => ({ data: undefined, error: null, isPending: true })
}))
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvex: () => ({})
}))
vi.mock('./useCampaignLiveSession', () => ({
  useCampaignLiveSession: () => ({
    commandReady: false,
    encounterSession: mocks.encounterSession,
    error: null,
    readEncounter: () => Promise.reject(new Error('Live play is not connected.')),
    recipientState: null,
    rejection: null,
    status: 'CONNECTED'
  })
}))
vi.mock('#app/data/campaigns/useCampaignPresentedScene', () => ({
  useCampaignPresentedScene: () => ({
    canPresent: false,
    error: null,
    isLoading: false,
    present: vi.fn(),
    sceneId: null
  })
}))
vi.mock('#app/data/media', () => ({
  useVttMapDelivery: () => ({ data: undefined, error: null, isPending: false })
}))

import { CampaignVttStage } from './CampaignVttStage'

const campaign = createTabletopCampaign('OWNER')

function queryArgs(reference: Parameters<typeof getFunctionName>[0]) {
  const name = getFunctionName(reference)
  return mocks.convexQuery.mock.calls.find(([called]) => getFunctionName(called) === name)?.[1]
}

describe('CampaignVttStage Convex reads (ADR 0035 A28)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.convexQuery.mockImplementation((reference) => ({
      queryKey: [getFunctionName(reference)]
    }))
    mocks.encounterSession = null
  })

  it('reads the stored Run and prepared decisions from Convex without the room', () => {
    renderWithAppProviders(
      <CampaignVttStage campaign={campaign} currentUserId={tabletopCurrentUserId} />
    )

    expect(queryArgs(convexApi.encounters.activeReads.active)).toEqual({ campaignId: campaign.id })
    expect(queryArgs(convexApi.encounters.projectionReads.pendingPrepared)).toEqual({
      campaignId: campaign.id
    })
  })

  it('skips the stored Run and prepared decision reads while the room holds authority', () => {
    mocks.encounterSession = {
      held: true,
      version: 1,
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
      preparedPending: [],
      actorSides: null,
      settlement: null,
      timeline: null
    }
    renderWithAppProviders(
      <CampaignVttStage campaign={campaign} currentUserId={tabletopCurrentUserId} />
    )

    expect(queryArgs(convexApi.encounters.activeReads.active)).toBe('skip')
    expect(queryArgs(convexApi.encounters.projectionReads.pendingPrepared)).toBe('skip')
  })
})
