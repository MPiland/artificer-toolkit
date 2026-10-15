import assert from 'node:assert/strict'
import { join } from 'node:path'
import { chromium, expect, type Page } from '@playwright/test'

// Called by the dev fixture driver: only generated credentials in memory, no
// stored browser profile, email delivery, trace, or credential-bearing screenshot.
export async function verifyAuthenticatedBrowserSession(input: {
  email: string
  password: string
  verifyRevoked: (jwt: string) => Promise<void>
  /** Native check that the live session JWT is accepted and a forged one is refused. */
  verifyBearer: (jwt: string) => Promise<void>
  profile?: {
    username: string
    bio: string
    other: { username: string; password: string; bio: string }
    screenshotDirectory: string
    /** Native check of what the second account reads while the first account holds `visibility`. */
    verifyVisibility: (visibility: 'Private' | 'Public') => Promise<void>
  }
}) {
  const origin = 'http://localhost:3000'
  const browser = await chromium.launch({ headless: true })
  let jwt = ''
  let stage = 'anonymous entry'
  let diagnosticPage: Page | undefined
  const browserErrors: string[] = []
  const failedResponses: { route: string; path: string; status: number }[] = []
  const failedRequests: {
    stage: string
    route: string
    path: string
    error: string | undefined
  }[] = []
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    diagnosticPage = page
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const source = message.location().url
      const path = source ? new URL(source, origin).pathname : ''
      // The SDK's in-flight token refresh can correctly receive 401 after sign-out.
      if (
        path === '/api/auth/convex/token' &&
        message.text() ===
          'Failed to load resource: the server responded with a status of 401 (Unauthorized)'
      )
        return
      browserErrors.push(
        `${stage}: ${new URL(page.url()).pathname} [${path}] ${message.text().slice(0, 1000)}`
      )
    })
    page.on('response', (response) => {
      if (response.status() < 400) return
      failedResponses.push({
        route: new URL(page.url()).pathname,
        path: new URL(response.url()).pathname,
        status: response.status()
      })
    })
    page.on('requestfailed', (request) => {
      if (!['fetch', 'xhr'].includes(request.resourceType())) return
      failedRequests.push({
        stage,
        route: new URL(page.url()).pathname,
        path: new URL(request.url()).pathname,
        error: request.failure()?.errorText
      })
    })
    const failures: string[] = []
    const legacyRequests: string[] = []
    page.on('pageerror', (error) => failures.push(error.message))
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.hostname.endsWith('.supabase.co') || url.pathname.startsWith('/api/trpc')) {
        legacyRequests.push(`${url.hostname}${url.pathname}`)
      }
    })
    // Better Auth allows 3 requests per 10 s on each sign-in path and answers the next with a 429
    // until 10 s pass without a request. The journey signs in more often than that, so it waits
    // out the window instead of depending on how fast the machine runs.
    const signInPaths = {
      email: { count: 0, last: -Infinity },
      username: { count: 0, last: -Infinity }
    }
    async function awaitSignInWindow(identifier: string) {
      const path = signInPaths[identifier.includes('@') ? 'email' : 'username']
      const windowMs = 10_000
      const marginMs = 500
      if (path.count >= 3 && performance.now() - path.last <= windowMs + marginMs)
        await page.waitForTimeout(path.last + windowMs + marginMs - performance.now())
      const now = performance.now()
      path.count = now - path.last > windowMs ? 1 : path.count + 1
      path.last = now
    }
    async function signIn(identifier: string, password: string) {
      stage = 'sign in'
      await page.getByRole('textbox', { name: 'Email or username' }).fill(identifier)
      await page.locator('input[name="password"]').fill(password)
      await awaitSignInWindow(identifier)
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 60000 })
      if (new URL(page.url()).pathname === '/home') {
        await expect(
          page.getByRole('heading', { name: 'Start with Library or Create', exact: true })
        ).toBeVisible({ timeout: 30000 })
      }
    }
    async function openProfile() {
      stage = 'open profile'
      await page.getByRole('button', { name: 'Open account menu', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Settings', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible({
        timeout: 30000
      })
    }
    // A URL change precedes completion of the router's session refresh.
    async function waitForRouterIdle() {
      await page.waitForFunction(() => {
        const router = (
          window as Window & {
            __TSR_ROUTER__?: { state: { status: string; isLoading: boolean } }
          }
        ).__TSR_ROUTER__
        return router?.state.status === 'idle' && !router.state.isLoading
      })
    }
    async function signOut() {
      stage = 'sign out'
      await page.goto(`${origin}/logout`, { waitUntil: 'domcontentloaded', timeout: 90000 })
      await expect(page).toHaveURL(`${origin}/sign-in`, { timeout: 30000 })
      await expect(page.getByRole('textbox', { name: 'Email or username' })).toBeEnabled()
      await waitForRouterIdle()
    }
    // A protected deep link sends the visitor to sign-in; either login must return to that path.
    async function signInReturningToSystems(identifier: string, password: string) {
      stage = 'protected deep link'
      await page.goto(`${origin}/systems`, { waitUntil: 'domcontentloaded', timeout: 90000 })
      await expect(page).toHaveURL(/\/sign-in\?redirect=/, { timeout: 30000 })
      assert.equal(new URL(page.url()).searchParams.get('redirect'), '/systems')
      await signIn(identifier, password)
      await expect(page).toHaveURL(`${origin}/systems`, { timeout: 60000 })
      await expect(page.getByRole('heading', { name: 'Game Systems', exact: true })).toBeVisible({
        timeout: 60000
      })
    }
    const started = performance.now()
    await signInReturningToSystems(input.email, input.password)
    console.log(
      JSON.stringify({ browserSignInToSystemsMs: Math.round(performance.now() - started) })
    )

    const cookies = await context.cookies(origin)
    const sessionCookie = cookies.find((cookie) => cookie.name.includes('session_token'))
    assert.ok(sessionCookie?.httpOnly, 'Session cookie must be HttpOnly.')
    assert.equal(sessionCookie.sameSite, 'Lax')
    const tokenResponse = await context.request.get(`${origin}/api/auth/convex/token`)
    assert.equal(tokenResponse.status(), 200)
    const tokenBody: unknown = await tokenResponse.json()
    assert.ok(
      tokenBody &&
        typeof tokenBody === 'object' &&
        'token' in tokenBody &&
        typeof tokenBody.token === 'string'
    )
    jwt = tokenBody.token
    stage = 'native bearer'
    await input.verifyBearer(jwt)

    const reloadStarted = performance.now()
    stage = 'authenticated reload'
    const response = await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    assert.equal(response?.status(), 200)
    assert.match(response?.headers()['cache-control'] ?? '', /private.*no-store/)
    const html = await response.text()
    assert.ok(!html.includes(jwt), 'Backend JWT must not appear in serialized SSR output.')
    // The reload keeps the session: the server renders the signed-in layout for this account before
    // any script runs. Page bodies render client-side (D75), so the account menu is the SSR signal.
    assert.ok(
      html.includes('aria-label="Open account menu"'),
      'Reload must server-render the signed-in shell.'
    )
    assert.equal(new URL(page.url()).pathname, '/systems')
    await expect(page.getByRole('heading', { name: 'Game Systems', exact: true })).toBeVisible()
    // Hydration completes on the same session: the router settles on /systems with no sign-in bounce.
    await waitForRouterIdle()
    assert.equal(new URL(page.url()).pathname, '/systems')
    await page.screenshot({
      path: 'local-validation/local-convex-proofs/phase82-foundation/private-ssr-browser.png'
    })
    console.log(
      JSON.stringify({ authenticatedReloadMs: Math.round(performance.now() - reloadStarted) })
    )
    stage = 'notifications'
    await page.goto(`${origin}/notifications`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await expect(page.getByRole('heading', { name: 'No notifications yet' })).toBeVisible({
      timeout: 30000
    })

    if (input.profile) {
      const profile = input.profile
      await openProfile()
      const username = page.getByRole('textbox', { name: 'Username', exact: true })
      const bio = page.getByRole('textbox', { name: 'Bio', exact: true })
      const save = page.getByRole('button', { name: 'Save profile', exact: true })
      await username.fill(profile.other.username.toUpperCase())
      await expect(page.getByText('That username is already taken.', { exact: true })).toBeVisible()
      await expect(save).toBeDisabled()
      await username.fill(profile.username)
      await bio.fill(profile.bio)
      await expect(save).toBeEnabled({ timeout: 15000 })
      await save.click()
      await expect(page.getByText('Profile saved.', { exact: true })).toBeVisible()
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
      await expect(username).toHaveValue(profile.username)
      await expect(bio).toHaveValue(profile.bio)

      // A display-case edit preserves the canonical login name and needs no collision probe.
      await username.fill(profile.username.toUpperCase())
      await save.click()
      await expect(page.getByText('Profile saved.', { exact: true })).toBeVisible()
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
      await expect(username).toHaveValue(profile.username.toUpperCase())
      await expect(bio).toHaveValue(profile.bio)
      await expect(page.locator('vite-error-overlay')).toHaveCount(0)
      assert.match(await page.title(), /Artificer/i)
      await page.screenshot({
        path: join(profile.screenshotDirectory, 'profile-browser-desktop.png')
      })
    }

    await signOut()
    await input.verifyRevoked(jwt)
    if (input.profile) {
      const profile = input.profile
      await signInReturningToSystems(profile.username.toLowerCase(), input.password)
      await openProfile()
      await expect(page.getByRole('textbox', { name: 'Username', exact: true })).toHaveValue(
        profile.username.toUpperCase()
      )
      await expect(page.getByRole('textbox', { name: 'Bio', exact: true })).toHaveValue(profile.bio)
      await signOut()

      // Reuse the browser context; a new one would hide cross-account cache leaks.
      await signIn(profile.other.username, profile.other.password)
      await openProfile()
      await expect(page.getByRole('textbox', { name: 'Username', exact: true })).toHaveValue(
        profile.other.username
      )
      await expect(page.getByRole('textbox', { name: 'Bio', exact: true })).toHaveValue(
        profile.other.bio
      )
      await expect(page.getByText(profile.bio, { exact: true })).toHaveCount(0)

      // Profile visibility: Private by default, Public to any signed-in account, Private again at once.
      const primaryProfilePath = `${origin}/profiles/${profile.username.toLowerCase()}`
      const unavailable = page.getByText("This profile is private or doesn't exist.", {
        exact: true
      })
      async function viewPrimaryProfile() {
        stage = 'view public profile'
        await page.goto(primaryProfilePath, { waitUntil: 'domcontentloaded', timeout: 90000 })
      }
      async function expectPrimaryProfilePrivate() {
        await viewPrimaryProfile()
        await expect(unavailable).toBeVisible({ timeout: 30000 })
        await expect(page.getByText(profile.bio, { exact: true })).toHaveCount(0)
      }
      async function setPrimaryVisibility(visibility: 'Private' | 'Public') {
        await signOut()
        await signIn(profile.username.toLowerCase(), input.password)
        await openProfile()
        stage = `set ${visibility} profile visibility`
        await page
          .getByRole('radiogroup', { name: 'Profile visibility', exact: true })
          .getByText(visibility, { exact: true })
          .click()
        await expect(page.getByRole('radio', { name: visibility, exact: true })).toBeChecked()
        await expect(
          page.getByRole('link', { name: 'View public profile', exact: true })
        ).toHaveCount(visibility === 'Public' ? 1 : 0, { timeout: 30000 })
        await signOut()
        await signIn(profile.other.username, profile.other.password)
      }
      await expectPrimaryProfilePrivate()
      await profile.verifyVisibility('Private')
      await setPrimaryVisibility('Public')
      await viewPrimaryProfile()
      await expect(
        page.getByRole('heading', { level: 1, name: profile.username.toUpperCase(), exact: true })
      ).toBeVisible({ timeout: 30000 })
      await expect(page.getByText(profile.bio, { exact: true })).toBeVisible()
      expect(await page.content()).not.toContain(input.email)
      await profile.verifyVisibility('Public')
      await setPrimaryVisibility('Private')
      await expectPrimaryProfilePrivate()
      await profile.verifyVisibility('Private')
      await openProfile()

      await page.setViewportSize({ width: 390, height: 844 })
      await expect(page.getByRole('button', { name: 'Save profile', exact: true })).toBeVisible()
      await page.screenshot({
        path: join(profile.screenshotDirectory, 'profile-browser-mobile.png')
      })
      await signOut()
      console.log(
        'Username collision, rename/case preservation, username login, profile visibility and same-browser account isolation passed.'
      )
    }
    stage = 'protected redirect after sign out'
    await page.goto(`${origin}/systems`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await expect(page).toHaveURL(/\/sign-in\?redirect=/, { timeout: 30000 })
    assert.deepEqual(legacyRequests, [], 'Migrated shell must not contact the old backend.')
    assert.deepEqual(failures, [], 'Authenticated browser must not have uncaught page errors.')
    // Chromium may report a canceled server-function fetch while a hard navigation
    // destroys the old document. Match one error to one actual client abort; genuine
    // network failures and unmatched React errors must still fail this journey.
    const canceledCalls = failedRequests.filter(
      ({ path, error }) => path.startsWith('/_serverFn/') && error === 'net::ERR_ABORTED'
    )
    const applicationErrors = browserErrors.filter((message) => {
      if (
        !message.includes('TypeError: Failed to fetch') ||
        !message.includes('/client-rpc/serverFnFetcher.js')
      )
        return true
      const index = canceledCalls.findIndex(({ stage, route }) =>
        message.startsWith(`${stage}: ${route} [`)
      )
      if (index < 0) return true
      canceledCalls.splice(index, 1)
      return false
    })
    assert.deepEqual(
      applicationErrors,
      [],
      'Authenticated browser must not log application errors.'
    )
    if (applicationErrors.length !== browserErrors.length) {
      console.log(
        `${browserErrors.length - applicationErrors.length} document-navigation fetch cancellation(s) matched to client aborts.`
      )
    }
    assert.deepEqual(
      failedResponses.filter(
        ({ path, status }) => path !== '/api/auth/convex/token' || status !== 401
      ),
      [],
      'Only token refresh after session revocation may return an HTTP error.'
    )
    console.log(
      'Authenticated SSR/reload, native notification feed, sign-out and revoked-JWT denial passed.'
    )
  } catch (error) {
    const diagnostic = diagnosticPage
      ? JSON.stringify({
          route: new URL(diagnosticPage.url()).pathname,
          body: (
            await diagnosticPage
              .locator('body')
              .innerText()
              .catch(() => '')
          ).slice(0, 3000),
          errors: browserErrors.slice(-3),
          failedResponses,
          failedRequests: failedRequests.slice(-6)
        })
      : ''
    let safeMessage =
      `${error instanceof Error ? error.message : 'Authenticated browser failed.'}\n${diagnostic}`
        .replaceAll(input.email, '[fixture email]')
        .replaceAll(input.password, '[fixture password]')
    if (input.profile)
      safeMessage = safeMessage.replaceAll(input.profile.other.password, '[fixture password]')
    throw new Error(jwt ? safeMessage.replaceAll(jwt, '[fixture JWT]') : safeMessage)
  } finally {
    await browser.close()
  }
}
