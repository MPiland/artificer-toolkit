import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOVEMENT_DECISION_SKIPPED_MESSAGE } from '@artificer-toolkit/schema/api/campaignCommunication'
import { liveSessionWebSocketServerMessageDtoSchema } from '@artificer-toolkit/schema/api/liveSessions'
import { activeGrantListingDtoSchema } from '@artificer-toolkit/schema/shared/activeGrantListing'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { facingArcSectors } from '@artificer-toolkit/shared/vtt'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { offeredRollModes } from '../../../test/offeredRollModes'
import { validated } from '../../../test/validatedFixture'
import {
  createTabletopCampaign,
  tabletopCurrentUserId,
  tabletopGmEncounter,
  tabletopLiveScene,
  tabletopPlayerEncounter
} from './CampaignTabletop.stories.fixtures'
import type { HeldEncounterSession } from './useCampaignLiveSession'

type RendererHandlers = {
  onMapLoadStatus: (status: 'LOADING' | 'READY' | 'ERROR') => void
  onTokenSelect: (tokenId: string | null) => void
}

const mocks = vi.hoisted(() => ({
  characterSheet: null as { characterId: string; streamVersion: number } | null,
  characterSheetIds: [] as (string | null)[],
  handlers: null as RendererHandlers | null,
  readEncounter: vi.fn(),
  recipientRole: 'PLAYER' as 'OWNER' | 'PLAYER',
  rejection: null as unknown,
  rendererUpdate: vi.fn(),
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
      update: mocks.rendererUpdate,
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
      recipientState: {
        recipientRole: mocks.recipientRole,
        presentationVersion: 1,
        scene: mocks.scene
      },
      rejection: mocks.rejection,
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
    pending?: ReturnType<typeof pendingRoll> | null
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
      pendingZoneSightings: [],
      auras: []
    },
    preparedPending: [],
    actorSides: null,
    settlement: extra.settlement ?? null,
    timeline: null
  }
}

// A roll the decision drawer answers; a board-picked destination stays out of the drawer (D157).
function pendingRoll() {
  return validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
    kind: 'D20_EVIDENCE',
    occurrenceId: '12121212-1212-4121-8121-121212121212',
    occurrenceVersion: 2,
    encounterVersion: tabletopGmEncounter.version,
    rollerActorId: emberActor.id,
    request: {
      requestId: 'attack-roll',
      min: 1,
      max: 20,
      rollMode: 'NORMAL',
      keep: 'FIRST',
      rollModes: offeredRollModes,
      derivedRollModeReasons: []
    },
    allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
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
    mocks.recipientRole = 'PLAYER'
    mocks.rejection = null
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

      mocks.room = heldRoom(tabletopGmEncounter, { pending: pendingRoll(), version: 2 })
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
      mocks.room = heldRoom(tabletopGmEncounter, { pending: pendingRoll() })
      const { rerender } = renderWithAppProviders(stage('PLAYER'))
      expect(await screen.findByRole('button', { name: openDecision })).toBeVisible()

      mocks.room = heldRoom(tabletopGmEncounter, { settlement: settled('GM_SKIP'), version: 2 })
      rerender(stage('PLAYER'))

      expect(screen.getByRole('button', { name: openDecision })).toBeVisible()
    })

    it('is not kept for the GM, whose drawer ends with the decision', async () => {
      mocks.room = heldRoom(tabletopGmEncounter, { pending: pendingRoll() })
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

  // VTT_UI-4.2: a Scene command the room rejects as stale is announced, not swallowed. The room's
  // COMMAND_REJECTED frame is the faked platform answer, parsed through the real schema.
  describe('a Scene command the room rejected as stale', () => {
    it('is announced to the GM', async () => {
      const frame = liveSessionWebSocketServerMessageDtoSchema.parse({
        code: 'STALE_STATE',
        commandId: '33333333-3333-4333-8333-333333333391',
        currentSequence: 1,
        message: 'The scene changed before the move landed.',
        reason: null,
        type: 'COMMAND_REJECTED',
        warnings: null
      })
      mocks.rejection = frame
      mocks.room = heldRoom(null)
      renderWithAppProviders(stage('OWNER'))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The scene changed before the move landed.'
      )
    })
  })

  // VTT_UI-1.3 and the GM's preview: what the room changes mid-play reaches the board. Each change
  // arrives as the room's own frame, parsed through the real schema; the Stage's hand-off to the
  // renderer is what is read, since the canvas is the platform (the renderer's drawing is proved by
  // the Presentation, Movement and Lighting stories).
  describe('a change the room makes while the Scene is in play', () => {
    const [ember, warden] = tabletopLiveScene.tokens as [
      (typeof tabletopLiveScene.tokens)[number],
      (typeof tabletopLiveScene.tokens)[number]
    ]
    const wardenInView = { ...warden, hidden: false }
    const gmScene = { ...tabletopLiveScene, tokens: [ember, wardenInView] }
    const facingArcs = [
      { arc: 'FRONT', fromDegrees: -45, toDegrees: 45 },
      { arc: 'RIGHT_SIDE', fromDegrees: 45, toDegrees: 135 },
      { arc: 'REAR', fromDegrees: 135, toDegrees: 225 },
      { arc: 'LEFT_SIDE', fromDegrees: 225, toDegrees: 315 }
    ] as const

    function stateSyncFrame(scene: typeof gmScene, sequence: number) {
      const frame = liveSessionWebSocketServerMessageDtoSchema.parse({
        authorityEpoch: '44444444-4444-4444-8444-444444444444',
        sequence,
        state: { presentationVersion: 1, recipientRole: 'OWNER', scene },
        type: 'STATE_SYNC'
      })
      if (frame.type !== 'STATE_SYNC') throw new Error('Unexpected frame type.')
      return frame
    }

    function encounterSessionFrame(encounter: object) {
      const frame = liveSessionWebSocketServerMessageDtoSchema.parse({
        session: heldRoom(encounter),
        type: 'ENCOUNTER_SESSION'
      })
      if (frame.type !== 'ENCOUNTER_SESSION' || !frame.session.held)
        throw new Error('Unexpected frame type.')
      return frame
    }

    // The room's frames, as the Stage's live session hands them over.
    function receive(
      sync: ReturnType<typeof stateSyncFrame>,
      session: ReturnType<typeof encounterSessionFrame>
    ) {
      mocks.recipientRole = sync.state.recipientRole
      mocks.scene = sync.state.scene
      mocks.room = session.session
    }

    function lastUpdate() {
      const [update] = mocks.rendererUpdate.mock.calls.at(-1) ?? []
      if (!update) throw new Error('The Stage has not updated the renderer.')
      return update as {
        previewTokenId: string | null
        scene: typeof gmScene
        tokenPresentations: Record<string, { facingArcs: unknown; statuses: { label: string }[] }>
      }
    }

    it('turns the selected token’s Facing arcs with the token', async () => {
      const facingEncounter = {
        ...tabletopGmEncounter,
        facingArcs: [...facingArcs],
        facingStepDegrees: 90
      }
      receive(stateSyncFrame(gmScene, 2), encounterSessionFrame(facingEncounter))
      const { rerender } = renderWithAppProviders(stage('OWNER'))
      await waitFor(() => expect(mocks.handlers).not.toBeNull())
      await waitFor(() => expect(lastUpdate().tokenPresentations[warden.id]).toBeDefined())
      expect(lastUpdate().tokenPresentations[warden.id]!.facingArcs).toBeNull()

      act(() => mocks.handlers!.onTokenSelect(warden.id))
      await waitFor(() =>
        expect(lastUpdate().tokenPresentations[warden.id]!.facingArcs).toEqual(
          facingArcSectors({ arcs: facingArcs, rotationDegrees: warden.rotationDegrees })
        )
      )

      const turned = {
        ...gmScene,
        tokens: gmScene.tokens.map((token) =>
          token.id === warden.id ? { ...token, rotationDegrees: 90 } : token
        ),
        version: gmScene.version + 1
      }
      receive(stateSyncFrame(turned, 3), encounterSessionFrame(facingEncounter))
      rerender(stage('OWNER'))
      await waitFor(() =>
        expect(lastUpdate().tokenPresentations[warden.id]!.facingArcs).toEqual(
          facingArcSectors({ arcs: facingArcs, rotationDegrees: 90 })
        )
      )
      expect(lastUpdate().scene.tokens.find(({ id }) => id === warden.id)?.rotationDegrees).toBe(90)

      act(() => mocks.handlers!.onTokenSelect(null))
      await waitFor(() => expect(lastUpdate().tokenPresentations[warden.id]!.facingArcs).toBeNull())
    })

    it('lists the mark on a token in its status list, naming who gave it', async () => {
      const user = userEvent.setup()
      const mark = validated(activeGrantListingDtoSchema)({
        effectId: '13131313-1313-4131-8131-131313131313',
        label: 'Mark',
        sourceHidden: false,
        sourceActorId: emberActor.id,
        remainingTicks: 2,
        expiresAtCampaignMinute: null,
        polarity: 'HARMFUL',
        endable: true
      })
      const marked = {
        ...tabletopGmEncounter,
        actors: tabletopGmEncounter.actors.map((actor) =>
          actor.id === wardenActor.id ? { ...actor, activeGrants: [mark] } : actor
        )
      }
      receive(stateSyncFrame(gmScene, 2), encounterSessionFrame(marked))
      renderWithAppProviders(stage('OWNER'))
      const label = "Mark from Ember's Wake, 2 rounds left"
      await waitFor(() =>
        expect(lastUpdate().tokenPresentations[warden.id]?.statuses).toContainEqual(
          expect.objectContaining({ id: `grant:${mark.effectId}`, label })
        )
      )

      await user.click(await screen.findByRole('button', { name: 'Scene controls' }))
      await user.hover(await screen.findByRole('menuitem', { name: `Focus ${warden.label}` }))
      const list = await screen.findByRole('region', { name: `${warden.label} statuses` })
      expect(within(list).getByText(label)).toBeVisible()
    })

    it('ends the GM’s preview when the previewed token leaves the Scene', async () => {
      const user = userEvent.setup()
      receive(stateSyncFrame(gmScene, 2), encounterSessionFrame(tabletopGmEncounter))
      const { rerender } = renderWithAppProviders(stage('OWNER'))
      await waitFor(() => expect(mocks.handlers).not.toBeNull())
      await waitFor(() => expect(lastUpdate().previewTokenId).toBeNull())

      await user.click(await screen.findByRole('button', { name: 'Scene controls' }))
      await user.click(
        await screen.findByRole('menuitem', { name: `Preview view ${warden.label}` })
      )
      await waitFor(() => expect(lastUpdate().previewTokenId).toBe(warden.id))
      expect(
        await screen.findByRole('menuitem', { name: `Stop previewing ${warden.label}` })
      ).toBeVisible()

      const gone = { ...gmScene, tokens: [ember], version: gmScene.version + 1 }
      receive(stateSyncFrame(gone, 3), encounterSessionFrame(tabletopGmEncounter))
      rerender(stage('OWNER'))
      await waitFor(() => expect(lastUpdate().previewTokenId).toBeNull())
      expect(lastUpdate().scene.tokens.map(({ id }) => id)).toEqual([ember.id])
      expect(screen.queryByRole('menuitem', { name: /previewing/ })).not.toBeInTheDocument()
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
