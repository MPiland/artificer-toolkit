import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LiveLoot } from '@artificer-toolkit/schema/api/lootTables'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  createTabletopCampaign,
  tabletopCurrentUserId,
  tabletopLiveScene
} from './CampaignTabletop.stories.fixtures'

const mocks = vi.hoisted(() => ({ liveLootArgs: vi.fn() }))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (reference: unknown) => ({ queryKey: [reference] })
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useMutation: () => ({ isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() }),
  useQueries: () => [],
  useQuery: () => ({ data: undefined, error: null, isPending: false })
}))
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvex: () => ({}),
  useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (getFunctionName(reference) !== 'loot/tables:live') return { currencies: [], skills: [] }
    mocks.liveLootArgs(args)
    return args === 'skip' ? undefined : liveLoot
  }
}))
vi.mock('./useCampaignLiveSession', () => ({
  useCampaignLiveSession: () => ({
    commandReady: true,
    encounterSession: null,
    error: null,
    readEncounter: () => Promise.reject(new Error('Live play is not connected.')),
    recipientState: {
      recipientRole: 'GM',
      presentationVersion: 1,
      scene: tabletopLiveScene
    },
    rejection: null,
    sendCommand: vi.fn(),
    sendEncounterCommand: vi.fn(),
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
vi.mock('#app/data/contentSnapshots/useContentCatalogue', () => ({
  useContentCatalogue: () => ({ items: [] })
}))
// The canvas renderer is the platform; the Stage's own view is what is under test.
vi.mock('./vttSceneRenderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./vttSceneRenderer')>()),
  createVttSceneRenderer: () =>
    Promise.resolve({
      applyTransient: vi.fn(),
      destroy: vi.fn(),
      fit: vi.fn(),
      focusToken: vi.fn(),
      previewDoorState: vi.fn(),
      retryMap: vi.fn(),
      setZoomScale: vi.fn(),
      update: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn()
    })
}))

import { CampaignVttStage } from './CampaignVttStage'

const liveLoot: LiveLoot = {
  documents: [
    {
      owner: {
        kind: 'SCENE',
        campaignId: createTabletopCampaign('OWNER').id,
        sceneDefinitionId: tabletopLiveScene.definitionId
      },
      version: 1,
      tables: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Guard room',
          ranges: [
            {
              id: '44444444-4444-4444-8444-444444444444',
              min: 1,
              max: null,
              entries: [],
              note: 'Under the cot'
            }
          ]
        }
      ]
    }
  ]
}

describe('CampaignVttStage loot (SCENE-4.2)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gives the GM the presented Scene tables and a roll result that highlights its range', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignVttStage
        campaign={createTabletopCampaign('OWNER')}
        currentUserId={tabletopCurrentUserId}
      />
    )
    await user.click(await screen.findByRole('button', { name: 'Open loot' }))
    const scene = await screen.findByRole('region', { name: 'This scene' })
    await user.type(within(scene).getByRole('textbox', { name: 'Roll result for Guard room' }), '4')
    expect(within(scene).getByText('Matches roll')).toBeInTheDocument()
    expect(within(scene).getByText('Under the cot')).toBeInTheDocument()
    expect(mocks.liveLootArgs).toHaveBeenLastCalledWith({
      campaignId: createTabletopCampaign('OWNER').id,
      encounterId: null,
      sceneDefinitionId: tabletopLiveScene.definitionId
    })
  })

  it('never reads or shows loot for a player', async () => {
    renderWithAppProviders(
      <CampaignVttStage
        campaign={createTabletopCampaign('PLAYER')}
        currentUserId={tabletopCurrentUserId}
      />
    )
    await waitFor(() => expect(mocks.liveLootArgs).toHaveBeenCalled())
    expect(mocks.liveLootArgs.mock.calls.every(([args]) => args === 'skip')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Open loot' })).not.toBeInTheDocument()
  })
})
