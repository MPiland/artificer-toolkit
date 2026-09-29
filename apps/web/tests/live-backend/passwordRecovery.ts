import assert from 'node:assert/strict'
import { join } from 'node:path'
import { chromium, expect, type Page } from '@playwright/test'

// The driver supplies a fixture OTP; no inbox, credentials, or browser storage is persisted.
export async function verifyPasswordRecoveryBrowser(input: {
  email: string
  unknownEmail: string
  password: string
  replacementPassword: string
  code: string
  screenshotDirectory: string
  verifySessions: () => Promise<void>
}) {
  const origin = 'http://localhost:3000'
  const browser = await chromium.launch({ headless: true })
  const errors: string[] = []
  const legacy: string[] = []
  const responses: Array<{ path: string; status: number }> = []
  let stage = 'login before recovery'
  try {
    const existingContext = await browser.newContext({
      viewport: { width: 1280, height: 900 }
    })
    const recoveryContext = await browser.newContext({
      viewport: { width: 1280, height: 900 }
    })
    const existing = await existingContext.newPage()
    const page = await recoveryContext.newPage()
    for (const target of [existing, page]) {
      target.on('pageerror', (error) => errors.push(`${stage}: ${error.message}`))
      target.on('console', (message) => {
        if (!['warn', 'error'].includes(message.type())) return
        const path = new URL(message.location().url || origin, origin).pathname
        if (
          (path === '/api/auth/email-otp/check-verification-otp' &&
            message.text().includes('400')) ||
          (path === '/api/auth/convex/token' && message.text().includes('401'))
        )
          return
        errors.push(`${stage}: ${message.text().slice(0, 500)}`)
      })
      target.on('response', (response) => {
        if (response.status() >= 400)
          responses.push({
            path: new URL(response.url()).pathname,
            status: response.status()
          })
      })
      target.on('request', (request) => {
        const url = new URL(request.url())
        if (url.hostname.endsWith('.supabase.co') || url.pathname.startsWith('/api/trpc'))
          legacy.push(`${url.hostname}${url.pathname}`)
      })
    }
    async function ready(target: Page) {
      await target.waitForFunction(() => {
        const router = (
          window as Window & {
            __TSR_ROUTER__?: { state: { status: string; isLoading: boolean } }
          }
        ).__TSR_ROUTER__
        return router?.state.status === 'idle' && !router.state.isLoading
      })
      await expect(target.locator('vite-error-overlay')).toHaveCount(0)
    }
    async function signIn(target: Page, password: string) {
      await ready(target)
      await target.getByRole('textbox', { name: 'Email or username' }).fill(input.email)
      await target.locator('input[name="password"]').fill(password)
      await target.getByRole('button', { name: 'Sign in', exact: true }).click()
      await expect(target).not.toHaveURL(/\/sign-in/, { timeout: 60000 })
      await ready(target)
    }
    async function enterCode(code: string) {
      // Clear the previous complete code before replacing digits; PinInput submits on completion.
      for (let index = 0; index < code.length; index++) {
        await page
          .getByRole('textbox', {
            name: `Verification code digit ${index + 1}`,
            exact: true
          })
          .fill('')
      }
      for (let index = 0; index < code.length; index++) {
        await page
          .getByRole('textbox', {
            name: `Verification code digit ${index + 1}`,
            exact: true
          })
          .fill(code[index]!)
      }
    }
    await existing.goto(`${origin}/systems`, {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    })
    await expect(existing).toHaveURL(/\/sign-in/, { timeout: 30000 })
    await signIn(existing, input.password)
    await expect(existing.getByRole('heading', { name: 'Game Systems', exact: true })).toBeVisible({
      timeout: 30000
    })

    stage = 'non-enumerating reset request'
    await page.goto(`${origin}/reset-password`, {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    })
    await ready(page)
    await expect(
      page.getByRole('heading', { name: 'Reset your password', exact: true })
    ).toBeVisible()
    await expect(page).toHaveTitle(/Artificer/i)
    await page.getByRole('textbox', { name: 'Email address' }).fill(input.unknownEmail)
    const request = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/auth/email-otp/request-password-reset'
    )
    await page.getByRole('button', { name: 'Send verification code', exact: true }).click()
    assert.equal((await request).status(), 200)
    await expect(
      page.getByRole('heading', {
        name: 'Verify your reset code',
        exact: true
      })
    ).toBeVisible()
    await expect(page).toHaveURL(`${origin}/verify-password-reset`)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await ready(page)
    await expect(page.getByRole('textbox', { name: 'Email address' })).toHaveValue('')

    stage = 'invalid code then valid code'
    await page.getByRole('textbox', { name: 'Email address' }).fill(input.email)
    await enterCode('000000')
    await expect(page.getByRole('alert')).toBeVisible()
    await enterCode(input.code)
    await expect(page.getByLabel(/^New password/)).toBeVisible()
    assert.equal(new URL(page.url()).search, '', 'Recovery secrets must not enter the URL.')
    assert.equal(new URL(page.url()).hash, '')

    stage = 'reload safely clears in-memory recovery proof'
    await page.reload({ waitUntil: 'domcontentloaded' })
    await ready(page)
    await expect(page.getByRole('textbox', { name: 'Email address' })).toHaveValue('')
    await expect(page.getByLabel(/^New password/)).toHaveCount(0)
    await page.getByRole('textbox', { name: 'Email address' }).fill(input.email)
    await enterCode(input.code)
    await expect(page.getByLabel(/^New password/)).toBeVisible()
    await page.getByLabel(/^New password/).fill(input.replacementPassword)
    await page.getByLabel(/^Confirm password/).fill(`${input.replacementPassword}x`)
    await page.getByRole('button', { name: 'Update password', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Enter the same password in both fields.')
    await page.getByLabel(/^Confirm password/).fill(input.replacementPassword)
    stage = 'password reset and live session revocation'
    await page.getByRole('button', { name: 'Update password', exact: true }).click()
    await expect(page).toHaveURL(`${origin}/sign-in`, { timeout: 30000 })
    await ready(page)

    stage = 'old sessions revoked and other account preserved'
    await input.verifySessions()
    await existing.reload({ waitUntil: 'domcontentloaded' })
    await expect(existing).toHaveURL(/\/sign-in/, { timeout: 30000 })
    await ready(existing)
    await expect(existing.getByRole('textbox', { name: 'Email or username' })).toBeVisible()

    stage = 'new password login and authenticated SSR reload'
    await signIn(page, input.replacementPassword)
    await page.goto(`${origin}/systems`, {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    })
    await expect(page.getByRole('heading', { name: 'Game Systems', exact: true })).toBeVisible()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await ready(page)
    await expect(page.getByRole('heading', { name: 'Game Systems', exact: true })).toBeVisible()
    await page.screenshot({
      path: join(input.screenshotDirectory, 'recovered-session-desktop.png')
    })
    await page.goto(`${origin}/logout`, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(`${origin}/sign-in`, { timeout: 30000 })
    await ready(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({
      path: join(input.screenshotDirectory, 'recovered-signout-mobile.png')
    })
    assert.deepEqual(legacy, [], 'Recovery must not use legacy transports.')
    assert.deepEqual(errors, [], 'No unexpected browser errors or warnings.')
    assert.equal(
      responses.filter(
        ({ path, status }) =>
          path === '/api/auth/email-otp/check-verification-otp' && status === 400
      ).length,
      1
    )
    assert.deepEqual(
      responses.filter(
        ({ path, status }) =>
          !(
            (path === '/api/auth/email-otp/check-verification-otp' && status === 400) ||
            (path === '/api/auth/convex/token' && status === 401)
          )
      ),
      [],
      'No unexpected failed responses.'
    )
    console.log(
      'Recovery browser: request, invalid code, reload, reset, revoked session, new login/SSR and logout passed; zero legacy requests.'
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Browser check failed.'
    throw new Error(
      `${stage}: ${message}\nResponses: ${JSON.stringify(responses)}\nBrowser errors: ${JSON.stringify(errors)}`
        .replaceAll(input.email, '[fixture email]')
        .replaceAll(input.unknownEmail, '[unknown email]')
        .replaceAll(input.password, '[password]')
        .replaceAll(input.replacementPassword, '[password]')
        .replaceAll(input.code, '[code]')
    )
  } finally {
    await browser.close()
  }
}
