import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect as playwrightExpect, type Locator, type Page } from '@playwright/test'
import type {
  MoveZoneInputDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterZoneMoveBrowserControls,
  EncounterZoneMoveBrowserFixture
} from '../../../apis/tests/developmentEncounterZoneMove'
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
 * Plays one player's zone move on their own Character: the cast of a zone spell with its origin picked on
 * the map, then the Actions drawer's zone row, a destination picked on the map and the move.
 *
 * Only the player has a browser. The dice go through the owner's API as stand-ins.
 */
export async function verifyEncounterZoneMoveBrowser(
  input: EncounterZoneMoveBrowserFixture & {
    owner: EncounterMovementAccount
    player: EncounterMovementAccount
    campaign: { id: string; publicId: string }
    evidenceDirectory: string
  },
  verify: (controls: EncounterZoneMoveBrowserControls) => Promise<void>
): Promise<void> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const diagnostics: string[] = []
  const abortedRequests = new Map<string, string>()
  const forbiddenLegacyRequests: string[] = []
  let stage = 'sign in'
  let failure: string | undefined
  let player: Page | undefined
  const submitted: Array<ResolveEncounterActionInputDto | MoveZoneInputDto> = []
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
    async function pointOnMap(at: { x: number; y: number }) {
      const bounds = await map.boundingBox()
      if (!bounds) throw new Error('The scene canvas has no bounds.')
      const scale =
        Math.min(bounds.width / input.map.width, bounds.height / input.map.height) * 0.94
      return {
        x: bounds.x + (bounds.width - input.map.width * scale) / 2 + at.x * scale,
        y: bounds.y + (bounds.height - input.map.height * scale) / 2 + at.y * scale
      }
    }
    const actionsDrawer = page.getByRole('dialog', { name: 'Actions', exact: true })
    async function openActions() {
      if (await actionsDrawer.isVisible()) return
      await page.getByRole('button', { name: 'Open actions', exact: true }).click()
      await expect(actionsDrawer).toBeVisible()
    }
    const zoneChoices = page.getByRole('region', { name: 'Zone choices', exact: true })
    const zoneRow = (label: string) =>
      zoneChoices.getByRole('listitem').filter({ hasText: `Move ${label}` })
    /** The drawer leaves for the map pick and returns with the point chosen. */
    async function pickOnMap(pickButton: Locator, at: { x: number; y: number }) {
      await pickButton.click()
      await expect(actionsDrawer).toBeHidden()
      const point = await pointOnMap(at)
      await page.mouse.move(point.x, point.y)
      await page.mouse.click(point.x, point.y)
      await expect(actionsDrawer).toBeVisible()
    }
    async function submit<TCommand extends ResolveEncounterActionInputDto | MoveZoneInputDto>(
      type: TCommand['type'],
      click: () => Promise<void>
    ) {
      const count = commands.size
      await click()
      const { command, result } = await waitForCommand(commands, count)
      if (command.type !== type)
        throw new Error('The player submitted ' + command.type + ' instead of ' + type + '.')
      submitted.push(command as TCommand)
      return { command: command as TCommand, result }
    }

    await verify({
      castZone: async () => {
        stage = 'cast ' + input.spellLabel
        await openActions()
        const action = page.getByRole('combobox', { name: 'Action', exact: true })
        await expect(action).toBeEnabled()
        await action.click()
        await page
          .getByRole('option', { name: new RegExp('^' + input.spellLabel) })
          .first()
          .click()
        await expect(page.getByText('Area origin', { exact: true })).toBeVisible()
        await pickOnMap(
          page.getByRole('button', { name: 'Pick on map', exact: true }),
          input.castAt
        )
        await expect(page.getByText('Area origin', { exact: true })).toBeVisible()
        await page.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/zone-move-cast-chosen.png',
          fullPage: true
        })
        const step = await submit<ResolveEncounterActionInputDto>('RESOLVE_ACTION', () =>
          page.getByRole('button', { name: 'Resolve action', exact: true }).click()
        )
        await page.getByRole('button', { name: 'Close actions', exact: true }).click()
        await expect(actionsDrawer).toBeHidden()
        return step
      },
      assertZoneRow: async (row) => {
        stage = 'see the zone row'
        await openActions()
        await expect(zoneChoices).toBeVisible()
        const item = zoneRow(row.label)
        await expect(item).toBeVisible()
        await expect(item).toContainText(row.activationLabel)
        await expect(item).toContainText('up to ' + row.distanceLabel)
        await page.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/zone-move-row.png',
          fullPage: true
        })
      },
      moveZone: async (row) => {
        stage = 'move the zone'
        await openActions()
        const item = zoneRow(row.label)
        await item.getByRole('button', { name: `Move ${row.label}`, exact: true }).click()
        await expect(item).toContainText('Pick the zone’s new center.')
        await pickOnMap(
          item.getByRole('button', { name: 'Pick on map', exact: true }),
          input.moveTo
        )
        await expect(item).toContainText('New center picked.')
        await page.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/zone-move-picked.png',
          fullPage: true
        })
        const step = await submit<MoveZoneInputDto>('MOVE_ZONE', () =>
          item.getByRole('button', { name: 'Move', exact: true }).click()
        )
        // The move spends the Bonus Action, so the choices reload and the row now warns of it.
        await expect(item).toContainText('No bonus action left this turn.')
        await expect(item.getByRole('button', { name: 'Move', exact: true })).toHaveCount(0)
        await page.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/zone-move-moved.png',
          fullPage: true
        })
        return step
      }
    })
    expect(submitted.map((command) => command.type)).toEqual(['RESOLVE_ACTION', 'MOVE_ZONE'])
    expect(forbiddenLegacyRequests).toEqual([])
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Zone move browser proof failed.'
    const warnings = await player
      ?.locator('li')
      .allInnerTexts()
      .catch(() => [])
    if (warnings?.length) failure += ' Visible list items: ' + warnings.join(' | ')
    await Promise.allSettled([
      player?.screenshot({
        caret: 'initial',
        path: input.evidenceDirectory + '/zone-move-failure.png',
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
      input.evidenceDirectory + '/zone-move-diagnostics.json',
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
