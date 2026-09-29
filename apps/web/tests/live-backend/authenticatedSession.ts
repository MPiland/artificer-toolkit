import assert from 'node:assert/strict'
import { join } from 'node:path'
import { chromium, expect, type Page } from '@playwright/test'

// Called by the dev fixture driver: only generated credentials in memory, no
// stored browser profile, email delivery, trace, or credential-bearing screenshot.
export async function verifyAuthenticatedBrowserSession(input: {
  email: string
  password: string
  verifyRevoked: (jwt: string) => Promise<void>
  profile?: {
    username: string
    bio: string
    other: { username: string; password: string; bio: string }
    screenshotDirectory: string
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
    async function signIn(identifier: string, password: string) {
      stage = 'sign in'
      await page.getByRole('textbox', { name: 'Email or username' }).fill(identifier)
      await page.locator('input[name="password"]').fill(password)
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
    async function signOut() {
      stage = 'sign out'
      await page.goto(`${origin}/logout`, { waitUntil: 'domcontentloaded', timeout: 90000 })
      await expect(page).toHaveURL(`${origin}/sign-in`, { timeout: 30000 })
      await expect(page.getByRole('textbox', { name: 'Email or username' })).toBeEnabled()
      // A URL change precedes completion of the router's session refresh.
      await page.waitForFunction(() => {
        const router = (
          window as Window & {
            __TSR_ROUTER__?: { state: { status: string; isLoading: boolean } }
          }
        ).__TSR_ROUTER__
        return router?.state.status === 'idle' && !router.state.isLoading
      })
    }
    await page.goto(`${origin}/systems`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await expect(page).toHaveURL(/\/sign-in\?redirect=/, { timeout: 30000 })
    const started = performance.now()
    await signIn(input.email, input.password)
    await expect(page.getByRole('heading', { name: 'Game Systems', exact: true })).toBeVisible({
      timeout: 60000
    })
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

    const reloadStarted = performance.now()
    stage = 'authenticated reload'
    const response = await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    assert.equal(response?.status(), 200)
    assert.match(response?.headers()['cache-control'] ?? '', /private.*no-store/)
    const html = await response.text()
    assert.ok(!html.includes(jwt), 'Backend JWT must not appear in serialized SSR output.')
    assert.match(html, /Game Systems/, 'Authenticated content must be server rendered.')
    await expect(page.getByRole('heading', { name: 'Game Systems', exact: true })).toBeVisible()
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
      await signIn(profile.username.toLowerCase(), input.password)
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
      await page.setViewportSize({ width: 390, height: 844 })
      await expect(page.getByRole('button', { name: 'Save profile', exact: true })).toBeVisible()
      await page.screenshot({
        path: join(profile.screenshotDirectory, 'profile-browser-mobile.png')
      })
      await signOut()
      console.log(
        'Username collision, rename/case preservation, username login and same-browser account isolation passed.'
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
