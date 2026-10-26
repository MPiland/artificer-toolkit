import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect as playwrightExpect, type Page } from '@playwright/test'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterHeatMetalBrowserControls,
  EncounterHeatMetalBrowserFixture,
  HeatMetalRepeatRow
} from '../../../apis/tests/developmentEncounterHeatMetal'
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
 * Plays one player's Heat Metal on their own Character: the cast on an Ogre's Longsword, then on the next
 * turn the repeat row with its cast level and frozen DC, used as a bonus action.
 *
 * Only the player has a browser. The Ogre's turn and the dice go through the owner's API as stand-ins.
 */
export async function verifyEncounterHeatMetalBrowser(
  input: EncounterHeatMetalBrowserFixture & {
    owner: EncounterMovementAccount
    player: EncounterMovementAccount
    campaign: { id: string; publicId: string }
    evidenceDirectory: string
  },
  verify: (controls: EncounterHeatMetalBrowserControls) => Promise<void>
): Promise<void> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const diagnostics: string[] = []
  const abortedRequests = new Map<string, string>()
  const forbiddenLegacyRequests: string[] = []
  let stage = 'sign in'
  let failure: string | undefined
  let player: Page | undefined
  const submitted: ResolveEncounterActionInputDto[] = []
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

    async function selectOption(label: string, option: string | RegExp) {
      const control = page.getByRole('combobox', { name: label, exact: true })
      await expect(control).toBeEnabled()
      await control.click()
      await page.getByRole('option', { name: option }).first().click()
    }
    const repeatRow = (row: Pick<HeatMetalRepeatRow, 'label' | 'holderLabel'>) =>
      page.getByRole('listitem').filter({
        has: page.getByRole('button', { name: `Repeat ${row.label} on ${row.holderLabel}` })
      })
    async function submitAction(click: () => Promise<void>) {
      const count = commands.size
      await click()
      const { command, result } = await waitForCommand(commands, count)
      if (command.type !== 'RESOLVE_ACTION')
        throw new Error('The player submitted ' + command.type + ' instead of RESOLVE_ACTION.')
      submitted.push(command)
      return { command, result }
    }

    await verify({
      castHeatMetal: async () => {
        stage = 'cast Heat Metal on the Ogre’s Longsword'
        await page.getByRole('button', { name: 'Open actions', exact: true }).click()
        await selectOption('Action', /^Heat Metal/)
        await selectOption('Target', input.ogre.label)
        await selectOption('Item', input.itemLabel)
        await page.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/heat-metal-cast-chosen.png',
          fullPage: true
        })
        const step = await submitAction(() =>
          page.getByRole('button', { name: 'Resolve action', exact: true }).click()
        )
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
        await expect(order.locator('[aria-current="true"]')).toContainText(input.ogre.label)
        await page.getByRole('button', { name: 'Close turn order', exact: true }).click()
      },
      assertRepeatRow: async (row) => {
        stage = 'see the repeat row'
        // The Ogre's turn ends from the owner's API; the Character's turn reopens the Actions drawer.
        await expect(page.getByRole('button', { name: 'Open actions', exact: true })).toBeEnabled()
        await page.getByRole('button', { name: 'Open actions', exact: true }).click()
        const item = repeatRow(row)
        await expect(item).toBeVisible()
        await expect(item).toContainText(`cast at level ${row.castLevel}`)
        await expect(item).toContainText(`DC ${row.dc}`)
        await page.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/heat-metal-repeat-row.png',
          fullPage: true
        })
      },
      useRepeat: async (row) => {
        stage = 'use the repeat row'
        const step = await submitAction(() =>
          repeatRow(row)
            .getByRole('button', { name: `Repeat ${row.label} on ${row.holderLabel}` })
            .click()
        )
        await expect(page.getByText('Action paused for a required decision.')).toBeVisible()
        return step
      },
      assertNoRepeatRow: async () => {
        stage = 'see the repeat row gone'
        await expect(page.getByRole('button', { name: /^Repeat Heat Metal/ })).toHaveCount(0)
        await page.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/heat-metal-repeat-gone.png',
          fullPage: true
        })
      }
    })
    expect(submitted.map((command) => command.type)).toEqual(['RESOLVE_ACTION', 'RESOLVE_ACTION'])
    expect(forbiddenLegacyRequests).toEqual([])
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Heat Metal browser proof failed.'
    await Promise.allSettled([
      player?.screenshot({
        caret: 'initial',
        path: input.evidenceDirectory + '/heat-metal-failure.png',
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
      input.evidenceDirectory + '/heat-metal-diagnostics.json',
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
