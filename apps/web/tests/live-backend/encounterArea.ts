import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect as playwrightExpect, type Page } from '@playwright/test'
import type {
  RemoveAreaTargetInputDto,
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterAreaBrowserControls,
  EncounterAreaBrowserFixture
} from '../../../apis/tests/developmentEncounterArea'
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

export async function verifyEncounterAreaBrowser(
  input: EncounterAreaBrowserFixture & {
    owner: EncounterMovementAccount
    player: EncounterMovementAccount
    campaign: { id: string; publicId: string }
    evidenceDirectory: string
  },
  verify: (controls: EncounterAreaBrowserControls) => Promise<void>
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
    command:
      | ResolveEncounterActionInputDto
      | ResolveRuleOccurrenceInputDto
      | RemoveAreaTargetInputDto
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
    async function open(page: Page, session: { authenticated: boolean }) {
      session.authenticated = false
      await page.goto(tabletopUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      await expect.poll(() => session.authenticated).toBe(true)
      await waitForRouterIdle(page)
      await expect(
        page.getByRole('region', { name: 'Live scene: ' + input.scene.name })
      ).toBeVisible({ timeout: 90_000 })
      await expect(page.getByText('Scene map ready.', { exact: true })).toBeVisible()
    }
    stage = 'hydrate area scene'
    await Promise.all([open(ownerPage, ownerSession), open(playerPage, playerSession)])
    await expect(ownerPage.getByRole('button', { name: 'Open actions', exact: true })).toBeVisible()
    await expect(playerPage.getByRole('button', { name: 'Open actions', exact: true })).toHaveCount(
      0
    )

    const decisionDrawer = (page: Page) => page.getByRole('dialog', { name: 'Pending decision' })
    const saveGroup = (page: Page, label: string) =>
      decisionDrawer(page).getByRole('group', { name: label, exact: true })
    async function openDecision(page: Page) {
      if (await decisionDrawer(page).isVisible()) return
      await page.getByRole('button', { name: 'Open pending decision', exact: true }).click()
      await expect(decisionDrawer(page)).toBeVisible()
    }

    await verify({
      startArea: async () => {
        stage = 'aim the area on the map'
        const map = ownerPage.locator('canvas[aria-description]')
        await ownerPage.getByRole('button', { name: 'Open actions', exact: true }).click()
        await select(ownerPage, 'Action', input.actionLabel)
        await expect(ownerPage.getByText('Area origin', { exact: true })).toBeVisible()
        await expect(ownerPage.getByRole('combobox', { name: 'Target', exact: true })).toHaveCount(
          0
        )
        await expect(ownerPage.getByText(/^In the area:/)).toHaveCount(0)
        // Escape leaves aiming with no origin: the drawer returns with nothing picked.
        await ownerPage.getByRole('button', { name: 'Pick on map', exact: true }).click()
        await expect(ownerPage.getByText('Area origin', { exact: true })).toBeHidden()
        await map.press('Escape')
        await expect(ownerPage.getByText('Area origin', { exact: true })).toBeVisible()
        await expect(ownerPage.getByText(/^In the area:/)).toHaveCount(0)
        // Picking the map center puts the origin among the ally, enemy and Character.
        await ownerPage.getByRole('button', { name: 'Pick on map', exact: true }).click()
        await expect(ownerPage.getByText('Area origin', { exact: true })).toBeHidden()
        await map.click()
        await expect(ownerPage.getByText('Area origin', { exact: true })).toBeVisible()
        const inArea = ownerPage.getByText(/^In the area:/)
        await expect(inArea).toBeVisible()
        for (const label of Object.values(input.caughtLabels))
          await expect(inArea).toContainText(label)
        for (const label of input.outsideLabels) await expect(inArea).not.toContainText(label)
        await ownerPage.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/area-owner-origin.png',
          fullPage: true
        })
        stage = 'resolve the area action'
        const count = ownerCommands.size
        await ownerPage.getByRole('button', { name: 'Resolve action', exact: true }).click()
        const result = await waitForCommand(ownerCommands, count)
        if (result.command.type !== 'RESOLVE_ACTION')
          throw new Error('Actions drawer did not submit RESOLVE_ACTION.')
        submitted.push({ actor: 'OWNER', command: result.command })
        await expect(
          ownerPage.getByText('Action paused for a required decision.', { exact: true })
        ).toBeVisible()
        await ownerPage.getByRole('button', { name: 'Close actions', exact: true }).click()
        return { command: result.command, result: result.result }
      },
      assertGmSaves: async (caught) => {
        stage = 'verify the GM area saves'
        await openDecision(ownerPage)
        const drawer = decisionDrawer(ownerPage)
        await expect(drawer.getByText('Area saves', { exact: true })).toBeVisible()
        await expect(
          drawer.getByText('Caught in the area: ' + caught.join(', '), { exact: true })
        ).toBeVisible()
        for (const label of caught) await expect(saveGroup(ownerPage, label)).toBeVisible()
        await expect(drawer.getByRole('group')).toHaveCount(caught.length)
        await ownerPage.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/area-owner-saves.png',
          fullPage: true
        })
      },
      removeFromArea: async (label) => {
        stage = 'remove a creature from the area'
        await openDecision(ownerPage)
        const count = ownerCommands.size
        await saveGroup(ownerPage, label)
          .getByRole('button', { name: 'Remove from area', exact: true })
          .click()
        const result = await waitForCommand(ownerCommands, count)
        if (result.command.type !== 'REMOVE_AREA_TARGET')
          throw new Error('Decision drawer did not submit REMOVE_AREA_TARGET.')
        submitted.push({ actor: 'OWNER', command: result.command })
        await expect(saveGroup(ownerPage, label)).toHaveCount(0)
        return { command: result.command, result: result.result }
      },
      assertPlayerSaves: async (ownLabel, others) => {
        stage = 'verify the player sees only their own save'
        await openDecision(playerPage)
        const drawer = decisionDrawer(playerPage)
        await expect(drawer.getByText('Area saves', { exact: true })).toBeVisible()
        await expect(saveGroup(playerPage, ownLabel)).toBeVisible()
        await expect(drawer.getByRole('group')).toHaveCount(1)
        await expect(
          drawer.getByRole('button', { name: 'Remove from area', exact: true })
        ).toHaveCount(0)
        await expect(drawer.getByText(/Caught in the area/)).toHaveCount(0)
        for (const label of others) await expect(drawer).not.toContainText(label)
        await playerPage.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/area-player-saves.png',
          fullPage: true
        })
      },
      answerSave: async (by, label, face) => {
        stage = 'answer the ' + label + ' save'
        const page = by === 'OWNER' ? ownerPage : playerPage
        const commands = by === 'OWNER' ? ownerCommands : playerCommands
        await openDecision(page)
        const group = saveGroup(page, label)
        const die = group.getByLabel('Die 1', { exact: true })
        await expect(die).toBeVisible()
        await die.fill(String(face))
        const count = commands.size
        await group.getByRole('button', { name: 'Submit roll', exact: true }).click()
        const result = await waitForCommand(commands, count)
        if (result.command.type !== 'RESOLVE_RULE_OCCURRENCE')
          throw new Error('Decision drawer did not submit RESOLVE_RULE_OCCURRENCE.')
        submitted.push({ actor: by, command: result.command })
        // The answered save leaves the GM's list; the others stay pending.
        if (by === 'PLAYER') await expect(saveGroup(ownerPage, label)).toHaveCount(0)
        return { command: result.command, result: result.result }
      },
      assertHistory: async (entry) => {
        stage = 'verify the Encounter history'
        // The canonical-slug redirect runs only once the client has authenticated.
        ownerSession.authenticated = false
        await ownerPage.goto(origin + '/campaigns/' + encodeURIComponent(input.campaign.publicId), {
          waitUntil: 'domcontentloaded',
          timeout: 90_000
        })
        await expect.poll(() => ownerSession.authenticated).toBe(true)
        await waitForRouterIdle(ownerPage)
        const slug = new URL(ownerPage.url()).pathname.split('/').filter(Boolean)[2]
        if (!slug)
          throw new Error(`Campaign route did not resolve a canonical slug: ${ownerPage.url()}`)
        ownerSession.authenticated = false
        await ownerPage.goto(
          origin +
            '/campaigns/' +
            encodeURIComponent(input.campaign.publicId) +
            '/' +
            slug +
            '/sessions/' +
            input.sessionNumber,
          { waitUntil: 'domcontentloaded', timeout: 90_000 }
        )
        await expect.poll(() => ownerSession.authenticated).toBe(true)
        await waitForRouterIdle(ownerPage)
        await expect(ownerPage.getByRole('tab', { name: 'Prepare', exact: true })).toBeVisible()
        await ownerPage.getByRole('button', { name: 'Encounter history', exact: true }).click()
        for (const line of entry.issuerLines)
          await expect(ownerPage.getByText(line, { exact: true })).toBeVisible()
        for (const line of entry.gmLines)
          await expect(ownerPage.getByText(line, { exact: true })).toBeVisible()
        await expect(ownerPage.getByText('GM only', { exact: true })).toHaveCount(
          entry.gmLines.length
        )
        await ownerPage.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/area-owner-history.png',
          fullPage: true
        })
      }
    })
    expect(submitted.map(({ actor, command }) => [actor, command.type])).toEqual([
      ['OWNER', 'RESOLVE_ACTION'],
      ['OWNER', 'REMOVE_AREA_TARGET'],
      ['PLAYER', 'RESOLVE_RULE_OCCURRENCE'],
      ['OWNER', 'RESOLVE_RULE_OCCURRENCE']
    ])
    expect(playerCommands.size).toBe(1)
    expect(forbiddenLegacyRequests).toEqual([])
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Area browser proof failed.'
    await Promise.allSettled([
      owner?.screenshot({
        caret: 'initial',
        path: input.evidenceDirectory + '/area-owner-failure.png',
        fullPage: true
      }),
      player?.screenshot({
        caret: 'initial',
        path: input.evidenceDirectory + '/area-player-failure.png',
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
      input.evidenceDirectory + '/area-diagnostics.json',
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
