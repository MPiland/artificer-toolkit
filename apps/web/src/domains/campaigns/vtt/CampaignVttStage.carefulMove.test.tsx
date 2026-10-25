import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  createTabletopCampaign,
  tabletopCurrentUserId,
  tabletopGmEncounter,
  tabletopLiveScene
} from './CampaignTabletop.stories.fixtures'
import type { HeldEncounterSession } from './useCampaignLiveSession'
import type { HalfSpeedField } from './CampaignVttCarefulMove.model'

const mocks = vi.hoisted(() => ({
  onTokenCommit: null as ((tokenId: string, path: ScenePoint[]) => void) | null,
  readEncounter: vi.fn(),
  sendCommand: vi.fn()
}))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (reference: unknown) => ({ queryKey: [reference] })
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
// The canvas renderer is the platform: the stage hands it a drag-commit callback, and a drag is
// simulated by calling that callback as the renderer does when a drag ends.
vi.mock('./vttSceneRenderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./vttSceneRenderer')>()),
  createVttSceneRenderer: (
    _host: HTMLElement,
    _gameSystemId: string,
    handlers: { onTokenCommit: (tokenId: string, path: ScenePoint[]) => void }
  ) => {
    mocks.onTokenCommit = handlers.onTokenCommit
    return Promise.resolve({
      applyTransient: vi.fn(),
      destroy: vi.fn(),
      fit: vi.fn(),
      focusToken: vi.fn(),
      previewDoorState: vi.fn(),
      retryMap: vi.fn(),
      update: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn()
    })
  }
}))

const campaign = createTabletopCampaign('OWNER')
const ember = tabletopLiveScene.tokens[0]!
const emberActor = tabletopGmEncounter.actors[0]!

const caltrops: HalfSpeedField = {
  id: '00000000-0000-4000-8000-0000000000f1',
  label: 'Caltrop field',
  shape: {
    kind: 'POLYGON',
    points: [
      { x: 300, y: 200 },
      { x: 400, y: 200 },
      { x: 400, y: 260 },
      { x: 300, y: 260 }
    ]
  }
}

const room: HeldEncounterSession = {
  held: true,
  version: tabletopGmEncounter.version,
  state: {
    encounter: tabletopGmEncounter,
    pending: null,
    waitingOn: null,
    turnMovement: [],
    halfSpeedFields: [caltrops],
    auras: [],
    movementCostZones: []
  },
  preparedPending: [],
  actorSides: null,
  settlement: null,
  timeline: null
}

vi.mock('./useCampaignLiveSession', () => ({
  useCampaignLiveSession: () => ({
    commandReady: true,
    encounterSession: room,
    error: null,
    readEncounter: mocks.readEncounter,
    recipientState: {
      recipientRole: 'OWNER',
      presentationVersion: 1,
      scene: tabletopLiveScene
    },
    rejection: null,
    sendCommand: mocks.sendCommand,
    status: 'CONNECTED'
  })
}))

import { CampaignVttStage } from './CampaignVttStage'

const binding = {
  encounterId: tabletopGmEncounter.id,
  sceneId: tabletopLiveScene.id
}

/** A drag of Ember's token from where it stands to `x`, along the row of the caltrop field. */
async function dragEmberTo(x: number) {
  await waitFor(() => expect(mocks.onTokenCommit).not.toBeNull())
  // The drag commits only once the room has answered the Scene, token bindings and holds.
  await waitFor(() => expect(mocks.readEncounter).toHaveBeenCalledTimes(3))
  await act(async () => {
    await Promise.resolve()
  })
  act(() => mocks.onTokenCommit!(ember.id, [ember.position, { x, y: ember.position.y }]))
}

describe('CampaignVttStage careful crossing (SPELLS-17.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.onTokenCommit = null
    mocks.sendCommand.mockResolvedValue(undefined)
    mocks.readEncounter.mockImplementation(({ kind }: { kind: string }) =>
      Promise.resolve({
        version: room.version,
        result:
          kind === 'SCENE_BINDING'
            ? { kind, result: { ...binding, encounterVersion: tabletopGmEncounter.version } }
            : kind === 'HELD_RELATIONSHIPS'
              ? { kind, result: [] }
              : { kind, result: [{ ...binding, actorId: emberActor.id, tokenId: ember.id }] }
      })
    )
    renderWithAppProviders(
      <CampaignVttStage campaign={campaign} currentUserId={tabletopCurrentUserId} />
    )
  })

  it('holds a drag across the half-speed field until the mover chooses, then commits it carefully', async () => {
    await dragEmberTo(500)
    expect(screen.getByText('This path enters the Caltrop field.')).toBeInTheDocument()
    expect(mocks.sendCommand).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Move carefully' }))

    expect(mocks.sendCommand).toHaveBeenCalledExactlyOnceWith({
      scope: 'SCENE',
      command: expect.objectContaining({
        type: 'MOVE_SCENE_TOKEN',
        carefully: true,
        movementKind: 'VOLUNTARY',
        tokenId: ember.id,
        sceneId: tabletopLiveScene.id,
        expectedEncounterVersion: tabletopGmEncounter.version,
        path: [ember.position, { x: 500, y: ember.position.y }]
      })
    })
    expect(screen.queryByRole('button', { name: 'Move carefully' })).not.toBeInTheDocument()
  })

  it('commits the same drag normally when the mover chooses to', async () => {
    await dragEmberTo(500)
    fireEvent.click(screen.getByRole('button', { name: 'Move normally' }))

    expect(mocks.sendCommand).toHaveBeenCalledExactlyOnceWith({
      scope: 'SCENE',
      command: expect.objectContaining({ type: 'MOVE_SCENE_TOKEN', carefully: false })
    })
  })

  it('sends nothing when the mover cancels the choice', async () => {
    await dragEmberTo(500)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(mocks.sendCommand).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Move carefully' })).not.toBeInTheDocument()
  })

  it('commits a drag that stays out of the field at once, without a choice', async () => {
    await dragEmberTo(200)

    expect(screen.queryByRole('button', { name: 'Move carefully' })).not.toBeInTheDocument()
    expect(mocks.sendCommand).toHaveBeenCalledExactlyOnceWith({
      scope: 'SCENE',
      command: expect.objectContaining({
        type: 'MOVE_SCENE_TOKEN',
        expectedEncounterVersion: tabletopGmEncounter.version
      })
    })
    expect(mocks.sendCommand.mock.calls[0]![0].command).not.toHaveProperty('carefully')
  })
})
