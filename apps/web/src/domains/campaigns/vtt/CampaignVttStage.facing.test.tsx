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
  onTokenSelect: null as ((tokenId: string | null) => void) | null,
  mutate: vi.fn(),
  readEncounter: vi.fn(),
  sendCommand: vi.fn(),
  facingStepDegrees: 90 as number | null
}))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (reference: unknown) => ({ queryKey: [reference] })
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useMutation: () => ({ isPending: false, mutate: mocks.mutate, mutateAsync: vi.fn() }),
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
// The canvas renderer is the platform: the stage hands it drag-commit and selection callbacks, and
// a drag or a click on a token is simulated by calling them as the renderer does.
vi.mock('./vttSceneRenderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./vttSceneRenderer')>()),
  createVttSceneRenderer: (
    _host: HTMLElement,
    _gameSystemId: string,
    handlers: {
      onTokenCommit: (tokenId: string, path: ScenePoint[]) => void
      onTokenSelect: (tokenId: string | null) => void
    }
  ) => {
    mocks.onTokenCommit = handlers.onTokenCommit
    mocks.onTokenSelect = handlers.onTokenSelect
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

function heldRoom(): HeldEncounterSession {
  return {
    held: true,
    version: tabletopGmEncounter.version,
    state: {
      encounter: { ...tabletopGmEncounter, facingStepDegrees: mocks.facingStepDegrees },
      pending: null,
      waitingOn: null,
      turnMovement: [],
      halfSpeedFields: [],
      auras: [],
      movementCostZones: []
    },
    preparedPending: [],
    actorSides: null,
    settlement: null,
    timeline: null
  }
}

vi.mock('./useCampaignLiveSession', () => ({
  useCampaignLiveSession: () => ({
    commandReady: true,
    encounterSession: heldRoom(),
    error: null,
    readEncounter: mocks.readEncounter,
    recipientState: {
      recipientRole: 'OWNER',
      presentationVersion: 1,
      scene: tabletopLiveScene
    },
    rejection: null,
    sendCommand: mocks.sendCommand,
    sendEncounterCommand: vi.fn(),
    status: 'CONNECTED'
  })
}))

import { CampaignVttStage } from './CampaignVttStage'

const binding = {
  encounterId: tabletopGmEncounter.id,
  sceneId: tabletopLiveScene.id
}
const eastward = [ember.position, { x: ember.position.x + 200, y: ember.position.y }]

/** Waits until the room has answered the Scene, token bindings and holds, as a move needs. */
async function stageReady() {
  await waitFor(() => expect(mocks.onTokenCommit).not.toBeNull())
  await waitFor(() => expect(mocks.readEncounter).toHaveBeenCalledTimes(3))
  await act(async () => {
    await Promise.resolve()
  })
}

function render(facingStepDegrees: number | null) {
  mocks.facingStepDegrees = facingStepDegrees
  renderWithAppProviders(
    <CampaignVttStage campaign={campaign} currentUserId={tabletopCurrentUserId} />
  )
}

describe('CampaignVttStage facing (ATTACK-12.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.onTokenCommit = null
    mocks.onTokenSelect = null
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

  it('holds an Encounter walk for the facing it ends in, offering the direction of travel first', async () => {
    render(90)
    await stageReady()
    act(() => mocks.onTokenCommit!(ember.id, eastward))

    const choice = screen.getByRole('region', { name: 'End facing' })
    expect(mocks.sendCommand).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'East' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'South' }))

    expect(mocks.sendCommand).toHaveBeenCalledExactlyOnceWith({
      scope: 'SCENE',
      command: expect.objectContaining({
        type: 'MOVE_SCENE_TOKEN',
        movementKind: 'VOLUNTARY',
        tokenId: ember.id,
        path: eastward,
        facingDegrees: 180
      })
    })
    expect(choice).not.toBeInTheDocument()
  })

  it('sends nothing when the mover cancels the facing choice', async () => {
    render(90)
    await stageReady()
    act(() => mocks.onTokenCommit!(ember.id, eastward))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(mocks.sendCommand).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'End facing' })).not.toBeInTheDocument()
  })

  it('commits a walk at once, with no facing, while the Facing rule is off', async () => {
    render(null)
    await stageReady()
    act(() => mocks.onTokenCommit!(ember.id, eastward))

    expect(screen.queryByRole('region', { name: 'End facing' })).not.toBeInTheDocument()
    expect(mocks.sendCommand).toHaveBeenCalledOnce()
    expect(mocks.sendCommand.mock.calls[0]![0].command).not.toHaveProperty('facingDegrees')
    act(() => mocks.onTokenSelect!(ember.id))
    expect(
      screen.queryByRole('button', { name: 'Change facing (reaction)' })
    ).not.toBeInTheDocument()
  })

  it('turns a selected creature as a reaction', async () => {
    render(90)
    await stageReady()
    act(() => mocks.onTokenSelect!(ember.id))
    fireEvent.click(screen.getByRole('button', { name: 'Change facing (reaction)' }))
    fireEvent.click(screen.getByRole('button', { name: 'West' }))

    expect(mocks.mutate).toHaveBeenCalledExactlyOnceWith({
      type: 'CHANGE_FACING',
      encounterId: tabletopGmEncounter.id,
      commandId: expect.any(String),
      expectedVersion: tabletopGmEncounter.version,
      actorId: emberActor.id,
      rotationDegrees: 270,
      acknowledgedWarnings: []
    })
    expect(screen.queryByRole('region', { name: 'Change facing' })).not.toBeInTheDocument()
    expect(mocks.sendCommand).not.toHaveBeenCalled()
  })
})
