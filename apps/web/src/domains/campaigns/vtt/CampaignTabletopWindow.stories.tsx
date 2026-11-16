import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { http, HttpResponse } from 'msw'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaigns'
import {
  type EncounterGmProjectionDto,
  type EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { validated } from '../../../test/validatedFixture'
import {
  buildTabletopPresentations,
  createTabletopCampaign,
  tabletopCampaignId,
  tabletopConditions,
  tabletopConfirmedMorale,
  tabletopCurrentUserId,
  tabletopGmEncounter,
  tabletopLiveScene,
  tabletopPlayerEncounter
} from './CampaignTabletop.stories.fixtures'
import { pressStage } from './CampaignTabletop.stories.pointer'
import { CampaignTabletopWindow } from './CampaignTabletopWindow'
import {
  drawnToken,
  expectDrawnPresentation,
  latestStageRenderer
} from './vttSceneRenderer.assertions'
import {
  TabletopFixtures,
  liveCommand,
  mapReadyTimeoutMs,
  projectScene,
  renderWindow,
  shownScene
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

// The scene canvas's description of its tokens, once the Warden is described.
async function describedScene(page: ReturnType<typeof within>): Promise<string> {
  return waitFor(() => {
    const value = page
      .getByRole('img', { name: 'Interactive campaign scene' })
      .getAttribute('aria-description')
    if (!value?.includes('Vault Warden. Creature')) throw new Error('Tokens not yet described.')
    return value
  })
}

// VTT_UI-2 journey: the GM confirmed the Warden fled; its token says so in the canvas description
// and in its status list.
export const GmSeesMoraleOutcome: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) => renderWindow(args, createTabletopCampaign('OWNER'), null, fledWardenFixtures),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    const { presentation, wardenToken } = wardenPresentationFor(
      'OWNER',
      fledWardenFixtures.gmEncounter
    )
    await expect(presentation.statuses).toContainEqual(
      expect.objectContaining({ kind: 'MORALE', label: 'Fled' })
    )
    await expect(await describedScene(page)).toContain('Fled')
    await expectDrawnWardenPresentation('OWNER', fledWardenFixtures.gmEncounter)
    await userEvent.click(await page.findByRole('button', { name: 'Scene controls' }))
    const sceneControls = await page.findByRole('menu', { name: 'Scene controls' })
    await userEvent.hover(
      await within(sceneControls).findByRole('menuitem', { name: `Focus ${wardenToken.label}` })
    )
    const list = await page.findByRole('region', { name: `${wardenToken.label} statuses` })
    await expect(within(list).getByText('Fled')).toBeVisible()
  }
}

// VTT_UI-2 journey: in the same Run a player sees the Warden's conditions, never its health band or
// the GM's morale outcome, and sees their own Character's reaction come up.
export const PlayerSeesOnlyWhatTheyMay: Story = {
  args: {
    campaignId: tabletopCampaignId,
    currentUserId: tabletopCurrentUserId
  },
  render: (args) => renderWindow(args, createTabletopCampaign('PLAYER'), null, fledWardenFixtures),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await page.findByText('Scene map ready.', undefined, { timeout: mapReadyTimeoutMs })
    const description = await describedScene(page)
    await expect(description).toContain('Poisoned')
    await expect(description).not.toContain('Wounded')
    await expect(description).not.toContain('Fled')
    // The harness binds no actor to Ember's token; its reaction is keyed by the token.
    const scene = projectScene('PLAYER', fledWardenFixtures.liveScene)
    const emberPresentation = buildTabletopPresentations({
      actorIdByTokenId: new Map(),
      boundTokenControl: new Map(),
      currentUserId: tabletopCurrentUserId,
      encounter: fledWardenFixtures.playerEncounter,
      pending: fledWardenFixtures.pending!,
      scene
    })[emberToken.id]!
    await expect(emberPresentation.halo?.label).toBe('Reaction available')
    await expect(emberPresentation.accessibleDescription).toContain(
      `${emberToken.label}. Scene token. Reaction available`
    )
    await expect(description).toContain(emberPresentation.accessibleDescription)
    const renderer = await latestStageRenderer()
    await waitFor(async () =>
      expectDrawnPresentation(
        drawnToken(renderer.getDiagnostics(), emberToken.id),
        emberPresentation
      )
    )
    await expectDrawnWardenPresentation('PLAYER', fledWardenFixtures.playerEncounter)
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

// VTT_UI-2 journey data: the GM confirmed the Warden fled, and Ember's reaction is up as it goes.
const emberToken = presentedTokensFixtures.liveScene.tokens[0]!
const emberActorId = presentedTokensFixtures.gmEncounter.actors[0]!.id
const fledWardenFixtures: TabletopFixtures = {
  ...presentedTokensFixtures,
  gmEncounter: {
    ...presentedTokensFixtures.gmEncounter,
    actors: presentedTokensFixtures.gmEncounter.actors.map((actor) =>
      actor.id === wardenId
        ? { ...actor, morale: tabletopConfirmedMorale(wardenId, 'FLEE') }
        : actor
    )
  },
  pending: validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
    kind: 'REACTION_CHOICE',
    occurrenceId: '12121212-1212-4121-8121-121212121213',
    occurrenceVersion: 2,
    encounterVersion: tabletopGmEncounter.version,
    targetActorId: emberActorId,
    reactorTokenId: emberToken.id,
    options: [{ optionId: 'a'.repeat(64), actionId: 'opportunity-attack' }],
    allowedResponses: ['DECLINE', 'OPTION']
  })
}
