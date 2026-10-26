import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  createTabletopCampaign,
  tabletopCurrentUserId,
  tabletopGmEncounter,
  tabletopLiveScene
} from './CampaignTabletop.stories.fixtures'
import type { HeldEncounterSession } from './useCampaignLiveSession'

const mocks = vi.hoisted(() => ({
  onAreaPoint: null as ((point: ScenePoint) => void) | null,
  readEncounter: vi.fn(),
  send: vi.fn()
}))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (reference: unknown) => ({ queryKey: [reference] })
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useMutation: () => ({ isPending: false, mutate: vi.fn(), mutateAsync: mocks.send }),
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
// The canvas renderer is the platform: the pick gesture is simulated by calling the point callback
// the stage handed it, as the renderer does when a press is released.
vi.mock('./vttSceneRenderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./vttSceneRenderer')>()),
  createVttSceneRenderer: (
    _host: HTMLElement,
    _gameSystemId: string,
    handlers: { onAreaPoint: (point: ScenePoint) => void }
  ) => {
    mocks.onAreaPoint = handlers.onAreaPoint
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

const room = (): HeldEncounterSession => ({
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
    sendCommand: vi.fn(),
    sendEncounterCommand: vi.fn(),
    status: 'CONNECTED'
  })
}))

import { CampaignVttStage } from './CampaignVttStage'

const binding = { encounterId: tabletopGmEncounter.id, sceneId: tabletopLiveScene.id }
const placedVersion = tabletopGmEncounter.version + 1
const result = (version: number): EncounterCommandResultDto => ({
  projection: { ...tabletopGmEncounter, version },
  roll: null,
  occurrence: null,
  evidenceRoll: null
})
const center: ScenePoint = { x: 240, y: 160 }

describe('CampaignVttStage GM zone tool (MOVE-3.2)', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn()
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.onAreaPoint = null
    mocks.readEncounter.mockImplementation(({ kind }: { kind: string }) =>
      Promise.resolve({
        version: tabletopGmEncounter.version,
        result:
          kind === 'SCENE_BINDING'
            ? { kind, result: { ...binding, encounterVersion: tabletopGmEncounter.version } }
            : { kind, result: [] }
      })
    )
    renderWithAppProviders(
      <CampaignVttStage
        campaign={createTabletopCampaign('OWNER')}
        currentUserId={tabletopCurrentUserId}
      />
    )
  })

  it('places a zone at the picked point, then undoes the placement', async () => {
    const user = userEvent.setup()
    mocks.send.mockResolvedValueOnce(result(placedVersion))
    await user.click(await screen.findByRole('button', { name: 'Place a zone' }))
    const tool = await screen.findByRole('dialog', { name: 'Place a zone' })
    await user.click(within(tool).getByRole('button', { name: 'Pick on map' }))
    await waitFor(() => expect(mocks.onAreaPoint).not.toBeNull())
    act(() => mocks.onAreaPoint!(center))

    const reopened = await screen.findByRole('dialog', { name: 'Place a zone' })
    expect(within(reopened).getByText('Centered at (240, 160)')).toBeInTheDocument()
    await user.click(within(reopened).getByRole('button', { name: 'Place zone' }))
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith({
      type: 'PLACE_ZONE',
      commandId: expect.any(String),
      encounterId: tabletopGmEncounter.id,
      expectedVersion: tabletopGmEncounter.version,
      zone: expect.objectContaining({ manifestKind: 'ZONE', attachmentKind: 'PLACED_SPACE' }),
      point: center
    })
    expect(await within(reopened).findByText('Zone placed.')).toBeInTheDocument()

    mocks.send.mockResolvedValueOnce(result(placedVersion + 1))
    await user.click(within(reopened).getByRole('button', { name: 'Undo placement' }))
    expect(mocks.send).toHaveBeenLastCalledWith({
      type: 'REVERT_LAST_ACTION',
      commandId: expect.any(String),
      encounterId: tabletopGmEncounter.id,
      expectedVersion: placedVersion
    })
    expect(await within(reopened).findByText('Zone removed.')).toBeInTheDocument()
    expect(within(reopened).queryByRole('button', { name: 'Undo placement' })).toBeNull()
  }, 20_000)

  it('shows the room’s refusal and keeps the picked point', async () => {
    const user = userEvent.setup()
    mocks.send.mockRejectedValueOnce(new Error('The Run moved on.'))
    await user.click(await screen.findByRole('button', { name: 'Place a zone' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Place a zone' })).getByRole('button', {
        name: 'Pick on map'
      })
    )
    await waitFor(() => expect(mocks.onAreaPoint).not.toBeNull())
    act(() => mocks.onAreaPoint!(center))

    const tool = await screen.findByRole('dialog', { name: 'Place a zone' })
    await user.click(within(tool).getByRole('button', { name: 'Place zone' }))
    expect(await within(tool).findByRole('alert')).toHaveTextContent('The Run moved on.')
    expect(within(tool).getByText('Centered at (240, 160)')).toBeInTheDocument()
    expect(within(tool).queryByRole('button', { name: 'Undo placement' })).toBeNull()
  }, 20_000)
})
