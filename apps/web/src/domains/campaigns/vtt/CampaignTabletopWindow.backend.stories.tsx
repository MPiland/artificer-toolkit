import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQuery } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { sceneFogAppendInputSchema } from '@artificer-toolkit/schema/api/sceneFog'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'
import { writesTo } from '#app/test/storybook/storyWrites'
import {
  latestAuras,
  latestEncounter,
  latestPending,
  latestStateSync,
  liveFramesReceived,
  liveWritesOfType,
  storyLiveWrite
} from '#app/test/storybook/storyLiveSession'
import {
  REVIEW_STORY_HOST,
  STORY_CAMPAIGN,
  STORY_OPEN_CAMPAIGN,
  STORY_PLAYER_CAMPAIGN,
  STORY_SHOVE_CAMPAIGN,
  STORY_SHOWING_CAMPAIGN,
  STORY_ZONES,
  type StoryCampaignSpec
} from '../../../../../apis/tests/developmentReviewDataScenarios'
import { SeededCampaign } from '../stories/SeededCampaign'
import { CampaignTabletopWindow } from './CampaignTabletopWindow'
import { createPlacedZoneDraft, placedZoneSize } from './campaignTabletopZoneTool.model'
import { reachByKeyboard } from './CampaignTabletop.stories.keyboard'
import { pressStage } from './CampaignTabletop.stories.pointer'
import { drawnToken, latestStageRenderer } from './vttSceneRenderer.assertions'
import {
  forcedMovementDestinationAfterKey,
  forcedMovementDestinationPick
} from './vttForcedMovementPick.model'
import {
  auraColor,
  minimumFocusedTokenScreenSize,
  placedZoneColor,
  selectionOutlineColor
} from './vttSceneRenderer.model'

/** The room activates from its checkpoint on the first socket, then syncs and the map loads. */
const roomJoinTimeoutMs = 30_000

/** The Tabletop window the story account opens on one of its seeded Campaigns, as the route does. */
function SeededTabletopWindow({ campaign }: { campaign: Pick<StoryCampaignSpec, 'name'> }) {
  const session = useQuery(api.account.session, {})
  return (
    <SeededCampaign campaign={campaign}>
      {(detail) =>
        session?.user ? (
          <div data-campaign-id={detail.id} data-testid='seeded-campaign'>
            <CampaignTabletopWindow campaignId={detail.id} currentUserId={session.user.userId} />
          </div>
        ) : null
      }
    </SeededCampaign>
  )
}

// Opens a real live session on the stack's Session Worker for a story Campaign (D218): the room
// connects through the real ticket and token flow, the Scene renderer is the real one under a spy,
// and every client write frame (COMMAND and fog staging) is recorded, never sent.
const meta = {
  title: 'Domains/Campaigns/VTT/Tabletop Window',
  component: SeededTabletopWindow,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof SeededTabletopWindow>

export default meta

type Story = StoryObj<typeof meta>

function presentedScene() {
  const { scene } = latestStateSync().state
  if (!scene) throw new Error('The room presents no Scene.')
  return scene
}

function tokenLabelled(label: string) {
  const token = presentedScene().tokens.find((candidate) => candidate.label === label)
  if (!token) throw new Error(`The presented Scene has no token "${label}".`)
  return token
}

/** Waits for the room to sync its Scene and the map to load; returns what the play steps read. */
async function openedWindow(canvasElement: HTMLElement, spec: StoryCampaignSpec) {
  const page = within(canvasElement.ownerDocument.body)
  const seeded = await page.findByTestId('seeded-campaign')
  await expect(
    await page.findByRole(
      'region',
      { name: `Live scene: ${spec.scene.name}` },
      { timeout: roomJoinTimeoutMs }
    )
  ).toBeVisible()
  await waitFor(
    () =>
      expect(liveFramesReceived()).toEqual(
        expect.arrayContaining([
          { type: 'TRANSIENT_READY', campaignId: seeded.dataset.campaignId },
          expect.objectContaining({ type: 'STATE_SYNC' })
        ])
      ),
    { timeout: roomJoinTimeoutMs }
  )
  await page.findByText('Scene map ready.', undefined, { timeout: roomJoinTimeoutMs })
  return { page }
}

/** The Encounter the room holds for the recipient, once it has sent it. */
function roomEncounter() {
  const { actors, name, round, version } = latestEncounter()
  return { actorLabels: actors.map(({ label }) => label), name, round, version }
}

/** The window's connection light is lit once the live session is connected. */
async function expectConnected(page: ReturnType<typeof within>) {
  const tabletop = page.getByRole('region', { name: /^Live scene:/ })
  await waitFor(() => expect(tabletop.querySelector('[data-connected]')).not.toBeNull(), {
    timeout: roomJoinTimeoutMs
  })
}

/** The renderer draws exactly the tokens the room presented, where it presented them. */
async function expectTokensDrawnAsPresented() {
  const renderer = await latestStageRenderer()
  const presented = (tokens: { id: string; position: { x: number; y: number } }[]) =>
    tokens.map(({ id, position }) => ({ id, position })).sort((a, b) => a.id.localeCompare(b.id))
  await waitFor(() =>
    expect(presented(renderer.getDiagnostics().tokens)).toEqual(presented(presentedScene().tokens))
  )
  const diagnostics = renderer.getDiagnostics()
  await expect(diagnostics.sceneVersion).toBe(presentedScene().version)
  await expect(diagnostics.mapLoadComplete).toBe(true)
  await expect(diagnostics.fogRenderCount).toBeGreaterThan(0)
}

/** The turn order drawer lists the Encounter the deployment holds. */
async function expectTurnOrderListsEncounter(
  page: ReturnType<typeof within>,
  encounter: ReturnType<typeof roomEncounter>
) {
  await userEvent.click(page.getByRole('button', { name: 'Open turn order' }))
  const drawer = within(await page.findByRole('dialog', { name: 'Turn order' }))
  await expect(drawer.getAllByText(encounter.name).length).toBeGreaterThan(0)
  await waitFor(() => expect(drawer.getByText(`Round ${encounter.round}`)).toBeVisible())
  for (const label of encounter.actorLabels)
    await expect(drawer.getAllByText(label).length).toBeGreaterThan(0)
}

async function chooseSceneControl(page: ReturnType<typeof within>, name: string) {
  await userEvent.click(page.getByRole('button', { name: 'Scene controls' }))
  await userEvent.click(await page.findByRole('menuitem', { name }))
}

export const GmWindow: Story = {
  args: { campaign: STORY_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_CAMPAIGN)
    await expectConnected(page)

    // The presented Scene: the GM's own view of the seeded board and its tokens.
    const sync = latestStateSync()
    const scene = presentedScene()
    await expect(sync.state.recipientRole).toBe('OWNER')
    await expect(scene.name).toBe(STORY_CAMPAIGN.scene.name)
    await expect(scene.barriers.map(({ kind }) => kind).sort()).toEqual(['DOOR', 'WALL', 'WALL'])
    await expect(scene.tokens.map(({ label }) => label).sort()).toEqual(
      [STORY_CAMPAIGN.scene.allyLabel, STORY_CAMPAIGN.enemyLabel].sort()
    )
    await expect(scene.fogMode).toBe(STORY_CAMPAIGN.scene.board.fogMode)
    await expect(page.getByLabelText('Tabletop mode')).toBeVisible()
    await expectTokensDrawnAsPresented()
    await expectTurnOrderListsEncounter(
      page,
      await waitFor(roomEncounter, { timeout: roomJoinTimeoutMs })
    )
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

export const GmEditsTheScene: Story = {
  args: { campaign: STORY_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_CAMPAIGN)
    await expectConnected(page)
    const scene = presentedScene()
    const { sequence } = latestStateSync()

    await userEvent.click(page.getByRole('radio', { name: /^Edit$/ }))
    await expect(page.getByRole('button', { name: 'Edit objects' })).toBeVisible()
    await expect(page.getByRole('toolbar', { name: 'Edit tools' })).toBeVisible()
    const drawWallButton = page.getByRole('button', { name: 'Draw wall' })
    await userEvent.click(drawWallButton)
    await expect(drawWallButton).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(page.getByRole('button', { name: 'Edit objects' }))
    await waitFor(async () => {
      await expect(page.getByRole('dialog', { name: 'Edit live scene object' })).toBeVisible()
    })
    await waitFor(async () => {
      await expect(page.getByRole('button', { name: 'Create wall' })).toBeEnabled()
    })
    await userEvent.click(page.getByRole('button', { name: 'Create wall' }))
    // The room is the only writer of the presented Scene (D79).
    await waitFor(() =>
      expect(storyLiveWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              expectedSceneVersion: scene.version,
              sceneId: scene.id,
              type: 'UPSERT_SCENE_BARRIER'
            }),
            scope: 'SCENE'
          },
          type: 'COMMAND'
        })
      )
    )
    await userEvent.click(page.getByRole('button', { name: 'Close live scene editor' }))

    // The unbound ally moves on the Scene alone; the creature's bound token moves with its Encounter.
    const ally = tokenLabelled(STORY_CAMPAIGN.scene.allyLabel)
    await chooseSceneControl(page, `Move ${ally.label} right`)
    await waitFor(() =>
      expect(storyLiveWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              type: 'MOVE_SCENE_TOKEN',
              expectedEncounterVersion: null,
              expectedSceneVersion: scene.version,
              tokenId: ally.id,
              path: expect.arrayContaining([ally.position])
            }),
            scope: 'SCENE'
          },
          expectedSessionSequence: sequence,
          type: 'COMMAND'
        })
      )
    )
    const { version: encounterVersion } = await waitFor(roomEncounter, {
      timeout: roomJoinTimeoutMs
    })
    const creature = tokenLabelled(STORY_CAMPAIGN.enemyLabel)
    await chooseSceneControl(page, `Move ${creature.label} right`)
    await waitFor(() =>
      expect(storyLiveWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              type: 'MOVE_SCENE_TOKEN',
              expectedEncounterVersion: encounterVersion,
              expectedSceneVersion: scene.version,
              tokenId: creature.id,
              path: expect.arrayContaining([creature.position])
            }),
            scope: 'SCENE'
          },
          expectedSessionSequence: sequence,
          type: 'COMMAND'
        })
      )
    )
    await userEvent.click(page.getByRole('button', { name: 'Undo last token move' }))
    await waitFor(() =>
      expect(storyLiveWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              type: 'UNDO_LAST_SCENE_MOVE',
              expectedSceneVersion: scene.version,
              sceneId: scene.id
            }),
            scope: 'SCENE'
          },
          expectedSessionSequence: sequence,
          type: 'COMMAND'
        })
      )
    )
  }
}

export const GmAdvancesTheTurn: Story = {
  args: { campaign: STORY_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_CAMPAIGN)
    await expectConnected(page)

    await userEvent.click(page.getByRole('button', { name: 'Open turn order' }))
    await userEvent.click(await page.findByRole('button', { name: 'Next turn' }))
    await waitFor(() =>
      expect(storyLiveWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({ type: 'ADVANCE_TURN' }),
            scope: 'ENCOUNTER'
          },
          type: 'COMMAND'
        })
      )
    )
  }
}

export const GmBindsTheCreatureToAnotherToken: Story = {
  args: { campaign: STORY_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_CAMPAIGN)
    await expectConnected(page)
    const scene = presentedScene()
    const ally = tokenLabelled(STORY_CAMPAIGN.scene.allyLabel)

    await userEvent.click(page.getByRole('button', { name: 'Open turn order' }))
    await userEvent.click(
      await page.findByLabelText(`Scene token for ${STORY_CAMPAIGN.enemyLabel}`)
    )
    await userEvent.click(await page.findByRole('option', { name: ally.label }))
    await waitFor(() =>
      expect(storyLiveWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              sceneId: scene.id,
              tokenId: ally.id,
              type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING'
            }),
            scope: 'ENCOUNTER'
          },
          type: 'COMMAND'
        })
      )
    )
  }
}

export const GmRevealsAPlayersFog: Story = {
  args: { campaign: STORY_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_CAMPAIGN)
    await expectConnected(page)
    const scene = presentedScene()

    // The fog is per player, and the story host plays in this Campaign.
    await userEvent.click(page.getByRole('button', { name: 'Scene controls' }))
    await userEvent.hover(await page.findByText(`Fog for @${REVIEW_STORY_HOST.username}`))
    await userEvent.click(await page.findByRole('menuitem', { name: 'Reveal entire map' }))
    await waitFor(() => expect(liveWritesOfType('COMMAND')).toHaveLength(1))

    const [begin] = liveWritesOfType('SCENE_FOG_BEGIN')
    await expect(begin).toBeDefined()
    await expect(begin!.input).toMatchObject({
      expectedSceneVersion: scene.version,
      sceneId: scene.id,
      type: 'PATCH_SCENE_FOG'
    })
    await expect(begin!.input.layer.ownerUserId).not.toBeNull()
    const appends = liveWritesOfType('SCENE_FOG_APPEND').map((append) =>
      sceneFogAppendInputSchema.parse(append.input)
    )
    await expect(appends.length).toBeGreaterThan(0)
    await expect(appends.every((append) => append.chunks.length <= 8)).toBe(true)
    await expect(begin!.input.chunkManifest).toEqual(
      appends.flatMap((append) =>
        append.chunks.map((chunk) => ({
          index: chunk.index,
          checksum: checksumCanonicalJson(chunk)
        }))
      )
    )
    await expect(liveWritesOfType('COMMAND')[0]).toMatchObject({
      command: {
        command: {
          commandId: begin!.input.commandId,
          expectedSceneVersion: scene.version,
          saveId: begin!.input.commandId,
          sceneId: scene.id,
          type: 'PUBLISH_SCENE_FOG_PATCH'
        },
        scope: 'SCENE'
      },
      type: 'COMMAND'
    })
  }
}

export const PlayerWindow: Story = {
  args: { campaign: STORY_PLAYER_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_PLAYER_CAMPAIGN)
    await expectConnected(page)

    // The presented Scene as a player sees it: only what their token has explored (D87).
    const sync = latestStateSync()
    const scene = presentedScene()
    await expect(sync.state.recipientRole).toBe('PLAYER')
    await expect(scene.name).toBe(STORY_PLAYER_CAMPAIGN.scene.name)
    await expect(scene.fogMode).toBe(STORY_PLAYER_CAMPAIGN.scene.board.fogMode)
    await expect(scene.tokens.map(({ label }) => label)).toEqual([
      STORY_PLAYER_CAMPAIGN.scene.allyLabel
    ])
    await expectTokensDrawnAsPresented()
    await expect(page.queryByLabelText('Tabletop mode')).not.toBeInTheDocument()
    await expect(page.getByRole('toolbar', { name: 'Play tools' })).toBeVisible()

    await userEvent.click(page.getByRole('button', { name: 'Scene controls' }))
    const controls = within(await page.findByRole('menu', { name: 'Scene controls' }))
    await waitFor(() =>
      expect(controls.getByText(`Focus ${STORY_PLAYER_CAMPAIGN.scene.allyLabel}`)).toBeVisible()
    )
    // A player may open and close the Scene's doors but has no way to lock one or to change its structure.
    const doors = scene.barriers.filter(({ kind }) => kind === 'DOOR')
    await expect(controls.queryAllByText(/^Door \d+: /)).toHaveLength(doors.length)
    await expect(controls.queryByText(/^Door \d+: Lock$/)).not.toBeInTheDocument()
    await expect(controls.getByText('No measurements')).toBeVisible()
    await expect(controls.queryByText(/^Remove /)).not.toBeInTheDocument()
    await expect(page.queryByText('Reveal entire map')).not.toBeInTheDocument()
    await expect(page.queryByRole('button', { name: 'Edit objects' })).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')

    await expectTurnOrderListsEncounter(
      page,
      await waitFor(roomEncounter, { timeout: roomJoinTimeoutMs })
    )
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

export const PlayerMovesTheirToken: Story = {
  args: { campaign: STORY_PLAYER_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_PLAYER_CAMPAIGN)
    await expectConnected(page)
    const scene = presentedScene()
    const { sequence } = latestStateSync()
    const ally = tokenLabelled(STORY_PLAYER_CAMPAIGN.scene.allyLabel)

    await chooseSceneControl(page, `Move ${ally.label} right`)
    await waitFor(() =>
      expect(storyLiveWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              type: 'MOVE_SCENE_TOKEN',
              expectedEncounterVersion: null,
              expectedSceneVersion: scene.version,
              tokenId: ally.id,
              path: expect.arrayContaining([ally.position])
            }),
            scope: 'SCENE'
          },
          expectedSessionSequence: sequence,
          type: 'COMMAND'
        })
      )
    )
  }
}

/** The placed zones the stage draws, read from the renderer's drawn presentation overlays. */
async function drawnZones(count: number) {
  const renderer = await latestStageRenderer()
  return waitFor(() => {
    const drawn = renderer
      .getDiagnostics()
      .overlays.filter((overlay) => overlay.strokeColors.includes(placedZoneColor))
    expect(drawn).toHaveLength(count)
    return drawn
  })
}

/** The zone as the seed placed it, drawn on the presented Scene's grid by the product's own geometry. */
function seededZoneArea({ point, radiusFeet }: (typeof STORY_ZONES)[number]) {
  const size = placedZoneSize(
    {
      shape: {
        id: crypto.randomUUID(),
        shapeKind: 'CIRCLE',
        radius: { amount: radiusFeet, unit: 'FEET' }
      }
    },
    presentedScene().grid
  )
  if (size?.kind !== 'RADIUS') throw new Error('A seeded zone is a circle.')
  return { center: point, radius: size.radius }
}

function sceneDescription(page: ReturnType<typeof within>) {
  return page
    .getByRole('img', { name: 'Interactive campaign scene' })
    .getAttribute('aria-description')
}

// The room lists every zone to the GM (MOVE-3.3), whose label names the hidden trap's spot DC.
export const GmSeesEveryPlacedZone: Story = {
  args: { campaign: STORY_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_CAMPAIGN)
    await expectConnected(page)
    const drawn = await drawnZones(STORY_ZONES.length)
    for (const zone of STORY_ZONES) {
      const overlay = drawn.find(({ label }) => label?.startsWith(zone.label))
      await expect(overlay?.circles).toEqual([seededZoneArea(zone)])
    }
    const trap = STORY_ZONES[1]
    await expect(drawn.map(({ label }) => label)).toContain(
      `${trap.label} (hidden, spot DC ${trap.spotDc.value})`
    )
    await expect(await sceneDescription(page)).toContain('Zones:')
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

// The room omits a trap concealed from every one of the player's Characters (MOVE-3.3) and carries no
// spot DC to a player, so the map draws only the zone in plain sight.
export const PlayerSeesOnlyZonesTheyKnowOf: Story = {
  args: { campaign: STORY_PLAYER_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_PLAYER_CAMPAIGN)
    await expectConnected(page)
    const [hazard, trap] = STORY_ZONES
    const drawn = await drawnZones(1)
    await expect(drawn[0]!.label).toBe(hazard.label)
    await expect(drawn[0]!.circles).toEqual([seededZoneArea(hazard)])
    const description = await sceneDescription(page)
    await expect(description).toContain(`Zones: ${hazard.label}`)
    await expect(description).not.toContain(trap.label)
  }
}

// MOVE-3.2 with VTT_UI-3.1: while the GM picks a zone's center, its area follows the pointer.
export const PlacingAZonePreviewsItsArea: Story = {
  args: { campaign: STORY_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_CAMPAIGN)
    await expectConnected(page)
    const renderer = await latestStageRenderer()
    const size = placedZoneSize(createPlacedZoneDraft(), presentedScene().grid)
    await expect(size).toMatchObject({ kind: 'RADIUS' })
    await userEvent.click(await page.findByRole('button', { name: 'Place a zone' }))
    const tool = await page.findByRole('dialog', { name: 'Place a zone' })
    await userEvent.click(await within(tool).findByRole('button', { name: 'Pick on map' }))
    await waitFor(() => expect(page.queryByRole('dialog', { name: 'Place a zone' })).toBeNull())
    await expect(renderer.getDiagnostics().areaAimOverlay).toBeNull()

    const canvas = page.getByRole('img', { name: 'Interactive campaign scene' })
    const bounds = canvas.getBoundingClientRect()
    const pointer = {
      clientX: bounds.left + 4,
      clientY: bounds.top + 4,
      pointerId: 42,
      pointerType: 'mouse'
    }
    fireEvent.pointerMove(canvas, pointer)
    await waitFor(() => {
      const aimed = renderer.getDiagnostics().areaAimOverlay
      expect(aimed?.label).toBe('Area origin')
      expect(aimed?.circles.map(({ radius }) => radius)).toEqual([
        size?.kind === 'RADIUS' ? size.radius : null
      ])
    })

    // Pressing empty map (the centre holds a door, which a press would operate) sets the center and reopens the tool; the aim preview ends.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    fireEvent.pointerDown(canvas, { ...pointer, button: 0, buttons: 1, pointerId: 1 })
    fireEvent.pointerUp(canvas, { ...pointer, button: 0, buttons: 0, pointerId: 1 })
    const reopened = await page.findByRole('dialog', { name: 'Place a zone' })
    // The drawer fades in, so the text is in the tree before it is visible.
    const centered = await within(reopened).findByText(/^Centered at/)
    await waitFor(() => expect(centered).toBeVisible())
    await expect(renderer.getDiagnostics().areaAimOverlay).toBeNull()
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

// D87: the GM shows another Scene's map to players without changing the presented Scene.
export const GmShowsSceneToPlayers: Story = {
  args: { campaign: STORY_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_CAMPAIGN)
    await expectConnected(page)
    const campaignId = (await page.findByTestId('seeded-campaign')).dataset.campaignId
    await userEvent.click(await page.findByRole('button', { name: 'Show to players' }))
    const presented = await page.findByRole('menuitem', { name: STORY_CAMPAIGN.scene.name })
    await expect(presented).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(
      await page.findByRole('menuitem', { name: STORY_CAMPAIGN.shownScene!.name })
    )
    await waitFor(() => expect(writesTo(api.scenes.showings.show)).toHaveLength(1))
    // The showing names the other Scene, never the presented one, and changes no live Scene.
    await expect(writesTo(api.scenes.showings.show)).toEqual([
      { campaignId, sceneId: expect.not.stringMatching(presentedScene().id) }
    ])
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

// Sibling of the window: the turn order drawer the GM opens, with its controls.
export const GmOpensTheTurnOrderDrawer: Story = {
  args: { campaign: STORY_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_CAMPAIGN)
    await expectConnected(page)
    await expectTurnOrderListsEncounter(
      page,
      await waitFor(roomEncounter, { timeout: roomJoinTimeoutMs })
    )
    const drawer = within(await page.findByRole('dialog', { name: 'Turn order' }))
    await expect(drawer.getByRole('button', { name: 'Next turn' })).toBeVisible()
    await expect(
      drawer.getByLabelText(`Scene token for ${STORY_CAMPAIGN.enemyLabel}`)
    ).toBeVisible()
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

// Sibling of the window: the live scene object editor opens from Edit mode and closes without a write.
export const GmOpensTheLiveSceneObjectEditor: Story = {
  args: { campaign: STORY_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_CAMPAIGN)
    await expectConnected(page)
    await userEvent.click(page.getByRole('radio', { name: /^Edit$/ }))
    await userEvent.click(await page.findByRole('button', { name: 'Edit objects' }))
    const editor = await page.findByRole('dialog', { name: 'Edit live scene object' })
    // The drawer slides in, so the dialog is in the tree before it is visible.
    await waitFor(() => expect(editor).toBeVisible())
    await userEvent.click(page.getByRole('button', { name: 'Close live scene editor' }))
    await waitFor(() =>
      expect(page.queryByRole('dialog', { name: 'Edit live scene object' })).not.toBeInTheDocument()
    )
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

/** A seeded creature as the room presented it to this viewer: its actor and its token. */
function seededCreature(label: string = STORY_CAMPAIGN.enemyLabel) {
  const actor = latestEncounter().actors.find((candidate) => candidate.label === label)
  if (!actor) throw new Error(`The room holds no creature "${label}".`)
  return { actor, token: tokenLabelled(label) }
}

/** A condition code or health band as the product words it on a token: `POISONED` is "Poisoned". */
function wordedStatus(code: string) {
  return `${code[0]}${code.slice(1).toLowerCase()}`
}

/**
 * The statuses the seed gave the Campaign's creature, as the product names them on its token. Only the
 * GM is shown how hurt the creature is (VTT_UI-1).
 */
function seededCreatureStatuses(campaign: {
  enemyLabel: string
  enemyState: { conditionCodes: readonly string[] }
}) {
  const { actor } = seededCreature(campaign.enemyLabel)
  const conditions = campaign.enemyState.conditionCodes.map(wordedStatus)
  if (!('healthBand' in actor)) return conditions
  if (actor.healthBand === 'HEALTHY') throw new Error('The seeded creature is not hurt.')
  return [...conditions, wordedStatus(actor.healthBand)]
}

// VTT_UI-1: the scene canvas describes each token's statuses; the GM also sees how hurt the creature is.
export const GmSeesTokenStatuses: Story = {
  args: { campaign: STORY_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_CAMPAIGN)
    await expectConnected(page)
    const description = await sceneDescription(page)
    await expect(description).toContain(`${STORY_CAMPAIGN.enemyLabel}. Custom. Hostile.`)
    for (const status of seededCreatureStatuses(STORY_CAMPAIGN))
      await expect(description).toContain(status)
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

// The outer ring shows at most eight segments; focusing a token in the controls names every status.
export const FocusingATokenListsEveryStatus: Story = {
  args: { campaign: STORY_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_CAMPAIGN)
    await expectConnected(page)
    const { token } = seededCreature()
    const statusRegion = { name: `${token.label} statuses` }
    await expect(page.queryByRole('region', statusRegion)).toBeNull()
    await userEvent.click(await page.findByRole('button', { name: 'Scene controls' }))
    const sceneControls = await page.findByRole('menu', { name: 'Scene controls' })
    const focusItem = await within(sceneControls).findByRole('menuitem', {
      name: `Focus ${token.label}`
    })
    focusItem.focus()
    const list = await page.findByRole('region', statusRegion)
    for (const status of seededCreatureStatuses(STORY_CAMPAIGN))
      await expect(within(list).getByText(status)).toBeVisible()
    focusItem.blur()
    await waitFor(() => expect(page.queryByRole('region', statusRegion)).toBeNull())
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

async function reachInMenu(page: ReturnType<typeof within>, name: string | RegExp) {
  const menu = await page.findByRole('menu', { name: 'Scene controls' })
  await reachByKeyboard(await within(menu).findByRole('menuitem', { name }), () =>
    userEvent.keyboard('{ArrowDown}')
  )
}

// VTT_UI-4.2: the Scene is playable, readable and recoverable without a pointer.
export const KeyboardOnlyTabletopJourney: Story = {
  args: { campaign: STORY_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_CAMPAIGN)
    await expectConnected(page)
    const stage = page.getByRole('img', { name: 'Interactive campaign scene' })
    const renderer = await latestStageRenderer()
    const { token: creature } = seededCreature()
    const ally = tokenLabelled(STORY_CAMPAIGN.scene.allyLabel)
    await expect(stage).toHaveAccessibleDescription(/^Visible tokens: /)
    for (const { label } of [creature, ally])
      await expect(stage).toHaveAccessibleDescription(new RegExp(label))
    for (let step = 0; step < 40; step += 1) renderer.zoomOut()
    const zoomedOut = renderer.getDiagnostics().zoomScale

    const trigger = page.getByRole('button', { name: 'Scene controls' })
    await reachByKeyboard(trigger, () => userEvent.tab())
    await userEvent.keyboard('{Enter}')
    await reachInMenu(page, `Focus ${creature.label}`)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(page.queryByRole('menu', { name: 'Scene controls' })).toBeNull())
    await waitFor(() => expect(trigger).toHaveFocus())
    await waitFor(() => expect(renderer.getDiagnostics().zoomScale).toBeGreaterThan(zoomedOut))

    // The creature's move is a Scene command carrying the Encounter version it was read at.
    await userEvent.keyboard('{Enter}')
    await reachInMenu(page, `Move ${creature.label} right`)
    await userEvent.keyboard('{Enter}')
    await waitFor(() =>
      expect(storyLiveWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              expectedEncounterVersion: latestEncounter().version,
              path: expect.arrayContaining([creature.position]),
              tokenId: creature.id,
              type: 'MOVE_SCENE_TOKEN'
            }),
            scope: 'SCENE'
          },
          type: 'COMMAND'
        })
      )
    )
    await waitFor(() => expect(trigger).toHaveFocus())

    await userEvent.keyboard('{Enter}')
    await reachInMenu(page, `Measure from ${creature.label}`)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(trigger).toHaveFocus())
    await userEvent.keyboard('{Enter}')
    await reachInMenu(page, new RegExp(`^To ${ally.label}`))
    await userEvent.keyboard('{Enter}')
    await expect(
      await page.findByText(new RegExp(`^Measured from ${creature.label} to ${ally.label}: .+\\.$`))
    ).toBeInTheDocument()

    // Escape closes the menu back to its trigger; Tab leaves it rather than walking its items.
    await userEvent.keyboard('{Enter}')
    await reachInMenu(page, `Focus ${creature.label}`)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page.queryByRole('menu', { name: 'Scene controls' })).toBeNull())
    await waitFor(() => expect(trigger).toHaveFocus())
    await userEvent.keyboard('{Enter}')
    await reachInMenu(page, `Focus ${creature.label}`)
    const openMenu = await page.findByRole('menu', { name: 'Scene controls' })
    await userEvent.tab()
    await expect(openMenu.contains(document.activeElement)).toBe(false)

    await reachByKeyboard(stage, () => userEvent.tab())
    await userEvent.keyboard('p')
    await expect(await page.findByText('You pinged the map.')).toBeInTheDocument()
  }
}

// The open-fog Campaign: the reader plays beside the GM, so every creature shows on the board.
const [vaultSentry, vaultHound] = STORY_OPEN_CAMPAIGN.creatures
const openWarden = STORY_OPEN_CAMPAIGN.enemyLabel
const openAlly = STORY_OPEN_CAMPAIGN.scene.allyLabel
const gmOfOpenCampaign = { storyAccount: 'openHost' } as const

function statusRegion(label: string) {
  return { name: `${label} statuses` }
}

function auraSource(aura: ReturnType<typeof latestAuras>[number]) {
  const source = presentedScene().tokens.find((token) => token.id === aura.sourceTokenId)
  if (!source) throw new Error('An aura surrounds a token the Scene does not present.')
  return source
}

/** The label the stage draws on an aura: its name and the token it surrounds. */
function auraLabel(aura: ReturnType<typeof latestAuras>[number]) {
  return `${aura.label ?? 'Aura'} around ${auraSource(aura).label}`
}

/** The auras the room shows this viewer, once it has sent them. */
function roomAuras(count: number) {
  return waitFor(
    () => {
      const auras = latestAuras()
      expect(auras).toHaveLength(count)
      return auras
    },
    { timeout: roomJoinTimeoutMs }
  )
}

/** The auras the stage draws, read from the renderer's drawn presentation overlays. */
async function drawnAuras(expectedLabels: readonly string[]) {
  const renderer = await latestStageRenderer()
  return waitFor(() => {
    const drawn = renderer
      .getDiagnostics()
      .overlays.filter((overlay) => overlay.strokeColors.includes(auraColor))
    expect(drawn.map((overlay) => overlay.label)).toEqual(expectedLabels)
    return drawn
  })
}

// The room lists every aura to the GM, who sees the hidden Balor's too.
export const GmSeesEveryAura: Story = {
  args: { campaign: STORY_OPEN_CAMPAIGN },
  parameters: gmOfOpenCampaign,
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_OPEN_CAMPAIGN)
    await expectConnected(page)
    const auras = await roomAuras(2)
    const drawn = await drawnAuras(auras.map(auraLabel))
    await expect(drawn.map((overlay) => overlay.circles)).toEqual(
      auras.map((aura) => [{ center: auraSource(aura).position, radius: aura.radius }])
    )
    await expect(await sceneDescription(page)).toContain(
      `Auras: ${auras.map(auraLabel).join('; ')}`
    )
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

// The room omits the hidden Balor's aura for the player (D121); the visible source's aura draws.
export const PlayerSeesOnlyAVisibleSourcesAura: Story = {
  args: { campaign: STORY_OPEN_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_OPEN_CAMPAIGN)
    await expectConnected(page)
    const [aura] = await roomAuras(1)
    // The hidden Balor has no token on the player's Scene either.
    await expect(presentedScene().tokens).toHaveLength(
      2 + STORY_OPEN_CAMPAIGN.creatures.filter((creature) => !('hidden' in creature)).length
    )
    const drawn = await drawnAuras([auraLabel(aura!)])
    await expect(drawn[0]!.circles).toEqual([
      { center: auraSource(aura!).position, radius: aura!.radius }
    ])
    await expect(await sceneDescription(page)).toContain(`Auras: ${auraLabel(aura!)}`)
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

// VTT_UI-1.1 journey: the SELECT tool selects any token on the canvas or from the Scene controls.
export const SelectingATokenOutlinesIt: Story = {
  args: { campaign: STORY_OPEN_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_OPEN_CAMPAIGN)
    await expectConnected(page)
    const stage = page.getByRole('img', { name: 'Interactive campaign scene' })
    const renderer = await latestStageRenderer()
    // The player moves their own token; the Warden is not theirs, so selecting it must still work.
    const [ally, warden] = [tokenLabelled(openAlly), tokenLabelled(openWarden)]
    await expect(ally.controlledByUserIds).toHaveLength(1)
    await expect(warden.controlledByUserIds).toEqual([])
    const selectedIds = () =>
      renderer
        .getDiagnostics()
        .tokens.filter((token) => token.selection)
        .map((token) => token.id)

    renderer.focusPoint(ally.position)
    await pressStage(stage, 'centre')
    await waitFor(() => expect(selectedIds()).toEqual([ally.id]))
    await expect(drawnToken(renderer.getDiagnostics(), ally.id).selection?.color).toBe(
      selectionOutlineColor
    )
    await waitFor(() =>
      expect(stage.getAttribute('aria-description')).toMatch(
        new RegExp(`${ally.label}[^;]*, selected`)
      )
    )
    await expect(stage.getAttribute('aria-description')?.match(/, selected/g)).toHaveLength(1)

    renderer.focusPoint(warden.position)
    await pressStage(stage, 'centre')
    await waitFor(() => expect(selectedIds()).toEqual([warden.id]))

    await pressStage(stage, 'corner')
    await waitFor(() => expect(selectedIds()).toEqual([]))
    await expect(stage.getAttribute('aria-description')).not.toContain(', selected')

    await userEvent.click(await page.findByRole('button', { name: 'Scene controls' }))
    const sceneControls = await page.findByRole('menu', { name: 'Scene controls' })
    await userEvent.click(
      await within(sceneControls).findByRole('menuitem', { name: `Focus ${ally.label}` })
    )
    await waitFor(() => expect(selectedIds()).toEqual([ally.id]))
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

// VTT_UI-1.2: the selected token lists every status until the selection clears.
export const SelectingATokenListsItsStatuses: Story = {
  args: { campaign: STORY_OPEN_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_OPEN_CAMPAIGN)
    await expectConnected(page)
    const stage = page.getByRole('img', { name: 'Interactive campaign scene' })
    const renderer = await latestStageRenderer()
    const { token } = seededCreature(openWarden)
    const statuses = seededCreatureStatuses(STORY_OPEN_CAMPAIGN)
    await expect(statuses.length).toBeGreaterThan(0)

    renderer.focusPoint(token.position)
    await pressStage(stage, 'centre')
    const list = await page.findByRole('region', statusRegion(token.label))
    for (const status of statuses) await expect(within(list).getByText(status)).toBeVisible()

    await pressStage(stage, 'corner')
    await waitFor(() => expect(page.queryByRole('region', statusRegion(token.label))).toBeNull())
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

// VTT_UI-1.2: pointing at a token's Focus item in the Scene controls lists every status.
export const HoveringAFocusItemListsEveryStatus: Story = {
  args: { campaign: STORY_OPEN_CAMPAIGN },
  parameters: gmOfOpenCampaign,
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_OPEN_CAMPAIGN)
    await expectConnected(page)
    const { token } = seededCreature(openWarden)
    const statuses = seededCreatureStatuses(STORY_OPEN_CAMPAIGN)
    await userEvent.click(await page.findByRole('button', { name: 'Scene controls' }))
    const sceneControls = await page.findByRole('menu', { name: 'Scene controls' })
    const focusItem = await within(sceneControls).findByRole('menuitem', {
      name: `Focus ${token.label}`
    })
    await userEvent.hover(focusItem)
    const list = await page.findByRole('region', statusRegion(token.label))
    for (const status of statuses) await expect(within(list).getByText(status)).toBeVisible()
    await userEvent.unhover(focusItem)
    await waitFor(() => expect(page.queryByRole('region', statusRegion(token.label))).toBeNull())
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

// VTT_UI-4.1: the panel names a token's disposition even when it has no statuses, and focusing a
// token from the Scene controls zooms a far-out view in until the token is readable.
export const FocusingATokenNamesItsDispositionAndZoomsIn: Story = {
  args: { campaign: STORY_OPEN_CAMPAIGN },
  parameters: gmOfOpenCampaign,
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_OPEN_CAMPAIGN)
    await expectConnected(page)
    const { token } = seededCreature(vaultHound.enemy.label)
    const renderer = await latestStageRenderer()
    for (let step = 0; step < 40; step += 1) renderer.zoomOut()
    const zoomedOut = renderer.getDiagnostics().zoomScale
    await userEvent.click(await page.findByRole('button', { name: 'Scene controls' }))
    const sceneControls = await page.findByRole('menu', { name: 'Scene controls' })
    const focusItem = await within(sceneControls).findByRole('menuitem', {
      name: `Focus ${token.label}`
    })
    await userEvent.hover(focusItem)
    const panel = await page.findByRole('region', statusRegion(token.label))
    await expect(within(panel).getByText('Hostile')).toBeVisible()
    await userEvent.click(focusItem)
    await waitFor(() => expect(page.queryByRole('menu', { name: 'Scene controls' })).toBeNull())
    await waitFor(() => expect(renderer.getDiagnostics().zoomScale).toBeGreaterThan(zoomedOut))
    await expect(
      renderer.getDiagnostics().zoomScale * Math.max(token.width, token.height)
    ).toBeGreaterThanOrEqual(minimumFocusedTokenScreenSize - 1e-9)
    // At the minimum zoom every token stays reachable: listed in Scene controls, and Focus brings
    // its larger footprint side up to the readable size.
    for (const { label, width, height } of presentedScene().tokens) {
      let floor = renderer.getDiagnostics().zoomScale
      let zoomedOutTo = Number.NaN
      while (zoomedOutTo !== floor) {
        zoomedOutTo = floor
        renderer.zoomOut()
        floor = renderer.getDiagnostics().zoomScale
      }
      await userEvent.click(await page.findByRole('button', { name: 'Scene controls' }))
      const menu = await page.findByRole('menu', { name: 'Scene controls' })
      await userEvent.click(await within(menu).findByRole('menuitem', { name: `Focus ${label}` }))
      // The next token reopens the menu, so wait for this one to finish closing first.
      await waitFor(() => expect(page.queryByRole('menu', { name: 'Scene controls' })).toBeNull())
      await waitFor(() => expect(renderer.getDiagnostics().zoomScale).toBeGreaterThan(floor))
      await expect(
        renderer.getDiagnostics().zoomScale * Math.max(width, height)
      ).toBeGreaterThanOrEqual(minimumFocusedTokenScreenSize - 1e-9)
    }
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

// VTT_UI-1.2: pointing at another token lists its statuses over the selected token's; leaving it
// lists the selected token's again.
export const HoveringATokenListsItOverTheSelection: Story = {
  args: { campaign: STORY_OPEN_CAMPAIGN },
  parameters: gmOfOpenCampaign,
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_OPEN_CAMPAIGN)
    await expectConnected(page)
    const stage = page.getByRole('img', { name: 'Interactive campaign scene' })
    const renderer = await latestStageRenderer()
    const { token: warden } = seededCreature(openWarden)
    const { token: sentry } = seededCreature(vaultSentry.enemy.label)
    const statusList = (label: string) => page.queryByRole('region', statusRegion(label))

    renderer.focusPoint(warden.position)
    await pressStage(stage, 'centre')
    await expect(
      within(await page.findByRole('region', statusRegion(warden.label))).getByText('Poisoned')
    ).toBeVisible()

    await userEvent.click(await page.findByRole('button', { name: 'Scene controls' }))
    const sceneControls = await page.findByRole('menu', { name: 'Scene controls' })
    const sentryFocus = await within(sceneControls).findByRole('menuitem', {
      name: `Focus ${sentry.label}`
    })
    await userEvent.hover(sentryFocus)
    const sentryList = await page.findByRole('region', statusRegion(sentry.label))
    await expect(within(sentryList).getByText('Prone')).toBeVisible()
    await expect(statusList(warden.label)).toBeNull()

    await userEvent.unhover(sentryFocus)
    await waitFor(() => expect(statusList(sentry.label)).toBeNull())
    const wardenList = await page.findByRole('region', statusRegion(warden.label))
    await expect(within(wardenList).getByText('Poisoned')).toBeVisible()
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

export const GmPreviewsATokenView: Story = {
  args: { campaign: STORY_OPEN_CAMPAIGN },
  parameters: gmOfOpenCampaign,
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_OPEN_CAMPAIGN)
    await expectConnected(page)
    const { token } = seededCreature(openWarden)
    const renderer = await latestStageRenderer()
    await expect(renderer.getDiagnostics().lighting.visionCount).toBe(0)
    await userEvent.click(await page.findByRole('button', { name: 'Scene controls' }))
    const controls = within(await page.findByRole('menu', { name: 'Scene controls' }))
    // Mantine fixes menu items to role menuitem, which cannot carry a pressed or checked state,
    // so the item's own words say whether the preview is on.
    await userEvent.click(
      await controls.findByRole('menuitem', { name: `Preview view ${token.label}` })
    )
    const stop = await controls.findByRole('menuitem', { name: `Stop previewing ${token.label}` })
    await expect(controls.getAllByRole('menuitem', { name: /^Stop previewing/ })).toHaveLength(1)
    // The renderer draws the previewed token's sight.
    await waitFor(() => expect(renderer.getDiagnostics().lighting.visionCount).toBe(1))
    await userEvent.click(stop)
    await expect(
      await controls.findByRole('menuitem', { name: `Preview view ${token.label}` })
    ).toBeVisible()
    await waitFor(() => expect(renderer.getDiagnostics().lighting.visionCount).toBe(0))
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

// Hovering a token on the canvas lists its statuses in the DOM, and leaving hides the list.
export const HoveringATokenOnTheCanvasListsItsStatuses: Story = {
  args: { campaign: STORY_OPEN_CAMPAIGN },
  parameters: gmOfOpenCampaign,
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_OPEN_CAMPAIGN)
    await expectConnected(page)
    const { token } = seededCreature(openWarden)
    const statuses = seededCreatureStatuses(STORY_OPEN_CAMPAIGN)
    const region = statusRegion(token.label)
    await expect(page.queryByRole('region', region)).toBeNull()
    // Centring the view puts the Warden under the middle of the canvas.
    const renderer = await latestStageRenderer()
    renderer.focusPoint(token.position)
    const canvas = page.getByRole('img', { name: 'Interactive campaign scene' })
    const bounds = canvas.getBoundingClientRect()
    const pointer = { pointerId: 41, pointerType: 'mouse' }
    fireEvent.pointerMove(canvas, {
      ...pointer,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2
    })
    const list = await page.findByRole('region', region)
    for (const status of statuses) await expect(within(list).getByText(status)).toBeVisible()
    fireEvent.pointerMove(canvas, { ...pointer, clientX: bounds.left + 4, clientY: bounds.top + 4 })
    await waitFor(() => expect(page.queryByRole('region', region)).toBeNull())
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

// A player reads each token's statuses, never how hurt a creature is: the room sends no health band.
export const PlayerSeesTokenStatusesWithoutGmHealth: Story = {
  args: { campaign: STORY_OPEN_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_OPEN_CAMPAIGN)
    await expectConnected(page)
    const description = await sceneDescription(page)
    await expect(description).toContain(`${openWarden}. Custom. Hostile.`)
    for (const status of seededCreatureStatuses(STORY_OPEN_CAMPAIGN))
      await expect(description).toContain(status)
    for (const band of ['Wounded', 'Bloodied', 'Critical'])
      await expect(description).not.toContain(band)
    // The GM's confirmed morale outcome stays the GM's: the room sends the player no morale.
    await expect(description).not.toContain('Fled')
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

// VTT_UI-2 journey: the GM confirmed the visible Balor's Morale save as fleeing; its token says so in
// the canvas description and in its status list.
export const GmSeesMoraleOutcome: Story = {
  args: { campaign: STORY_OPEN_CAMPAIGN },
  parameters: gmOfOpenCampaign,
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_OPEN_CAMPAIGN)
    await expectConnected(page)
    const token = tokenLabelled(STORY_OPEN_CAMPAIGN.creatures[2].tokenLabel)
    await expect(await sceneDescription(page)).toContain('Fled')
    await userEvent.click(await page.findByRole('button', { name: 'Scene controls' }))
    const sceneControls = await page.findByRole('menu', { name: 'Scene controls' })
    await userEvent.hover(
      await within(sceneControls).findByRole('menuitem', { name: `Focus ${token.label}` })
    )
    const list = await page.findByRole('region', statusRegion(token.label))
    await expect(within(list).getByText('Fled')).toBeVisible()
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

// The GM showed the Scene to the table: the player's own window opens it read-only over the page,
// and closing it leaves the window as it was. The Campaign has no Run, so nothing else is on screen.
export const PlayerSeesShownScene: Story = {
  args: { campaign: STORY_SHOWING_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    const sceneName = STORY_SHOWING_CAMPAIGN.shownScene.name
    const viewer = await page.findByRole(
      'dialog',
      { name: sceneName },
      { timeout: roomJoinTimeoutMs }
    )
    const map = await within(viewer).findByRole('img', { name: `Map of ${sceneName}` })
    // The Modal fades in; the map is visible once that enter transition has finished.
    await waitFor(() => expect(map).toBeVisible())
    await expect(page.queryByRole('button', { name: 'Show to players' })).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() =>
      expect(page.queryByRole('dialog', { name: sceneName })).not.toBeInTheDocument()
    )
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}

// D157: the reader's Wolf shoved the Goblin aside, so the Run waits on the board for the reader to
// pick where it lands; a press inside one of the highlighted legal squares answers it.
export const PlayerPicksWhereAPushLeavesTheCreature: Story = {
  args: { campaign: STORY_SHOVE_CAMPAIGN },
  play: async ({ canvasElement }) => {
    const { page } = await openedWindow(canvasElement, STORY_SHOVE_CAMPAIGN)
    await expectConnected(page)
    const { creatures, shove } = STORY_SHOVE_CAMPAIGN
    const target = tokenLabelled(creatures[shove.target].tokenLabel)
    const pending = await waitFor(() => {
      const held = latestPending()
      if (held?.kind !== 'FORCED_MOVEMENT_DESTINATION')
        throw new Error('The room holds no push for the reader to place.')
      return held
    })
    const pick = forcedMovementDestinationPick({
      pending,
      scene: presentedScene(),
      targetTokenId: target.id
    })
    if (!pick) throw new Error('The push moves no token on the presented Scene.')
    await expect(pick.destinations.length).toBeGreaterThan(1)

    const choice = await page.findByRole('region', { name: `Where ${target.label} lands` })
    await expect(within(choice).getByText(`Pick where ${target.label} lands.`)).toBeVisible()
    const [first, chosen] = pick.destinations
    const picker = within(choice).getByRole('button', { name: first!.label })
    await waitFor(() => expect(picker).toHaveFocus())
    // One picker control: an arrow key walks it to the nearest legal square that way, Home returns
    // to the first.
    const positions = pick.destinations.map(({ position }) => position)
    const [move] = (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'] as const).flatMap((key) => {
      const position = forcedMovementDestinationAfterKey(positions, first!.position, key)
      return position ? [{ key, position }] : []
    })
    if (!move) throw new Error('No arrow key leaves the first legal square.')
    await userEvent.keyboard(`{${move.key}}`)
    await expect(picker).toHaveAccessibleName(
      pick.destinations.find(
        ({ position }) => position.x === move.position.x && position.y === move.position.y
      )!.label
    )
    await userEvent.keyboard('{Home}')
    await expect(picker).toHaveAccessibleName(first!.label)

    const renderer = await latestStageRenderer()
    // Every legal square is outlined on the board.
    await waitFor(() =>
      expect(renderer.getDiagnostics().overlayCount).toBeGreaterThanOrEqual(positions.length)
    )
    renderer.focusPoint(chosen!.position)
    await pressStage(page.getByRole('img', { name: 'Interactive campaign scene' }), 'centre')
    await waitFor(() =>
      expect(storyLiveWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              type: 'RESOLVE_RULE_OCCURRENCE',
              occurrenceId: pending.occurrenceId,
              resolution: {
                kind: 'FORCED_MOVEMENT',
                requestId: pending.requestId,
                position: chosen!.position
              }
            }),
            scope: 'ENCOUNTER'
          },
          type: 'COMMAND'
        })
      )
    )
  }
}
