import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { validated } from '../../../test/validatedFixture'
import {
  createTabletopCampaign,
  tabletopCurrentUserId,
  tabletopGmEncounter,
  tabletopLiveScene
} from './CampaignTabletop.stories.fixtures'
import type { HeldEncounterSession } from './useCampaignLiveSession'
import type { VttSceneRendererUpdate } from './vttSceneRenderer'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  onSquarePick: null as ((center: ScenePoint) => void) | null,
  readEncounter: vi.fn(),
  room: null as unknown,
  update: vi.fn()
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
vi.mock('#app/settings/useGmRollVisibilityPreference', () => ({
  useGmRollVisibilityPreference: () => ({
    gmRollVisibility: 'PUBLIC',
    setGmRollVisibility: vi.fn()
  })
}))
// The canvas renderer is the platform: a press inside a legal square is simulated by calling the
// callback the renderer's gesture ends in, and what the stage hands it is read from its updates.
vi.mock('./vttSceneRenderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./vttSceneRenderer')>()),
  createVttSceneRenderer: (
    _host: HTMLElement,
    _gameSystemId: string,
    handlers: { onSquarePick: (center: ScenePoint) => void }
  ) => {
    mocks.onSquarePick = handlers.onSquarePick
    return Promise.resolve({
      applyTransient: vi.fn(),
      destroy: vi.fn(),
      fit: vi.fn(),
      focusToken: vi.fn(),
      previewDoorState: vi.fn(),
      retryMap: vi.fn(),
      update: mocks.update,
      zoomIn: vi.fn(),
      zoomOut: vi.fn()
    })
  }
}))
vi.mock('./useCampaignLiveSession', () => ({
  useCampaignLiveSession: () => ({
    commandReady: true,
    encounterSession: mocks.room,
    error: null,
    readEncounter: mocks.readEncounter,
    recipientState: { recipientRole: 'OWNER', presentationVersion: 1, scene: tabletopLiveScene },
    rejection: null,
    sendCommand: vi.fn(),
    sendEncounterCommand: vi.fn(),
    status: 'CONNECTED'
  })
}))

import { CampaignVttStage } from './CampaignVttStage'

const [emberToken, wardenToken] = tabletopLiveScene.tokens as [
  (typeof tabletopLiveScene.tokens)[number],
  (typeof tabletopLiveScene.tokens)[number]
]
const [emberActor, wardenActor] = tabletopGmEncounter.actors as [
  (typeof tabletopGmEncounter.actors)[number],
  (typeof tabletopGmEncounter.actors)[number]
]
const stay = wardenToken.position
const west = { x: stay.x - 70, y: stay.y }
const north = { x: stay.x, y: stay.y - 70 }
const binding = { encounterId: tabletopGmEncounter.id, sceneId: tabletopLiveScene.id }

/** Ember's Wake pushes the Vault Warden, or the Warden pushes Ember's Wake. */
function pendingPush(sourceActorId: string, targetActorId: string) {
  return validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
    kind: 'FORCED_MOVEMENT_DESTINATION',
    occurrenceId: '12121212-1212-4121-8121-121212121212',
    occurrenceVersion: 2,
    encounterVersion: tabletopGmEncounter.version,
    sourceActorId,
    targetActorId,
    requestId: 'crusher-push',
    positions:
      targetActorId === wardenActor.id
        ? [stay, west, north]
        : [emberToken.position, { x: emberToken.position.x + 70, y: emberToken.position.y }],
    allowedResponses: ['FORCED_MOVEMENT']
  })
}

function renderStage(
  role: 'OWNER' | 'PLAYER',
  pending: ReturnType<typeof pendingPush>
): ReturnType<typeof userEvent.setup> {
  mocks.room = {
    held: true,
    version: tabletopGmEncounter.version,
    state: {
      encounter: tabletopGmEncounter,
      pending,
      waitingOn: null,
      turnMovement: [],
      halfSpeedFields: [],
      movementCostZones: [],
      auras: []
    },
    preparedPending: [],
    actorSides: null,
    settlement: null,
    timeline: null
  } satisfies HeldEncounterSession
  renderWithAppProviders(
    <CampaignVttStage
      campaign={createTabletopCampaign(role)}
      currentUserId={tabletopCurrentUserId}
    />
  )
  return userEvent.setup()
}

const lastUpdate = (): VttSceneRendererUpdate => mocks.update.mock.lastCall![0]

const resolution = (position: ScenePoint) => ({
  type: 'RESOLVE_RULE_OCCURRENCE',
  encounterId: tabletopGmEncounter.id,
  commandId: expect.any(String),
  expectedVersion: tabletopGmEncounter.version,
  occurrenceId: '12121212-1212-4121-8121-121212121212',
  expectedOccurrenceVersion: 2,
  correlationId: null,
  resolution: { kind: 'FORCED_MOVEMENT', requestId: 'crusher-push', position }
})

describe('CampaignVttStage picking where a forced movement leaves its target (D157)', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn()
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.onSquarePick = null
    mocks.readEncounter.mockImplementation(({ kind }: { kind: string }) =>
      Promise.resolve({
        version: tabletopGmEncounter.version,
        result:
          kind === 'SCENE_BINDING'
            ? { kind, result: { ...binding, encounterVersion: tabletopGmEncounter.version } }
            : kind === 'HELD_RELATIONSHIPS'
              ? { kind, result: [] }
              : {
                  kind,
                  result: [
                    { ...binding, actorId: emberActor.id, tokenId: emberToken.id },
                    { ...binding, actorId: wardenActor.id, tokenId: wardenToken.id }
                  ]
                }
      })
    )
  })

  it('limits the board to the legal squares and answers with the square a press landed in', async () => {
    renderStage('OWNER', pendingPush(emberActor.id, wardenActor.id))
    expect(await screen.findByText('Pick where Vault Warden lands.')).toBeVisible()
    await waitFor(() =>
      expect(lastUpdate().squarePick).toEqual({
        centers: [stay, west, north],
        width: wardenToken.width,
        height: wardenToken.height
      })
    )
    act(() => mocks.onSquarePick!(west))
    expect(mocks.mutate).toHaveBeenCalledExactlyOnceWith(resolution(west))
  })

  it('moves one picker over the legal squares with the arrow keys, marks and announces the focused one, and answers with it', async () => {
    const user = renderStage('OWNER', pendingPush(emberActor.id, wardenActor.id))
    const picker = await screen.findByRole('button', { name: 'Leave Vault Warden where it is' })
    await waitFor(() => expect(picker).toHaveFocus())
    expect(screen.getAllByRole('button', { name: /Vault Warden/ })).toEqual([picker])
    await user.keyboard('{ArrowLeft}')
    expect(picker).toHaveAccessibleName('Move Vault Warden 5 ft west')
    expect(picker).toHaveFocus()
    await waitFor(() =>
      expect(lastUpdate().overlays?.find(({ purpose }) => purpose === 'TARGET')?.label).toBe(
        'Move Vault Warden 5 ft west'
      )
    )
    expect(
      screen.getByText('Move Vault Warden 5 ft west', { selector: '[aria-live]' })
    ).toBeInTheDocument()
    await user.keyboard('{ArrowUp}')
    expect(picker).toHaveAccessibleName('Move Vault Warden 5 ft north')
    await user.keyboard('{Home}')
    expect(picker).toHaveAccessibleName('Leave Vault Warden where it is')
    await user.keyboard('{ArrowLeft}')
    await user.keyboard('{Enter}')
    expect(mocks.mutate).toHaveBeenCalledExactlyOnceWith(resolution(west))
  })

  it('picks the focused square with Space', async () => {
    const user = renderStage('OWNER', pendingPush(emberActor.id, wardenActor.id))
    const picker = await screen.findByRole('button', { name: 'Leave Vault Warden where it is' })
    await waitFor(() => expect(picker).toHaveFocus())
    await user.keyboard('{ArrowUp}')
    await user.keyboard(' ')
    expect(mocks.mutate).toHaveBeenCalledExactlyOnceWith(resolution(north))
  })

  it('offers the pick to a player who acts for the source', async () => {
    renderStage('PLAYER', pendingPush(emberActor.id, wardenActor.id))
    expect(await screen.findByText('Pick where Vault Warden lands.')).toBeVisible()
  })

  it('offers no pick to a player who does not act for the source', async () => {
    renderStage('PLAYER', pendingPush(wardenActor.id, emberActor.id))
    await waitFor(() => expect(mocks.update).toHaveBeenCalled())
    expect(screen.queryByText(/Pick where/)).not.toBeInTheDocument()
    expect(lastUpdate().squarePick).toBeNull()
  })
})
