import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOVEMENT_DECISION_SKIPPED_MESSAGE } from '@artificer-toolkit/schema/api/campaignCommunication'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { validated } from '../../../test/validatedFixture'
import {
  createTabletopCampaign,
  tabletopCurrentUserId,
  tabletopGmEncounter,
  tabletopLiveScene,
  tabletopPlayerEncounter
} from './CampaignTabletop.stories.fixtures'
import type { HeldEncounterSession } from './useCampaignLiveSession'

type RendererHandlers = { onMapLoadStatus: (status: 'LOADING' | 'READY' | 'ERROR') => void }

const mocks = vi.hoisted(() => ({
  characterSheet: null as { characterId: string; streamVersion: number } | null,
  characterSheetIds: [] as (string | null)[],
  handlers: null as RendererHandlers | null,
  readEncounter: vi.fn(),
  room: null as unknown,
  scene: null as unknown,
  sendCharacterSheetCommand: vi.fn()
}))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (reference: unknown) => ({ queryKey: [reference] })
}))
// Only reads are faked; the mutations are the library's own, so their lifecycle callbacks run.
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
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
  useVttMapDelivery: () => ({
    data: undefined,
    error: null,
    isPending: false,
    onMapLoadStatus: vi.fn()
  })
}))
vi.mock('#app/settings/useGmRollVisibilityPreference', () => ({
  useGmRollVisibilityPreference: () => ({
    gmRollVisibility: 'PUBLIC',
    setGmRollVisibility: vi.fn()
  })
}))
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
      update: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn()
    })
  }
}))
vi.mock('./useCampaignLiveSession', () => ({
  useCampaignLiveSession: ({ characterSheetId }: { characterSheetId: string | null }) => {
    mocks.characterSheetIds.push(characterSheetId)
    return {
      characterSheet: mocks.characterSheet,
      commandReady: true,
      encounterSession: mocks.room,
      error: null,
      readEncounter: mocks.readEncounter,
      recipientState: { recipientRole: 'PLAYER', presentationVersion: 1, scene: mocks.scene },
      rejection: null,
      sendCharacterSheetCommand: mocks.sendCharacterSheetCommand,
      sendCommand: vi.fn(),
      sendEncounterCommand: vi.fn(),
      status: 'CONNECTED'
    }
  }
}))

import { CampaignVttStage } from './CampaignVttStage'

const [emberActor, wardenActor] = tabletopGmEncounter.actors as [
  (typeof tabletopGmEncounter.actors)[number],
  (typeof tabletopGmEncounter.actors)[number]
]

function heldRoom(
  encounter: object | null,
  extra: {
    pending?: ReturnType<typeof pendingPush> | null
    settlement?: HeldEncounterSession['settlement']
    version?: number
  } = {}
) {
  return {
    held: true,
    version: extra.version ?? 1,
    state: {
      encounter,
      pending: extra.pending ?? null,
      waitingOn: null,
      turnMovement: [],
      halfSpeedFields: [],
      movementCostZones: [],
      placedZones: [],
      auras: []
    },
    preparedPending: [],
    actorSides: null,
    settlement: extra.settlement ?? null,
    timeline: null
  }
}

function pendingPush() {
  return validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
    kind: 'FORCED_MOVEMENT_DESTINATION',
    occurrenceId: '12121212-1212-4121-8121-121212121212',
    occurrenceVersion: 2,
    encounterVersion: tabletopGmEncounter.version,
    sourceActorId: emberActor.id,
    targetActorId: wardenActor.id,
    requestId: 'crusher-push',
    positions: [
      tabletopLiveScene.tokens[1]!.position,
      {
        x: tabletopLiveScene.tokens[1]!.position.x - 70,
        y: tabletopLiveScene.tokens[1]!.position.y
      }
    ],
    allowedResponses: ['FORCED_MOVEMENT']
  })
}

const settled = (outcome: 'ANSWER' | 'GM_SKIP') => ({
  occurrenceId: '12121212-1212-4121-8121-121212121212',
  occurrenceVersion: 2,
  outcome
})

function stage(role: 'OWNER' | 'PLAYER') {
  return (
    <CampaignVttStage
      campaign={createTabletopCampaign(role)}
      currentUserId={tabletopCurrentUserId}
    />
  )
}

describe('CampaignVttStage state that follows the room (RELIABILITY-9.3)', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn()
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.characterSheet = null
    mocks.characterSheetIds = []
    mocks.handlers = null
    mocks.scene = tabletopLiveScene
    mocks.sendCharacterSheetCommand.mockResolvedValue({})
    // The room answers the Stage's binding reads, so the Stage is not left waiting on them.
    const binding = { encounterId: tabletopGmEncounter.id, sceneId: tabletopLiveScene.id }
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
                    {
                      ...binding,
                      actorId: emberActor.id,
                      tokenId: tabletopLiveScene.tokens[0]!.id
                    },
                    {
                      ...binding,
                      actorId: wardenActor.id,
                      tokenId: tabletopLiveScene.tokens[1]!.id
                    }
                  ]
                }
      })
    )
  })

  describe('the Actions drawer', () => {
    const wardenTurn = { ...tabletopPlayerEncounter, currentActorId: wardenActor.id }

    async function openActions(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole('button', { name: 'Open actions' }))
      expect(await screen.findByRole('dialog', { name: 'Actions' })).toBeVisible()
    }

    it('stays open through room updates that keep the acting turn', async () => {
      const user = userEvent.setup()
      mocks.room = heldRoom(tabletopPlayerEncounter)
      const { rerender } = renderWithAppProviders(stage('PLAYER'))
      await openActions(user)

      mocks.room = heldRoom(tabletopPlayerEncounter, { version: 2 })
      rerender(stage('PLAYER'))

      expect(screen.getByRole('dialog', { name: 'Actions' })).toBeVisible()
    })

    it('comes back closed after the turn passes to an actor the member does not act for', async () => {
      const user = userEvent.setup()
      mocks.room = heldRoom(tabletopPlayerEncounter)
      const { rerender } = renderWithAppProviders(stage('PLAYER'))
      await openActions(user)

      mocks.room = heldRoom(wardenTurn, { version: 2 })
      rerender(stage('PLAYER'))
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Open actions' })).not.toBeInTheDocument()
      )
      mocks.room = heldRoom(tabletopPlayerEncounter, { version: 3 })
      rerender(stage('PLAYER'))

      expect(await screen.findByRole('button', { name: 'Open actions' })).toBeVisible()
      expect(screen.queryByRole('dialog', { name: 'Actions' })).not.toBeInTheDocument()
    })

    it('comes back closed after Manual automation hides it', async () => {
      const user = userEvent.setup()
      mocks.room = heldRoom(tabletopPlayerEncounter)
      const { rerender } = renderWithAppProviders(stage('PLAYER'))
      await openActions(user)

      mocks.room = heldRoom(
        { ...tabletopPlayerEncounter, automationMode: 'MANUAL' },
        { version: 2 }
      )
      rerender(stage('PLAYER'))
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Open actions' })).not.toBeInTheDocument()
      )
      mocks.room = heldRoom(tabletopPlayerEncounter, { version: 3 })
      rerender(stage('PLAYER'))

      expect(await screen.findByRole('button', { name: 'Open actions' })).toBeVisible()
      expect(screen.queryByRole('dialog', { name: 'Actions' })).not.toBeInTheDocument()
    })
  })

  describe('the last shown decision', () => {
    const openDecision = 'Open pending decision'

    it('stays in the player drawer after it stops being pending, says the GM skipped it, and goes once answered', async () => {
      const user = userEvent.setup()
      mocks.room = heldRoom(tabletopGmEncounter)
      const { rerender } = renderWithAppProviders(stage('PLAYER'))
      await waitFor(() => expect(mocks.handlers).not.toBeNull())
      expect(screen.queryByRole('button', { name: openDecision })).not.toBeInTheDocument()

      mocks.room = heldRoom(tabletopGmEncounter, { pending: pendingPush(), version: 2 })
      rerender(stage('PLAYER'))
      expect(await screen.findByRole('button', { name: openDecision })).toBeVisible()

      mocks.room = heldRoom(tabletopGmEncounter, { version: 3 })
      rerender(stage('PLAYER'))
      expect(screen.getByRole('button', { name: openDecision })).toBeVisible()

      mocks.room = heldRoom(tabletopGmEncounter, { settlement: settled('GM_SKIP'), version: 4 })
      rerender(stage('PLAYER'))
      await user.click(screen.getByRole('button', { name: openDecision }))
      expect(await screen.findByText(MOVEMENT_DECISION_SKIPPED_MESSAGE)).toBeVisible()

      mocks.room = heldRoom(tabletopGmEncounter, { settlement: settled('ANSWER'), version: 5 })
      rerender(stage('PLAYER'))
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: openDecision })).not.toBeInTheDocument()
      )
    })

    it('keeps a decision that was already pending when the Stage mounted', async () => {
      mocks.room = heldRoom(tabletopGmEncounter, { pending: pendingPush() })
      const { rerender } = renderWithAppProviders(stage('PLAYER'))
      expect(await screen.findByRole('button', { name: openDecision })).toBeVisible()

      mocks.room = heldRoom(tabletopGmEncounter, { settlement: settled('GM_SKIP'), version: 2 })
      rerender(stage('PLAYER'))

      expect(screen.getByRole('button', { name: openDecision })).toBeVisible()
    })

    it('is not kept for the GM, whose drawer ends with the decision', async () => {
      mocks.room = heldRoom(tabletopGmEncounter, { pending: pendingPush() })
      const { rerender } = renderWithAppProviders(stage('OWNER'))
      expect(await screen.findByRole('button', { name: openDecision })).toBeVisible()

      mocks.room = heldRoom(tabletopGmEncounter, { version: 2 })
      rerender(stage('OWNER'))

      await waitFor(() =>
        expect(screen.queryByRole('button', { name: openDecision })).not.toBeInTheDocument()
      )
    })
  })

  describe('ending a Character Concentration', () => {
    const concentratingEncounter = {
      ...tabletopPlayerEncounter,
      actors: [
        {
          ...tabletopPlayerEncounter.actors[0],
          concentration: { label: 'Bless', sourceHidden: false }
        },
        tabletopPlayerEncounter.actors[1]
      ]
    }
    const characterId = tabletopPlayerEncounter.actors[0].sourceId!

    it('subscribes to the Sheet, sends one command once it arrives, and unsubscribes without resending on later pushes', async () => {
      const user = userEvent.setup()
      mocks.room = heldRoom(concentratingEncounter)
      const { rerender } = renderWithAppProviders(stage('PLAYER'))
      await user.click(await screen.findByRole('button', { name: 'Open turn order' }))
      await user.click(
        await screen.findByRole('button', { name: "End Concentration for Ember's Wake" })
      )

      await waitFor(() => expect(mocks.characterSheetIds.at(-1)).toBe(characterId))
      expect(mocks.sendCharacterSheetCommand).not.toHaveBeenCalled()

      mocks.characterSheet = { characterId, streamVersion: 7 }
      rerender(stage('PLAYER'))
      await waitFor(() => expect(mocks.sendCharacterSheetCommand).toHaveBeenCalledTimes(1))
      expect(mocks.sendCharacterSheetCommand.mock.calls[0]![0]).toMatchObject({
        characterId,
        encounterId: concentratingEncounter.id,
        command: { type: 'END_CONCENTRATION', expectedVersion: 7 }
      })
      await waitFor(() => expect(mocks.characterSheetIds.at(-1)).toBeNull())

      mocks.characterSheet = { characterId, streamVersion: 8 }
      rerender(stage('PLAYER'))
      await act(async () => {})
      expect(mocks.sendCharacterSheetCommand).toHaveBeenCalledTimes(1)
    })
  })

  describe('the map load status', () => {
    it('clears when the presented Scene changes', async () => {
      mocks.room = heldRoom(null)
      const { rerender } = renderWithAppProviders(stage('PLAYER'))
      await waitFor(() => expect(mocks.handlers).not.toBeNull())
      act(() => mocks.handlers!.onMapLoadStatus('READY'))
      expect(await screen.findByText('Scene map ready.')).toBeInTheDocument()

      mocks.scene = { ...tabletopLiveScene, id: '88888888-8888-4888-8888-888888888888' }
      rerender(stage('PLAYER'))

      await waitFor(() => expect(screen.queryByText('Scene map ready.')).not.toBeInTheDocument())
    })

    it('stays while the same Scene updates', async () => {
      mocks.room = heldRoom(null)
      const { rerender } = renderWithAppProviders(stage('PLAYER'))
      await waitFor(() => expect(mocks.handlers).not.toBeNull())
      act(() => mocks.handlers!.onMapLoadStatus('READY'))
      expect(await screen.findByText('Scene map ready.')).toBeInTheDocument()

      mocks.scene = { ...tabletopLiveScene, version: tabletopLiveScene.version + 1 }
      rerender(stage('PLAYER'))

      expect(screen.getByText('Scene map ready.')).toBeInTheDocument()
    })
  })
})
