import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium, expect, type Request } from '@playwright/test'
import { authSessionSnapshotDtoSchema } from '@artificer-toolkit/schema/api/auth'
import {
  artificerPortableContentDtoSchema,
  type ArtificerPortableContentDto
} from '@artificer-toolkit/schema/api/imports'

// One owned copy of canonical SRD data, provisioned/removed by the development driver.
// Credentials stay in memory; screenshots are taken only after account setup/sign-in.
export async function verifyNativeAuthoring(input: {
  domain: 'background' | 'class' | 'feat' | 'equipment'
  evidenceDirectory: string
  email: string
  password: string
  start:
    | { kind: 'EDIT'; publicId: string; label: string }
    | {
        kind: 'COPY'
        sourceLabel: string
        verifyCopied: () => Promise<{ publicId: string; label: string }>
      }
  equipmentOptionLabel?: string
  verifySaved: (label: string) => Promise<void>
  verifyPublished?: (label: string) => Promise<void>
  verifyExported?: (content: ArtificerPortableContentDto) => Promise<void>
  verifyAfterActiveDeletion?: (label: string) => Promise<void>
  verifyAfterDraftDeletion?: () => Promise<void>
}) {
  const domainLabel =
    input.domain === 'class'
      ? 'Class'
      : input.domain === 'feat'
        ? 'Feat'
        : input.domain === 'equipment'
          ? 'Equipment'
          : 'Background'
  const domainPlural =
    input.domain === 'class'
      ? 'classes'
      : input.domain === 'feat'
        ? 'feats'
        : input.domain === 'equipment'
          ? 'equipment'
          : 'backgrounds'
  const publishedRoute = new RegExp(`/${domainPlural}/[^/]+/[^/?]+/?$`)
  const origin = 'http://localhost:3000'
  const browser = await chromium.launch({ headless: true })
  const errors: string[] = []
  const legacyRequests: string[] = []
  const failedRequests: Array<{
    stage: string
    path: string
    documentPath?: string
    error: string | null
  }> = []
  const requestDocuments = new WeakMap<Request, string>()
  const navigationTrace: Array<{
    event: string
    stage: string
    documentPath: string
    at: number
  }> = []
  const traceStart = performance.now()
  const traceNavigation = (event: string) => {
    // Failure evidence distinguishes document-unload cancellation from a live-page error.
    // Keep only request kinds/timing/document paths, never tokens, bodies or query strings.
    if (navigationTrace.length === 30) navigationTrace.shift()
    navigationTrace.push({
      event,
      stage,
      documentPath: new URL(page.url()).pathname,
      at: Math.round(performance.now() - traceStart)
    })
  }
  let nativeResolveObserved = false
  let nativeEquipmentObserved = false
  let nativeCatalogueManifestObserved = false
  let nativeExportObserved = false
  let anonymousSessionObserved = false
  let authenticatedSessionObserved = false
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  })
  context.setDefaultTimeout(30000)
  context.setDefaultNavigationTimeout(90000)
  const page = await context.newPage()
  const waitForAuthenticatedClient = async () => {
    await expect.poll(() => authenticatedSessionObserved, { timeout: 30000 }).toBe(true)
    await page.waitForFunction(() => {
      const router = (
        window as Window & {
          __TSR_ROUTER__?: { state: { status: string; isLoading: boolean } }
        }
      ).__TSR_ROUTER__
      return router?.state.status === 'idle' && !router.state.isLoading
    })
  }
  let stage = 'sign in'
  try {
    page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        errors.push(message.text())
        traceNavigation(`console ${message.type()}`)
      }
    })
    page.on('request', (request) => {
      const url = new URL(request.url())
      requestDocuments.set(request, new URL(page.url()).pathname)
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        traceNavigation(`document ${url.pathname}`)
      }
      if (url.pathname.startsWith('/_serverFn/')) traceNavigation('session refresh started')
      if (
        url.hostname.endsWith('.supabase.co') ||
        url.pathname.startsWith('/api/trpc') ||
        url.pathname.startsWith('/api/imports')
      ) {
        legacyRequests.push(`${url.hostname}${url.pathname}`)
      }
    })
    page.on('requestfinished', (request) => {
      if (new URL(request.url()).pathname.startsWith('/_serverFn/')) {
        traceNavigation('session refresh finished')
      }
    })
    page.on('requestfailed', (request) => {
      traceNavigation(
        `request failed ${new URL(request.url()).pathname.startsWith('/_serverFn/') ? 'session refresh' : 'other'}`
      )
      failedRequests.push({
        stage,
        path: new URL(request.url()).pathname,
        documentPath: requestDocuments.get(request),
        error: request.failure()?.errorText ?? null
      })
    })
    page.on('websocket', (socket) => {
      socket.on('framereceived', ({ payload }) => {
        const message: unknown = JSON.parse(payload.toString())
        if (!message || typeof message !== 'object' || !('modifications' in message)) return
        if (!Array.isArray(message.modifications)) return
        for (const modification of message.modifications) {
          if (!modification || typeof modification !== 'object' || !('value' in modification))
            continue
          const snapshot = authSessionSnapshotDtoSchema.safeParse(modification.value)
          if (snapshot.success && snapshot.data.user === null) anonymousSessionObserved = true
          if (snapshot.success && snapshot.data.user !== null) authenticatedSessionObserved = true
        }
      })
      socket.on('framesent', ({ payload }) => {
        // Inspect only the function identifier; never record frame arguments or auth tokens.
        if (payload.toString().includes('authoring/nodeRuntime:resolve')) {
          nativeResolveObserved = true
        }
        if (payload.toString().includes('content/equipmentOptions:list')) {
          nativeEquipmentObserved = true
        }
        if (payload.toString().includes('contentSnapshots/manifest:catalogue')) {
          nativeCatalogueManifestObserved = true
        }
        if (payload.toString().includes('content/exports:get')) {
          nativeExportObserved = true
        }
      })
    })
    await page.goto(`${origin}/sign-in`, {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    })
    await expect.poll(() => anonymousSessionObserved, { timeout: 30000 }).toBe(true)
    await page.getByRole('textbox', { name: 'Email or username' }).fill(input.email)
    await page.locator('input[name="password"]').fill(input.password)
    stage = 'submit sign in'
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 60000 })
    stage = 'home hydration'
    await expect(
      page.getByRole('heading', {
        name: 'Start with Library or Create',
        exact: true
      })
    ).toBeVisible({ timeout: 30000 })
    // SSR markup can be visible while the router is still refreshing the new session.
    await waitForAuthenticatedClient()

    let draft: { publicId: string; label: string }
    if (input.start.kind === 'COPY') {
      stage = `Guided copy from ${domainLabel} catalogue`
      await page.goto(`${origin}/${domainPlural}/new`, {
        waitUntil: 'domcontentloaded',
        timeout: 90000
      })
      await expect(
        page.getByRole('heading', {
          name: 'How do you want to begin?',
          exact: true
        })
      ).toBeFocused({ timeout: 60000 })
      await page
        .getByRole('button', {
          name: new RegExp(
            `^Use an existing ${input.domain === 'equipment' ? 'item' : input.domain}`
          )
        })
        .click()
      const sources = page.getByRole('combobox', {
        name: `Search ${input.domain === 'equipment' ? 'items' : domainPlural}`,
        exact: true
      })
      await expect(sources).toBeEnabled({ timeout: 30000 })
      await expect.poll(() => nativeCatalogueManifestObserved).toBe(true)
      await sources.fill(input.start.sourceLabel)
      await page.getByRole('option', { name: input.start.sourceLabel, exact: true }).click()
      await expect(page.getByRole('button', { name: 'Create copy', exact: true })).toBeEnabled()
      await page.screenshot({
        path: `${input.evidenceDirectory}/${input.domain}-guided-copy-desktop.png`
      })
      await page.getByRole('button', { name: 'Create copy', exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`/${domainPlural}/[^/]+/[^/]+/edit$`), {
        timeout: 30000
      })
      draft = await input.start.verifyCopied()
      assert.equal(new URL(page.url()).pathname.split('/')[2], draft.publicId)
    } else {
      stage = `open ${domainLabel} draft`
      draft = input.start
      await page.goto(`${origin}/${domainPlural}/${encodeURIComponent(draft.publicId)}/edit`, {
        waitUntil: 'domcontentloaded',
        timeout: 90000
      })
    }
    const canvas = page.getByTestId('authoring-form-canvas')
    await expect(canvas).toBeVisible({ timeout: 60000 })
    await expect(page).toHaveTitle('Artificer Toolkit')
    await expect.poll(() => nativeResolveObserved, { timeout: 30000 }).toBe(true)
    await page.getByRole('button', { name: 'Switch to advanced', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Use guided authoring', exact: true })
    ).toBeEnabled({
      timeout: 30000
    })
    const name = canvas.getByRole('textbox', { name: /name/i }).filter({ visible: true })
    await expect(name).toHaveValue(draft.label, { timeout: 30000 })
    await expect.poll(() => nativeResolveObserved).toBe(true)
    await expect(page.locator('vite-error-overlay')).toHaveCount(0)
    await page.screenshot({
      path: `${input.evidenceDirectory}/${input.domain}-authoring-desktop.png`
    })

    stage = `save ${domainLabel} draft`
    const nextLabel = `${draft.label} native proof`
    await name.fill(nextLabel)
    await name.blur()
    const save = page.getByRole('button', { name: /save draft/i }).filter({ visible: true })
    await expect(save).toBeEnabled()
    await save.click()
    await expect(page.getByText(/all changes saved/i)).toBeVisible({
      timeout: 30000
    })
    await input.verifySaved(nextLabel)

    stage = `reload ${domainLabel} draft`
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    await expect(name).toHaveValue(nextLabel, { timeout: 60000 })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(name).toBeVisible()
    await page.screenshot({
      path: `${input.evidenceDirectory}/${input.domain}-authoring-mobile.png`
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    stage = `Guided ${domainLabel} fields`
    await page.getByRole('button', { name: 'Use guided authoring', exact: true }).click()
    if (input.domain === 'feat') {
      await expect(page.getByRole('heading', { name: 'Name your feat', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      await expect(
        page.getByRole('heading', {
          name: 'Describe the core outcome',
          exact: true
        })
      ).toBeVisible()
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      await expect(
        page.getByRole('heading', {
          name: 'Add supporting features',
          exact: true
        })
      ).toBeVisible()
      await page.screenshot({
        path: `${input.evidenceDirectory}/feat-guided-features-desktop.png`
      })
    } else if (input.domain === 'equipment') {
      await expect(page.getByRole('heading', { name: 'Name the item', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      await expect(
        page.getByRole('heading', { name: 'Set the item details', exact: true })
      ).toBeVisible()
      const parent = page.getByRole('combobox', { name: 'Base item', exact: true })
      assert.ok(input.equipmentOptionLabel, 'The Equipment journey requires its canonical parent.')
      await expect(parent).toBeEnabled({ timeout: 30000 })
      await expect.poll(() => nativeEquipmentObserved).toBe(true)
      await expect(parent).toHaveValue(input.equipmentOptionLabel)
      await parent.click()
      await page.getByRole('option', { name: input.equipmentOptionLabel, exact: true }).click()
      await expect(parent).toHaveValue('')
      await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
      await parent.click()
      await page.getByRole('option', { name: input.equipmentOptionLabel, exact: true }).click()
      await expect(parent).toHaveValue(input.equipmentOptionLabel)
      await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled()
      await page.screenshot({
        path: `${input.evidenceDirectory}/equipment-guided-parent-desktop.png`
      })
    } else {
      await expect(
        page.getByRole('heading', {
          name: input.domain === 'background' ? 'Name your background' : 'Name the class',
          exact: true
        })
      ).toBeVisible()
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      await expect(
        page.getByRole('heading', {
          name: input.domain === 'background' ? 'Add the benefits' : 'Build the chassis',
          exact: true
        })
      ).toBeVisible()
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      await expect(
        page.getByRole('heading', {
          name:
            input.domain === 'background'
              ? 'Choose starting gear'
              : 'Choose proficiencies and gear',
          exact: true
        })
      ).toBeVisible()
      const equipment = page.getByRole('combobox', {
        name: 'Starting item',
        exact: true
      })
      await expect(equipment).toBeEnabled({ timeout: 30000 })
      await expect.poll(() => nativeEquipmentObserved).toBe(true)
      assert.ok(input.equipmentOptionLabel, 'The equipment journey requires a canonical option.')
      await equipment.fill(input.equipmentOptionLabel)
      await expect(
        page.getByRole('option', {
          name: input.equipmentOptionLabel,
          exact: true
        })
      ).toBeVisible()
      await equipment.press('Escape')
      await page.screenshot({
        path: `${input.evidenceDirectory}/${input.domain}-guided-equipment-desktop.png`
      })
    }
    await page.getByRole('button', { name: 'Switch to advanced', exact: true }).click()
    console.log(
      `Native ${domainLabel} ${input.start.kind === 'COPY' ? 'Guided copy, ' : ''}resolution, save/reload and owner binding passed including Guided ${input.domain === 'feat' ? 'features' : 'equipment'}.`
    )
    if (input.verifyPublished) {
      stage = `activate ${domainLabel}`
      const activate = page
        .getByRole('button', { name: 'Activate', exact: true })
        .filter({ visible: true })
      await expect(activate).toBeEnabled({ timeout: 30000 })
      await activate.click()
      await expect(page).toHaveURL(publishedRoute, { timeout: 30000 })
      await expect(page.getByRole('heading', { name: nextLabel, exact: true })).toBeVisible()
      await input.verifyPublished(nextLabel)
      if (input.domain === 'equipment') {
        assert.ok(input.equipmentOptionLabel)
        await expect(page.getByText(input.equipmentOptionLabel, { exact: true })).toBeVisible()
      }
      stage = `reload published ${domainLabel}`
      authenticatedSessionObserved = false
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
      await expect(page.getByRole('heading', { name: nextLabel, exact: true })).toBeVisible({
        timeout: 30000
      })
      // Wait for this document's client subscription before screenshots or JS-only actions.
      await waitForAuthenticatedClient()
      await page.screenshot({
        path: `${input.evidenceDirectory}/${input.domain}-published-desktop.png`
      })
      await page.setViewportSize({ width: 390, height: 844 })
      await expect(page.getByRole('heading', { name: nextLabel, exact: true })).toBeVisible()
      await page.screenshot({
        path: `${input.evidenceDirectory}/${input.domain}-published-mobile.png`
      })
      await page.setViewportSize({ width: 1280, height: 900 })
      if (input.verifyExported) {
        stage = `export published ${domainLabel}`
        const [download] = await Promise.all([
          page.waitForEvent('download'),
          page
            .getByRole('button', { name: 'Export JSON', exact: true })
            .filter({ visible: true })
            .click()
        ])
        assert.ok(download.suggestedFilename().endsWith('.artificer.json'))
        const exportPath = `${input.evidenceDirectory}/${input.domain}-published.artificer.json`
        await download.saveAs(exportPath)
        const content = artificerPortableContentDtoSchema.parse(
          JSON.parse(await readFile(exportPath, 'utf8'))
        )
        await input.verifyExported(content)
        assert.equal(
          nativeExportObserved,
          true,
          'The browser download must use the native export query.'
        )
        console.log(
          `Browser ${domainLabel} portable export passed with exact active payload and native transport.`
        )
      }
      stage = `edit published ${domainLabel}`
      await page
        .getByRole('button', { name: 'Edit', exact: true })
        .filter({ visible: true })
        .click()
      await expect(name).toHaveValue(nextLabel, { timeout: 30000 })
      const replacementLabel = `${nextLabel} revised`
      await name.fill(replacementLabel)
      await name.blur()
      await expect(save).toBeEnabled()
      await save.click()
      await expect(page.getByText(/all changes saved/i)).toBeVisible({
        timeout: 30000
      })
      await input.verifySaved(replacementLabel)
      stage = `replace published ${domainLabel}`
      await expect(activate).toBeEnabled({ timeout: 30000 })
      await activate.click()
      await expect(page).toHaveURL(publishedRoute, { timeout: 30000 })
      await expect(page.getByRole('heading', { name: replacementLabel, exact: true })).toBeVisible()
      await input.verifyPublished(replacementLabel)
      console.log(
        `Browser ${domainLabel} activation, published reload, working-edit isolation and replacement passed.`
      )
      if (input.verifyAfterActiveDeletion && input.verifyAfterDraftDeletion) {
        stage = `search published ${domainLabel} catalogue`
        const activeDetailUrl = page.url()
        authenticatedSessionObserved = false
        await page.goto(`${origin}/${domainPlural}`, {
          waitUntil: 'domcontentloaded',
          timeout: 90000
        })
        await expect(
          page.getByRole('heading', {
            name: `${domainPlural[0]!.toUpperCase()}${domainPlural.slice(1)}`
          })
        ).toBeVisible({ timeout: 30000 })
        await waitForAuthenticatedClient()
        const search = page.getByRole('textbox', {
          name: `Search ${domainPlural}`,
          exact: true
        })
        const source = page.getByRole('combobox', { name: 'Source', exact: true })
        await expect(search).toBeVisible()
        await expect(source).toBeVisible()
        // The list reads the published snapshot files: the newly activated record appears once the
        // catalogue manifest advances, and search and filters run locally.
        await search.fill(replacementLabel)
        await source.click()
        await page.getByRole('option', { name: 'Homebrew', exact: true }).click()
        const replacementRow = page.getByRole('row', {
          name: `View ${replacementLabel}`,
          exact: true
        })
        await expect(replacementRow).toBeVisible({ timeout: 30000 })
        await page.screenshot({
          path: `${input.evidenceDirectory}/${input.domain}-catalogue-homebrew-desktop.png`
        })
        await page.setViewportSize({ width: 390, height: 844 })
        await expect(
          page.getByRole('textbox', { name: `Search ${domainPlural}`, exact: true })
        ).toBeVisible()
        await page.screenshot({
          path: `${input.evidenceDirectory}/${input.domain}-catalogue-homebrew-mobile.png`
        })
        await page.setViewportSize({ width: 1280, height: 900 })
        await source.click()
        await page.getByRole('option', { name: 'SRD', exact: true }).click()
        await expect(replacementRow).toHaveCount(0)
        await source.click()
        await page.getByRole('option', { name: 'Homebrew', exact: true }).click()
        await expect(replacementRow).toBeVisible()
        await page.getByRole('button', { name: 'Table view', exact: true }).click()

        stage = `edit retained ${domainLabel} draft`
        await page.getByRole('button', { name: `Open ${replacementLabel}`, exact: true }).click()
        await expect(page).toHaveURL(publishedRoute, { timeout: 30000 })
        await page
          .getByRole('button', { name: 'Edit', exact: true })
          .filter({ visible: true })
          .click()
        await expect(name).toHaveValue(replacementLabel, { timeout: 30000 })
        const retainedDraftLabel = `${replacementLabel} retained draft`
        await name.fill(retainedDraftLabel)
        await name.blur()
        await expect(save).toBeEnabled()
        await save.click()
        await expect(page.getByText(/all changes saved/i)).toBeVisible({ timeout: 30000 })
        await input.verifySaved(retainedDraftLabel)

        stage = `delete active ${domainLabel} with retained draft`
        authenticatedSessionObserved = false
        await page.goto(activeDetailUrl, { waitUntil: 'domcontentloaded', timeout: 90000 })
        await expect(
          page.getByRole('heading', { name: replacementLabel, exact: true })
        ).toBeVisible({
          timeout: 30000
        })
        await waitForAuthenticatedClient()
        await page
          .getByRole('button', { name: 'Delete', exact: true })
          .filter({ visible: true })
          .click()
        const activeDeleteDialog = page.getByRole('dialog', {
          name: `Delete ${replacementLabel}`
        })
        await expect(activeDeleteDialog).toContainText(
          `Any draft for this ${domainLabel.toLowerCase()} will stay available.`
        )
        await activeDeleteDialog.getByRole('button', { name: 'Delete', exact: true }).click()
        await expect(page).toHaveURL(new RegExp(`/${domainPlural}/?$`), { timeout: 30000 })
        await input.verifyAfterActiveDeletion(retainedDraftLabel)

        stage = `discard retained ${domainLabel} draft`
        await page.getByText('Drafts (1)', { exact: true }).click()
        await expect(
          page.getByRole('button', { name: `Open ${retainedDraftLabel}`, exact: true })
        ).toBeVisible()
        await page.getByRole('button', { name: `Open ${retainedDraftLabel}`, exact: true }).click()
        await expect(
          page.getByRole('heading', { name: retainedDraftLabel, exact: true })
        ).toBeVisible({
          timeout: 30000
        })
        await page
          .getByRole('button', { name: 'Delete', exact: true })
          .filter({ visible: true })
          .click()
        const draftDeleteDialog = page.getByRole('dialog', {
          name: `Delete ${retainedDraftLabel}`
        })
        await expect(draftDeleteDialog).toContainText(
          `Delete the draft for ${retainedDraftLabel}? The active ${domainLabel.toLowerCase()} will stay unchanged if one exists.`
        )
        await draftDeleteDialog.getByRole('button', { name: 'Delete', exact: true }).click()
        await expect(page).toHaveURL(new RegExp(`/${domainPlural}/?$`), { timeout: 30000 })
        await input.verifyAfterDraftDeletion()
        console.log(
          `Browser ${domainLabel} native catalogue search, active deletion and retained-draft discard passed.`
        )
      }
    }
    stage = 'legacy dependency check'
    assert.deepEqual(
      failedRequests.filter(
        (request) =>
          request.documentPath === '/sign-in' &&
          (request.path.startsWith('/_serverFn/') || request.path === '/api/auth/convex/token')
      ),
      [],
      'Sign-in must not abort its session verification requests.'
    )
    assert.deepEqual(
      legacyRequests,
      [],
      `${domainLabel} journey must not request legacy product data.`
    )
    assert.deepEqual(
      errors,
      [],
      `${domainLabel} journey must not log application errors or warnings.`
    )
  } catch (error) {
    const routerState = await page
      .evaluate(() => {
        const router = (
          window as Window & {
            __TSR_ROUTER__?: {
              state: {
                status: string
                isLoading: boolean
                matches: Array<{ routeId: string; status: string; error?: unknown }>
              }
            }
          }
        ).__TSR_ROUTER__
        return router
          ? {
              status: router.state.status,
              isLoading: router.state.isLoading,
              matches: router.state.matches.map((match) => ({
                routeId: match.routeId,
                status: match.status,
                error:
                  match.error instanceof Error
                    ? {
                        name: match.error.name,
                        message: match.error.message,
                        stack: match.error.stack
                      }
                    : typeof match.error
              }))
            }
          : null
      })
      .catch(() => null)
    const diagnostic = JSON.stringify({
      stage,
      routerState,
      route: new URL(page.url()).pathname,
      navigationTrace: navigationTrace.slice(-30),
      body: (
        await page
          .locator('body')
          .innerText()
          .catch(() => '')
      ).slice(0, 4500),
      nativeResolveObserved,
      nativeEquipmentObserved,
      nativeCatalogueManifestObserved,
      legacyRequests,
      failedRequests: failedRequests.slice(-5),
      errors: errors.slice(-5)
    })
    const message =
      `${error instanceof Error ? error.message : `${domainLabel} browser failed.`}\n${diagnostic}`
        .replaceAll(input.email, '[fixture email]')
        .replaceAll(input.password, '[fixture password]')
    throw new Error(message)
  } finally {
    await browser.close()
  }
}
