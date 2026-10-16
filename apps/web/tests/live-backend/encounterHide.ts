import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect as playwrightExpect, type Page } from '@playwright/test'
import {
  LIVE_SESSION_PATH_PREFIX,
  liveSessionWebSocketServerMessageDtoSchema
} from '@artificer-toolkit/schema/api/liveSessions'
import type {
  EncounterHideBrowserControls,
  EncounterHideBrowserFixture
} from '../../../apis/tests/developmentEncounterHide'
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

export async function verifyEncounterHideBrowser(
  input: EncounterHideBrowserFixture & {
    owner: EncounterMovementAccount
    player: EncounterMovementAccount
    campaign: { id: string; publicId: string }
    evidenceDirectory: string
  },
  verify: (controls: EncounterHideBrowserControls) => Promise<void>
): Promise<void> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const diagnostics: string[] = []
  const abortedRequests = new Map<string, string>()
  const forbiddenLegacyRequests: string[] = []
  const playerFrames: string[] = []
  const playerCommittedCommandIds: string[] = []
  let stage = 'sign in'
  let failure: string | undefined
  let owner: Page | undefined
  let player: Page | undefined
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
    // Everything the room sends the player's page, kept whole so the proof can search it.
    playerPage.on('websocket', (socket) => {
      if (!new URL(socket.url()).pathname.startsWith(LIVE_SESSION_PATH_PREFIX)) return
      socket.on('framereceived', ({ payload }) => {
        const frame = payload.toString()
        playerFrames.push(frame)
        try {
          const message = liveSessionWebSocketServerMessageDtoSchema.safeParse(JSON.parse(frame))
          if (message.success && message.data.type === 'COMMAND_COMMITTED')
            playerCommittedCommandIds.push(message.data.commandId)
        } catch {
          // A frame that is not JSON carries no command.
        }
      })
    })
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
    stage = 'hydrate hide scene'
    await Promise.all([open(ownerPage, ownerSession), open(playerPage, playerSession)])

    const turnOrder = (page: Page) => page.getByRole('dialog', { name: 'Turn order' })
    async function openTurnOrder(page: Page) {
      if (await turnOrder(page).isVisible()) return
      await page.getByRole('button', { name: 'Open turn order', exact: true }).click()
      await expect(turnOrder(page)).toBeVisible()
    }
    const hiddenSection = (page: Page) =>
      turnOrder(page).getByRole('region', { name: 'Hidden creature ' + input.hiderLabel })

    await verify({
      assertGmObservers: async ({ hidden, noticed }) => {
        stage = 'verify the GM observer list'
        await openTurnOrder(ownerPage)
        const section = hiddenSection(ownerPage)
        await expect(section).toBeVisible()
        for (const label of hidden) {
          await expect(section.getByText('Hidden from ' + label, { exact: true })).toBeVisible()
          await expect(
            section.getByRole('button', {
              name: 'Stop hiding ' + input.hiderLabel + ' from ' + label,
              exact: true
            })
          ).toBeVisible()
        }
        for (const label of noticed) {
          await expect(section.getByText('Noticed by ' + label, { exact: true })).toBeVisible()
          await expect(
            section.getByRole('button', {
              name: 'Hide ' + input.hiderLabel + ' from ' + label,
              exact: true
            })
          ).toBeVisible()
        }
        await expect(section.getByText(/^Hidden from /)).toHaveCount(hidden.length)
        await expect(section.getByText(/^Noticed by /)).toHaveCount(noticed.length)
        await ownerPage.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/hide-owner-observers-' + hidden.length + '.png',
          fullPage: true
        })
      },
      revealTo: async (label) => {
        stage = 'stop hiding the creature from ' + label
        await openTurnOrder(ownerPage)
        const count = ownerCommands.size
        await hiddenSection(ownerPage)
          .getByRole('button', {
            name: 'Stop hiding ' + input.hiderLabel + ' from ' + label,
            exact: true
          })
          .click()
        const result = await waitForCommand(ownerCommands, count)
        if (result.command.type !== 'SET_CONCEALMENT_OBSERVERS')
          throw new Error('Turn order did not submit SET_CONCEALMENT_OBSERVERS.')
        return { command: result.command, result: result.result }
      },
      assertPlayerSeesNoObservers: async ({ commandId, observerActorIds, effectId }) => {
        stage = 'verify the player sees no observer list'
        // The room sent the player the edit's commit, and it carries nothing of the concealment.
        await expect.poll(() => playerCommittedCommandIds.includes(commandId)).toBe(true)
        await openTurnOrder(playerPage)
        await expect(turnOrder(playerPage).getByText(input.hiderLabel).first()).toBeVisible()
        await expect(hiddenSection(playerPage)).toHaveCount(0)
        await expect(turnOrder(playerPage).getByText(/Hidden from |Noticed by /)).toHaveCount(0)
        await expect(
          turnOrder(playerPage).getByRole('button', { name: /^(Stop hiding|Hide) .* from / })
        ).toHaveCount(0)
        const everything = playerFrames.join('\n')
        for (const secret of ['concealment', 'observerActorIds', effectId, ...observerActorIds])
          expect(everything).not.toContain(secret)
        await playerPage.screenshot({
          caret: 'initial',
          path: input.evidenceDirectory + '/hide-player-turn-order.png',
          fullPage: true
        })
      }
    })
    expect(ownerCommands.size).toBe(1)
    expect(forbiddenLegacyRequests).toEqual([])
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Hide browser proof failed.'
    await Promise.allSettled([
      owner?.screenshot({
        caret: 'initial',
        path: input.evidenceDirectory + '/hide-owner-failure.png',
        fullPage: true
      }),
      player?.screenshot({
        caret: 'initial',
        path: input.evidenceDirectory + '/hide-player-failure.png',
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
      input.evidenceDirectory + '/hide-diagnostics.json',
      JSON.stringify(
        {
          stage,
          failure: failure && scrub(failure),
          playerCommittedCommandIds,
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
