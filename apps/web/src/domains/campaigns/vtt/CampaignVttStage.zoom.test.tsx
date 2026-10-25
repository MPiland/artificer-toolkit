import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  createTabletopCampaign,
  tabletopCurrentUserId,
  tabletopLiveScene
} from './CampaignTabletop.stories.fixtures'
import { readStoredVttZoom, vttZoomStorageKey } from './vttZoom.model'

type ZoomHandlers = {
  onZoomChange: (scale: number, origin: 'SCENE' | 'USER') => void
  resolveSceneZoom: (sceneId: string) => number | null
}

const mocks = vi.hoisted(() => ({
  handlers: null as ZoomHandlers | null,
  setZoomScale: vi.fn()
}))

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
  useConvex: () => ({})
}))
vi.mock('./useCampaignLiveSession', () => ({
  useCampaignLiveSession: () => ({
    commandReady: true,
    encounterSession: null,
    error: null,
    readEncounter: () => Promise.reject(new Error('Live play is not connected.')),
    recipientState: {
      recipientRole: 'OWNER',
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
// The canvas renderer is the platform: it reports zoom through the callbacks the Stage hands it.
vi.mock('./vttSceneRenderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./vttSceneRenderer')>()),
  createVttSceneRenderer: (_host: HTMLElement, _gameSystemId: string, handlers: ZoomHandlers) => {
    mocks.handlers = handlers
    return Promise.resolve({
      applyTransient: vi.fn(),
      destroy: vi.fn(),
      fit: vi.fn(),
      focusToken: vi.fn(),
      previewDoorState: vi.fn(),
      retryMap: vi.fn(),
      setZoomScale: (scale: number) => {
        mocks.setZoomScale(scale)
        handlers.onZoomChange(scale, 'USER')
      },
      update: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn()
    })
  }
}))

import { CampaignVttStage } from './CampaignVttStage'

const campaign = createTabletopCampaign('PLAYER')
const zoomKey = vttZoomStorageKey(campaign.id, tabletopLiveScene.id)

async function readyHandlers(): Promise<ZoomHandlers> {
  await waitFor(() => expect(mocks.handlers).not.toBeNull())
  return mocks.handlers!
}

describe('CampaignVttStage zoom (SCENE-5.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.handlers = null
  })

  it('lets a player type a zoom and keeps it on this device for the Scene', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignVttStage campaign={campaign} currentUserId={tabletopCurrentUserId} />
    )
    await readyHandlers()

    const field = await screen.findByRole('textbox', { name: 'Zoom percentage' })
    await user.clear(field)
    await user.type(field, '150{Enter}')

    expect(mocks.setZoomScale).toHaveBeenCalledExactlyOnceWith(1.5)
    expect(field).toHaveValue('150%')
    expect(readStoredVttZoom(zoomKey)).toBe(1.5)
  })

  it('persists a step and hands the saved zoom back after a reload', async () => {
    const user = userEvent.setup()
    const first = renderWithAppProviders(
      <CampaignVttStage campaign={campaign} currentUserId={tabletopCurrentUserId} />
    )
    await readyHandlers()
    await user.click(await screen.findByRole('button', { name: 'Zoom in' }))
    const stepped = readStoredVttZoom(zoomKey)
    expect(stepped).toBeCloseTo(1.1, 12)

    first.unmount()
    mocks.handlers = null
    renderWithAppProviders(
      <CampaignVttStage campaign={campaign} currentUserId={tabletopCurrentUserId} />
    )
    const handlers = await readyHandlers()

    expect(handlers.resolveSceneZoom(tabletopLiveScene.id)).toBe(stepped)
  })

  it('shows a zoom the renderer sets for a scene without saving it as a choice', async () => {
    renderWithAppProviders(
      <CampaignVttStage campaign={campaign} currentUserId={tabletopCurrentUserId} />
    )
    const handlers = await readyHandlers()

    handlers.onZoomChange(0.4, 'SCENE')

    expect(await screen.findByRole('textbox', { name: 'Zoom percentage' })).toHaveValue('40%')
    expect(readStoredVttZoom(zoomKey)).toBeNull()
    expect(handlers.resolveSceneZoom(tabletopLiveScene.id)).toBeNull()
  })
})
