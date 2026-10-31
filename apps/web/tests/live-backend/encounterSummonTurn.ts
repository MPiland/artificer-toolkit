import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect as playwrightExpect, type Page } from '@playwright/test'
import type {
  EncounterSummonTurnBrowserControls,
  EncounterSummonTurnBrowserFixture
} from '../../../apis/tests/developmentEncounterSummonTurn'
import type { EncounterMovementAccount } from './encounterMovement'
import {
  captureDiagnostics,
  signIn,
  waitForRouterIdle,
  watchAuthenticatedSession
} from './campaignCollaboration'
import { captureLegacyRequests } from './sceneLive'
import { captureEncounterCommands } from './encounterCommandCapture'

const expect = playwrightExpect.configure({ timeout: 90_000 })
const origin = 'http://localhost:3000'

/**
 * The player ends their Character's turn and is prompted when their summon's turn starts; ending the
 * summon's turn clears the prompt.
 *
 * Only the player has a browser. The summon and the dice go through the owner's API as stand-ins.
 */
export async function verifyEncounterSummonTurnBrowser(
  input: EncounterSummonTurnBrowserFixture & {
    owner: EncounterMovementAccount
    player: EncounterMovementAccount
    campaign: { id: string; publicId: string }
    evidenceDirectory: string
  },
  verify: (controls: EncounterSummonTurnBrowserControls) => Promise<void>
): Promise<void> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const diagnostics: string[] = []
  const abortedRequests = new Map<string, string>()
  const forbiddenLegacyRequests: string[] = []
  let stage = 'sign in'
  let failure: string | undefined
  let player: Page | undefined
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
    captureEncounterCommands(page, diagnostics, () => stage)
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
    await expect(page.getByRole('button', { name: 'Open actions', exact: true })).toBeEnabled()
    const prompt = page.getByRole('status').filter({ hasText: input.summon.label + "'s turn" })

    await verify({
      endCharacterTurn: async () => {
        stage = 'end the Character turn'
        await expect(prompt).toBeHidden()
        await page.getByRole('button', { name: 'Open turn order', exact: true }).click()
        const order = page.getByLabel('Encounter turn order')
        await expect(order.locator('[aria-current="true"]')).toContainText(input.hero.label)
        await page.getByRole('button', { name: 'End turn', exact: true }).click()
        await expect(order.locator('[aria-current="true"]')).toContainText(input.summon.label)
        await page.getByRole('button', { name: 'Close turn order', exact: true }).click()
      },
      assertPromptedForSummon: async () => {
        stage = 'see the summon turn prompt'
        await expect(prompt).toBeVisible()
        await expect(prompt).toContainText(input.hero.label)
        await page.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/summon-turn-prompt.png',
          fullPage: true
        })
      },
      endSummonTurn: async () => {
        stage = 'end the summon turn'
        await page.getByRole('button', { name: 'Open turn order', exact: true }).click()
        await page.getByRole('button', { name: 'End turn', exact: true }).click()
        await expect(
          page.getByLabel('Encounter turn order').locator('[aria-current="true"]')
        ).not.toContainText(input.summon.label)
        await page.getByRole('button', { name: 'Close turn order', exact: true }).click()
        await expect(prompt).toBeHidden()
      }
    })
    expect(forbiddenLegacyRequests).toEqual([])
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Summon turn browser proof failed.'
    const warnings = await player
      ?.locator('li')
      .allInnerTexts()
      .catch(() => [])
    if (warnings?.length) failure += ' Visible list items: ' + warnings.join(' | ')
    await Promise.allSettled([
      player?.screenshot({
        caret: 'initial',
        path: input.evidenceDirectory + '/summon-turn-failure.png',
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
      input.evidenceDirectory + '/summon-turn-diagnostics.json',
      JSON.stringify(
        {
          stage,
          failure: failure && scrub(failure),
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
