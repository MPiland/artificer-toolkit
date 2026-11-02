import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect as playwrightExpect, type Page } from '@playwright/test'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterConcentrationSheetBrowserControls,
  EncounterConcentrationSheetBrowserFixture
} from '../../../apis/tests/developmentEncounterConcentrationSheet'
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

/** A spell name as the page shows it: the apostrophe may be straight or curly. */
const spellText = (label: string) =>
  new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace("'", '.'))

/**
 * Plays one player's two Concentrations: Hunter's Mark and Shield of Faith cast from the scene, then the
 * Character's Sheet, which lists each and ends the one the player picks (SPELLS-12.3).
 *
 * Only the player has a browser. The creatures' turns go through the owner's API.
 */
export async function verifyEncounterConcentrationSheetBrowser(
  input: EncounterConcentrationSheetBrowserFixture & {
    owner: EncounterMovementAccount
    player: EncounterMovementAccount
    campaign: { id: string; publicId: string }
    evidenceDirectory: string
  },
  verify: (controls: EncounterConcentrationSheetBrowserControls) => Promise<void>
): Promise<void> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const diagnostics: string[] = []
  const abortedRequests = new Map<string, string>()
  const forbiddenLegacyRequests: string[] = []
  let stage = 'sign in'
  let failure: string | undefined
  let player: Page | undefined
  let sheet: Page | undefined
  const submitted: Array<ResolveEncounterActionInputDto> = []
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

    const actionsDrawer = page.getByRole('dialog', { name: 'Actions', exact: true })
    async function openActions() {
      if (await actionsDrawer.isVisible()) return
      await page.getByRole('button', { name: 'Open actions', exact: true }).click()
      await expect(actionsDrawer).toBeVisible()
    }
    async function selectOption(label: string, option: string | RegExp) {
      const control = page.getByRole('combobox', { name: label, exact: true })
      await expect(control).toBeEnabled()
      await control.click()
      await page.getByRole('option', { name: option }).first().click()
    }
    // The Sheet is its own page in the same signed-in context; the room pushes it while the Run holds the Character.
    async function openSheet() {
      if (sheet) return sheet
      sheet = await playerContext.newPage()
      captureDiagnostics(sheet, 'player', () => stage, diagnostics, abortedRequests)
      await sheet.goto(origin + '/characters/' + encodeURIComponent(input.characterPublicId), {
        waitUntil: 'domcontentloaded',
        timeout: 90_000
      })
      return sheet
    }

    await verify({
      cast: async (spell, targetLabel) => {
        stage = 'cast ' + spell.source
        await page.bringToFront()
        await openActions()
        await selectOption('Action', spell)
        await selectOption('Target', targetLabel)
        const count = commands.size
        await page.getByRole('button', { name: 'Resolve action', exact: true }).click()
        const { command, result } = await waitForCommand(commands, count)
        if (command.type !== 'RESOLVE_ACTION')
          throw new Error('The player submitted ' + command.type + ' instead of RESOLVE_ACTION.')
        submitted.push(command)
        await page.getByRole('button', { name: 'Close actions', exact: true }).click()
        await expect(actionsDrawer).toBeHidden()
        return { command, result }
      },
      endTurn: async () => {
        stage = 'end the player turn'
        await page.bringToFront()
        await page.getByRole('button', { name: 'Open turn order', exact: true }).click()
        const order = page.getByLabel('Encounter turn order')
        await expect(order.locator('[aria-current="true"]')).toContainText(input.hero.label)
        await page.getByRole('button', { name: 'End turn', exact: true }).click()
        await expect(order.locator('[aria-current="true"]')).not.toContainText(input.hero.label)
        await page.getByRole('button', { name: 'Close turn order', exact: true }).click()
      },
      assertSheetConcentrations: async (spellLabels) => {
        stage = 'see the Sheet Concentrations'
        const view = await openSheet()
        await view.bringToFront()
        const rows = view.getByRole('list', { name: 'Concentrations' }).getByRole('listitem')
        await expect(rows).toHaveCount(spellLabels.length)
        for (const label of spellLabels)
          await expect(rows.filter({ hasText: spellText(label) })).toHaveCount(1)
        await view.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + `/concentration-sheet-${spellLabels.length}.png`,
          fullPage: true
        })
      },
      endOnSheet: async (spellLabel) => {
        stage = 'end ' + spellLabel + ' on the Sheet'
        const view = await openSheet()
        await view.bringToFront()
        const row = view
          .getByRole('list', { name: 'Concentrations' })
          .getByRole('listitem')
          .filter({ hasText: spellText(spellLabel) })
        await row.getByRole('button', { name: /^End Concentration/ }).click()
      }
    })
    expect(submitted.map((command) => command.type)).toEqual(['RESOLVE_ACTION', 'RESOLVE_ACTION'])
    expect(forbiddenLegacyRequests).toEqual([])
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Concentration Sheet browser proof failed.'
    const statuses = await player
      ?.getByRole('status')
      .allInnerTexts()
      .catch(() => [])
    if (statuses?.length) failure += ' Statuses: ' + statuses.join(' | ')
    const sheetRows = await sheet
      ?.getByRole('list', { name: 'Concentrations' })
      .allInnerTexts()
      .catch(() => [])
    if (sheetRows?.length) failure += ' Sheet Concentrations: ' + sheetRows.join(' | ')
    await Promise.allSettled([
      player?.screenshot({
        caret: 'initial',
        path: input.evidenceDirectory + '/concentration-sheet-failure.png',
        fullPage: true
      }),
      sheet?.screenshot({
        caret: 'initial',
        path: input.evidenceDirectory + '/concentration-sheet-page-failure.png',
        fullPage: true
      })
    ])
    throw new Error(failure, { cause: error })
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
      input.evidenceDirectory + '/concentration-sheet-diagnostics.json',
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
