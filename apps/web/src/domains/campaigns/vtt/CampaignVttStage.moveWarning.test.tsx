import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  createTabletopCampaign,
  tabletopCurrentUserId,
  tabletopGmEncounter,
  tabletopLiveScene
} from './CampaignTabletop.stories.fixtures'
import { LiveSessionCommandRejectedError } from './liveSessionClient'
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
// The canvas renderer is the platform: a drag is simulated by calling the commit callback the
// stage hands it, as the renderer does when a drag ends.
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

const room: HeldEncounterSession = {
  held: true,
  version: tabletopGmEncounter.version,
  state: {
    encounter: tabletopGmEncounter,
    pending: null,
    waitingOn: null,
    turnMovement: [],
    halfSpeedFields: [],
    auras: [],
    movementCostZones: [],
    placedZones: []
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

const approach = {
  code: 'CONDITION_SOURCE_APPROACH',
  message: 'Frightened: this move ends closer to the source of its fear.'
} as const

const destination = { x: 200, y: ember.position.y }

async function dragEmber() {
  await waitFor(() => expect(mocks.onTokenCommit).not.toBeNull())
  // The drag commits only once the room has answered the Scene, token bindings and holds.
  await waitFor(() => expect(mocks.readEncounter).toHaveBeenCalledTimes(3))
  await act(async () => {
    await Promise.resolve()
  })
  await act(async () => {
    mocks.onTokenCommit!(ember.id, [ember.position, destination])
    await Promise.resolve()
  })
}

describe('CampaignVttStage move rule warnings (SPELLS-29.T1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.onTokenCommit = null
    mocks.sendCommand
      .mockImplementationOnce(({ command }: { command: { commandId: string } }) =>
        Promise.reject(
          new LiveSessionCommandRejectedError({
            code: 'DOMAIN_REJECTED',
            commandId: command.commandId,
            currentSequence: 3,
            message: 'This action breaks a rule. Do it anyway?',
            reason: 'RULE_WARNINGS',
            warnings: [approach]
          })
        )
      )
      .mockResolvedValue(undefined)
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

  it('shows the warning on a refused move and resends it acknowledged on "Do it anyway"', async () => {
    await dragEmber()
    const confirmation = await screen.findByRole('alert')
    expect(within(confirmation).getByText('This breaks a rule')).toBeVisible()
    expect(within(confirmation).getByText(approach.message)).toBeVisible()

    fireEvent.click(within(confirmation).getByRole('button', { name: 'Do it anyway' }))

    await waitFor(() => expect(mocks.sendCommand).toHaveBeenCalledTimes(2))
    const [first, second] = mocks.sendCommand.mock.calls.map(([sent]) => sent.command)
    expect(first).toMatchObject({ type: 'MOVE_SCENE_TOKEN', acknowledgedWarnings: [] })
    expect(second).toMatchObject({
      type: 'MOVE_SCENE_TOKEN',
      tokenId: ember.id,
      path: [ember.position, destination],
      acknowledgedWarnings: [approach.code]
    })
    expect(second.commandId).not.toBe(first.commandId)
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('sends nothing more when the mover keeps to the rule', async () => {
    await dragEmber()
    const confirmation = await screen.findByRole('alert')
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }))

    expect(mocks.sendCommand).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})
