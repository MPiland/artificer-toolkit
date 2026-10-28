import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'
import { http, HttpResponse } from 'msw'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaigns'
import {
  type EncounterGmProjectionDto,
  type EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { activeGrantListingDtoSchema } from '@artificer-toolkit/schema/shared/activeGrantListing'
import {
  sceneFogAppendInputSchema,
  sceneFogPatchInputSchema
} from '@artificer-toolkit/schema/api/sceneFog'
import { validated } from '../../../test/validatedFixture'
import { reachByKeyboard } from './CampaignTabletop.stories.keyboard'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { facingArcSectors } from '@artificer-toolkit/shared/vtt'
import {
  buildTabletopPresentations,
  createTabletopCampaign,
  tabletopCampaignId,
  tabletopConditions,
  tabletopCurrentUserId,
  tabletopGmEncounter,
  tabletopLiveScene,
  tabletopMapDelivery,
  tabletopPlayerEncounter
} from './CampaignTabletop.stories.fixtures'
import { CampaignTabletopWindow } from './CampaignTabletopWindow'
import {
  drawnToken,
  expectDrawnPresentation,
  latestStageRenderer
} from './vttSceneRenderer.assertions'
import {
  facingArcRadius,
  facingArcWedge,
  gmDarknessCapAlpha,
  minimumFocusedTokenScreenSize,
  selectionOutlineColor
} from './vttSceneRenderer.model'
import {
  TabletopFixtures,
  fogAppend,
  fogBegin,
  liveCommand,
  mapReadyTimeoutMs,
  mediaGetDelivery,
  projectScene,
  renderWindow,
  showScene,
  shownScene,
  storyFogSaveId,
  syncStoryScene
} from './CampaignTabletopWindow.stories.harness'

const liveSessionTokenHandler = http.get('*/api/auth/convex/token', () =>
  HttpResponse.json({ token: 'story-convex-access-token' })
)
const meta = {
  component: CampaignTabletopWindow,
  beforeEach({ msw }) {
    msw.use(liveSessionTokenHandler)
  },
  parameters: {
    a11y: { test: 'error' },
    layout: 'fullscreen'
  },
  title: 'Domains/Campaigns/VTT/Tabletop Window'
} satisfies Meta<typeof CampaignTabletopWindow>

export default meta
type Story = StoryObj<typeof meta>

export const GmWindow: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) => renderWindow(args, createTabletopCampaign('OWNER')),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await expect(
      await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    ).toBeInTheDocument()
    await expect(page.getByRole('region', { name: 'Live scene: The Lantern Vault' })).toBeVisible()
    await expect(mediaGetDelivery).toHaveBeenCalledWith({
      assetId: tabletopMapDelivery.assetId
    })
    await expect(page.getByLabelText('Tabletop mode')).toBeVisible()
    await userEvent.click(page.getByRole('radio', { name: /^Edit$/ }))
    await expect(page.getByRole('button', { name: 'Edit objects' })).toBeVisible()
    await expect(page.getByRole('toolbar', { name: 'Edit tools' })).toBeVisible()
    const drawWallButton = page.getByRole('button', { name: 'Draw wall' })
    await userEvent.click(drawWallButton)
    await expect(drawWallButton).toHaveAttribute('aria-pressed', 'true')

    const editObjectsButton = page.getByRole('button', {
      name: 'Edit objects'
    })
    await userEvent.click(editObjectsButton)
    await waitFor(async () => {
      await expect(page.getByRole('dialog', { name: 'Edit live scene object' })).toBeVisible()
    })
    await waitFor(async () => {
      await expect(page.getByRole('button', { name: 'Create wall' })).toBeEnabled()
    })
    await userEvent.click(page.getByRole('button', { name: 'Create wall' }))
    // The room is the only writer of the presented Scene (D79).
    await waitFor(async () => {
      await expect(liveCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              expectedSceneVersion: tabletopLiveScene.version,
              sceneId: tabletopLiveScene.id,
              type: 'UPSERT_SCENE_BARRIER'
            }),
            scope: 'SCENE'
          },
          type: 'COMMAND'
        })
      )
    })
    await userEvent.click(page.getByRole('button', { name: 'Close live scene editor' }))
    await userEvent.click(page.getByRole('button', { name: 'Scene controls' }))
    await userEvent.click(await page.findByRole('menuitem', { name: 'Move Ember right' }))
    await waitFor(() =>
      expect(liveCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              type: 'MOVE_SCENE_TOKEN',
              expectedEncounterVersion: null,
              expectedSceneVersion: tabletopLiveScene.version,
              tokenId: tabletopLiveScene.tokens[0]!.id,
              path: expect.arrayContaining([tabletopLiveScene.tokens[0]!.position])
            }),
            scope: 'SCENE'
          },
          expectedSessionSequence: 1,
          type: 'COMMAND'
        })
      )
    )
    await userEvent.click(page.getByRole('button', { name: 'Scene controls' }))
    await userEvent.click(await page.findByRole('menuitem', { name: 'Move Vault Warden right' }))
    await waitFor(() =>
      expect(liveCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              type: 'MOVE_SCENE_TOKEN',
              expectedEncounterVersion: tabletopGmEncounter.version,
              expectedSceneVersion: tabletopLiveScene.version,
              tokenId: tabletopLiveScene.tokens[1]!.id,
              path: expect.arrayContaining([tabletopLiveScene.tokens[1]!.position])
            }),
            scope: 'SCENE'
          },
          expectedSessionSequence: 1,
          type: 'COMMAND'
        })
      )
    )
    await userEvent.click(page.getByRole('button', { name: 'Undo last token move' }))
    await waitFor(() =>
      expect(liveCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              type: 'UNDO_LAST_SCENE_MOVE',
              expectedSceneVersion: tabletopLiveScene.version,
              sceneId: tabletopLiveScene.id
            }),
            scope: 'SCENE'
          },
          expectedSessionSequence: 1,
          type: 'COMMAND'
        })
      )
    )
    await userEvent.click(page.getByRole('button', { name: 'Open turn order' }))
    await userEvent.click(await page.findByRole('button', { name: 'Next turn' }))
    await waitFor(async () => {
      await expect(liveCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({ type: 'ADVANCE_TURN' }),
            scope: 'ENCOUNTER'
          },
          type: 'COMMAND'
        })
      )
    })
    const emberTokenSelect = page.getByLabelText("Scene token for Ember's Wake")
    // Turn controls stay disabled until the room acknowledges the turn change.
    await waitFor(() => expect(emberTokenSelect).toBeEnabled())
    await userEvent.click(emberTokenSelect)
    await userEvent.click(await page.findByRole('option', { name: 'Ember' }))
    await waitFor(async () => {
      await expect(liveCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              encounterId: tabletopGmEncounter.id,
              sceneId: tabletopLiveScene.id,
              tokenId: tabletopLiveScene.tokens[0]!.id,
              type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING'
            }),
            scope: 'ENCOUNTER'
          },
          type: 'COMMAND'
        })
      )
    })
    await userEvent.click(page.getByRole('button', { name: 'Scene controls' }))
    await userEvent.click(await page.findByRole('menuitem', { name: 'Reveal entire map' }))
    await waitFor(async () => {
      await expect(fogBegin).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'PATCH_SCENE_FOG' })
      )
      const input = sceneFogPatchInputSchema.parse(fogBegin.mock.calls[0]?.[0])
      await expect(input.chunkManifest).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            checksum: expect.stringMatching(/^[a-f0-9]{64}$/)
          })
        ])
      )
      await expect(fogAppend).toHaveBeenCalled()
      const appendInputs = fogAppend.mock.calls.map(([args]) =>
        sceneFogAppendInputSchema.parse(args)
      )
      await expect(appendInputs.every((append) => append.chunks.length <= 8)).toBe(true)
      await expect(input.chunkManifest).toEqual(
        appendInputs.flatMap((append) =>
          append.chunks.map((chunk) => ({
            index: chunk.index,
            checksum: checksumCanonicalJson(chunk)
          }))
        )
      )
      await expect(liveCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              commandId: input.commandId,
              saveId: storyFogSaveId,
              type: 'PUBLISH_SCENE_FOG_PATCH'
            }),
            scope: 'SCENE'
          },
          type: 'COMMAND'
        })
      )
    })
  }
}

export const PlayerWindow: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) => renderWindow(args, createTabletopCampaign('PLAYER')),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await expect(
      await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    ).toBeInTheDocument()
    await expect(page.getByRole('region', { name: 'Live scene: The Lantern Vault' })).toBeVisible()
    await expect(mediaGetDelivery).toHaveBeenCalledWith({
      assetId: tabletopMapDelivery.assetId
    })
    await expect(page.queryByLabelText('Tabletop mode')).not.toBeInTheDocument()
    await expect(page.getByRole('toolbar', { name: 'Play tools' })).toBeVisible()
    const sceneControlsButton = page.getByRole('button', {
      name: 'Scene controls'
    })
    await userEvent.click(sceneControlsButton)
    const sceneControls = await page.findByRole('menu', {
      name: 'Scene controls'
    })
    await waitFor(async () => {
      await expect(sceneControls).toBeVisible()
    })
    const controls = within(sceneControls)
    await expect(controls.getByText('Focus Ember')).toBeVisible()
    await expect(controls.getByText(/Remove Vault span/)).toBeVisible()
    await expect(controls.getByText('No doors')).toBeVisible()
    await expect(page.queryByText('Vault Warden')).not.toBeInTheDocument()
    await expect(page.queryByText('Reveal entire map')).not.toBeInTheDocument()
    await expect(page.queryByRole('button', { name: 'Edit objects' })).not.toBeInTheDocument()
  }
}

// The real presentation of the Warden for one viewer, built by the product's own function.
function wardenPresentationFor(
  role: CampaignDetailDto['role'],
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto
) {
  const scene = projectScene(role, presentedTokensFixtures.liveScene)
  const wardenToken = scene.tokens[1]!
  const presentation = buildTabletopPresentations({
    actorIdByTokenId: new Map([[wardenToken.id, wardenId]]),
    boundTokenControl: new Map(),
    currentUserId: tabletopCurrentUserId,
    encounter,
    pending: null,
    scene
  })[wardenToken.id]!
  return { presentation, wardenToken }
}

// The renderer's live display objects for the Warden match the real presentation for that viewer.
async function expectDrawnWardenPresentation(
  role: CampaignDetailDto['role'],
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto
): Promise<void> {
  const { presentation, wardenToken } = wardenPresentationFor(role, encounter)
  await expect(presentation.statuses.length).toBeGreaterThan(0)
  const renderer = await latestStageRenderer()
  await waitFor(() => expect(renderer.getDiagnostics().tokens.length).toBeGreaterThan(0))
  await waitFor(async () =>
    expectDrawnPresentation(drawnToken(renderer.getDiagnostics(), wardenToken.id), presentation)
  )
}

// VTT_UI-1 journey: the scene canvas describes each token's statuses and the current turn.
export const GmSeesTokenStatuses: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) =>
    renderWindow(args, createTabletopCampaign('OWNER'), null, presentedTokensFixtures),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    const description = await waitFor(() => {
      const value = page
        .getByRole('img', { name: 'Interactive campaign scene' })
        .getAttribute('aria-description')
      if (!value?.includes('Vault Warden. Creature')) throw new Error('Tokens not yet described.')
      return value
    })
    await expect(description).toContain('Vault Warden. Creature. Hostile. Current turn.')
    await expect(description).toContain('Poisoned')
    await expect(description).toContain('Frightened')
    // The GM also sees how hurt the Warden is.
    await expect(description).toContain('Wounded')
    await expectDrawnWardenPresentation('OWNER', presentedTokensFixtures.gmEncounter)
  }
}

// The outer ring shows at most eight segments; focusing a token in the controls names every status.
export const FocusingATokenListsEveryStatus: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) =>
    renderWindow(args, createTabletopCampaign('OWNER'), null, presentedTokensFixtures),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    const { presentation, wardenToken } = wardenPresentationFor(
      'OWNER',
      presentedTokensFixtures.gmEncounter
    )
    await expect(presentation.statuses.length).toBeGreaterThan(0)
    await expect(page.queryByRole('region', { name: `${wardenToken.label} statuses` })).toBeNull()
    await userEvent.click(await page.findByRole('button', { name: 'Scene controls' }))
    const sceneControls = await page.findByRole('menu', { name: 'Scene controls' })
    const focusItem = await within(sceneControls).findByRole('menuitem', {
      name: `Focus ${wardenToken.label}`
    })
    focusItem.focus()
    const list = await page.findByRole('region', { name: `${wardenToken.label} statuses` })
    for (const status of presentation.statuses) {
      await expect(within(list).getByText(status.label)).toBeVisible()
    }
    focusItem.blur()
    await waitFor(() =>
      expect(page.queryByRole('region', { name: `${wardenToken.label} statuses` })).toBeNull()
    )
  }
}

async function reachInMenu(page: ReturnType<typeof within>, name: string | RegExp): Promise<void> {
  const menu = await page.findByRole('menu', { name: 'Scene controls' })
  await reachByKeyboard(await within(menu).findByRole('menuitem', { name }), () =>
    userEvent.keyboard('{ArrowDown}')
  )
}

// Presses the canvas centre, where focusing a token puts it, or a corner, which is empty map there.
async function pressStage(canvas: HTMLElement, where: 'centre' | 'corner'): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  const bounds = canvas.getBoundingClientRect()
  const point =
    where === 'centre'
      ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
      : { x: bounds.left + 4, y: bounds.top + 4 }
  const pointer = { clientX: point.x, clientY: point.y, pointerId: 1, pointerType: 'mouse' }
  fireEvent.pointerDown(canvas, { ...pointer, button: 0, buttons: 1 })
  fireEvent.pointerUp(canvas, { ...pointer, button: 0, buttons: 0 })
}

// VTT_UI-1.1 journey: the SELECT tool selects any token on the canvas or from the Scene controls.
export const SelectingATokenOutlinesIt: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) =>
    renderWindow(args, createTabletopCampaign('PLAYER'), null, presentedTokensFixtures),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    const stage = page.getByRole('img', { name: 'Interactive campaign scene' })
    const renderer = await latestStageRenderer()
    const scene = projectScene('PLAYER', presentedTokensFixtures.liveScene)
    // The player moves Ember; the Warden is not theirs, so selecting it must still work.
    const [ember, warden] = [scene.tokens[0]!, scene.tokens[1]!]
    await expect(ember.controlledByUserIds).toContain(tabletopCurrentUserId)
    await expect(warden.controlledByUserIds).not.toContain(tabletopCurrentUserId)
    const selectedIds = () =>
      renderer
        .getDiagnostics()
        .tokens.filter((token) => token.selection)
        .map((token) => token.id)

    renderer.focusPoint(ember.position)
    await pressStage(stage, 'centre')
    await waitFor(() => expect(selectedIds()).toEqual([ember.id]))
    await expect(drawnToken(renderer.getDiagnostics(), ember.id).selection?.color).toBe(
      selectionOutlineColor
    )
    await waitFor(() =>
      expect(stage.getAttribute('aria-description')).toMatch(
        new RegExp(`${ember.label}[^;]*, selected`)
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
      await within(sceneControls).findByRole('menuitem', { name: `Focus ${ember.label}` })
    )
    await waitFor(() => expect(selectedIds()).toEqual([ember.id]))
  }
}

// VTT_UI-1.3: the selected token draws its Facing arcs, and they follow it when it turns.
export const SelectingATokenShowsItsFacingArcs: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) => renderWindow(args, createTabletopCampaign('OWNER'), null, facingFixtures),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    const stage = page.getByRole('img', { name: 'Interactive campaign scene' })
    const renderer = await latestStageRenderer()
    const warden = facingFixtures.liveScene.tokens[1]!
    const drawnArcs = () => drawnToken(renderer.getDiagnostics(), warden.id).facingArcs
    const expectArcsAt = async (rotationDegrees: number) =>
      expect(drawnArcs()).toEqual(
        facingArcSectors({ arcs: facingArcs, rotationDegrees }).map((sector) => ({
          arc: sector.arc,
          polygon: facingArcWedge(sector, facingArcRadius(warden))
        }))
      )

    await expect(drawnArcs()).toEqual([])
    renderer.focusPoint(warden.position)
    await pressStage(stage, 'centre')
    await waitFor(() => expect(drawnArcs()).toHaveLength(4))
    await expectArcsAt(warden.rotationDegrees)

    syncStoryScene({
      ...facingFixtures.liveScene,
      tokens: facingFixtures.liveScene.tokens.map((token) =>
        token.id === warden.id ? { ...token, rotationDegrees: 90 } : token
      ),
      version: facingFixtures.liveScene.version + 1
    })
    await waitFor(() =>
      expect(drawnToken(renderer.getDiagnostics(), warden.id).rotationDegrees).toBe(90)
    )
    await expectArcsAt(90)

    await pressStage(stage, 'corner')
    await waitFor(() => expect(drawnArcs()).toEqual([]))
  }
}

// VTT_UI-1.3: Ember's Wake marked the Warden; its status list names the marker.
export const HoveringAMarkedTokenNamesItsMarker: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) => renderWindow(args, createTabletopCampaign('OWNER'), null, markedFixtures),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    const { presentation, wardenToken } = wardenPresentationFor('OWNER', markedFixtures.gmEncounter)
    const mark = presentation.statuses.find(({ id }) => id === `grant:${wardenMark.effectId}`)
    await expect(mark?.label).toBe("Mark from Ember's Wake, 2 rounds left")
    await userEvent.click(await page.findByRole('button', { name: 'Scene controls' }))
    const sceneControls = await page.findByRole('menu', { name: 'Scene controls' })
    const focusItem = await within(sceneControls).findByRole('menuitem', {
      name: `Focus ${wardenToken.label}`
    })
    await userEvent.hover(focusItem)
    const list = await page.findByRole('region', { name: `${wardenToken.label} statuses` })
    await expect(within(list).getByText(mark!.label)).toBeVisible()
  }
}

// VTT_UI-1.2: the selected token lists every status until the selection clears.
export const SelectingATokenListsItsStatuses: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) =>
    renderWindow(args, createTabletopCampaign('PLAYER'), null, presentedTokensFixtures),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    const stage = page.getByRole('img', { name: 'Interactive campaign scene' })
    const renderer = await latestStageRenderer()
    const { presentation, wardenToken } = wardenPresentationFor(
      'PLAYER',
      presentedTokensFixtures.playerEncounter
    )
    await expect(presentation.statuses.length).toBeGreaterThan(0)
    const statusList = () => page.queryByRole('region', { name: `${wardenToken.label} statuses` })

    renderer.focusPoint(wardenToken.position)
    await pressStage(stage, 'centre')
    const list = await page.findByRole('region', { name: `${wardenToken.label} statuses` })
    for (const status of presentation.statuses) {
      await expect(within(list).getByText(status.label)).toBeVisible()
    }

    await pressStage(stage, 'corner')
    await waitFor(() => expect(statusList()).toBeNull())
  }
}

// VTT_UI-1.2: pointing at a token's Focus item in the Scene controls lists every status.
export const HoveringAFocusItemListsEveryStatus: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) =>
    renderWindow(args, createTabletopCampaign('OWNER'), null, presentedTokensFixtures),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    const { presentation, wardenToken } = wardenPresentationFor(
      'OWNER',
      presentedTokensFixtures.gmEncounter
    )
    await expect(presentation.statuses.length).toBeGreaterThan(0)
    await userEvent.click(await page.findByRole('button', { name: 'Scene controls' }))
    const sceneControls = await page.findByRole('menu', { name: 'Scene controls' })
    const focusItem = await within(sceneControls).findByRole('menuitem', {
      name: `Focus ${wardenToken.label}`
    })
    await userEvent.hover(focusItem)
    const list = await page.findByRole('region', { name: `${wardenToken.label} statuses` })
    for (const status of presentation.statuses) {
      await expect(within(list).getByText(status.label)).toBeVisible()
    }
    await userEvent.unhover(focusItem)
    await waitFor(() =>
      expect(page.queryByRole('region', { name: `${wardenToken.label} statuses` })).toBeNull()
    )
  }
}

// VTT_UI-4.1: the panel names a token's disposition even when it has no statuses, and focusing a
// token from the Scene controls zooms a far-out view in until the token is readable.
export const FocusingATokenNamesItsDispositionAndZoomsIn: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) => renderWindow(args, createTabletopCampaign('OWNER'), null, bareWardenFixtures),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    const { presentation, wardenToken } = wardenPresentationFor(
      'OWNER',
      bareWardenFixtures.gmEncounter
    )
    await expect(presentation.statuses).toHaveLength(0)
    await expect(presentation.dispositionLabel).toBe('Hostile')
    const renderer = await latestStageRenderer()
    for (let step = 0; step < 40; step += 1) renderer.zoomOut()
    const zoomedOut = renderer.getDiagnostics().zoomScale
    await userEvent.click(await page.findByRole('button', { name: 'Scene controls' }))
    const sceneControls = await page.findByRole('menu', { name: 'Scene controls' })
    const focusItem = await within(sceneControls).findByRole('menuitem', {
      name: `Focus ${wardenToken.label}`
    })
    await userEvent.hover(focusItem)
    const panel = await page.findByRole('region', { name: `${wardenToken.label} statuses` })
    await expect(within(panel).getByText(presentation.dispositionLabel!)).toBeVisible()
    await userEvent.click(focusItem)
    await waitFor(() => expect(page.queryByRole('menu', { name: 'Scene controls' })).toBeNull())
    await waitFor(() => expect(renderer.getDiagnostics().zoomScale).toBeGreaterThan(zoomedOut))
    await expect(
      renderer.getDiagnostics().zoomScale * Math.max(wardenToken.width, wardenToken.height)
    ).toBeGreaterThanOrEqual(minimumFocusedTokenScreenSize - 1e-9)
    // At the minimum zoom every token stays reachable: listed in Scene controls, and Focus brings
    // its larger footprint side up to the readable size.
    for (const token of projectScene('OWNER', bareWardenFixtures.liveScene).tokens) {
      let floor = renderer.getDiagnostics().zoomScale
      let zoomedOutTo = Number.NaN
      while (zoomedOutTo !== floor) {
        zoomedOutTo = floor
        renderer.zoomOut()
        floor = renderer.getDiagnostics().zoomScale
      }
      await userEvent.click(await page.findByRole('button', { name: 'Scene controls' }))
      const menu = await page.findByRole('menu', { name: 'Scene controls' })
      await userEvent.click(
        await within(menu).findByRole('menuitem', { name: `Focus ${token.label}` })
      )
      // The next token reopens the menu, so wait for this one to finish closing first.
      await waitFor(() => expect(page.queryByRole('menu', { name: 'Scene controls' })).toBeNull())
      await waitFor(() => expect(renderer.getDiagnostics().zoomScale).toBeGreaterThan(floor))
      await expect(
        renderer.getDiagnostics().zoomScale * Math.max(token.width, token.height)
      ).toBeGreaterThanOrEqual(minimumFocusedTokenScreenSize - 1e-9)
    }
  }
}

// VTT_UI-1.2: pointing at another token lists its statuses over the selected token's; leaving it
// lists the selected token's again.
export const HoveringATokenListsItOverTheSelection: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) => renderWindow(args, createTabletopCampaign('OWNER'), null, sentryFixtures),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    const stage = page.getByRole('img', { name: 'Interactive campaign scene' })
    const renderer = await latestStageRenderer()
    const { wardenToken } = wardenPresentationFor('OWNER', sentryFixtures.gmEncounter)
    const sentryToken = sentryFixtures.liveScene.tokens.find((token) => token.id === sentryTokenId)!
    const statusList = (label: string) => page.queryByRole('region', { name: `${label} statuses` })

    renderer.focusPoint(wardenToken.position)
    await pressStage(stage, 'centre')
    await expect(
      within(await page.findByRole('region', { name: `${wardenToken.label} statuses` })).getByText(
        'Poisoned'
      )
    ).toBeVisible()

    await userEvent.click(await page.findByRole('button', { name: 'Scene controls' }))
    const sceneControls = await page.findByRole('menu', { name: 'Scene controls' })
    const sentryFocus = await within(sceneControls).findByRole('menuitem', {
      name: `Focus ${sentryToken.label}`
    })
    await userEvent.hover(sentryFocus)
    const sentryList = await page.findByRole('region', { name: `${sentryToken.label} statuses` })
    await expect(within(sentryList).getByText('Prone')).toBeVisible()
    await expect(statusList(wardenToken.label)).toBeNull()

    await userEvent.unhover(sentryFocus)
    await waitFor(() => expect(statusList(sentryToken.label)).toBeNull())
    const wardenList = await page.findByRole('region', { name: `${wardenToken.label} statuses` })
    await expect(within(wardenList).getByText('Poisoned')).toBeVisible()
  }
}

// VTT_UI-4.2: the Scene is playable, readable and recoverable without a pointer.
export const KeyboardOnlyTabletopJourney: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) => renderWindow(args, createTabletopCampaign('OWNER'), null, sentryFixtures),
  play: async ({ canvasElement }) => {
    liveCommand.mockClear()
    const page = within(canvasElement.ownerDocument.body)
    await expect(
      await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    ).toBeVisible()
    const stage = page.getByRole('img', { name: 'Interactive campaign scene' })
    await expect(page.getByRole('combobox', { name: 'Presented campaign scene' })).toBeVisible()
    const renderer = await latestStageRenderer()
    const { wardenToken } = wardenPresentationFor('OWNER', sentryFixtures.gmEncounter)
    const sentryToken = sentryFixtures.liveScene.tokens.find((token) => token.id === sentryTokenId)!
    await expect(stage).toHaveAccessibleDescription(/^Visible tokens: /)
    for (const token of [wardenToken, sentryToken])
      await expect(stage).toHaveAccessibleDescription(new RegExp(token.label))
    for (let step = 0; step < 40; step += 1) renderer.zoomOut()
    const zoomedOut = renderer.getDiagnostics().zoomScale

    const trigger = page.getByRole('button', { name: 'Scene controls' })
    await reachByKeyboard(trigger, () => userEvent.tab())
    await userEvent.keyboard('{Enter}')
    await reachInMenu(page, `Focus ${wardenToken.label}`)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(page.queryByRole('menu', { name: 'Scene controls' })).toBeNull())
    await waitFor(() => expect(trigger).toHaveFocus())
    await waitFor(() => expect(renderer.getDiagnostics().zoomScale).toBeGreaterThan(zoomedOut))

    await userEvent.keyboard('{Enter}')
    await reachInMenu(page, `Move ${wardenToken.label} right`)
    await userEvent.keyboard('{Enter}')
    await waitFor(() =>
      expect(liveCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              path: expect.arrayContaining([wardenToken.position]),
              tokenId: wardenToken.id,
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
    await reachInMenu(page, `Measure from ${wardenToken.label}`)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(trigger).toHaveFocus())
    await userEvent.keyboard('{Enter}')
    await reachInMenu(page, new RegExp(`^To ${sentryToken.label}`))
    await userEvent.keyboard('{Enter}')
    await expect(
      await page.findByText(
        new RegExp(`^Measured from ${wardenToken.label} to ${sentryToken.label}: .+\\.$`)
      )
    ).toBeInTheDocument()

    // Escape closes the menu back to its trigger; Tab leaves it rather than walking its items.
    await userEvent.keyboard('{Enter}')
    await reachInMenu(page, `Focus ${wardenToken.label}`)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page.queryByRole('menu', { name: 'Scene controls' })).toBeNull())
    await waitFor(() => expect(trigger).toHaveFocus())
    await userEvent.keyboard('{Enter}')
    await reachInMenu(page, `Focus ${wardenToken.label}`)
    const openMenu = await page.findByRole('menu', { name: 'Scene controls' })
    await userEvent.tab()
    await expect(openMenu.contains(document.activeElement)).toBe(false)

    await reachByKeyboard(stage, () => userEvent.tab())
    await userEvent.keyboard('p')
    await expect(await page.findByText('You pinged the map.')).toBeInTheDocument()
  }
}

// VTT_UI-4.2: a Scene command the room rejects as stale is announced, not swallowed.
export const KeyboardMoveRejectedAsStaleIsAnnounced: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) =>
    renderWindow(
      args,
      createTabletopCampaign('OWNER'),
      null,
      sentryFixtures,
      'The scene changed before the move landed.'
    ),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    const { wardenToken } = wardenPresentationFor('OWNER', sentryFixtures.gmEncounter)
    await reachByKeyboard(page.getByRole('button', { name: 'Scene controls' }), () =>
      userEvent.tab()
    )
    await userEvent.keyboard('{Enter}')
    await reachInMenu(page, `Move ${wardenToken.label} right`)
    await userEvent.keyboard('{Enter}')
    await expect(await page.findByRole('alert')).toHaveTextContent(
      'The scene changed before the move landed.'
    )
  }
}

export const GmPreviewsATokenView: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) => renderWindow(args, createTabletopCampaign('OWNER'), null, previewFixtures),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    const { wardenToken } = wardenPresentationFor('OWNER', previewFixtures.gmEncounter)
    const renderer = await latestStageRenderer()
    await expect(renderer.getDiagnostics().lighting.visionCount).toBe(0)
    await userEvent.click(await page.findByRole('button', { name: 'Scene controls' }))
    const sceneControls = await page.findByRole('menu', { name: 'Scene controls' })
    const controls = within(sceneControls)
    // Mantine fixes menu items to role menuitem, which cannot carry a pressed or checked state,
    // so the item's own words say whether the preview is on.
    await userEvent.click(
      await controls.findByRole('menuitem', { name: `Preview view ${wardenToken.label}` })
    )
    const stop = await controls.findByRole('menuitem', {
      name: `Stop previewing ${wardenToken.label}`
    })
    await expect(controls.getAllByRole('menuitem', { name: /^Stop previewing/ })).toHaveLength(1)
    // The renderer draws the previewed token's sight.
    await waitFor(() => expect(renderer.getDiagnostics().lighting.visionCount).toBe(1))
    await userEvent.click(stop)
    await expect(
      await controls.findByRole('menuitem', { name: `Preview view ${wardenToken.label}` })
    ).toBeVisible()
    await waitFor(() => expect(renderer.getDiagnostics().lighting.visionCount).toBe(0))
  }
}

// The GM's preview is derived from the Scene: once the previewed token leaves it, the map is the
// GM's see-all view again, not black.
export const GmPreviewEndsWhenThePreviewedTokenLeavesTheScene: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) => renderWindow(args, createTabletopCampaign('OWNER'), null, previewFixtures),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    const { wardenToken } = wardenPresentationFor('OWNER', previewFixtures.gmEncounter)
    const renderer = await latestStageRenderer()
    // Ground far from every light and token in the darkened scene, and behind a wall from the
    // Warden: its authored sight (120 ft) reaches the whole map, so only the wall hides it.
    const ground = [{ x: 400, y: 100 }]
    await expect(renderer.sampleDarkness(ground)[0]?.alpha).toBeCloseTo(gmDarknessCapAlpha, 1)
    await userEvent.click(await page.findByRole('button', { name: 'Scene controls' }))
    const controls = within(await page.findByRole('menu', { name: 'Scene controls' }))
    await userEvent.click(
      await controls.findByRole('menuitem', { name: `Preview view ${wardenToken.label}` })
    )
    await waitFor(() => expect(renderer.getDiagnostics().lighting.visionCount).toBe(1))
    await expect(renderer.sampleDarkness(ground)[0]).toMatchObject({ alpha: 1, masked: true })

    syncStoryScene({
      ...previewFixtures.liveScene,
      tokens: previewFixtures.liveScene.tokens.filter((token) => token.id !== wardenToken.id),
      version: previewFixtures.liveScene.version + 1
    })
    await waitFor(() => expect(renderer.getDiagnostics().tokenVisualCount).toBe(1))
    await expect(renderer.getDiagnostics().lighting.visionCount).toBe(0)
    await expect(renderer.sampleDarkness(ground)[0]?.alpha).toBeCloseTo(gmDarknessCapAlpha, 1)
    await expect(renderer.sampleDarkness(ground)[0]?.masked).toBe(false)
    await expect(page.queryByRole('menuitem', { name: /previewing/ })).toBeNull()
  }
}

// Hovering a token on the canvas lists its statuses in the DOM, and leaving hides the list.
export const HoveringATokenOnTheCanvasListsItsStatuses: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) =>
    renderWindow(args, createTabletopCampaign('OWNER'), null, presentedTokensFixtures),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    const { presentation, wardenToken } = wardenPresentationFor(
      'OWNER',
      presentedTokensFixtures.gmEncounter
    )
    await expect(presentation.statuses.length).toBeGreaterThan(0)
    const region = { name: `${wardenToken.label} statuses` }
    await expect(page.queryByRole('region', region)).toBeNull()
    // Centring the view puts the Warden under the middle of the canvas.
    const stageRenderer = await latestStageRenderer()
    stageRenderer.focusPoint(wardenToken.position)
    const canvas = page.getByRole('img', { name: 'Interactive campaign scene' })
    const bounds = canvas.getBoundingClientRect()
    const pointer = { pointerId: 41, pointerType: 'mouse' }
    fireEvent.pointerMove(canvas, {
      ...pointer,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2
    })
    const list = await page.findByRole('region', region)
    for (const status of presentation.statuses) {
      await expect(within(list).getByText(status.label)).toBeVisible()
    }
    fireEvent.pointerMove(canvas, {
      ...pointer,
      clientX: bounds.left + 4,
      clientY: bounds.top + 4
    })
    await waitFor(() => expect(page.queryByRole('region', region)).toBeNull())
  }
}

export const PlayerSeesTokenStatusesWithoutGmHealth: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) =>
    renderWindow(args, createTabletopCampaign('PLAYER'), null, presentedTokensFixtures),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    const description = await waitFor(() => {
      const value = page
        .getByRole('img', { name: 'Interactive campaign scene' })
        .getAttribute('aria-description')
      if (!value?.includes('Vault Warden. Creature')) throw new Error('Tokens not yet described.')
      return value
    })
    await expect(description).toContain('Vault Warden. Creature. Hostile. Current turn.')
    await expect(description).toContain('Poisoned')
    await expect(description).toContain('Frightened')
    await expect(description).not.toContain('Wounded')
    await expectDrawnWardenPresentation('PLAYER', presentedTokensFixtures.playerEncounter)
  }
}

// D157: a push that leaves its target a choice waits on the board for the player whose Character
// pushed; a press inside one of the highlighted legal squares answers it.
export const PlayerPicksWhereAPushLeavesTheCreature: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) =>
    renderWindow(args, createTabletopCampaign('PLAYER'), null, pushedWardenFixtures),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    const choice = await page.findByRole('region', { name: 'Where Vault Warden lands' })
    await expect(within(choice).getByText('Pick where Vault Warden lands.')).toBeVisible()
    const picker = within(choice).getByRole('button', { name: 'Leave Vault Warden where it is' })
    await waitFor(() => expect(picker).toHaveFocus())
    // One picker control: the arrow keys walk it over the legal squares, Home returns to the first.
    await userEvent.keyboard('{ArrowLeft}')
    await expect(picker).toHaveAccessibleName('Move Vault Warden 5 ft west')
    await userEvent.keyboard('{Home}')
    await expect(picker).toHaveAccessibleName('Leave Vault Warden where it is')
    const renderer = await latestStageRenderer()
    // Every legal square is outlined on the board.
    await waitFor(() =>
      expect(renderer.getDiagnostics().overlayCount).toBeGreaterThanOrEqual(
        pushedWardenSquares.length
      )
    )
    renderer.focusPoint(pushedWardenSquares[1]!)
    await pressStage(page.getByRole('img', { name: 'Interactive campaign scene' }), 'centre')
    await waitFor(() =>
      expect(liveCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: {
            command: expect.objectContaining({
              type: 'RESOLVE_RULE_OCCURRENCE',
              occurrenceId: pushedWardenPending.occurrenceId,
              resolution: {
                kind: 'FORCED_MOVEMENT',
                requestId: pushedWardenPending.requestId,
                position: pushedWardenSquares[1]
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

// D87: the GM shows another Scene's map to players without changing the presented Scene.
export const GmShowsSceneToPlayers: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) => renderWindow(args, createTabletopCampaign('OWNER')),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(await page.findByRole('button', { name: 'Show to players' }))
    const presented = await page.findByRole('menuitem', { name: tabletopLiveScene.name })
    await expect(presented).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(page.getByRole('menuitem', { name: shownScene.sceneName }))
    await waitFor(() =>
      expect(showScene).toHaveBeenCalledWith({
        campaignId: tabletopCampaignId,
        sceneId: shownScene.sceneId
      })
    )
  }
}

export const PlayerSeesShownScene: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) => renderWindow(args, createTabletopCampaign('PLAYER'), shownScene),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    const viewer = await page.findByRole('dialog', { name: shownScene.sceneName })
    const map = await within(viewer).findByRole('img', { name: `Map of ${shownScene.sceneName}` })
    // The Modal fades in; the map is visible once that enter transition has finished.
    await waitFor(() => expect(map).toBeVisible())
    await expect(page.queryByRole('button', { name: 'Show to players' })).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() =>
      expect(page.queryByRole('dialog', { name: shownScene.sceneName })).not.toBeInTheDocument()
    )
  }
}

// VTT_UI-1 journey data: the Warden is in plain view, takes the current turn and carries conditions.
const wardenConditions = tabletopConditions('POISONED', 'FRIGHTENED')
const wardenId = tabletopGmEncounter.actors[1]!.id
const presentedTokensFixtures: TabletopFixtures = {
  gmEncounter: {
    ...tabletopGmEncounter,
    actors: tabletopGmEncounter.actors.map((actor) =>
      actor.id === wardenId ? { ...actor, conditions: wardenConditions } : actor
    ),
    currentActorId: wardenId
  },
  liveScene: {
    ...tabletopLiveScene,
    fogMode: 'OFF',
    tokens: tabletopLiveScene.tokens.map((token) => ({ ...token, hidden: false }))
  },
  playerEncounter: {
    ...tabletopPlayerEncounter,
    actors: tabletopPlayerEncounter.actors.map((actor) =>
      actor.id === wardenId ? { ...actor, conditions: wardenConditions } : actor
    ),
    currentActorId: wardenId
  }
}

// VTT_UI-1.3 journey data: Facing is on and Ember has the turn, so the Warden shows arcs only when selected.
const facingArcs = [
  { arc: 'FRONT', fromDegrees: -45, toDegrees: 45 },
  { arc: 'RIGHT_SIDE', fromDegrees: 45, toDegrees: 135 },
  { arc: 'REAR', fromDegrees: 135, toDegrees: 225 },
  { arc: 'LEFT_SIDE', fromDegrees: 225, toDegrees: 315 }
] as const
const facingFixtures: TabletopFixtures = {
  ...presentedTokensFixtures,
  gmEncounter: {
    ...presentedTokensFixtures.gmEncounter,
    currentActorId: tabletopGmEncounter.actors[0]!.id,
    facingArcs: [...facingArcs],
    facingStepDegrees: 90
  }
}

// VTT_UI-1.3 journey data: Ember's Wake's melee attack marked the Warden (ATTACK-13), as the
// Encounter projection lists it to the GM.
const wardenMark = validated(activeGrantListingDtoSchema)({
  effectId: '13131313-1313-4131-8131-131313131313',
  label: 'Mark',
  sourceHidden: false,
  sourceActorId: tabletopGmEncounter.actors[0]!.id,
  remainingTicks: 2,
  expiresAtCampaignMinute: null,
  polarity: 'HARMFUL'
})
const markedFixtures: TabletopFixtures = {
  ...presentedTokensFixtures,
  gmEncounter: {
    ...presentedTokensFixtures.gmEncounter,
    actors: presentedTokensFixtures.gmEncounter.actors.map((actor) =>
      actor.id === wardenId ? { ...actor, activeGrants: [wardenMark] } : actor
    )
  }
}

// Ember's Wake pushed the Warden, which may stay put or land one square west or north (D157).
const pushedWardenPosition = presentedTokensFixtures.liveScene.tokens[1]!.position
const pushedWardenSquares = [
  pushedWardenPosition,
  { x: pushedWardenPosition.x - 70, y: pushedWardenPosition.y },
  { x: pushedWardenPosition.x, y: pushedWardenPosition.y - 70 }
]
const pushedWardenPending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
  kind: 'FORCED_MOVEMENT_DESTINATION',
  occurrenceId: '12121212-1212-4121-8121-121212121212',
  occurrenceVersion: 2,
  encounterVersion: tabletopGmEncounter.version,
  sourceActorId: tabletopGmEncounter.actors[0]!.id,
  targetActorId: wardenId,
  requestId: 'crusher-push',
  positions: pushedWardenSquares,
  allowedResponses: ['FORCED_MOVEMENT']
})
if (pushedWardenPending.kind !== 'FORCED_MOVEMENT_DESTINATION')
  throw new Error('Unexpected pending kind.')
const pushedWardenFixtures: TabletopFixtures = {
  ...presentedTokensFixtures,
  pending: pushedWardenPending
}

// The Warden bound to a token but carrying no status, so only its disposition is listed.
const bareWardenFixtures: TabletopFixtures = {
  ...presentedTokensFixtures,
  gmEncounter: {
    ...presentedTokensFixtures.gmEncounter,
    actors: presentedTokensFixtures.gmEncounter.actors.map((actor) =>
      actor.id === wardenId ? { ...actor, conditions: [], healthBand: 'HEALTHY' as const } : actor
    )
  }
}

// A second bound creature, the prone Sentry, so pointing at it lists statuses distinct from the
// selected Warden's.
const wardenActor = presentedTokensFixtures.gmEncounter.actors[1]!
const wardenSceneToken = presentedTokensFixtures.liveScene.tokens[1]!
const sentryTokenId = '77777777-7777-4777-8777-777777777710'
const sentryFixtures: TabletopFixtures = {
  ...presentedTokensFixtures,
  gmEncounter: {
    ...presentedTokensFixtures.gmEncounter,
    actors: [
      ...presentedTokensFixtures.gmEncounter.actors,
      {
        ...wardenActor,
        conditions: tabletopConditions('PRONE'),
        id: '99999999-9999-4999-8999-999999999903',
        label: 'Vault Sentry'
      }
    ]
  },
  liveScene: {
    ...presentedTokensFixtures.liveScene,
    tokens: [
      ...presentedTokensFixtures.liveScene.tokens,
      {
        ...wardenSceneToken,
        id: sentryTokenId,
        label: 'Vault Sentry',
        position: { x: 700, y: 300 }
      }
    ]
  }
}

// The Warden sees in a darkened Scene, so previewing its view is distinguishable from the GM's.
const previewFixtures: TabletopFixtures = {
  ...presentedTokensFixtures,
  liveScene: {
    ...presentedTokensFixtures.liveScene,
    ambientIllumination: 'ORDINARY_DARKNESS',
    tokens: presentedTokensFixtures.liveScene.tokens.map((token) =>
      token.id === tabletopLiveScene.tokens[1]!.id
        ? {
            ...token,
            vision: {
              angleDegrees: 360,
              brightRange: 60,
              dimRange: 120,
              directionDegrees: 0,
              enabled: true
            }
          }
        : token
    )
  }
}
