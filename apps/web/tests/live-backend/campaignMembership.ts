import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect, type BrowserContext, type Page } from '@playwright/test'
import { api } from '@artificer-toolkit/apis/convex/api'
import { authSessionSnapshotDtoSchema } from '@artificer-toolkit/schema/api/auth'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import {
  assertDomainRejection,
  type DevelopmentClient
} from '../../../apis/tests/developmentClient'
import type { CampaignMembershipLifecycleStage } from '../../../apis/tests/developmentCampaignMembershipLifecycle'
import {
  signIn,
  waitForRouterIdle,
  watchAuthenticatedSession,
  watchNavigationAbortedRequests
} from './campaignCollaboration'

type MembershipAccount = {
  email: string
  password: string
  username: string
  userId: string
  characterIds: readonly string[]
  client: Pick<DevelopmentClient, 'query'>
}

type CampaignMembershipBrowserInput = {
  origin: string
  publicId: string
  campaignId: string
  accounts: readonly [MembershipAccount, MembershipAccount, MembershipAccount, MembershipAccount]
  evidenceDirectory: string
}

const stages: readonly CampaignMembershipLifecycleStage[] = [
  'BEFORE_LEAVE',
  'AFTER_LEAVE',
  'AFTER_REJOIN_LEAVE',
  'BEFORE_REMOVE',
  'AFTER_REMOVE',
  'AFTER_REJOIN_REMOVE',
  'AFTER_FORWARD_TRANSFER',
  'AFTER_RESTORE_TRANSFER'
]

/** Only the supplied native coordinator mutates membership; the browser observes it. */
export async function verifyCampaignMembershipBrowser<T>(
  input: CampaignMembershipBrowserInput,
  runLifecycle: (onStage: (stage: CampaignMembershipLifecycleStage) => Promise<void>) => Promise<T>
): Promise<T> {
  const requestedOrigin = new URL(input.origin)
  assert.ok(['localhost', '127.0.0.1'].includes(requestedOrigin.hostname))
  assert.equal(requestedOrigin.protocol, 'http:')
  assert.equal(requestedOrigin.port, '3000')
  assert.equal(requestedOrigin.pathname, '/')
  assert.equal(
    requestedOrigin.search +
      requestedOrigin.hash +
      requestedOrigin.username +
      requestedOrigin.password,
    ''
  )
  // signIn's existing fixture helper uses localhost; keep every context on that cookie host.
  const origin = 'http://localhost:3000'
  const path = `/campaigns/${encodeURIComponent(input.publicId)}`
  assert.equal(new Set(input.accounts.map((account) => account.userId)).size, 4)
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const contexts: BrowserContext[] = []
  const pages: Page[] = []
  const diagnostics: string[] = []
  const expectedDenials: string[] = []
  const boundedAuthRetries: string[] = []
  const cleanupErrors: unknown[] = []
  const sessions: ReturnType<typeof watchAuthenticatedSession>[] = []
  const authenticatedSockets: number[] = []
  let currentStage = 'start'
  let authenticatingReload = false
  let completedStages = 0
  let failure: unknown
  let failed = false

  const scrub = (text: string) =>
    input.accounts.reduce(
      (value, account, index) =>
        value
          .replaceAll(account.email, `[account ${index} email]`)
          .replaceAll(account.password, `[account ${index} password]`),
      text.replace(/(https?:\/\/[^?\s"'<>]+)\?[^\s"'<>]+/g, '$1?[redacted]')
    )
  const outsiderIndex = 3
  const denied = (stage: CampaignMembershipLifecycleStage, index: number) =>
    index === outsiderIndex ||
    (stage === 'AFTER_LEAVE' && index === 1) ||
    (stage === 'AFTER_REMOVE' && index === 2)

  async function start() {
    for (const [index, account] of input.accounts.entries()) {
      const identity = await account.client.query(api.account.identity, {})
      assert.equal(identity.userId, account.userId, `Native account ${index} identity mismatch`)
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        reducedMotion: 'reduce'
      })
      contexts.push(context)
      context.setDefaultTimeout(30_000)
      context.setDefaultNavigationTimeout(90_000)
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
      // Block old product boundaries, preserving only existing sign-in/session endpoints.
      await context.route('**/*', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        const auth =
          url.origin === origin &&
          ((request.method() === 'GET' &&
            ['/api/auth/get-session', '/api/auth/convex/token'].includes(url.pathname)) ||
            (request.method() === 'POST' &&
              ['/api/auth/sign-in/email', '/api/auth/sign-in/username'].includes(url.pathname)))
        const session =
          url.origin === origin &&
          request.method() === 'GET' &&
          url.pathname.startsWith('/_serverFn/')
        if (
          url.hostname.endsWith('.supabase.co') ||
          (url.origin === origin && url.pathname.startsWith('/api/') && !auth) ||
          (url.origin === origin && url.pathname.startsWith('/_serverFn/') && !session)
        ) {
          diagnostics.push(
            `${index} ${currentStage}: rejected legacy request ${request.method()} ${url.hostname}${url.pathname}`
          )
          await route.abort('blockedbyclient')
          return
        }
        await route.continue()
      })
      const page = await context.newPage()
      pages.push(page)
      sessions.push(watchAuthenticatedSession(page))
      authenticatedSockets.push(0)
      page.on('websocket', (socket) => {
        let authenticated = false
        socket.on('framereceived', ({ payload }) => {
          const message: unknown = JSON.parse(payload.toString())
          if (
            !message ||
            typeof message !== 'object' ||
            !('modifications' in message) ||
            !Array.isArray(message.modifications)
          )
            return
          for (const modification of message.modifications) {
            if (!modification || typeof modification !== 'object' || !('value' in modification))
              continue
            const snapshot = authSessionSnapshotDtoSchema.safeParse(modification.value)
            if (!snapshot.success || !snapshot.data.user) continue
            if (snapshot.data.user.userId !== account.userId) {
              diagnostics.push(`${index} ${currentStage}: authenticated browser identity mismatch`)
              continue
            }
            if (!authenticated) authenticatedSockets[index] = authenticatedSockets[index]! + 1
            authenticated = true
          }
        })
      })
      const record = (kind: string, detail: string) => {
        const entry = scrub(`${index} ${currentStage}: ${kind} ${detail}`)
        // Exact native denial messages only, on deliberately unauthorized contexts.
        // Active Party also subscribes to clock:get. Departure invalidates both reads.
        const departureWindow =
          (index === 1 && ['BEFORE_LEAVE', 'AFTER_LEAVE'].includes(currentStage)) ||
          (index === 2 && ['BEFORE_REMOVE', 'AFTER_REMOVE'].includes(currentStage))
        const denialWindow = index === 3 || departureWindow
        const queryDenial =
          /^(?:(?:Convex)?Error: )?\[CONVEX Q\(campaigns\/(?:queries:get|clock:get)\)\](?: \[Request ID: [a-f0-9]+\])? Server Error\nUncaught ConvexError: \{[^\n]*"reason":\s*"CAMPAIGN_NOT_FOUND"[^\n]*\}(?:\n\s+(?:Called by client|at [^\n]+))*\s*$/.test(
            detail
          )
        const denialBoundary =
          /^%o\n\n%s\n\n%s\n Error: \[Request ID: [a-f0-9]+\] Server Error\nUncaught ConvexError: \{[^\n]*"reason":\s*"CAMPAIGN_NOT_FOUND"/.test(
            detail
          ) &&
          detail.endsWith(
            'The above error occurred in the <MatchInnerImpl> component. React will try to recreate this component tree from scratch using the error boundary you provided, CatchBoundaryImpl.'
          )
        const liveDenialBoundary =
          /^%o\n\n%s\n\n%s\n Error: \[CONVEX Q\(campaigns\/queries:get\)\] \[Request ID: [a-f0-9]+\] Server Error\nUncaught ConvexError: \{[^\n]*"reason":\s*"CAMPAIGN_NOT_FOUND"/.test(
            detail
          ) &&
          detail.endsWith(
            'The above error occurred in the <CampaignDetailPage> component. React will try to recreate this component tree from scratch using the error boundary you provided, CatchBoundaryImpl.'
          )
        const denialPageDiagnostic =
          (kind === 'response' && /^500 \/campaigns\/[a-z0-9]+(?:\/[a-z0-9-]+)?$/.test(detail)) ||
          (kind === 'console error' &&
            detail === 'Failed to load resource: the server responded with a status of 500 ()') ||
          (kind === 'console warning' &&
            detail.startsWith('Warning: Error in route match: /_authed/campaigns/'))
        const boundedSignInRetry =
          currentStage === 'start' &&
          ((kind === 'response' && detail === '429 /api/auth/sign-in/email') ||
            (kind === 'console error' &&
              /^Failed to load resource: the server responded with a status of 429 \((?:Too Many Requests)?\)$/.test(
                detail
              )))
        const authRateLimit =
          currentStage !== 'start' &&
          !denialWindow &&
          ((kind === 'response' && detail === '429 /api/auth/convex/token') ||
            (kind === 'console error' &&
              /^Failed to load resource: the server responded with a status of 429 \(Too Many Requests\)$/.test(
                detail
              )) ||
            (kind === 'console error' &&
              // React's boundary logs the SSR verification failure with a format prefix. The router's
              // own log of the same fail-closed error (transport.md) has none.
              /^(?:%o\n\n%s\n\n%s\n )?Error: Authentication verification is unavailable\./.test(
                detail
              )))
        const boundedAuthRetry =
          authRateLimit ||
          (authenticatingReload &&
            ((kind === 'response' &&
              /^(?:400|500) \/api\/auth\/(?:get-session|convex\/token)$/.test(detail)) ||
              (kind === 'console error' &&
                /^Failed to load resource: the server responded with a status of (?:400 \(Bad Request\)|500 \(Internal Server Error\))$/.test(
                  detail
                )) ||
              (kind === 'console warning' &&
                detail === 'Warning: Error in route match: __root__/') ||
              (kind === 'console error' &&
                /^%o\n\n%s\n\n%s\n Error: Authentication verification is unavailable\./.test(
                  detail
                ) &&
                detail.endsWith(
                  'The above error occurred in the <MatchInnerImpl> component. React will try to recreate this component tree from scratch using the error boundary you provided, CatchBoundaryImpl.'
                ))))
        if (
          boundedSignInRetry ||
          (denialWindow &&
            ((kind === 'console error' && (queryDenial || denialBoundary || liveDenialBoundary)) ||
              denialPageDiagnostic))
        )
          expectedDenials.push(entry)
        else if (boundedAuthRetry) {
          if (kind === 'response' && detail === '429 /api/auth/convex/token') {
            const prefix = `${index} ${currentStage}: `
            for (
              let diagnosticIndex = diagnostics.length - 1;
              diagnosticIndex >= 0;
              diagnosticIndex--
            ) {
              const diagnostic = diagnostics[diagnosticIndex]!
              if (
                diagnostic.startsWith(prefix) &&
                (/ response 500 \/campaigns\/[a-z0-9]+(?:\/[a-z0-9-]+)?$/.test(diagnostic) ||
                  diagnostic.endsWith(
                    'console error Failed to load resource: the server responded with a status of 500 ()'
                  ) ||
                  diagnostic.includes(
                    'console warning Warning: Error in route match: /_authed/campaigns/'
                  ))
              ) {
                boundedAuthRetries.push(diagnostic)
                diagnostics.splice(diagnosticIndex, 1)
              }
            }
          }
          boundedAuthRetries.push(entry)
        } else diagnostics.push(entry)
        return entry
      }
      page.on('console', (message) => {
        if (['error', 'warning'].includes(message.type()))
          record(`console ${message.type()}`, message.text())
      })
      page.on('pageerror', (error) => record('pageerror', error.stack ?? error.message))
      const tolerateNavigationAbort = watchNavigationAbortedRequests(page)
      page.on('requestfailed', (request) => {
        // A failed request is never denial or retry noise, so `record` always files it in `diagnostics`.
        const entry = record(
          'requestfailed',
          `${request.method()} ${new URL(request.url()).pathname} ${request.failure()?.errorText ?? 'unknown failure'}`
        )
        tolerateNavigationAbort(request, () =>
          diagnostics.splice(diagnostics.lastIndexOf(entry), 1)
        )
      })
      page.on('response', (response) => {
        if (response.status() >= 400)
          record('response', `${response.status()} ${new URL(response.url()).pathname}`)
      })
    }
    for (const [index, page] of pages.entries())
      await signIn(page, input.accounts[index]!, sessions[index]!)
    for (const [index] of pages.entries())
      await expect.poll(() => authenticatedSockets[index]).toBeGreaterThan(0)
  }

  async function navigateWithAuthRecovery(
    index: number,
    page: Page,
    previousAuthenticatedSocket: number,
    navigate: () => Promise<void>
  ) {
    for (let attempt = 0; ; attempt++) {
      const authRetriesBeforeAttempt = boundedAuthRetries.length
      authenticatingReload = true
      await navigate()
      await expect
        .poll(
          () =>
            authenticatedSockets[index]! > previousAuthenticatedSocket ||
            boundedAuthRetries.length > authRetriesBeforeAttempt,
          { timeout: 30_000 }
        )
        .toBe(true)
      if (authenticatedSockets[index]! > previousAuthenticatedSocket) {
        authenticatingReload = false
        return
      }
      if (attempt === 1)
        throw new Error('Browser authentication failed on both navigation attempts.')
      for (const authPath of ['/api/auth/get-session', '/api/auth/convex/token'])
        await expect
          .poll(
            async () => {
              const response = await page.request.get(`${origin}${authPath}`)
              const status = response.status()
              await response.dispose()
              return status
            },
            { timeout: 30_000 }
          )
          .toBe(200)
    }
  }
  async function retryNativeQuery<T>(query: () => Promise<T>): Promise<T> {
    const deadline = Date.now() + 30_000
    for (let retry = 0; ; retry++) {
      try {
        return await query()
      } catch (error) {
        const delay = Math.min(retry + 1, 3) * 1000
        if (
          !(error instanceof Error) ||
          !(
            error.message.includes('Function execution timed out') ||
            error.message.includes('IsolateNotClean')
          ) ||
          Date.now() + delay > deadline
        )
          throw error
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  async function readNative(stage: CampaignMembershipLifecycleStage) {
    const campaigns: (CampaignDetailDto | 'CAMPAIGN_NOT_FOUND')[] = []
    for (const [index, account] of input.accounts.entries()) {
      if (denied(stage, index)) {
        await assert.rejects(
          () =>
            retryNativeQuery(() =>
              account.client.query(api.campaigns.queries.get, { id: input.campaignId })
            ),
          // The client throws the apis package's ConvexError, a different class from this file's.
          (error: unknown) => assertDomainRejection(error, 'CAMPAIGN_NOT_FOUND'),
          `Account ${index} must receive the specific native Campaign-not-found denial`
        )
        campaigns.push('CAMPAIGN_NOT_FOUND')
      } else {
        const campaign = await retryNativeQuery(() =>
          account.client.query(api.campaigns.queries.get, {
            id: input.campaignId
          })
        )
        assert.equal(campaign.id, input.campaignId)
        assert.equal(campaign.publicId, input.publicId)
        campaigns.push(campaign)
      }
    }
    const characterSheets = []
    for (const account of input.accounts) {
      const sheets = []
      for (const id of account.characterIds) {
        const slices = await Promise.all(
          (
            ['COMMON', 'ACTIONS', 'SPELLS', 'INVENTORY', 'EXTRAS', 'FEATURES', 'NOTES'] as const
          ).map(async (slice) => {
            const response = await retryNativeQuery(() =>
              account.client.query(api.characters.sheetSlices.get, { id, slice })
            )
            assert.ok(response, `Known owned Character ${id} ${slice} must remain readable`)
            assert.equal(response.slice, slice)
            return response
          })
        )
        sheets.push({ id, slices })
      }
      characterSheets.push(sheets)
    }
    const ownerIndex = stage === 'AFTER_FORWARD_TRANSFER' ? 1 : 0
    const owner = input.accounts[ownerIndex]!.client
    const clock = await retryNativeQuery(() =>
      owner.query(api.campaigns.clock.get, { campaignId: input.campaignId })
    )
    assert.notEqual(
      clock?.running,
      true,
      'Read-only browser proof requires a paused/unset clock; UI auto-reconcile must not mutate it'
    )
    const partyVersion = await retryNativeQuery(() =>
      owner.query(api.campaigns.inventoryOwners.version, {
        input: {
          campaignId: input.campaignId,
          owner: { kind: 'CAMPAIGN', campaignId: input.campaignId }
        }
      })
    )
    const audit: unknown[] = []
    const cursors = new Set<string>()
    let cursor: string | undefined
    do {
      const result = await retryNativeQuery(() =>
        owner.query(api.campaigns.inventoryAudit.list, {
          campaignId: input.campaignId,
          limit: 8,
          ...(cursor ? { cursor } : {})
        })
      )
      audit.push(...result.events)
      if (result.nextCursor === null) break
      assert.equal(cursors.has(result.nextCursor), false, 'Audit cursor must advance')
      cursors.add(result.nextCursor)
      cursor = result.nextCursor
    } while (cursor !== undefined)
    return { campaigns, characterSheets, clock, partyVersion, audit }
  }

  async function assertPage(
    page: Page,
    campaign: CampaignDetailDto | 'CAMPAIGN_NOT_FOUND',
    index: number
  ) {
    await expect(page.locator('vite-error-overlay')).toHaveCount(0)
    await expect(page).not.toHaveURL(/\/sign-in/)
    if (campaign === 'CAMPAIGN_NOT_FOUND') {
      // The outsider only ever visits directly: the route loader's denial shows the route error
      // state. A page that was open when its member left returns to the Campaigns list
      // (CampaignDetailPage), and a reload of that URL stays there.
      await expect(
        index === outsiderIndex
          ? page.getByText("This page couldn't load", { exact: true })
          : page.getByRole('heading', { name: 'Campaigns', exact: true, level: 1 })
      ).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('heading', { name: 'Party roster', exact: true })).toHaveCount(0)
      await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Remove player', exact: true })).toHaveCount(0)
      return
    }
    const loadError = page.getByText("This page couldn't load", { exact: true })
    const offCampaignRoute = !new URL(page.url()).pathname.startsWith(path)
    if ((await loadError.isVisible().catch(() => false)) || offCampaignRoute) {
      const previousAuthenticatedSocket = authenticatedSockets[index]!
      await navigateWithAuthRecovery(index, page, previousAuthenticatedSocket, async () => {
        await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' })
      })
      await waitForRouterIdle(page)
    }
    const membership = campaign.memberships.find(
      (member) => member.userId === input.accounts[index]!.userId
    )
    assert.ok(membership)
    assert.equal(campaign.role, membership.role)
    await expect(
      page.getByRole('heading', { name: campaign.name, exact: true, level: 1 })
    ).toBeVisible({ timeout: 30_000 })
    const header = page.locator('main > header')
    await expect(
      header.getByText(campaign.role === 'OWNER' ? 'GM' : 'Player', { exact: true })
    ).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toHaveCount(
      campaign.role === 'OWNER' ? 1 : 0
    )
    await page.getByRole('tab', { name: 'Party', exact: true }).click()
    const roster = page.getByRole('region', { name: 'Party roster', exact: true })
    await expect(roster).toBeVisible()
    // The GM is on the roster only while playing their own Character (CAMPAIGN-7).
    const players = campaign.memberships.filter(
      (member) => member.role === 'PLAYER' || member.assignedCharacter
    )
    await expect(roster.getByRole('article')).toHaveCount(players.length, { timeout: 30_000 })
    for (const member of players) {
      const card = roster
        .getByRole('article')
        .filter({ has: page.getByText(`@${member.username}`, { exact: true }) })
      await expect(card).toHaveCount(1)
      await expect(
        card.getByText(member.assignedCharacter ? 'Ready' : 'Needs Character', { exact: true })
      ).toBeVisible()
      if (member.assignedCharacter)
        await expect(card.getByText(member.assignedCharacter.label, { exact: true })).toBeVisible()
      await expect(card.getByRole('button', { name: 'Remove player', exact: true })).toHaveCount(
        campaign.capabilities.manageMembers && member.role === 'PLAYER' ? 1 : 0
      )
      await expect(card.getByRole('button', { name: 'Unassign', exact: true })).toHaveCount(
        campaign.capabilities.manageMembers && member.role === 'PLAYER' && member.assignedCharacter
          ? 1
          : 0
      )
      await expect(card.getByRole('button', { name: 'Inspect Sheet', exact: true })).toHaveCount(
        campaign.role === 'OWNER' && member.assignedCharacter ? 1 : 0
      )
      await expect(card.getByRole('button', { name: 'Remove Character', exact: true })).toHaveCount(
        campaign.capabilities.assignOwnCharacter &&
          member.userId === membership.userId &&
          member.assignedCharacter
          ? 1
          : 0
      )
    }
    await expect(roster.getByRole('button', { name: 'Leave Campaign', exact: true })).toHaveCount(
      campaign.role === 'PLAYER' && campaign.status === 'ACTIVE' ? 1 : 0
    )
    await expect(
      roster.getByRole('button', {
        name: membership.assignedCharacter ? 'Change Character' : 'Add Character',
        exact: true
      })
    ).toHaveCount(campaign.capabilities.assignOwnCharacter ? 1 : 0)
  }

  async function evidence(stage: string, pass: string) {
    await Promise.all(
      pages.map(async (page, index) => {
        const file = `${input.evidenceDirectory}/${stage}-${pass}-account-${index}`
        await page.screenshot({ path: `${file}.png`, fullPage: true, caret: 'initial' })
        await writeFile(`${file}.html`, scrub(await page.content()))
      })
    )
  }

  async function onStage(stage: CampaignMembershipLifecycleStage) {
    assert.equal(
      stage,
      stages[completedStages],
      'Coordinator checkpoints must arrive exactly once in order'
    )
    currentStage = stage
    const before = await readNative(stage)
    await writeFile(
      `${input.evidenceDirectory}/${stage}-native.json`,
      scrub(JSON.stringify(before, null, 2))
    )
    // Existing pages first prove live convergence. Rejoined error-boundary pages need a route retry.
    if (stage === 'BEFORE_LEAVE') {
      const previousAuthenticatedSockets = [...authenticatedSockets]
      for (const [index, page] of pages.entries()) {
        await navigateWithAuthRecovery(
          index,
          page,
          previousAuthenticatedSockets[index]!,
          async () => {
            await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' })
          }
        )
        await waitForRouterIdle(page)
      }
    } else if (stage === 'AFTER_REJOIN_LEAVE' || stage === 'AFTER_REJOIN_REMOVE') {
      const index = stage === 'AFTER_REJOIN_LEAVE' ? 1 : 2
      const page = pages[index]!
      await navigateWithAuthRecovery(index, page, authenticatedSockets[index]!, async () => {
        await page.reload({ waitUntil: 'domcontentloaded' })
      })
      await waitForRouterIdle(page)
    }
    for (const [index, page] of pages.entries())
      await assertPage(page, before.campaigns[index]!, index)
    await evidence(stage, 'live')
    assert.deepEqual(
      await readNative(stage),
      before,
      `${stage}: live observer must not write native state`
    )
    // A real document reload creates a fresh socket/auth session in each isolated context.
    const previousAuthenticatedSockets = [...authenticatedSockets]
    for (const [index, page] of pages.entries()) {
      await navigateWithAuthRecovery(
        index,
        page,
        previousAuthenticatedSockets[index]!,
        async () => {
          await page.reload({ waitUntil: 'domcontentloaded' })
        }
      )
      await waitForRouterIdle(page)
      await assertPage(page, before.campaigns[index]!, index)
    }
    await evidence(stage, 'reload-reconnect')
    assert.deepEqual(
      await readNative(stage),
      before,
      `${stage}: reload/reconnect observer must not write native state`
    )
    assert.deepEqual(diagnostics, [], `${stage}: independent browser diagnostics must be empty`)
    completedStages++
  }

  let result: T
  try {
    await start()
    result = await runLifecycle(onStage)
    assert.equal(completedStages, stages.length, 'Every membership browser checkpoint must run')
  } catch (error) {
    failed = true
    failure = error
    const retained = await Promise.allSettled([evidence(currentStage, 'failure')])
    for (const item of retained) if (item.status === 'rejected') cleanupErrors.push(item.reason)
    throw error
  } finally {
    const retained = await Promise.allSettled(
      contexts.map((context, index) =>
        context.tracing.stop({
          path: `${input.evidenceDirectory}/account-${index}-trace.zip`
        })
      )
    )
    for (const item of retained) if (item.status === 'rejected') cleanupErrors.push(item.reason)
    const closed = await Promise.allSettled(contexts.map((context) => context.close()))
    for (const item of closed) if (item.status === 'rejected') cleanupErrors.push(item.reason)
    const browserClosed = await Promise.allSettled([browser.close()])
    for (const item of browserClosed)
      if (item.status === 'rejected') cleanupErrors.push(item.reason)
    const finalEvidence = await Promise.allSettled([
      writeFile(
        `${input.evidenceDirectory}/diagnostics.json`,
        scrub(
          JSON.stringify(
            {
              requestedOrigin: requestedOrigin.origin,
              effectiveOrigin: origin,
              completedStages,
              diagnostics,
              expectedDenials,
              boundedAuthRetries,
              failure: failed ? String(failure) : null,
              cleanupErrors: cleanupErrors.map(String)
            },
            null,
            2
          )
        )
      )
    ])
    for (const item of finalEvidence)
      if (item.status === 'rejected') cleanupErrors.push(item.reason)
  }
  assert.deepEqual(diagnostics, [], 'Browser diagnostics including shutdown must be empty')
  if (cleanupErrors.length)
    throw new AggregateError(cleanupErrors, 'Membership browser evidence/cleanup failed')
  return result
}
