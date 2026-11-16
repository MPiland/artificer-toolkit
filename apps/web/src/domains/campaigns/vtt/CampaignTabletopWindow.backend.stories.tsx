import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQuery } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { sceneFogAppendInputSchema } from '@artificer-toolkit/schema/api/sceneFog'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'
import { writesTo } from '#app/test/storybook/storyWrites'
import {
  latestEncounter,
  latestStateSync,
  liveFramesReceived,
  liveWritesOfType,
  storyLiveWrite
} from '#app/test/storybook/storyLiveSession'
import {
  REVIEW_STORY_HOST,
  STORY_CAMPAIGN,
  STORY_PLAYER_CAMPAIGN,
  STORY_ZONES,
  type StoryCampaignSpec
} from '../../../../../apis/tests/developmentReviewDataScenarios'
import { SeededCampaign } from '../stories/SeededCampaign'
import { CampaignTabletopWindow } from './CampaignTabletopWindow'
import { createPlacedZoneDraft, placedZoneSize } from './campaignTabletopZoneTool.model'
import { latestStageRenderer } from './vttSceneRenderer.assertions'
import { placedZoneColor } from './vttSceneRenderer.model'

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
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
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

    // Pressing the map sets the center and reopens the tool; the aim preview ends.
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
    await expect(editor).toBeVisible()
    await userEvent.click(page.getByRole('button', { name: 'Close live scene editor' }))
    await waitFor(() =>
      expect(page.queryByRole('dialog', { name: 'Edit live scene object' })).not.toBeInTheDocument()
    )
    await expect(storyLiveWrite).not.toHaveBeenCalled()
  }
}
