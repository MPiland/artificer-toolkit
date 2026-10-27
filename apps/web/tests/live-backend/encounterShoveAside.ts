import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect as playwrightExpect, type Page } from '@playwright/test'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import type {
  EncounterShoveAsideBrowserControls,
  EncounterShoveAsideBrowserFixture
} from '../../../apis/tests/developmentEncounterShoveAside'
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

/** The GM's Shove 5 feet aside on the Scene board (MOVE-2.4, D157), from the actions drawer to the landing. */
export async function verifyEncounterShoveAsideBrowser(
  input: EncounterShoveAsideBrowserFixture & {
    owner: EncounterMovementAccount
    campaign: { id: string; publicId: string }
    evidenceDirectory: string
  },
  verify: (controls: EncounterShoveAsideBrowserControls) => Promise<void>
): Promise<void> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const diagnostics: string[] = []
  const abortedRequests = new Map<string, string>()
  const forbiddenLegacyRequests: string[] = []
  let stage = 'sign in'
  let failure: string | undefined
  let page: Page | undefined
  const submitted: string[] = []
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce'
    })
    context.setDefaultTimeout(30_000)
    const owner = await context.newPage()
    page = owner
    const session = watchAuthenticatedSession(owner)
    captureDiagnostics(owner, 'owner', () => stage, diagnostics, abortedRequests)
    captureLegacyRequests(owner, 'owner', () => stage, forbiddenLegacyRequests)
    const commands = captureEncounterCommands(owner, diagnostics, () => stage)
    await signIn(owner, input.owner, session)
    stage = 'hydrate Shove scene'
    await owner.goto(
      origin + '/tabletop/campaigns/' + encodeURIComponent(input.campaign.publicId),
      {
        waitUntil: 'domcontentloaded',
        timeout: 90_000
      }
    )
    await expect.poll(() => session.authenticated).toBe(true)
    await waitForRouterIdle(owner)
    await expect(
      owner.getByRole('region', { name: 'Live scene: ' + input.scene.name })
    ).toBeVisible({
      timeout: 90_000
    })
    await expect(owner.getByText('Scene map ready.', { exact: true })).toBeVisible()

    const map = owner.locator('canvas[aria-description]')
    // The renderer fits the map deterministically, so a square's screen point is computed.
    const screenPoint = async ({ x, y }: ScenePoint) => {
      const box = await map.boundingBox()
      if (!box) throw new Error('The scene canvas has no bounds.')
      const { width, height } = input.scene.map
      const scale = Math.min(box.width / width, box.height / height) * 0.94
      return {
        x: box.x + (box.width - width * scale) / 2 + x * scale,
        y: box.y + (box.height - height * scale) / 2 + y * scale
      }
    }
    const instruction = owner.getByRole('status').filter({
      hasText: `Pick where ${input.targetLabel} lands.`
    })
    const pendingDecision = owner.getByRole('button', {
      name: 'Open pending decision',
      exact: true
    })

    await verify({
      shoveAside: async () => {
        stage = 'use Shove aside from the actions drawer'
        await owner.getByRole('button', { name: 'Open actions', exact: true }).click()
        const basicActions = owner.getByRole('region', { name: 'Basic actions' })
        await select(owner, 'Target of shove', input.targetLabel)
        await select(owner, 'Option of shove', input.asideLabel)
        const count = commands.size
        await basicActions.getByRole('button', { name: 'Use Shove', exact: true }).click()
        const result = await waitForCommand(commands, count)
        if (result.command.type !== 'RESOLVE_ACTION')
          throw new Error('Basic actions did not submit RESOLVE_ACTION.')
        submitted.push(result.command.type)
        await owner.getByRole('button', { name: 'Close actions', exact: true }).click()
        return { command: result.command, result: result.result }
      },
      enterDice: async (faces) => {
        stage = `enter the contest faces ${faces.join(', ')}`
        await pendingDecision.click()
        const check = owner.getByRole('combobox', { name: 'Check', exact: true })
        if (await check.count()) {
          await check.click()
          await owner.getByRole('option').first().click()
        }
        for (const [index, face] of faces.entries())
          await owner.getByLabel('Die ' + (index + 1), { exact: true }).fill(String(face))
        // At disadvantage the shover enters exactly two d20s.
        await expect(owner.getByLabel('Die ' + (faces.length + 1), { exact: true })).toHaveCount(0)
        const count = commands.size
        await owner.getByRole('button', { name: 'Submit roll', exact: true }).click()
        const result = await waitForCommand(commands, count)
        if (result.command.type !== 'RESOLVE_RULE_OCCURRENCE')
          throw new Error('Decision drawer did not submit RESOLVE_RULE_OCCURRENCE.')
        submitted.push(result.command.type)
        const close = owner.getByRole('button', { name: 'Close pending decision', exact: true })
        if (await close.isVisible()) await close.click()
        return { command: result.command, result: result.result }
      },
      pickDestination: async (position) => {
        stage = 'pick where the shoved Wolf lands on the board'
        // The board asks, with no drawer: the legal squares are highlighted and the picker has focus.
        await expect(instruction).toBeVisible()
        await expect(owner.getByRole('dialog', { name: 'Pending decision' })).toHaveCount(0)
        const picker = owner
          .getByRole('region', { name: `Where ${input.targetLabel} lands` })
          .getByRole('button')
        await expect(picker).toBeFocused()
        const offered = new Set([(await picker.textContent()) ?? ''])
        for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight']) {
          await picker.press(key)
          offered.add((await picker.textContent()) ?? '')
        }
        // The squares 5 feet from the target that stay within the shover's reach, and no other.
        expect([...offered].sort()).toEqual(
          ['north', 'north-west', 'south', 'south-west'].map(
            (direction) => `Move ${input.targetLabel} 5 ft ${direction}`
          )
        )
        await owner.screenshot({
          fullPage: true,
          path: input.evidenceDirectory + '/shove-aside-destination-pick.png'
        })
        // A press outside the legal squares picks nothing.
        const count = commands.size
        const outside = await screenPoint(input.outOfReach)
        await owner.mouse.click(outside.x, outside.y)
        await owner.waitForTimeout(1_000)
        expect(commands.size).toBe(count)
        await expect(instruction).toBeVisible()
        const square = await screenPoint(position)
        await owner.mouse.click(square.x, square.y)
        const result = await waitForCommand(commands, count)
        if (result.command.type !== 'RESOLVE_RULE_OCCURRENCE')
          throw new Error('The board did not submit RESOLVE_RULE_OCCURRENCE.')
        submitted.push(result.command.type)
        await expect(instruction).toHaveCount(0)
        await expect(pendingDecision).toHaveCount(0)
        await owner.screenshot({
          fullPage: true,
          path: input.evidenceDirectory + '/shove-aside-landed.png'
        })
        return { offered: [...offered], command: result.command, result: result.result }
      }
    })
    expect(submitted).toEqual([
      'RESOLVE_ACTION',
      'RESOLVE_RULE_OCCURRENCE',
      'RESOLVE_RULE_OCCURRENCE',
      'RESOLVE_RULE_OCCURRENCE'
    ])
    expect(forbiddenLegacyRequests).toEqual([])
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Shove aside browser proof failed.'
    await page
      ?.screenshot({
        caret: 'initial',
        path: input.evidenceDirectory + '/shove-aside-failure.png',
        fullPage: true
      })
      .catch(() => undefined)
    throw error
  } finally {
    await browser.close()
    for (const diagnostic of abortedRequests.values()) diagnostics.push(diagnostic)
    const scrub = (text: string) =>
      text
        .replace(/(https?:\/\/[^?\s"'<>]+)\?[^\s"'<>]+/g, '$1?[redacted]')
        .replaceAll(input.owner.email, '[fixture email]')
        .replaceAll(input.owner.password, '[fixture password]')
    await writeFile(
      input.evidenceDirectory + '/shove-aside-diagnostics.json',
      JSON.stringify(
        {
          stage,
          failure: failure && scrub(failure),
          submitted,
          diagnostics: diagnostics.map(scrub),
          forbiddenLegacyRequests
        },
        null,
        2
      )
    )
    if (!failure) expect(diagnostics.map(scrub)).toEqual([])
  }
}

async function select(page: Page, label: string, option: string): Promise<void> {
  const control = page.getByRole('combobox', { name: label, exact: true })
  await expect(control).toBeEnabled()
  await control.click()
  await page.getByRole('option', { name: option, exact: true }).click()
}
