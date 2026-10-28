import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect as playwrightExpect, type Page } from '@playwright/test'
import type {
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterDisarmBrowserControls,
  EncounterDisarmBrowserFixture
} from '../../../apis/tests/developmentEncounterDisarm'
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

export async function verifyEncounterDisarmBrowser(
  input: EncounterDisarmBrowserFixture & {
    owner: EncounterMovementAccount
    player: EncounterMovementAccount
    campaign: { id: string; publicId: string }
    evidenceDirectory: string
  },
  verify: (controls: EncounterDisarmBrowserControls) => Promise<void>
): Promise<void> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const diagnostics: string[] = []
  const abortedRequests = new Map<string, string>()
  const forbiddenLegacyRequests: string[] = []
  let stage = 'sign in'
  let failure: string | undefined
  let owner: Page | undefined
  let player: Page | undefined
  const submitted: Array<{
    actor: 'OWNER' | 'PLAYER'
    command: ResolveEncounterActionInputDto | ResolveRuleOccurrenceInputDto
  }> = []
  try {
    const ownerContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce'
    })
    const playerContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce'
    })
    ownerContext.setDefaultTimeout(30_000)
    playerContext.setDefaultTimeout(30_000)
    const ownerPage = await ownerContext.newPage()
    const playerPage = await playerContext.newPage()
    owner = ownerPage
    player = playerPage
    const ownerSession = watchAuthenticatedSession(ownerPage)
    const playerSession = watchAuthenticatedSession(playerPage)
    for (const [role, page] of [
      ['owner', ownerPage],
      ['player', playerPage]
    ] as const) {
      captureDiagnostics(page, role, () => stage, diagnostics, abortedRequests)
      captureLegacyRequests(page, role, () => stage, forbiddenLegacyRequests)
    }
    const ownerCommands = captureEncounterCommands(ownerPage, diagnostics, () => stage)
    const playerCommands = captureEncounterCommands(playerPage, diagnostics, () => stage)
    await Promise.all([
      signIn(ownerPage, input.owner, ownerSession),
      signIn(playerPage, input.player, playerSession)
    ])
    const tabletopUrl =
      origin + '/tabletop/campaigns/' + encodeURIComponent(input.campaign.publicId)
    async function open(page: Page, session: { authenticated: boolean }, reload = false) {
      session.authenticated = false
      if (reload) await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 })
      else await page.goto(tabletopUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      await expect.poll(() => session.authenticated).toBe(true)
      await waitForRouterIdle(page)
      await expect(
        page.getByRole('region', { name: 'Live scene: ' + input.scene.name })
      ).toBeVisible({ timeout: 90_000 })
      await expect(page.getByText('Scene map ready.', { exact: true })).toBeVisible()
    }
    stage = 'hydrate Disarm scene'
    await Promise.all([open(ownerPage, ownerSession), open(playerPage, playerSession)])
    await expect(ownerPage.getByRole('button', { name: 'Open actions', exact: true })).toBeVisible()
    await expect(playerPage.getByRole('button', { name: 'Open actions', exact: true })).toHaveCount(
      0
    )

    await verify({
      resolveAction: async () => {
        stage = 'select Disarm through actions'
        await ownerPage.getByRole('button', { name: 'Open actions', exact: true }).click()
        const { attackSlot, label, sourceLabel } = input.action
        // The Creature holds the weapon, so the drawer starts on its attack (D107); choosing the
        // selected option again would clear it. Tab closes the list and keeps the selection.
        const actionControl = ownerPage.getByRole('combobox', { name: 'Action', exact: true })
        await expect(actionControl).toBeEnabled()
        await actionControl.click()
        // An Attack action's option also names its slot (D93), e.g. "Bite" over "Attack 1 of 1".
        await expect(
          ownerPage.getByRole('option', {
            name:
              (sourceLabel ? label + ' · ' + sourceLabel : label) +
              (attackSlot ? ` Attack ${attackSlot.number} of ${attackSlot.total}` : ''),
            exact: true,
            selected: true
          })
        ).toBeVisible()
        await actionControl.press('Tab')
        stage = 'pick the Disarm target on the map'
        const map = ownerPage.locator('canvas[aria-description]')
        const targetingTitle = ownerPage.getByText('Pick a target', { exact: true })
        const targetButton = ownerPage.getByRole('button', {
          name: 'Target ' + input.targetLabel,
          exact: true
        })
        // Escape leaves targeting with nothing picked: the action drawer returns.
        await ownerPage.getByRole('button', { name: 'Pick on map', exact: true }).click()
        await expect(targetingTitle).toBeVisible()
        await expect(targetButton).toHaveAttribute('aria-pressed', 'false')
        await map.press('Escape')
        await expect(targetingTitle).toBeHidden()
        await expect(ownerPage.getByRole('combobox', { name: 'Target', exact: true })).toHaveValue(
          ''
        )
        // The renderer fits the map deterministically, so the defender's screen point is computed.
        await ownerPage.getByRole('button', { name: 'Pick on map', exact: true }).click()
        await expect(targetingTitle).toBeVisible()
        const box = await map.boundingBox()
        if (!box) throw new Error('The scene canvas has no bounds.')
        const { map: size, targetPosition } = input.scene
        const scale = Math.min(box.width / size.width, box.height / size.height) * 0.94
        const point = {
          x: box.x + (box.width - size.width * scale) / 2 + targetPosition.x * scale,
          y: box.y + (box.height - size.height * scale) / 2 + targetPosition.y * scale
        }
        // Hovering shows the distance, the reach and what the Character believes about the roll.
        await ownerPage.mouse.move(point.x, point.y)
        await expect(
          ownerPage.getByRole('status').filter({ hasText: input.targetLabel + ': ' })
        ).toContainText(/\d+(\.\d)? ft · In range/)
        // The canvas draws the range ring and the highlighted targets; the review evidence shows them.
        await ownerPage.screenshot({
          fullPage: true,
          path: input.evidenceDirectory + '/disarm-owner-targeting.png'
        })
        await ownerPage.mouse.click(point.x, point.y)
        await expect(targetingTitle).toBeHidden()
        await expect(ownerPage.getByRole('combobox', { name: 'Target', exact: true })).toHaveValue(
          input.targetLabel
        )
        await select(ownerPage, 'Optional rule', input.optionalChoices.label)
        for (const field of input.optionalChoices.fields) {
          const selected = input.command.optionalCombatIntent?.selections.find(
            (selection) => selection.fieldId === field.fieldId
          )
          if (selected?.value.kind !== 'ENTITY')
            throw new Error('Missing Disarm fixture selection.')
          const entityId = selected.value.entityId
          const option = field.options.find((entry) => entry.id === entityId)
          if (!option) throw new Error('Disarm fixture selection was not issued.')
          await select(ownerPage, field.label, option.label)
        }
        const count = ownerCommands.size
        await ownerPage.getByRole('button', { name: 'Resolve action', exact: true }).click()
        const result = await waitForCommand(ownerCommands, count)
        if (result.command.type !== 'RESOLVE_ACTION')
          throw new Error('Action drawer did not submit RESOLVE_ACTION.')
        // The creature picked on the map is the one the action resolved against.
        expect(result.command.target).toEqual(input.command.target)
        submitted.push({ actor: 'OWNER', command: result.command })
        await expect(
          ownerPage.getByText('Action paused for a required decision.', { exact: true })
        ).toBeVisible()
        await ownerPage.getByRole('button', { name: 'Close actions', exact: true }).click()
        return { command: result.command, result: result.result }
      },
      assertInitiatorPrivacy: async () => {
        stage = 'verify initiator audience'
        await expect(
          ownerPage.getByRole('button', { name: 'Open pending decision', exact: true })
        ).toBeVisible()
        await expect(
          playerPage.getByRole('button', { name: 'Open pending decision', exact: true })
        ).toHaveCount(0)
        await expect(playerPage.getByLabel('Die 1', { exact: true })).toHaveCount(0)
        await expect(
          playerPage.getByRole('button', { name: 'Submit roll', exact: true })
        ).toHaveCount(0)
      },
      assertDefenderPending: async () => {
        stage = 'verify assigned defender audience'
        await expect(
          playerPage.getByRole('button', { name: 'Open pending decision', exact: true })
        ).toBeVisible()
      },
      resolveEvidence: async (actor, expected) => {
        stage = actor === 'OWNER' ? 'submit initiator d20 20' : 'submit defender d20 1'
        const page = actor === 'OWNER' ? ownerPage : playerPage
        const commands = actor === 'OWNER' ? ownerCommands : playerCommands
        if (expected.resolution.kind !== 'ENTER_DICE')
          throw new Error('Disarm browser proof requires physical dice.')
        await page.getByRole('button', { name: 'Open pending decision', exact: true }).click()
        for (const [index, face] of expected.resolution.rawFaces.entries()) {
          const die = page.getByLabel('Die ' + (index + 1), { exact: true })
          await expect(die).toBeVisible()
          await die.fill(String(face))
        }
        const count = commands.size
        await page.getByRole('button', { name: 'Submit roll', exact: true }).click()
        const result = await waitForCommand(commands, count)
        if (result.command.type !== 'RESOLVE_RULE_OCCURRENCE')
          throw new Error('Decision drawer did not submit RESOLVE_RULE_OCCURRENCE.')
        submitted.push({ actor, command: result.command })
        // The GM sees the defender's decision too (D87), so the GM's drawer stays open on it.
        if (actor === 'OWNER')
          await page.getByRole('button', { name: 'Close pending decision', exact: true }).click()
        else
          await expect(
            page.getByRole('button', { name: 'Open pending decision', exact: true })
          ).toHaveCount(0)
        return { command: result.command, result: result.result }
      },
      reload: async () => {
        stage = 'reload settled Disarm'
        for (const page of [ownerPage, playerPage])
          await expect(
            page.getByRole('button', { name: 'Open pending decision', exact: true })
          ).toHaveCount(0)
        await Promise.all([
          open(ownerPage, ownerSession, true),
          open(playerPage, playerSession, true)
        ])
        for (const page of [ownerPage, playerPage]) {
          await expect(
            page.getByRole('button', { name: 'Open pending decision', exact: true })
          ).toHaveCount(0)
          await expect(page.getByLabel('Die 1', { exact: true })).toHaveCount(0)
        }
        await expect(
          ownerPage.getByRole('button', { name: 'Open actions', exact: true })
        ).toBeVisible()
        await expect(
          playerPage.getByRole('button', { name: 'Open actions', exact: true })
        ).toHaveCount(0)
        await Promise.all([
          ownerPage.screenshot({
            caret: 'initial',
            path: input.evidenceDirectory + '/disarm-owner-reloaded.png',
            fullPage: true
          }),
          playerPage.screenshot({
            caret: 'initial',
            path: input.evidenceDirectory + '/disarm-player-reloaded.png',
            fullPage: true
          })
        ])
      }
    })
    expect(submitted.map(({ actor, command }) => [actor, command.type])).toEqual([
      ['OWNER', 'RESOLVE_ACTION'],
      ['OWNER', 'RESOLVE_RULE_OCCURRENCE'],
      ['PLAYER', 'RESOLVE_RULE_OCCURRENCE']
    ])
    expect(forbiddenLegacyRequests).toEqual([])
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Disarm browser proof failed.'
    await Promise.allSettled([
      owner?.screenshot({
        caret: 'initial',
        path: input.evidenceDirectory + '/disarm-owner-failure.png',
        fullPage: true
      }),
      player?.screenshot({
        caret: 'initial',
        path: input.evidenceDirectory + '/disarm-player-failure.png',
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
      input.evidenceDirectory + '/disarm-diagnostics.json',
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
    if (!failure) {
      expect(diagnostics.map(scrub)).toEqual([])
      expect(forbiddenLegacyRequests).toEqual([])
    }
  }
}

async function select(page: Page, label: string, option: string): Promise<void> {
  const control = page.getByRole('combobox', { name: label, exact: true })
  await expect(control).toBeEnabled()
  await control.click()
  await page.getByRole('option', { name: option, exact: true }).click()
}
