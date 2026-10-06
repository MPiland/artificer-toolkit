import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { chromium, expect, type APIResponse, type Page } from '@playwright/test'
import { z } from 'zod'

// R05.2 request audit (D75, D80): signed-in pages render on the server without Convex data prefetch,
// and a window blur/refocus issues no Better Auth session refetch. Called by the dev fixture driver
// with generated credentials in memory; nothing credential-bearing is retained.
const origin = 'http://localhost:3000'
const evidencePath =
  'local-validation/local-convex-proofs/phase82-signed-in-request-audit/request-audit.json'

// Route families behind `_authed` whose loaders call `ensureQueryData`: the signed-in landing page,
// a list and a three-query detail page of the authored catalogue, the per-user lists, the layout's
// notification feed and a settings page. Every child inherits `defaultSsr: false`; the sample covers
// each loader shape that could regress it. Entity detail routes need fixtures and share these loaders'
// mechanism, so they are covered by the static policy test (-ssrPolicy.test.ts).
const signedInPaths = (systemId: string) => [
  '/home',
  '/systems',
  `/systems/${systemId}`,
  '/characters',
  '/campaigns',
  '/notifications',
  '/settings/profile'
]

// The Convex backend's native function log is the only observable of the server-side render: its
// Convex calls leave the web server, never the browser. `caller` HttpApi marks a call made through
// the HTTP client API, as the server's ConvexHttpClient does; the auth component's internal calls
// carry other callers. The cursor is a timestamp that repeats its last entry.
const functionLogCompletionSchema = z.object({
  kind: z.literal('Completion'),
  udfType: z.string(),
  identifier: z.string(),
  caller: z.string().nullable(),
  identityType: z.string().nullable(),
  executionId: z.string(),
  timestamp: z.number()
})
const functionLogPageSchema = z.object({ entries: z.array(z.unknown()), newCursor: z.number() })
type FunctionLogCompletion = z.infer<typeof functionLogCompletionSchema>

const serverClientCaller = 'HttpApi'
// The only Convex call a signed-in server render makes: the root route's session snapshot.
const sessionIdentifier = 'account:session'
const markerIdentifier = 'account:identity'

export async function verifySignedInRequestAudit(input: {
  email: string
  password: string
  systemId: string
  readFunctionLog: (cursor: number) => Promise<unknown>
  callMarker: () => Promise<unknown>
}) {
  const violations: string[] = []
  const pages: unknown[] = []
  const focusSessionRequests: { path: string; count: number }[] = []
  let cursor = 0
  const seen = new Set<string>()
  const drain = async () => {
    const page = functionLogPageSchema.parse(await input.readFunctionLog(cursor))
    cursor = page.newCursor
    return page.entries.flatMap((entry) => {
      const completion = functionLogCompletionSchema.safeParse(entry)
      if (!completion.success || seen.has(completion.data.executionId)) return []
      seen.add(completion.data.executionId)
      return [completion.data]
    })
  }
  // Everything up to and including the marker call is delivered in order, so the marker proves the
  // request's executions have reached the log without a fixed wait.
  const executionsDuring = async (request: () => Promise<APIResponse>) => {
    await drain()
    const response = await request()
    await input.callMarker()
    const fresh: FunctionLogCompletion[] = []
    const findMarker = () =>
      fresh.find(
        (entry) => entry.identifier === markerIdentifier && entry.caller === serverClientCaller
      )
    await expect
      .poll(async () => {
        fresh.push(...(await drain()))
        return Boolean(findMarker())
      })
      .toBe(true)
    const marker = findMarker()
    assert.ok(marker)
    return { response, executions: fresh.filter((entry) => entry.timestamp < marker.timestamp) }
  }

  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    let armed = false
    const sessionRequests: string[] = []
    page.on('request', (request) => {
      if (armed && new URL(request.url()).pathname === '/api/auth/get-session')
        sessionRequests.push(request.url())
    })

    await page.goto(`${origin}/sign-in`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.getByRole('textbox', { name: 'Email or username' }).fill(input.email)
    await page.locator('input[name="password"]').fill(input.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 60000 })

    // Parked on a blank document so no subscription of this tab can re-run a query in a window.
    await page.goto('about:blank')
    const paths = signedInPaths(input.systemId)
    for (const path of paths) {
      // A raw request executes no page script, so every Convex call during it is the server's.
      const { response, executions } = await executionsDuring(() =>
        context.request.get(`${origin}${path}`, {
          headers: { accept: 'text/html' },
          maxRedirects: 0
        })
      )
      const serverCalls = executions
        .filter((entry) => entry.caller === serverClientCaller)
        .map(({ udfType, identifier, caller, identityType }) => ({
          udfType,
          identifier,
          caller,
          identityType
        }))
      const session = serverCalls[0]
      if (response.status() !== 200 || !/no-store/u.test(response.headers()['cache-control'] ?? ''))
        violations.push(`${path}: SSR answered ${response.status()} instead of a private render.`)
      else if (
        serverCalls.length !== 1 ||
        session?.identifier !== sessionIdentifier ||
        session.udfType !== 'Query' ||
        session.identityType !== 'user'
      )
        violations.push(
          `${path}: the server render made Convex calls other than one signed-in ${sessionIdentifier} query: ${JSON.stringify(serverCalls)}`
        )

      pages.push({
        path,
        ssrStatus: response.status(),
        ssrClientCalls: serverCalls,
        ssrExecutionCount: executions.length
      })
    }

    for (const path of paths) {
      await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
      await page.waitForFunction(() => {
        const router = (
          window as Window & {
            __TSR_ROUTER__?: { state: { status: string; isLoading: boolean } }
          }
        ).__TSR_ROUTER__
        return router?.state.status === 'idle' && !router.state.isLoading
      })
      await page.waitForLoadState('networkidle')
      sessionRequests.length = 0
      armed = true
      await refocusWindow(page)
      armed = false
      focusSessionRequests.push({ path, count: sessionRequests.length })
      if (sessionRequests.length > 0)
        violations.push(
          `${path}: refocusing the window requested the session ${sessionRequests.length} time(s).`
        )
    }
  } finally {
    await browser.close()
  }

  const verdict = violations.length === 0 ? 'passed' : 'failed'
  await mkdir(dirname(evidencePath), { recursive: true })
  await writeFile(
    evidencePath,
    JSON.stringify({ verdict, violations, pages, focusSessionRequests }, null, 2)
  )
  assert.equal(violations.length, 0, `Signed-in request audit failed:\n${violations.join('\n')}`)
  console.log(
    `Signed-in request audit passed for ${pages.length} pages: no server-side Convex prefetch and no session refetch on window focus.`
  )
}

// Better Auth refetches only from `visibilitychange` once the document is visible again; it
// subscribes to nothing when `refetchOnWindowFocus` is false. Playwright cannot blur a page, so the
// hidden-then-visible transition is replayed on the document. The barrier request returns after any
// request the handlers started, and the idle wait covers a request that follows.
async function refocusWindow(page: Page) {
  await page.evaluate(async () => {
    for (const state of ['hidden', 'visible']) {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    Reflect.deleteProperty(document, 'visibilityState')
    window.dispatchEvent(new Event('blur'))
    window.dispatchEvent(new Event('focus'))
    await fetch('/favicon.svg', { cache: 'no-store' })
  })
  await page.waitForLoadState('networkidle')
}
