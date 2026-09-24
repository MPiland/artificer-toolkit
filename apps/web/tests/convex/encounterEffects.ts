import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect as playwrightExpect, type Page } from '@playwright/test'
import type {
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterEffectsBrowserControls,
  EncounterEffectsBrowserFixture
} from '../../../apis/tests/developmentEncounterEffects'
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

export async function verifyEncounterEffectsBrowser(
  input: EncounterEffectsBrowserFixture & {
    owner: EncounterMovementAccount
    player: EncounterMovementAccount
    campaign: { id: string; publicId: string }
    evidenceDirectory: string
  },
  verify: (controls: EncounterEffectsBrowserControls) => Promise<void>
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
    actor: 'OWNER'
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
    stage = 'hydrate action-effect scene'
    await Promise.all([open(ownerPage, ownerSession), open(playerPage, playerSession)])
    await expect(ownerPage.getByRole('button', { name: 'Open actions', exact: true })).toBeVisible()
    await expect(playerPage.getByRole('button', { name: 'Open actions', exact: true })).toHaveCount(
      0
    )

    await verify({
      resolveAction: async () => {
        stage = 'select generic action and target'
        await ownerPage.getByRole('button', { name: 'Open actions', exact: true }).click()
        await select(ownerPage, 'Action', input.actionLabel)
        await select(ownerPage, 'Target', input.targetLabel)
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
        return {
          command: {
            type: 'RESOLVE_ACTION',
            encounterId: result.command.encounterId,
            commandId: result.command.commandId,
            expectedVersion: result.command.expectedVersion,
            actorId: result.command.actorId,
            actionId: result.command.actionId,
            targetActorId: result.command.targetActorId,
            optionalCombatIntent: result.command.optionalCombatIntent,
            sceneContext: result.command.sceneContext
          },
          result: result.result
        }
      },
      assertPendingPrivacy: async () => {
        stage = 'verify owner-only save evidence'
        await expect(
          ownerPage.getByRole('button', { name: 'Open pending decision', exact: true })
        ).toBeVisible()
        await expect(
          playerPage.getByRole('button', { name: 'Open pending decision', exact: true })
        ).toHaveCount(0)
        await expect(playerPage.getByLabel('Die 1', { exact: true })).toHaveCount(0)
        await expect(
          playerPage.getByRole('button', { name: 'Submit physical roll', exact: true })
        ).toHaveCount(0)
      },
      resolveEvidence: async (expected) => {
        stage = 'submit owner d20 evidence'
        if (expected.resolution.kind !== 'ENTER_DICE')
          throw new Error('Action-effect browser proof requires physical dice.')
        await ownerPage.getByRole('button', { name: 'Open pending decision', exact: true }).click()
        for (const [index, face] of expected.resolution.rawFaces.entries()) {
          const die = ownerPage.getByLabel('Die ' + (index + 1), { exact: true })
          await expect(die).toBeVisible()
          await die.fill(String(face))
        }
        const count = ownerCommands.size
        await ownerPage.getByRole('button', { name: 'Submit physical roll', exact: true }).click()
        const result = await waitForCommand(ownerCommands, count)
        if (result.command.type !== 'RESOLVE_RULE_OCCURRENCE')
          throw new Error('Decision drawer did not submit RESOLVE_RULE_OCCURRENCE.')
        submitted.push({ actor: 'OWNER', command: result.command })
        await expect(
          ownerPage.getByRole('button', { name: 'Open pending decision', exact: true })
        ).toHaveCount(0)
        return {
          command: {
            type: 'RESOLVE_RULE_OCCURRENCE',
            encounterId: result.command.encounterId,
            commandId: result.command.commandId,
            expectedVersion: result.command.expectedVersion,
            correlationId: result.command.correlationId,
            occurrenceId: result.command.occurrenceId,
            expectedOccurrenceVersion: result.command.expectedOccurrenceVersion,
            resolution: result.command.resolution
          },
          result: result.result
        }
      },
      assertTerminal: async () => {
        stage = 'verify terminal target state'
        for (const page of [ownerPage, playerPage]) {
          const map = page.locator('canvas[aria-description]')
          await expect
            .poll(() => map.getAttribute('aria-description'))
            .toContain(input.targetTokenLabel)
          if (input.expectedConditionLabel)
            await expect
              .poll(() => map.getAttribute('aria-description'))
              .toContain(input.expectedConditionLabel)
          else
            await expect
              .poll(() => map.getAttribute('aria-description'))
              .not.toContain('Frightened')
        }
        await Promise.all([
          ownerPage.screenshot({
            caret: 'initial',
            path: input.evidenceDirectory + '/effects-owner-terminal.png',
            fullPage: true
          }),
          playerPage.screenshot({
            caret: 'initial',
            path: input.evidenceDirectory + '/effects-player-terminal.png',
            fullPage: true
          })
        ])
      }
    })
    expect(submitted.map(({ actor, command }) => [actor, command.type])).toEqual([
      ['OWNER', 'RESOLVE_ACTION'],
      ['OWNER', 'RESOLVE_RULE_OCCURRENCE']
    ])
    expect(playerCommands.size).toBe(0)
    expect(forbiddenLegacyRequests).toEqual([])
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Action-effect browser proof failed.'
    await Promise.allSettled([
      owner?.screenshot({
        caret: 'initial',
        path: input.evidenceDirectory + '/effects-owner-failure.png',
        fullPage: true
      }),
      player?.screenshot({
        caret: 'initial',
        path: input.evidenceDirectory + '/effects-player-failure.png',
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
      input.evidenceDirectory + '/effects-diagnostics.json',
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
