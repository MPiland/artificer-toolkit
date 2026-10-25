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

const mistyStepAllowance = {
  castCommandId: '00000000-0000-4000-8000-0000000000a1',
  maxFeet: 30,
  destinationKind: 'VISIBLE' as const
}

let teleport: (typeof mistyStepAllowance)[] = []

const room = (): HeldEncounterSession => ({
  held: true,
  version: tabletopGmEncounter.version,
  state: {
    encounter: tabletopGmEncounter,
    pending: null,
    waitingOn: null,
    turnMovement: [
      {
        actorId: emberActor.id,
        used: 0,
        speedId: null,
        allowances: [],
        fleeSourceActorIds: [],
        teleport
      }
    ],
    halfSpeedFields: [],
    auras: [],
    movementCostZones: []
  },
  preparedPending: [],
  actorSides: null,
  settlement: null,
  timeline: null
})

vi.mock('./useCampaignLiveSession', () => ({
  useCampaignLiveSession: () => ({
    commandReady: true,
    encounterSession: room(),
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

const destination: ScenePoint = { x: ember.position.x + 100, y: ember.position.y + 200 }

/** A drag of Ember's token that wanders before it ends at `destination`. */
async function dragEmber() {
  await waitFor(() => expect(mocks.onTokenCommit).not.toBeNull())
  await waitFor(() => expect(mocks.readEncounter).toHaveBeenCalledTimes(3))
  await act(async () => {
    await Promise.resolve()
  })
  act(() =>
    mocks.onTokenCommit!(ember.id, [
      ember.position,
      { x: ember.position.x + 300, y: ember.position.y },
      destination
    ])
  )
}

function renderStage() {
  mocks.onTokenCommit = null
  renderWithAppProviders(
    <CampaignVttStage campaign={campaign} currentUserId={tabletopCurrentUserId} />
  )
}

describe('CampaignVttStage in-Scene teleport (SPELLS-28.T1b)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sendCommand.mockResolvedValue(undefined)
    mocks.readEncounter.mockImplementation(({ kind }: { kind: string }) =>
      Promise.resolve({
        version: tabletopGmEncounter.version,
        result:
          kind === 'SCENE_BINDING'
            ? { kind, result: { ...binding, encounterVersion: tabletopGmEncounter.version } }
            : kind === 'HELD_RELATIONSHIPS'
              ? { kind, result: [] }
              : { kind, result: [{ ...binding, actorId: emberActor.id, tokenId: ember.id }] }
      })
    )
  })

  it('sends a drag as a teleport from the origin to the drop while the cast allowance stands', async () => {
    teleport = [mistyStepAllowance]
    renderStage()
    await dragEmber()

    expect(mocks.sendCommand).toHaveBeenCalledExactlyOnceWith({
      scope: 'SCENE',
      command: expect.objectContaining({
        type: 'MOVE_SCENE_TOKEN',
        movementKind: 'TELEPORT',
        tokenId: ember.id,
        path: [ember.position, destination]
      })
    })
  })

  it('walks the same drag when no allowance stands', async () => {
    teleport = []
    renderStage()
    await dragEmber()

    expect(mocks.sendCommand).toHaveBeenCalledExactlyOnceWith({
      scope: 'SCENE',
      command: expect.objectContaining({ movementKind: 'VOLUNTARY' })
    })
  })

  it('walks the drag when the mover turns teleporting off', async () => {
    teleport = [mistyStepAllowance]
    renderStage()
    fireEvent.click(await screen.findByRole('switch', { name: 'Teleport' }))
    await dragEmber()

    expect(mocks.sendCommand).toHaveBeenCalledExactlyOnceWith({
      scope: 'SCENE',
      command: expect.objectContaining({ movementKind: 'VOLUNTARY' })
    })
  })
})
