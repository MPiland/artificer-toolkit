import { convexQuery } from '@convex-dev/react-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ConvexReactClient, useAction, useConvex } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { useEffect, useState, type ComponentProps, type JSX, type ReactNode } from 'react'
import { expect, fireEvent, fn, mocked, userEvent, waitFor, within } from 'storybook/test'
import { http, HttpResponse } from 'msw'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaigns'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto,
  type EncounterGmProjectionDto,
  type EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  pendingEncounterRuleOccurrenceSummaryDtoSchema,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import {
  sceneFogAppendInputSchema,
  sceneFogChunksPageInputSchema,
  sceneFogChunksPageSchema,
  sceneFogLayersPageInputSchema,
  sceneFogLayersPageSchema,
  sceneFogPatchInputSchema,
  type SceneFogPatchInput
} from '@artificer-toolkit/schema/api/sceneFog'
import {
  liveSessionWebSocketClientMessageDtoSchema,
  liveSessionRecipientStateDtoSchema,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionRecipientStateDto
} from '@artificer-toolkit/schema/api/liveSessions'
import {
  sceneEncounterBindingSchema,
  sceneRecipientHeaderSchema,
  sceneRecipientEncounterBindingsInputSchema,
  sceneRecipientEncounterBindingsPageSchema,
  sceneRecipientPageInputSchema,
  sceneRecipientPageSchema
} from '@artificer-toolkit/schema/api/sceneRecipient'
import {
  campaignSceneShowingDtoSchema,
  type CampaignSceneShowingDto,
  type CampaignSceneStateDto,
  setCampaignLiveScenePresentationInputDtoSchema,
  setCampaignLiveScenePresentationResultDtoSchema
} from '@artificer-toolkit/schema/api/vttScenes'
import { validated } from '../../../test/validatedFixture'
import { reachByKeyboard } from './CampaignTabletop.stories.keyboard'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { facingArcSectors, projectSceneForViewer } from '@artificer-toolkit/shared/vtt'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import {
  buildTabletopPresentations,
  createTabletopCampaign,
  tabletopCampaignId,
  seedTabletopSystem,
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

const liveSessionTokenHandler = http.get('*/api/auth/convex/token', () =>
  HttpResponse.json({ token: 'story-convex-access-token' })
)
const recipientRevision = 'a'.repeat(64)
const mapReadyTimeoutMs = 10_000
const liveCommand = fn()
const mediaGetDelivery = fn()
const fogBegin = fn()
const fogAppend = fn()
const storyFogSaveId = '77777777-7777-4777-8777-777777777799'
const showScene = fn()
const shownScene = validated(campaignSceneShowingDtoSchema)({
  sceneId: '77777777-7777-4777-8777-777777777798',
  sceneName: 'The Ashen Stair',
  shownAt: '2099-08-15T20:00:00.000Z'
})
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

type TabletopFixtures = {
  gmEncounter: EncounterGmProjectionDto
  liveScene: CampaignSceneStateDto
  playerEncounter: EncounterPlayerProjectionDto
  pending?: PendingEncounterRuleOccurrenceSummaryDto
}

const defaultTabletopFixtures: TabletopFixtures = {
  gmEncounter: tabletopGmEncounter,
  liveScene: tabletopLiveScene,
  playerEncounter: tabletopPlayerEncounter
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

// Replaces the room's presented Scene with a later state, as a Scene edit does mid-session.
let pushStoryScene: ((scene: CampaignSceneStateDto) => void) | null = null

function syncStoryScene(scene: CampaignSceneStateDto): void {
  if (!pushStoryScene) throw new Error('The story live session transport is not installed.')
  pushStoryScene(scene)
}

function renderWindow(
  args: ComponentProps<typeof CampaignTabletopWindow>,
  campaign: CampaignDetailDto,
  showing: CampaignSceneShowingDto | null = null,
  fixtures: TabletopFixtures = defaultTabletopFixtures,
  sceneCommandRejection: string | null = null
): JSX.Element {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY }
    }
  })
  queryClient.setQueryDefaults(getCampaignDetail(tabletopCampaignId).queryKey, {
    queryFn: async () => campaign
  })
  // This Scene fixture has no Character Sheet action data.
  queryClient.setQueryDefaults(
    ['convexQuery', getFunctionName(convexApi.characters.sheetSlices.get)],
    {
      queryFn: async () => null
    }
  )
  queryClient.setQueryData(getCampaignDetail(tabletopCampaignId).queryKey, campaign)
  const encounter = campaign.role === 'OWNER' ? fixtures.gmEncounter : fixtures.playerEncounter
  const scene = projectScene(campaign.role, fixtures.liveScene)
  const header = recipientHeader(scene)
  const nativeActorTokenBindings = scene.tokens.slice(1).flatMap((token, index) => {
    const actor = encounter.actors[index + 1]
    return actor
      ? [
          {
            actorId: actor.id,
            encounterId: encounter.id,
            sceneId: scene.id,
            tokenId: token.id
          }
        ]
      : []
  })
  const encounterResult = encounterCommandResultDtoSchema.parse({
    projection: { ...encounter, version: encounter.version + 1 },
    roll: null,
    occurrence: null
  })
  const sceneBinding = validated(sceneEncounterBindingSchema)({
    encounterId: encounter.id,
    encounterVersion: encounter.version,
    sceneId: scene.id
  })
  const presentationVersion = 0
  mediaGetDelivery.mockReset().mockResolvedValue(tabletopMapDelivery)
  const sceneBindingQuery = convexQuery(convexApi.encounters.sceneBindings.get, {
    encounterId: encounter.id,
    sceneId: scene.id
  })
  const activeEncounterQuery = convexQuery(convexApi.encounters.activeReads.active, {
    campaignId: tabletopCampaignId
  })
  const pendingPreparedQuery = convexQuery(convexApi.encounters.projectionReads.pendingPrepared, {
    campaignId: tabletopCampaignId
  })
  const skippedActionChoicesQuery = convexQuery(convexApi.encounters.actionChoices.get, 'skip')
  queryClient.setQueryDefaults(sceneBindingQuery.queryKey.slice(0, 2), {
    queryFn: async () => sceneBinding
  })
  const activeState = {
    encounter,
    pending: fixtures.pending ?? null,
    waitingOn: null,
    turnMovement: [],
    halfSpeedFields: [],
    auras: [],
    movementCostZones: [],
    placedZones: [],
    pendingZoneSightings: []
  }
  queryClient.setQueryDefaults(activeEncounterQuery.queryKey, {
    queryFn: async () => activeState
  })
  queryClient.setQueryDefaults(pendingPreparedQuery.queryKey, { queryFn: async () => [] })
  const rollPreferencesQuery = convexQuery(convexApi.account.rollPreferences, {})
  const rollPreferences = { autoRollDice: true, gmRollVisibility: 'PUBLIC' as const }
  queryClient.setQueryDefaults(rollPreferencesQuery.queryKey, {
    queryFn: async () => rollPreferences
  })
  queryClient.setQueryDefaults(skippedActionChoicesQuery.queryKey, {
    queryFn: async () => null
  })
  const showingQuery = convexQuery(convexApi.scenes.showings.current, {
    campaignId: tabletopCampaignId
  })
  const presentationQuery = convexQuery(convexApi.scenes.presentations.get, {
    campaignId: tabletopCampaignId
  })
  const shownHeaderQuery = convexQuery(convexApi.scenes.recipientReads.header, {
    sceneId: shownScene.sceneId,
    includeSnapshot: false
  })
  queryClient.setQueryDefaults(showingQuery.queryKey, { queryFn: async () => showing })
  queryClient.setQueryDefaults(presentationQuery.queryKey, {
    queryFn: async () => ({
      campaignId: tabletopCampaignId,
      sceneId: scene.id,
      version: presentationVersion
    })
  })
  queryClient.setQueryDefaults(shownHeaderQuery.queryKey, {
    queryFn: async () => ({ ...header, id: shownScene.sceneId, name: shownScene.sceneName })
  })
  queryClient.setQueryData(sceneBindingQuery.queryKey, sceneBinding)
  seedTabletopSystem(queryClient, campaign)
  queryClient.setQueryData(activeEncounterQuery.queryKey, activeState)
  queryClient.setQueryData(pendingPreparedQuery.queryKey, [])
  queryClient.setQueryData(rollPreferencesQuery.queryKey, rollPreferences)
  const convex = new ConvexReactClient('https://story-fixture.convex.cloud', {
    logger: false
  })
  Object.defineProperty(convex, 'query', {
    value: fn<ConvexReactClient['query']>().mockImplementation(async (...[reference, args]) => {
      const name = getFunctionName(reference)
      if (name === getFunctionName(convexApi.encounters.activeReads.active)) return activeState
      if (name === getFunctionName(convexApi.encounters.projectionReads.pendingPrepared)) return []
      if (name === getFunctionName(convexApi.scenes.recipientReads.header)) return header
      if (name === getFunctionName(convexApi.encounters.sceneBindings.get)) return sceneBinding
      if (name === getFunctionName(convexApi.scenes.definitionReads.listLive))
        return {
          page: [
            {
              definitionId: tabletopLiveScene.definitionId,
              id: tabletopLiveScene.id,
              name: tabletopLiveScene.name,
              version: tabletopLiveScene.version
            },
            {
              definitionId: shownScene.sceneId,
              id: shownScene.sceneId,
              name: shownScene.sceneName,
              version: 0
            }
          ],
          isDone: true,
          continueCursor: ''
        }
      if (name === getFunctionName(convexApi.scenes.fogReads.layers)) {
        const input = sceneFogLayersPageInputSchema.parse(args)
        const start = input.paginationOpts.cursor === null ? 0 : Number(input.paginationOpts.cursor)
        const page = scene.fogLayers.slice(start, start + input.paginationOpts.numItems)
        const next = start + page.length
        return validated(sceneFogLayersPageSchema)({
          version: scene.version,
          page: page.map((layer, ordinal) => ({
            ownerUserId: layer.ownerUserId,
            width: layer.width,
            height: layer.height,
            chunkCount: layer.chunks.length,
            ordinal: start + ordinal
          })),
          isDone: next === scene.fogLayers.length,
          continueCursor: next === scene.fogLayers.length ? '' : String(next),
          pageStatus: null,
          splitCursor: null
        })
      }
      if (name === getFunctionName(convexApi.scenes.fogReads.chunks)) {
        const input = sceneFogChunksPageInputSchema.parse(args)
        const layer = scene.fogLayers.find(
          (candidate) => candidate.ownerUserId === input.ownerUserId
        )
        if (!layer) throw new Error('Story fixture fog layer was not found.')
        const page = layer.chunks.slice(input.offset, input.offset + input.numItems)
        const nextOffset = input.offset + page.length
        return validated(sceneFogChunksPageSchema)({
          version: scene.version,
          ownerUserId: layer.ownerUserId,
          width: layer.width,
          height: layer.height,
          page,
          nextOffset,
          isDone: nextOffset === layer.chunks.length
        })
      }
      throw new Error(`Unexpected story fixture query: ${name}`)
    })
  })
  Object.defineProperty(convex, 'action', {
    value: fn<ConvexReactClient['action']>().mockImplementation(async (...[reference, args]) => {
      const name = getFunctionName(reference)
      if (name === getFunctionName(convexApi.liveSessions.tickets.issue)) {
        return {
          expiresAt: '2099-08-15T23:59:00.000Z',
          ticket: 'storybook-live-session-ticket'
        }
      }
      if (name === getFunctionName(convexApi.media.vttMapActions.getDelivery)) {
        return mediaGetDelivery(args)
      }
      if (
        name === getFunctionName(convexApi.media.characterPortraitActions.getImage) ||
        name === getFunctionName(convexApi.media.authoredActions.getImage)
      )
        return null
      if (name === getFunctionName(convexApi.scenes.presentations.setLive)) {
        const input = setCampaignLiveScenePresentationInputDtoSchema.parse(args)
        return validated(setCampaignLiveScenePresentationResultDtoSchema)({
          commandId: input.commandId,
          replayed: false,
          campaignId: input.campaignId,
          sceneId: input.sceneId,
          version: presentationVersion + 1
        })
      }
      if (name === getFunctionName(convexApi.scenes.recipientActions.encounterBindings)) {
        const input = sceneRecipientEncounterBindingsInputSchema.parse(args)
        if (
          input.expectedRecipientRevision !== recipientRevision ||
          input.expectedEncounterVersion !== encounter.version
        )
          throw new Error('Story fixture Encounter binding fence did not match.')
        const start =
          input.afterEntityId === null
            ? 0
            : scene.tokens.findIndex((token) => token.id === input.afterEntityId) + 1
        if (start <= 0 && input.afterEntityId !== null)
          throw new Error('Story fixture Encounter binding continuation was not found.')
        const pageTokens = scene.tokens.slice(start, start + input.numItems)
        const next = start + pageTokens.length
        return validated(sceneRecipientEncounterBindingsPageSchema)({
          ...sceneBinding,
          page: pageTokens.flatMap((token) => {
            const binding = nativeActorTokenBindings.find(
              (candidate) => candidate.tokenId === token.id
            )
            return binding ? [binding] : []
          }),
          recipientRevision,
          next: next === scene.tokens.length ? null : (pageTokens.at(-1)?.id ?? null),
          version: scene.version
        })
      }
      if (name !== getFunctionName(convexApi.scenes.recipientActions.entities))
        throw new Error(`Unexpected story fixture action: ${name}`)
      const input = sceneRecipientPageInputSchema.parse(args)
      if (input.expectedRecipientRevision !== recipientRevision)
        throw new Error('Story fixture recipient revision did not match.')
      const entities = scene[input.collection]
      const start =
        input.afterEntityId === null
          ? 0
          : entities.findIndex((entity) => entity.id === input.afterEntityId) + 1
      if (start <= 0 && input.afterEntityId !== null)
        throw new Error('Story fixture recipient entity was not found.')
      const page = entities.slice(start, start + input.numItems)
      const next = start + page.length
      return sceneRecipientPageSchema.parse({
        version: scene.version,
        recipientRevision,
        collection: input.collection,
        page: page.map((entity) => ({
          value: { collection: input.collection, entity },
          doorState:
            input.collection === 'barriers' && 'kind' in entity && entity.kind === 'DOOR'
              ? (scene.doorStates[entity.id] ?? null)
              : null
        })),
        next: next === entities.length ? null : (page.at(-1)?.id ?? null)
      })
    })
  })
  Object.defineProperty(convex, 'mutation', {
    value: fn<ConvexReactClient['mutation']>().mockImplementation(async (...[reference, args]) => {
      const name = getFunctionName(reference)
      if (name === getFunctionName(convexApi.scenes.showings.show)) {
        showScene(args)
        return null
      }
      throw new Error(`Unexpected story fixture mutation: ${name}`)
    })
  })
  showScene.mockReset()
  fogBegin.mockReset()
  fogAppend.mockReset()

  const recipientState = validated(liveSessionRecipientStateDtoSchema)({
    presentationVersion,
    recipientRole: campaign.role,
    scene
  })
  liveCommand.mockReset()
  return (
    <StoryLiveSessionTransport
      encounterResult={encounterResult}
      sceneCommandRejection={sceneCommandRejection}
      state={recipientState}
    >
      <StoryConvexFixture client={convex}>
        <QueryClientProvider client={queryClient}>
          <CampaignTabletopWindow campaignId={args.campaignId} currentUserId={args.currentUserId} />
        </QueryClientProvider>
      </StoryConvexFixture>
    </StoryLiveSessionTransport>
  )
}

function projectScene(
  role: CampaignDetailDto['role'],
  liveScene: CampaignSceneStateDto = tabletopLiveScene
): CampaignSceneStateDto {
  return role === 'OWNER'
    ? liveScene
    : projectSceneForViewer(
        liveScene,
        {
          role: 'PLAYER',
          userId: tabletopCurrentUserId
        },
        new Map()
      )
}

function recipientHeader(scene: ReturnType<typeof projectScene>) {
  const {
    annotations: _annotations,
    barriers: _barriers,
    darknessZones: _darknessZones,
    doorStates: _doorStates,
    fogLayers: _fogLayers,
    lights: _lights,
    measurements: _measurements,
    tokens: _tokens,
    ...header
  } = scene
  return validated(sceneRecipientHeaderSchema)({ ...header, recipientRevision })
}

function StoryConvexFixture({
  children,
  client
}: {
  children: ReactNode
  client: ConvexReactClient
}) {
  mocked(useConvex).mockReturnValue(client)
  mocked(useAction).mockImplementation(
    (reference) =>
      (...args) =>
        client.action(reference, ...args)
  )
  useEffect(() => () => void client.close(), [client])
  return children
}

function StoryLiveSessionTransport({
  children,
  encounterResult,
  sceneCommandRejection,
  state
}: {
  children: ReactNode
  encounterResult: EncounterCommandResultDto
  /** When set, the room rejects every Scene command as stale with this message. */
  sceneCommandRejection: string | null
  state: LiveSessionRecipientStateDto
}) {
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const originalWebSocket = globalThis.WebSocket
    const readyMessage = validated(liveSessionWebSocketServerMessageDtoSchema)({
      campaignId: tabletopCampaignId,
      type: 'TRANSIENT_READY'
    })
    const stateSyncMessage = validated(liveSessionWebSocketServerMessageDtoSchema)({
      authorityEpoch: crypto.randomUUID(),
      sequence: 1,
      state,
      type: 'STATE_SYNC'
    })
    let fogInput: SceneFogPatchInput | null = null
    class StoryWebSocket extends EventTarget {
      readyState = 0

      constructor() {
        super()
        pushStoryScene = (scene) =>
          this.dispatchEvent(
            new MessageEvent('message', {
              data: JSON.stringify(
                validated(liveSessionWebSocketServerMessageDtoSchema)({
                  ...stateSyncMessage,
                  sequence: stateSyncMessage.sequence + 1,
                  state: { ...state, scene }
                })
              )
            })
          )
        queueMicrotask(() => {
          if (this.readyState !== 0) return
          this.readyState = 1
          this.dispatchEvent(new Event('open'))
        })
      }

      close(code = 1000, reason = ''): void {
        if (this.readyState === 3) return
        this.readyState = 3
        this.dispatchEvent(new CloseEvent('close', { code, reason }))
      }

      send(data: string): void {
        const message = liveSessionWebSocketClientMessageDtoSchema.parse(JSON.parse(data))
        // The room stages a GM fog patch and reports each step's progress (D79).
        if (message.type === 'SCENE_FOG_BEGIN' || message.type === 'SCENE_FOG_APPEND') {
          if (message.type === 'SCENE_FOG_BEGIN') {
            fogBegin(message.input)
            fogInput = message.input
          } else {
            fogAppend(message.input)
            if (message.input.saveId !== storyFogSaveId)
              throw new Error('Unexpected story fog append.')
          }
          if (!fogInput) throw new Error('Story fog append arrived before its begin.')
          const progress = validated(liveSessionWebSocketServerMessageDtoSchema)({
            progress: {
              commandId: fogInput.commandId,
              receivedChunks:
                message.type === 'SCENE_FOG_APPEND'
                  ? message.input.offset + message.input.chunks.length
                  : 0,
              saveId: storyFogSaveId,
              sceneId: fogInput.sceneId,
              status: 'RECEIVING',
              totalChunks: fogInput.chunkManifest.length
            },
            type: 'SCENE_FOG_PROGRESS'
          })
          this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(progress) }))
        }
        if (message.type === 'COMMAND') {
          liveCommand(message)
          if (message.command.scope === 'SCENE' && sceneCommandRejection) {
            const rejected = validated(liveSessionWebSocketServerMessageDtoSchema)({
              code: 'STALE_STATE',
              commandId: message.command.command.commandId,
              currentSequence: message.expectedSessionSequence,
              message: sceneCommandRejection,
              reason: null,
              type: 'COMMAND_REJECTED',
              warnings: null
            })
            this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(rejected) }))
          }
          // The room acknowledges an Encounter command to its initiator, which settles the command.
          if (message.command.scope === 'ENCOUNTER') {
            const committed = validated(liveSessionWebSocketServerMessageDtoSchema)({
              commandId: message.command.command.commandId,
              delta: { scope: 'ENCOUNTER', result: encounterResult },
              sequence: message.expectedSessionSequence,
              type: 'COMMAND_COMMITTED'
            })
            this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(committed) }))
          }
          // The GM binds an Encounter to the presented Scene through the room (D47).
          if (message.command.scope === 'ENCOUNTER_BINDING' && state.scene) {
            const { command } = message.command
            const committed = validated(liveSessionWebSocketServerMessageDtoSchema)({
              commandId: command.commandId,
              delta: {
                scope: 'ENCOUNTER_BINDING',
                result: {
                  commandId: command.commandId,
                  encounterId: command.encounterId,
                  replayed: false,
                  sceneId: state.scene.id
                }
              },
              sequence: message.expectedSessionSequence + 1,
              type: 'COMMAND_COMMITTED'
            })
            this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(committed) }))
          }
        }
        if (
          message.type === 'AUTHENTICATE' &&
          message.accessToken === 'story-convex-access-token'
        ) {
          this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(readyMessage) }))
          this.dispatchEvent(
            new MessageEvent('message', { data: JSON.stringify(stateSyncMessage) })
          )
        }
        if (message.type === 'RESUME') {
          this.dispatchEvent(
            new MessageEvent('message', { data: JSON.stringify(stateSyncMessage) })
          )
        }
      }
    }

    Reflect.set(globalThis, 'WebSocket', StoryWebSocket)
    setInstalled(true)
    return () => {
      pushStoryScene = null
      Reflect.set(globalThis, 'WebSocket', originalWebSocket)
    }
  }, [encounterResult, sceneCommandRejection, state])

  return installed ? children : null
}
