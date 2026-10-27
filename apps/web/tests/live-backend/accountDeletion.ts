import assert from 'node:assert/strict'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, expect, type BrowserContext, type Page } from '@playwright/test'
import { authSessionSnapshotDtoSchema } from '@artificer-toolkit/schema/api/auth'
import {
  signIn,
  waitForRouterIdle,
  watchAuthenticatedSession,
  watchNavigationAbortedRequests
} from './campaignCollaboration'

const origin = 'http://localhost:3000'
const accountDeletePath = '/api/auth/account/delete'
const wrongPassword = 'Wrong-current-password-4061!'

type AccountDeletionBrowserStage =
  | 'READY'
  | 'INVALID_EMAIL_NO_WRITE'
  | 'WRONG_PASSWORD_NO_WRITE'
  | 'OWNED_CAMPAIGNS_REFUSED'
  | 'DELETED'
  | 'OTHER_SESSION_DENIED'
  | 'RELOAD_DENIED'

type BrowserAccount = {
  email: string
  password: string
  userId: string
  username: string
}

type AccountDeletionBrowserInput = {
  accounts: {
    subject: BrowserAccount
    auditor: BrowserAccount
  }
  evidenceDirectory: string
  prepareFinalDeletion: () => Promise<void>
  verifyState: (stage: AccountDeletionBrowserStage) => Promise<void>
}

type Diagnostic = {
  context: string
  detail: string
  kind: 'console error' | 'console warning' | 'pageerror' | 'requestfailed' | 'response'
  path: string
  stage: string
  status?: number
}

type StrictSession = {
  activeAuthenticatedSockets: number
  authenticated: boolean
  authenticatedSockets: number
  revoked: boolean
}

/**
 * Promotion candidate for apps/web/tests/live-backend/accountDeletion.ts.
 * The coordinator supplies native inspection; this helper only drives native Settings UI and observes it.
 */
export async function verifyAccountDeletionBrowser(
  input: AccountDeletionBrowserInput
): Promise<void> {
  assert.notEqual(input.accounts.subject.userId, input.accounts.auditor.userId)
  await mkdir(input.evidenceDirectory, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const contexts: BrowserContext[] = []
  const pages: Page[] = []
  const diagnostics: Diagnostic[] = []
  const cleanupErrors: unknown[] = []
  const deleteResponses: { context: string; status: number }[] = []
  const artifactPaths: string[] = []
  let stage = 'launch'
  let failed = false
  let failure: unknown

  const record = (diagnostic: Diagnostic) => diagnostics.push(diagnostic)
  async function createPage(contextName: 'subject' | 'subjectSecond' | 'auditor') {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce'
    })
    contexts.push(context)
    context.setDefaultTimeout(30_000)
    context.setDefaultNavigationTimeout(90_000)
    await installBoundaryGuard(context, contextName, () => stage, record)
    const page = await context.newPage()
    pages.push(page)
    captureDiagnostics(page, contextName, () => stage, diagnostics, record, deleteResponses)
    return { context, page }
  }

  async function evidence(pass: string) {
    await Promise.all(
      pages.map(async (page, index) => {
        const prefix = join(input.evidenceDirectory, `${stage}-${pass}-${index}`)
        const screenshotPath = `${prefix}.png`
        const htmlPath = `${prefix}.html`
        artifactPaths.push(screenshotPath, htmlPath)
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
          caret: 'initial',
          mask: [
            page.getByText(input.accounts.subject.email, { exact: false }),
            page.getByText(input.accounts.auditor.email, { exact: false }),
            page.locator('input[name="password"], input[name="currentPassword"]')
          ],
          maskColor: '#000000'
        })
        await writeFile(htmlPath, scrub(await page.content(), input))
      })
    )
  }

  try {
    const [subjectMain, subjectSecond, auditor] = await Promise.all([
      createPage('subject'),
      createPage('subjectSecond'),
      createPage('auditor')
    ])
    const subjectMainSession = watchAuthenticatedSession(subjectMain.page)
    const subjectSecondSession = watchAuthenticatedSession(subjectSecond.page)
    const auditorSession = watchAuthenticatedSession(auditor.page)
    const strictSubjectMain = watchExpectedSession(
      subjectMain.page,
      'subject',
      input.accounts.subject.userId,
      () => stage,
      record
    )
    const strictSubjectSecond = watchExpectedSession(
      subjectSecond.page,
      'subjectSecond',
      input.accounts.subject.userId,
      () => stage,
      record
    )
    const strictAuditor = watchExpectedSession(
      auditor.page,
      'auditor',
      input.accounts.auditor.userId,
      () => stage,
      record
    )

    stage = 'sign-in'
    await Promise.all([
      signIn(subjectMain.page, input.accounts.subject, subjectMainSession),
      signIn(subjectSecond.page, input.accounts.subject, subjectSecondSession),
      signIn(auditor.page, input.accounts.auditor, auditorSession)
    ])
    await Promise.all([
      openAccountSettings(subjectMain.page, subjectMainSession, strictSubjectMain),
      openAccountSettings(subjectSecond.page, subjectSecondSession, strictSubjectSecond),
      openAccountSettings(auditor.page, auditorSession, strictAuditor)
    ])
    await reconnectAccountSettings(subjectSecond.page, subjectSecondSession, strictSubjectSecond)

    stage = 'READY'
    await input.verifyState('READY')
    await evidence('ready')

    const openDelete = subjectMain.page.getByRole('button', {
      name: 'Delete account',
      exact: true
    })
    const submitDelete = subjectMain.page.getByRole('button', {
      name: 'Permanently delete account',
      exact: true
    })
    const confirmationEmail = subjectMain.page.getByRole('textbox', {
      name: `Type ${input.accounts.subject.email} to confirm`,
      exact: true
    })
    const currentPassword = subjectMain.page.locator('input[name="currentPassword"]')

    stage = 'INVALID_EMAIL_NO_WRITE'
    await openDelete.click()
    await confirmationEmail.fill('wrong-account@example.invalid')
    await currentPassword.fill(input.accounts.subject.password)
    await expect(
      subjectMain.page.getByText('Enter the email address for this account.', { exact: true })
    ).toBeVisible()
    await expect(submitDelete).toBeDisabled()
    assert.deepEqual(
      deleteResponses,
      [],
      'A mismatched confirmation must issue zero delete requests.'
    )
    await assertActiveAccountSession(auditor.page, strictAuditor)
    await input.verifyState('INVALID_EMAIL_NO_WRITE')

    stage = 'WRONG_PASSWORD_NO_WRITE'
    await confirmationEmail.fill(input.accounts.subject.email)
    await currentPassword.fill(wrongPassword)
    await expect(submitDelete).toBeEnabled()
    const [wrongPasswordResponse] = await Promise.all([
      subjectMain.page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === accountDeletePath
      ),
      submitDelete.click()
    ])
    assert.equal(wrongPasswordResponse.status(), 400)
    const wrongPasswordBody: unknown = await wrongPasswordResponse.json()
    assert.equal(
      readStringProperty(wrongPasswordBody, 'message'),
      'The current password is incorrect.'
    )
    await expect(
      subjectMain.page.getByRole('alert').filter({ hasText: 'The current password is incorrect.' })
    ).toBeVisible()
    await assertActiveAccountSession(subjectMain.page, strictSubjectMain)
    await assertActiveAccountSession(auditor.page, strictAuditor)
    assert.deepEqual(
      deleteResponses,
      [{ context: 'subject', status: 400 }],
      'Wrong-password confirmation must produce exactly one native delete request.'
    )
    await input.verifyState('WRONG_PASSWORD_NO_WRITE')
    await evidence('wrong-password')

    stage = 'OWNED_CAMPAIGNS_REFUSED'
    await currentPassword.fill(input.accounts.subject.password)
    const [ownedCampaignsResponse] = await Promise.all([
      subjectMain.page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === accountDeletePath
      ),
      submitDelete.click()
    ])
    assert.equal(ownedCampaignsResponse.status(), 400)
    const ownedCampaignsBody: unknown = await ownedCampaignsResponse.json()
    assert.equal(
      readStringProperty(ownedCampaignsBody, 'message'),
      'Transfer or delete your Campaigns before deleting your account.'
    )
    await expect(
      subjectMain.page
        .getByRole('alert')
        .filter({ hasText: 'Transfer or delete your Campaigns before deleting your account.' })
    ).toBeVisible()
    await assertActiveAccountSession(subjectMain.page, strictSubjectMain)
    await assertActiveAccountSession(auditor.page, strictAuditor)
    assert.deepEqual(deleteResponses, [
      { context: 'subject', status: 400 },
      { context: 'subject', status: 400 }
    ])
    await input.verifyState('OWNED_CAMPAIGNS_REFUSED')
    await evidence('owned-campaigns-refused')
    await input.prepareFinalDeletion()

    stage = 'DELETED'
    await currentPassword.fill(input.accounts.subject.password)
    const [deleteResponse] = await Promise.all([
      subjectMain.page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === accountDeletePath
      ),
      submitDelete.click()
    ])
    assert.equal(deleteResponse.status(), 200)
    await expect(subjectMain.page).toHaveURL(`${origin}/sign-in`, { timeout: 30_000 })
    await expect(subjectMain.page.getByRole('textbox', { name: 'Email or username' })).toBeEnabled()
    await expect.poll(() => strictSubjectMain.revoked, { timeout: 30_000 }).toBe(true)
    await expect.poll(() => strictSubjectSecond.revoked, { timeout: 30_000 }).toBe(true)
    await assertActiveAccountSession(auditor.page, strictAuditor)
    assert.equal(strictAuditor.revoked, false)
    assert.deepEqual(deleteResponses, [
      { context: 'subject', status: 400 },
      { context: 'subject', status: 400 },
      { context: 'subject', status: 200 }
    ])
    await input.verifyState('DELETED')
    await evidence('deleted')

    stage = 'OTHER_SESSION_DENIED'
    assert.equal(strictSubjectSecond.activeAuthenticatedSockets, 0)
    await assertDeletedAccountDenied(subjectSecond.page)
    await assertActiveAccountSession(auditor.page, strictAuditor)
    await input.verifyState('OTHER_SESSION_DENIED')
    await evidence('other-session-denied')

    stage = 'RELOAD_DENIED'
    await Promise.all([
      reloadDeniedAccount(subjectMain.page),
      reloadDeniedAccount(subjectSecond.page)
    ])
    await assertActiveAccountSession(auditor.page, strictAuditor)
    await input.verifyState('RELOAD_DENIED')
    await evidence('reload-denied')
  } catch (error) {
    failed = true
    failure = error
    const result = await Promise.allSettled([evidence('failure')])
    for (const item of result) if (item.status === 'rejected') cleanupErrors.push(item.reason)
  } finally {
    const closedContexts = await Promise.allSettled(contexts.map((context) => context.close()))
    for (const item of closedContexts)
      if (item.status === 'rejected') cleanupErrors.push(item.reason)
    const closedBrowser = await Promise.allSettled([browser.close()])
    for (const item of closedBrowser)
      if (item.status === 'rejected') cleanupErrors.push(item.reason)
    const diagnosticsPath = join(input.evidenceDirectory, 'diagnostics.json')
    artifactPaths.push(diagnosticsPath)
    const written = await Promise.allSettled([
      writeFile(
        diagnosticsPath,
        scrub(
          JSON.stringify(
            {
              stage,
              deleteResponses,
              diagnostics,
              failure: failure instanceof Error ? failure.message : failed ? String(failure) : null,
              cleanupErrors: cleanupErrors.map((error) =>
                error instanceof Error ? error.message : String(error)
              )
            },
            null,
            2
          ),
          input
        )
      )
    ])
    for (const item of written) if (item.status === 'rejected') cleanupErrors.push(item.reason)
    const retained = await Promise.allSettled(
      [...new Set(artifactPaths)].map((path) => access(path))
    )
    for (const item of retained) if (item.status === 'rejected') cleanupErrors.push(item.reason)
  }

  if (failed) throw failure
  if (cleanupErrors.length > 0) throw new AggregateError(cleanupErrors, 'Browser cleanup failed.')
  assertDiagnostics(diagnostics)
}
async function installBoundaryGuard(
  context: BrowserContext,
  contextName: string,
  currentStage: () => string,
  record: (diagnostic: Diagnostic) => void
): Promise<void> {
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const isCurrentAuth =
      url.origin === origin &&
      ((request.method() === 'GET' &&
        ['/api/auth/get-session', '/api/auth/convex/token'].includes(url.pathname)) ||
        (request.method() === 'POST' &&
          [
            '/api/auth/sign-in/email',
            '/api/auth/sign-in/username',
            '/api/auth/account/delete'
          ].includes(url.pathname)))
    const isServerSessionRead =
      url.origin === origin && request.method() === 'GET' && url.pathname.startsWith('/_serverFn/')
    if (
      url.hostname.endsWith('.supabase.co') ||
      (url.origin === origin && url.pathname.startsWith('/api/') && !isCurrentAuth) ||
      (url.origin === origin && url.pathname.startsWith('/_serverFn/') && !isServerSessionRead)
    ) {
      record({
        context: contextName,
        detail: `blocked legacy request ${request.method()} ${url.hostname}${url.pathname}`,
        kind: 'requestfailed',
        path: url.pathname,
        stage: currentStage()
      })
      await route.abort('blockedbyclient')
      return
    }
    await route.continue()
  })
}

function captureDiagnostics(
  page: Page,
  context: string,
  currentStage: () => string,
  diagnostics: Diagnostic[],
  record: (diagnostic: Diagnostic) => void,
  deleteResponses: { context: string; status: number }[]
): void {
  page.on('console', (message) => {
    if (!['error', 'warning'].includes(message.type())) return
    const location = message.location().url
    record({
      context,
      detail: message.text(),
      kind: message.type() === 'warning' ? 'console warning' : 'console error',
      path: location ? new URL(location, origin).pathname : '',
      stage: currentStage()
    })
  })
  page.on('pageerror', (error) =>
    record({
      context,
      detail: error.stack ?? error.message,
      kind: 'pageerror',
      path: new URL(page.url()).pathname,
      stage: currentStage()
    })
  )
  const tolerateNavigationAbort = watchNavigationAbortedRequests(page)
  page.on('requestfailed', (request) => {
    const diagnostic: Diagnostic = {
      context,
      detail: `${request.method()} ${request.failure()?.errorText ?? 'unknown failure'}`,
      kind: 'requestfailed',
      path: new URL(request.url()).pathname,
      stage: currentStage()
    }
    record(diagnostic)
    tolerateNavigationAbort(request, () =>
      diagnostics.splice(diagnostics.lastIndexOf(diagnostic), 1)
    )
  })
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname
    if (path === accountDeletePath && response.request().method() === 'POST')
      deleteResponses.push({ context, status: response.status() })
    if (response.status() >= 400)
      record({
        context,
        detail: `${response.request().method()} ${response.status()}`,
        kind: 'response',
        path,
        stage: currentStage(),
        status: response.status()
      })
  })
}

function watchExpectedSession(
  page: Page,
  context: string,
  userId: string,
  currentStage: () => string,
  record: (diagnostic: Diagnostic) => void
): StrictSession {
  const session: StrictSession = {
    activeAuthenticatedSockets: 0,
    authenticated: false,
    authenticatedSockets: 0,
    revoked: false
  }
  const openSockets = new Set<() => void>()
  // Chromium reports no close for sockets that a document navigation tears down.
  page.on('request', (request) => {
    if (!request.isNavigationRequest() || request.frame() !== page.mainFrame()) return
    for (const revokeSocket of [...openSockets]) revokeSocket()
  })
  page.on('websocket', (socket) => {
    let socketAuthenticated = false
    const revokeSocket = () => {
      if (!socketAuthenticated) return
      socketAuthenticated = false
      openSockets.delete(revokeSocket)
      session.activeAuthenticatedSockets -= 1
      if (session.activeAuthenticatedSockets === 0) {
        session.authenticated = false
        session.revoked = true
      }
    }
    socket.on('close', revokeSocket)
    socket.on('framereceived', ({ payload }) => {
      let message: unknown
      try {
        message = JSON.parse(payload.toString())
      } catch {
        record({
          context,
          detail: 'Invalid WebSocket JSON.',
          kind: 'pageerror',
          path: new URL(page.url()).pathname,
          stage: currentStage()
        })
        return
      }
      if (!message || typeof message !== 'object' || !('modifications' in message)) return
      if (!Array.isArray(message.modifications)) return
      for (const modification of message.modifications) {
        if (!modification || typeof modification !== 'object' || !('value' in modification))
          continue
        const snapshot = authSessionSnapshotDtoSchema.safeParse(modification.value)
        if (!snapshot.success) continue
        if (!snapshot.data.user) {
          revokeSocket()
          continue
        }
        if (snapshot.data.user.userId !== userId) {
          record({
            context,
            detail: 'Authenticated WebSocket identity mismatch.',
            kind: 'pageerror',
            path: new URL(page.url()).pathname,
            stage: currentStage()
          })
          continue
        }
        session.authenticated = true
        session.revoked = false
        if (!socketAuthenticated) {
          session.activeAuthenticatedSockets += 1
          session.authenticatedSockets += 1
          socketAuthenticated = true
          openSockets.add(revokeSocket)
        }
      }
    })
  })
  return session
}

async function openAccountSettings(
  page: Page,
  session: ReturnType<typeof watchAuthenticatedSession>,
  strictSession: StrictSession
): Promise<void> {
  await page.goto(`${origin}/settings/account`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 30_000 })
  await waitForRouterIdle(page)
  await assertActiveAccountSession(page, strictSession)
  await expect.poll(() => session.authenticated, { timeout: 30_000 }).toBe(true)
}

async function reconnectAccountSettings(
  page: Page,
  session: ReturnType<typeof watchAuthenticatedSession>,
  strictSession: StrictSession
): Promise<void> {
  const authenticatedSockets = strictSession.authenticatedSockets
  session.authenticated = false
  strictSession.authenticated = false
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForRouterIdle(page)
  await assertActiveAccountSession(page, strictSession)
  await expect.poll(() => session.authenticated, { timeout: 30_000 }).toBe(true)
  await expect
    .poll(() => strictSession.authenticatedSockets, { timeout: 30_000 })
    .toBeGreaterThan(authenticatedSockets)
}

async function assertActiveAccountSession(page: Page, strictSession: StrictSession): Promise<void> {
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open account menu', exact: true })).toBeEnabled()
  await expect.poll(() => strictSession.authenticated, { timeout: 30_000 }).toBe(true)
  await expect
    .poll(() => strictSession.activeAuthenticatedSockets, { timeout: 30_000 })
    .toBeGreaterThan(0)
}

async function assertDeletedAccountDenied(page: Page): Promise<void> {
  await page.goto(`${origin}/settings/account`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await expect(page).toHaveURL(/\/sign-in(?:\?|$)/, { timeout: 30_000 })
  await expect(page.getByRole('textbox', { name: 'Email or username' })).toBeEnabled()
}

async function reloadDeniedAccount(page: Page): Promise<void> {
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/sign-in(?:\?|$)/, { timeout: 30_000 })
  await expect(page.getByRole('textbox', { name: 'Email or username' })).toBeEnabled()
}

function assertDiagnostics(diagnostics: readonly Diagnostic[]): void {
  const refusalStages = ['WRONG_PASSWORD_NO_WRITE', 'OWNED_CAMPAIGNS_REFUSED']
  const allowedRefusalResponse = (diagnostic: Diagnostic) =>
    diagnostic.kind === 'response' &&
    diagnostic.context === 'subject' &&
    refusalStages.includes(diagnostic.stage) &&
    diagnostic.path === accountDeletePath &&
    diagnostic.status === 400
  const allowedRefusalConsole = (diagnostic: Diagnostic) =>
    diagnostic.kind === 'console error' &&
    diagnostic.context === 'subject' &&
    refusalStages.includes(diagnostic.stage) &&
    diagnostic.path === accountDeletePath &&
    diagnostic.detail ===
      'Failed to load resource: the server responded with a status of 400 (Bad Request)'
  const allowed = diagnostics.filter(
    (diagnostic) => allowedRefusalResponse(diagnostic) || allowedRefusalConsole(diagnostic)
  )
  assert.equal(
    diagnostics.filter((diagnostic) => !allowed.includes(diagnostic)).length,
    0,
    `Unexpected browser diagnostics: ${JSON.stringify(diagnostics)}`
  )
  for (const refusalStage of refusalStages) {
    assert.equal(
      allowed.filter(
        (diagnostic) => allowedRefusalResponse(diagnostic) && diagnostic.stage === refusalStage
      ).length,
      1,
      `Expected exactly one HTTP 400 during ${refusalStage}.`
    )
    assert.ok(
      allowed.filter(
        (diagnostic) => allowedRefusalConsole(diagnostic) && diagnostic.stage === refusalStage
      ).length <= 1,
      `Only the matching browser resource diagnostic may accompany ${refusalStage}.`
    )
  }
}

function readStringProperty(value: unknown, property: string): string | undefined {
  if (!value || typeof value !== 'object' || !(property in value)) return undefined
  const result = (value as Record<string, unknown>)[property]
  return typeof result === 'string' ? result : undefined
}

function scrub(value: string, input: AccountDeletionBrowserInput): string {
  return value
    .replace(/(https?:\/\/[^?\s"'<>]+)\?[^\s"'<>]+/g, '$1?[redacted]')
    .replaceAll(input.accounts.subject.email, '[subject email]')
    .replaceAll(input.accounts.subject.password, '[subject password]')
    .replaceAll(input.accounts.auditor.email, '[auditor email]')
    .replaceAll(input.accounts.auditor.password, '[auditor password]')
    .replaceAll(wrongPassword, '[wrong password]')
}
