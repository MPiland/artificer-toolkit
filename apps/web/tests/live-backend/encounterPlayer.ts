import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect as playwrightExpect, type Page } from '@playwright/test'
import type {
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterPlayerBrowserControls,
  EncounterPlayerBrowserFixture
} from '../../../apis/tests/developmentEncounterPlayer'
import type { EncounterMovementAccount } from './encounterMovement'
import {
  captureDiagnostics,
  signIn,
  waitForRouterIdle,
  watchAuthenticatedSession
} from './campaignCollaboration'
import { captureLegacyRequests } from './sceneLive'
import { captureEncounterCommands, waitForCommand } from './encounterCommandCapture'

const expect = playwrightExpect.configure({ timeout: 90_000 })
const origin = 'http://localhost:3000'

/**
 * Plays one player's turns on their own Character with no GM step: a Club attack on a Wolf picked from
 * the map, a Shield reaction, a Thunderwave aimed on the map, and a death save.
 *
 * Only the player has a browser. The Wolf's turns and the dice it rolls go through the owner's API as
 * stand-ins (see the fixture): the acceptance criterion is that the player's own actions need no GM step,
 * so the GM's side is not driven through a second browser here.
 */
export async function verifyEncounterPlayerBrowser(
  input: EncounterPlayerBrowserFixture & {
    owner: EncounterMovementAccount
    player: EncounterMovementAccount
    campaign: { id: string; publicId: string }
    evidenceDirectory: string
  },
  verify: (controls: EncounterPlayerBrowserControls) => Promise<void>
): Promise<void> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const diagnostics: string[] = []
  const abortedRequests = new Map<string, string>()
  const forbiddenLegacyRequests: string[] = []
  let stage = 'sign in'
  let failure: string | undefined
  let player: Page | undefined
  const submitted: Array<ResolveEncounterActionInputDto | ResolveRuleOccurrenceInputDto> = []
  try {
    const playerContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce'
    })
    playerContext.setDefaultTimeout(30_000)
    const page = await playerContext.newPage()
    player = page
    const session = watchAuthenticatedSession(page)
    captureDiagnostics(page, 'player', () => stage, diagnostics, abortedRequests)
    captureLegacyRequests(page, 'player', () => stage, forbiddenLegacyRequests)
    const commands = captureEncounterCommands(page, diagnostics, () => stage)
    await signIn(page, input.player, session)
    session.authenticated = false
    await page.goto(origin + '/tabletop/campaigns/' + encodeURIComponent(input.campaign.publicId), {
      waitUntil: 'domcontentloaded',
      timeout: 90_000
    })
    await expect.poll(() => session.authenticated).toBe(true)
    await waitForRouterIdle(page)
    stage = 'hydrate player scene'
    await expect(page.getByRole('region', { name: 'Live scene: ' + input.scene.name })).toBeVisible(
      { timeout: 90_000 }
    )
    await expect(page.getByText('Scene map ready.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open actions', exact: true })).toBeVisible()

    const map = page.locator('canvas[aria-description]')
    // The same fit the renderer uses: the scene is centred in the canvas at 94% of the largest fit.
    async function pointOnMap(x: number, y: number) {
      const bounds = await map.boundingBox()
      if (!bounds) throw new Error('The scene canvas has no bounds.')
      const scale =
        Math.min(bounds.width / input.map.width, bounds.height / input.map.height) * 0.94
      return {
        x: bounds.x + (bounds.width - input.map.width * scale) / 2 + x * scale,
        y: bounds.y + (bounds.height - input.map.height * scale) / 2 + y * scale
      }
    }
    const decisionDrawer = page.getByRole('dialog', { name: 'Pending decision' })
    async function openDecision() {
      if (await decisionDrawer.isVisible()) return
      await page.getByRole('button', { name: 'Open pending decision', exact: true }).click()
      await expect(decisionDrawer).toBeVisible()
    }
    async function submitAction(click: () => Promise<void>) {
      const count = commands.size
      await click()
      const { command, result } = await waitForCommand(commands, count)
      if (command.type !== 'RESOLVE_ACTION')
        throw new Error('The player submitted ' + command.type + ' instead of RESOLVE_ACTION.')
      submitted.push(command)
      return { command, result }
    }
    async function submitDecision(click: () => Promise<void>) {
      const count = commands.size
      await click()
      const { command, result } = await waitForCommand(commands, count)
      if (command.type !== 'RESOLVE_RULE_OCCURRENCE')
        throw new Error(
          'The player submitted ' + command.type + ' instead of RESOLVE_RULE_OCCURRENCE.'
        )
      submitted.push(command)
      return { command, result }
    }
    async function openAction(label: RegExp) {
      await page.getByRole('button', { name: 'Open actions', exact: true }).click()
      const control = page.getByRole('combobox', { name: 'Action', exact: true })
      await expect(control).toBeEnabled()
      await control.click()
      await page.getByRole('option', { name: label }).first().click()
    }
    const resolveAction = () =>
      submitAction(() => page.getByRole('button', { name: 'Resolve action', exact: true }).click())

    await verify({
      attackWolfFromMap: async () => {
        stage = 'attack the Wolf picked from the map'
        await openAction(/^Club/)
        await page.getByRole('button', { name: 'Pick on map', exact: true }).click()
        await expect(page.getByRole('dialog', { name: 'Pick a target' })).toBeVisible()
        const wolf = await pointOnMap(input.wolf.x + 12, input.wolf.y + 12)
        // Hovering first lets the renderer hit-test the token; it then names the Wolf and its distance.
        await page.mouse.move(wolf.x, wolf.y)
        await expect(
          page.getByRole('status').filter({ hasText: input.wolf.label + ': ' })
        ).toContainText(/\d+(\.\d)? ft/)
        // The Actions drawer's overlay lingers while it closes, and a press on it would dismiss the drawer.
        await expect(page.getByRole('dialog', { name: 'Actions', exact: true })).toBeHidden()
        await page.mouse.click(wolf.x, wolf.y)
        // A map pick closes the targeting drawer and fills the action's Target.
        await expect(page.getByRole('dialog', { name: 'Pick a target' })).toBeHidden()
        await expect(page.getByRole('combobox', { name: 'Target', exact: true })).toHaveValue(
          input.wolf.label
        )
        await page.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/player-wolf-picked-from-map.png',
          fullPage: true
        })
        const step = await resolveAction()
        await expect(
          page.getByText('Action paused for a required decision.', { exact: true })
        ).toBeVisible()
        await page.getByRole('button', { name: 'Close actions', exact: true }).click()
        return step
      },
      answerEvidence: async (value) => {
        stage = 'answer the evidence ' + value
        await openDecision()
        const entry = decisionDrawer.getByLabel(/^(Die 1|Result)$/)
        // A fresh row mounts empty for each new request, so a typed value is a stale one.
        await expect(entry).toHaveValue('')
        await entry.fill(String(value))
        return submitDecision(() =>
          decisionDrawer.getByRole('button', { name: 'Submit roll', exact: true }).click()
        )
      },
      useReaction: async () => {
        stage = 'use the offered reaction'
        await openDecision()
        await expect(decisionDrawer.getByText('Reaction', { exact: false }).first()).toBeVisible()
        await page.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/player-reaction-offered.png',
          fullPage: true
        })
        return submitDecision(() =>
          decisionDrawer.getByRole('button', { name: 'Use reaction', exact: true }).click()
        )
      },
      castThunderwaveFromMap: async () => {
        stage = 'aim Thunderwave on the map'
        await openAction(/^Thunderwave/)
        await expect(page.getByText('Area direction', { exact: true })).toBeVisible()
        await page.getByRole('button', { name: 'Aim on map', exact: true }).click()
        await expect(page.getByText('Area direction', { exact: true })).toBeHidden()
        // Press on the caster's side facing the Wolf and drag toward it: the renderer snaps the origin
        // to the caster's nearest edge, and the aim is only valid when it points away from the token.
        const from = await pointOnMap(input.hero.x + 40, input.hero.y + 25)
        const toward = await pointOnMap(input.wolf.x + 12, input.wolf.y + 12)
        await page.mouse.move(from.x, from.y)
        await page.mouse.down()
        await page.mouse.move(toward.x, toward.y, { steps: 10 })
        await page.mouse.up()
        await expect(page.getByText('Area direction', { exact: true })).toBeVisible()
        await expect(page.getByText(/^In the area:/)).toContainText(input.wolf.label)
        await page.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/player-thunderwave-aimed.png',
          fullPage: true
        })
        const step = await resolveAction()
        await expect(
          page.getByText('Action paused for a required decision.', { exact: true })
        ).toBeVisible()
        await page.getByRole('button', { name: 'Close actions', exact: true }).click()
        return step
      },
      endTurn: async () => {
        stage = 'end the player turn'
        await page.getByRole('button', { name: 'Open turn order', exact: true }).click()
        const order = page.getByLabel('Encounter turn order')
        await expect(order.locator('[aria-current="true"]')).toContainText(input.hero.label)
        await page.getByRole('button', { name: 'End turn', exact: true }).click()
        await expect(order.locator('[aria-current="true"]')).toContainText(input.wolf.label)
        await page.getByRole('button', { name: 'Close turn order', exact: true }).click()
      },
      assertDeathSaveOffered: async () => {
        stage = 'verify the death save is offered'
        await openDecision()
        await expect(decisionDrawer.getByText('Death save', { exact: true })).toBeVisible()
        await page.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/player-death-save.png',
          fullPage: true
        })
      }
    })
    expect(submitted.map((command) => command.type)).toEqual([
      'RESOLVE_ACTION',
      'RESOLVE_RULE_OCCURRENCE',
      'RESOLVE_RULE_OCCURRENCE',
      'RESOLVE_RULE_OCCURRENCE',
      'RESOLVE_ACTION',
      'RESOLVE_RULE_OCCURRENCE',
      'RESOLVE_RULE_OCCURRENCE'
    ])
    expect(forbiddenLegacyRequests).toEqual([])
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Player browser proof failed.'
    await Promise.allSettled([
      player?.screenshot({
        caret: 'initial',
        path: input.evidenceDirectory + '/player-failure.png',
        fullPage: true
      })
    ])
    throw error
  } finally {
    await browser.close()
    for (const diagnostic of abortedRequests.values()) diagnostics.push(diagnostic)
    const scrub = (text: string) => {
      let clean = text.replace(/(https?:\/\/[^?\s"'<>]+)\?[^\s"'<>]+/g, '$1?[redacted]')
      for (const account of [input.owner, input.player])
        clean = clean
          .replaceAll(account.email, '[fixture email]')
          .replaceAll(account.password, '[fixture password]')
      return clean
    }
    await writeFile(
      input.evidenceDirectory + '/player-diagnostics.json',
      JSON.stringify(
        {
          stage,
          failure: failure && scrub(failure),
          submitted: submitted.map((command) => command.type),
          diagnostics: diagnostics.map(scrub),
          forbiddenLegacyRequests
        },
        null,
        2
      )
    )
    if (!failure) {
      expect(diagnostics.map(scrub)).toEqual([])
      expect(forbiddenLegacyRequests).toEqual([])
    }
  }
}
