import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect as playwrightExpect, type Page } from '@playwright/test'
import type {
  MoveHeldEffectInputDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterHeldEffectBrowserControls,
  EncounterHeldEffectBrowserFixture
} from '../../../apis/tests/developmentEncounterHeldEffect'
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
 * Plays one player's Hunter's Mark on their own Character: the cast on a creature, then, with that creature
 * at 0 hit points, the move offer in the Actions drawer, answered by picking the next holder on the map.
 *
 * Only the player has a browser. The creatures' turns, the damage and the GM's undo go through the owner's API.
 */
export async function verifyEncounterHeldEffectBrowser(
  input: EncounterHeldEffectBrowserFixture & {
    owner: EncounterMovementAccount
    player: EncounterMovementAccount
    campaign: { id: string; publicId: string }
    evidenceDirectory: string
  },
  verify: (controls: EncounterHeldEffectBrowserControls) => Promise<void>
): Promise<void> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const diagnostics: string[] = []
  const abortedRequests = new Map<string, string>()
  const forbiddenLegacyRequests: string[] = []
  let stage = 'sign in'
  let failure: string | undefined
  let player: Page | undefined
  const submitted: Array<ResolveEncounterActionInputDto | MoveHeldEffectInputDto> = []
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
    const actionsDrawer = page.getByRole('dialog', { name: 'Actions', exact: true })
    async function openActions() {
      if (await actionsDrawer.isVisible()) return
      await page.getByRole('button', { name: 'Open actions', exact: true }).click()
      await expect(actionsDrawer).toBeVisible()
    }
    const offerButton = (holderLabel: string) =>
      page.getByRole('button', { name: `Move effect on ${holderLabel}`, exact: true })
    async function selectOption(label: string, option: string | RegExp) {
      const control = page.getByRole('combobox', { name: label, exact: true })
      await expect(control).toBeEnabled()
      await control.click()
      await page.getByRole('option', { name: option }).first().click()
    }
    async function submit<TCommand extends ResolveEncounterActionInputDto | MoveHeldEffectInputDto>(
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
      castHuntersMark: async () => {
        stage = 'cast Hunter’s Mark'
        await openActions()
        await selectOption('Action', /^Hunter.s Mark/)
        await selectOption('Target', input.marked.label)
        const step = await submit<ResolveEncounterActionInputDto>('RESOLVE_ACTION', () =>
          page.getByRole('button', { name: 'Resolve action', exact: true }).click()
        )
        await page.getByRole('button', { name: 'Close actions', exact: true }).click()
        await expect(actionsDrawer).toBeHidden()
        return step
      },
      endTurn: async () => {
        stage = 'end the player turn'
        await page.getByRole('button', { name: 'Open turn order', exact: true }).click()
        const order = page.getByLabel('Encounter turn order')
        await expect(order.locator('[aria-current="true"]')).toContainText(input.hero.label)
        await page.getByRole('button', { name: 'End turn', exact: true }).click()
        await expect(order.locator('[aria-current="true"]')).not.toContainText(input.hero.label)
        await page.getByRole('button', { name: 'Close turn order', exact: true }).click()
      },
      assertOfferRow: async ({ holderLabel }) => {
        stage = 'see the move offer'
        // The turn returns from the owner's API; the Actions drawer then lists the offer.
        await expect(page.getByRole('button', { name: 'Open actions', exact: true })).toBeEnabled()
        await openActions()
        await expect(page.getByRole('heading', { name: 'Effect choices' })).toBeVisible()
        await expect(offerButton(holderLabel)).toBeVisible()
        await page.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/held-effect-offer-row.png',
          fullPage: true
        })
      },
      assertNoOfferRow: async () => {
        stage = 'see the move offer gone'
        await openActions()
        await expect(page.getByRole('button', { name: /^Move effect on / })).toHaveCount(0)
        await page.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/held-effect-offer-gone.png',
          fullPage: true
        })
        await page.getByRole('button', { name: 'Close actions', exact: true }).click()
        await expect(actionsDrawer).toBeHidden()
      },
      moveToPickedOnMap: async () => {
        stage = 'pick the next holder on the map'
        await openActions()
        await page.getByRole('button', { name: /^Move effect on / }).click()
        await page.getByRole('button', { name: 'Pick on map', exact: true }).click()
        await expect(page.getByRole('dialog', { name: 'Pick a target' })).toBeVisible()
        const next = await pointOnMap(input.next.x + 12, input.next.y + 12)
        // Hovering first lets the renderer hit-test the token; it then names the creature and its distance.
        await page.mouse.move(next.x, next.y)
        await expect(
          page.getByRole('status').filter({ hasText: input.next.label + ': ' })
        ).toContainText(/\d+(\.\d)? ft/)
        await expect(actionsDrawer).toBeHidden()
        await page.mouse.click(next.x, next.y)
        await expect(page.getByRole('dialog', { name: 'Pick a target' })).toBeHidden()
        await openActions()
        await expect(page.getByRole('combobox', { name: 'New holder' })).toHaveValue(
          input.next.label
        )
        await page.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/held-effect-holder-picked.png',
          fullPage: true
        })
        const step = await submit<MoveHeldEffectInputDto>('MOVE_HELD_EFFECT', () =>
          page.getByRole('button', { name: 'Move', exact: true }).click()
        )
        await expect(page.getByText('Effect moved.', { exact: true })).toBeVisible()
        return step
      }
    })
    expect(submitted.map((command) => command.type)).toEqual(['RESOLVE_ACTION', 'MOVE_HELD_EFFECT'])
    expect(forbiddenLegacyRequests).toEqual([])
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Held effect browser proof failed.'
    const warnings = await player
      ?.locator('li')
      .allInnerTexts()
      .catch(() => [])
    if (warnings?.length) failure += ' Visible list items: ' + warnings.join(' | ')
    await Promise.allSettled([
      player?.screenshot({
        caret: 'initial',
        path: input.evidenceDirectory + '/held-effect-failure.png',
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
      input.evidenceDirectory + '/held-effect-diagnostics.json',
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
