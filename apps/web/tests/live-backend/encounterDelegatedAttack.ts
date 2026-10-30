import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect as playwrightExpect, type Page } from '@playwright/test'
import type {
  EncounterDelegatedAttackBrowserControls,
  EncounterDelegatedAttackBrowserFixture
} from '../../../apis/tests/developmentEncounterDelegatedAttack'
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
 * The player, on their Character's turn, picks their familiar's attack from their own Actions drawer.
 *
 * Only the player has a browser. The summon, the turns and the dice go through the owner's API as stand-ins.
 */
export async function verifyEncounterDelegatedAttackBrowser(
  input: EncounterDelegatedAttackBrowserFixture & {
    owner: EncounterMovementAccount
    player: EncounterMovementAccount
    campaign: { id: string; publicId: string }
    evidenceDirectory: string
  },
  verify: (controls: EncounterDelegatedAttackBrowserControls) => Promise<void>
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
    const openActions = page.getByRole('button', { name: 'Open actions', exact: true })
    await expect(openActions).toBeEnabled()

    async function selectOption(label: string, option: string | RegExp) {
      const control = page.getByRole('combobox', { name: label, exact: true })
      await expect(control).toBeEnabled()
      await control.click()
      await page.getByRole('option', { name: option }).first().click()
    }

    await verify({
      attackWithFamiliar: async () => {
        stage = 'pick the familiar’s attack'
        await openActions.click()
        await selectOption('Action', /Claws/)
        await selectOption('Target', input.target.label)
        await page.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/delegated-attack-chosen.png',
          fullPage: true
        })
        const count = commands.size
        await page.getByRole('button', { name: 'Resolve action', exact: true }).click()
        const { command, result } = await waitForCommand(commands, count)
        if (command.type !== 'RESOLVE_ACTION')
          throw new Error('The player submitted ' + command.type + ' instead of RESOLVE_ACTION.')
        return { command, result }
      },
      assertAttackGone: async () => {
        stage = 'see the attack gone'
        const control = page.getByRole('combobox', { name: 'Action', exact: true })
        await expect(control).toBeEnabled()
        await control.click()
        await expect(page.getByRole('option', { name: /Claws/ })).toHaveCount(0)
        await page.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/delegated-attack-gone.png',
          fullPage: true
        })
      }
    })
    expect(forbiddenLegacyRequests).toEqual([])
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Delegated attack browser proof failed.'
    const warnings = await player
      ?.locator('li')
      .allInnerTexts()
      .catch(() => [])
    if (warnings?.length) failure += ' Visible list items: ' + warnings.join(' | ')
    await Promise.allSettled([
      player?.screenshot({
        caret: 'initial',
        path: input.evidenceDirectory + '/delegated-attack-failure.png',
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
      input.evidenceDirectory + '/delegated-attack-diagnostics.json',
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
