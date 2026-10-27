import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import { encounterActionChoicesDtoSchema } from '@artificer-toolkit/schema/api/encounterActionChoices'
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

const mocks = vi.hoisted(() => ({
  onAreaDirection: null as ((aim: { origin: ScenePoint; toward: ScenePoint }) => void) | null,
  onAreaPoint: null as ((point: ScenePoint) => void) | null,
  readEncounter: vi.fn(),
  resolve: vi.fn()
}))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (reference: unknown) => ({ queryKey: [reference] })
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useMutation: () => ({ isPending: false, mutate: vi.fn(), mutateAsync: mocks.resolve }),
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
// The canvas renderer is the platform: the stage hands it the callbacks the aim gesture ends in, and
// the gesture is simulated by calling them as the renderer does when a press is released.
vi.mock('./vttSceneRenderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./vttSceneRenderer')>()),
  createVttSceneRenderer: (
    _host: HTMLElement,
    _gameSystemId: string,
    handlers: {
      onAreaDirection: (aim: { origin: ScenePoint; toward: ScenePoint }) => void
      onAreaPoint: (point: ScenePoint) => void
    }
  ) => {
    mocks.onAreaDirection = handlers.onAreaDirection
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

const campaign = createTabletopCampaign('OWNER')
const ember = tabletopLiveScene.tokens[0]!
const emberActor = tabletopGmEncounter.actors[0]!

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
        teleport: [],
        fleeSourceActorIds: []
      }
    ],
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

const binding = {
  encounterId: tabletopGmEncounter.id,
  sceneId: tabletopLiveScene.id
}

const validatedChoices = validated(encounterActionChoicesDtoSchema)
const baseChoice = {
  sourceLabel: 'Creature',
  rangeLabel: 'Self',
  range: { kind: 'SELF' as const },
  grip: null,
  wieldConflict: null,
  warnings: [],
  attackSlot: null
}
const roomChoices = validatedChoices({
  encounterId: tabletopGmEncounter.id,
  encounterVersion: tabletopGmEncounter.version,
  actorId: emberActor.id,
  openAttackAction: null,
  defaultActionId: null,
  actions: [
    {
      ...baseChoice,
      id: 'creature-wyrm:cone',
      label: 'Cone',
      target: { kind: 'DIRECTED', area: { kind: 'CONE', length: { amount: 15, unit: 'FEET' } } }
    },
    {
      ...baseChoice,
      id: 'creature-wyrm:blast',
      label: 'Blast',
      target: { kind: 'POINT', area: { kind: 'RADIUS', radius: { amount: 20, unit: 'FEET' } } }
    }
  ],
  unavailableActions: [],
  basicActionChoices: [],
  escapes: [],
  heldGrantEnds: [],
  effectOffers: [],
  releases: [],
  optionalRules: []
})

const resolved: EncounterCommandResultDto = {
  projection: tabletopGmEncounter,
  roll: null,
  occurrence: null,
  evidenceRoll: null
}

/** On Ember's east edge, aimed east. */
const origin: ScenePoint = { x: ember.position.x + 35, y: ember.position.y + 10 }
const toward: ScenePoint = { x: origin.x + 400, y: origin.y + 30 }

async function chooseAction(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(await screen.findByRole('button', { name: 'Open actions' }))
  await user.click(await screen.findByRole('combobox', { name: 'Action' }))
  await user.click(await screen.findByRole('option', { name: new RegExp(label) }))
}

describe('CampaignVttStage aiming an area (SPELLS-23)', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn()
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.onAreaDirection = null
    mocks.onAreaPoint = null
    mocks.resolve.mockResolvedValue(resolved)
    mocks.readEncounter.mockImplementation(({ kind }: { kind: string }) =>
      Promise.resolve({
        version: tabletopGmEncounter.version,
        result:
          kind === 'SCENE_BINDING'
            ? { kind, result: { ...binding, encounterVersion: tabletopGmEncounter.version } }
            : kind === 'ACTION_CHOICES'
              ? { kind, result: roomChoices }
              : { kind, result: [{ ...binding, actorId: emberActor.id, tokenId: ember.id }] }
      })
    )
    renderWithAppProviders(
      <CampaignVttStage campaign={campaign} currentUserId={tabletopCurrentUserId} />
    )
  })

  it('resolves a directed area with exactly the origin and direction the renderer gesture ended in', async () => {
    const user = userEvent.setup()
    await chooseAction(user, 'Cone')
    await user.click(await screen.findByRole('button', { name: 'Aim on map' }))
    await waitFor(() => expect(mocks.onAreaDirection).not.toBeNull())
    act(() => mocks.onAreaDirection!({ origin, toward }))

    await user.click(await screen.findByRole('button', { name: 'Resolve action' }))
    expect(mocks.resolve).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        actionId: 'creature-wyrm:cone',
        target: {
          kind: 'DIRECTED',
          sceneId: tabletopLiveScene.id,
          expectedSceneVersion: tabletopLiveScene.version,
          origin,
          toward
        }
      })
    )
  })

  it('resolves a point area at exactly the point the renderer press landed on', async () => {
    const user = userEvent.setup()
    await chooseAction(user, 'Blast')
    await user.click(await screen.findByRole('button', { name: 'Pick on map' }))
    await waitFor(() => expect(mocks.onAreaPoint).not.toBeNull())
    act(() => mocks.onAreaPoint!(toward))

    await user.click(await screen.findByRole('button', { name: 'Resolve action' }))
    expect(mocks.resolve).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        actionId: 'creature-wyrm:blast',
        target: {
          kind: 'POINT',
          sceneId: tabletopLiveScene.id,
          expectedSceneVersion: tabletopLiveScene.version,
          point: toward
        }
      })
    )
  })
})
