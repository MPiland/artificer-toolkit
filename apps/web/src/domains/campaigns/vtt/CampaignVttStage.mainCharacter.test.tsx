import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  createTabletopCampaign,
  tabletopCurrentUserId,
  tabletopLiveScene
} from './CampaignTabletop.stories.fixtures'

type RendererHandlers = { onTokenSelect: (tokenId: string | null) => void }

const mocks = vi.hoisted(() => ({
  handlers: null as RendererHandlers | null,
  update: vi.fn()
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
      recipientRole: 'PLAYER',
      presentationVersion: 1,
      scene: scene
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
// The canvas renderer is the platform: it receives the Stage's view and reports token selection.
vi.mock('./vttSceneRenderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./vttSceneRenderer')>()),
  createVttSceneRenderer: (
    _host: HTMLElement,
    _gameSystemId: string,
    handlers: RendererHandlers
  ) => {
    mocks.handlers = handlers
    return Promise.resolve({
      applyTransient: vi.fn(),
      destroy: vi.fn(),
      fit: vi.fn(),
      focusToken: vi.fn(),
      previewDoorState: vi.fn(),
      retryMap: vi.fn(),
      setZoomScale: vi.fn(),
      update: mocks.update,
      zoomIn: vi.fn(),
      zoomOut: vi.fn()
    })
  }
}))

import { CampaignVttStage } from './CampaignVttStage'

const ownCharacterId = '33333333-3333-4333-8333-333333333333'
const ownCharacterTokenId = tabletopLiveScene.tokens[0].id
const grantedCharacterTokenId = '77777777-7777-4777-8777-77777777770a'
const grantedCharacter = {
  id: '33333333-3333-4333-8333-333333333334',
  label: 'Brindle',
  publicId: 'brindle',
  systemId: '44444444-4444-4444-8444-444444444444'
}
const baseCampaign = createTabletopCampaign('PLAYER')
const campaign = {
  ...baseCampaign,
  memberships: [
    ...baseCampaign.memberships.map((membership) => ({
      ...membership,
      assignedCharacter: { ...membership.assignedCharacter!, id: ownCharacterId }
    })),
    {
      ...baseCampaign.memberships[0]!,
      assignedCharacter: grantedCharacter,
      characterControllerUserIds: [tabletopCurrentUserId],
      userId: '00000000-0000-4000-8000-0000000000bb',
      username: 'brindle-player'
    }
  ]
}
const [ember, warden] = tabletopLiveScene.tokens
const scene = {
  ...tabletopLiveScene,
  tokens: [
    { ...ember, characterId: ownCharacterId },
    // Another member's Character, granted to the current user: no GM-listed controller.
    {
      ...ember,
      characterId: grantedCharacter.id,
      controlledByUserIds: [],
      id: grantedCharacterTokenId,
      label: 'Brindle',
      position: { x: 400, y: 230 }
    },
    warden
  ]
}

const viewedToken = () => mocks.update.mock.lastCall?.[0].viewTokenId

describe('CampaignVttStage main Character (SCENE-5.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handlers = null
  })

  async function renderStage() {
    renderWithAppProviders(
      <CampaignVttStage campaign={campaign} currentUserId={tabletopCurrentUserId} />
    )
    await waitFor(() => expect(mocks.handlers).not.toBeNull())
    await waitFor(() => expect(viewedToken()).toBeDefined())
  }

  it('lists the controlled Characters, defaulting to the member own', async () => {
    const user = userEvent.setup()
    await renderStage()

    const picker = await screen.findByRole('combobox', { name: 'Main Character' })
    expect(picker).toHaveValue("Ember's Wake")
    expect(viewedToken()).toBe(ownCharacterTokenId)

    await user.click(picker)
    expect(await screen.findByRole('option', { name: 'Brindle' })).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('views through the picked Character, a selected controlled token, and back on clear', async () => {
    const user = userEvent.setup()
    await renderStage()

    await user.click(await screen.findByRole('combobox', { name: 'Main Character' }))
    await user.click(await screen.findByRole('option', { name: 'Brindle' }))
    await waitFor(() => expect(viewedToken()).toBe(grantedCharacterTokenId))

    act(() => mocks.handlers!.onTokenSelect(ownCharacterTokenId))
    await waitFor(() => expect(viewedToken()).toBe(ownCharacterTokenId))

    act(() => mocks.handlers!.onTokenSelect(null))
    await waitFor(() => expect(viewedToken()).toBe(grantedCharacterTokenId))
  })

  it('ignores a selected token the member does not control', async () => {
    await renderStage()

    act(() => mocks.handlers!.onTokenSelect(warden.id))

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2))
    expect(viewedToken()).toBe(ownCharacterTokenId)
  })
})
