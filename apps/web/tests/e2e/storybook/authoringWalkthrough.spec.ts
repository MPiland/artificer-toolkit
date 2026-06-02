import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { authoredFormCoverage, authoredFormCoverageStories, type AuthoringCoverageMode } from './authoringCoverage'

const storyExpect = expect.configure({ timeout: 20_000 })
const MAX_ROW_EXPANSIONS = 80
const MAX_WORKSPACE_DEPTH = 5
const AUTHORING_RENDERER_FILE = /AuthoringRenderer\.tsx$/

test.describe.configure({ mode: 'serial' })

type PageFailure = {
  message: string
  source: string
}

type SurfaceMetrics = {
  contentHeight: number | null
  contentWidth: number | null
  viewportHeight: number | null
  viewportWidth: number | null
}

type AuthoringUxAuditEvent =
  | {
      kind: 'field-change'
      stepName: string
    }
  | {
      kind: 'inline-expand'
      label: string
      stepName: string
    }
  | {
      kind: 'workspace-close'
      closeKind: 'back' | 'done'
      depthBeforeClose: number
      returnedStepName: string
      sourceStepName: string
    }
  | {
      kind: 'workspace-open'
      actionLabel: string
      childMapHint: string
      depthAfterOpen: number
      depthBeforeOpen: number
      sourceStepName: string
      surface: SurfaceMetrics
    }
  | {
      kind: 'reset-step'
      stepName: string
    }
  | {
      kind: 'readonly-step'
      stepName: string
    }
  | {
      kind: 'step-visit'
      mode: AuthoringCoverageMode
      stepName: string
    }

type AuthoringUxAuditReport = {
  domain: string
  events: AuthoringUxAuditEvent[]
  failures: PageFailure[]
  mode: AuthoringCoverageMode
  storyExportName: string
  storyId: string
  summary: {
    fieldChanges: number
    inlineExpansions: number
    maxWorkspaceDepth: number
    resets: number
    stepVisits: number
    workspaceOpens: number
  }
}

function createAuthoringUxAudit({
  domain,
  mode,
  storyExportName,
  storyId
}: {
  domain: string
  mode: AuthoringCoverageMode
  storyExportName: string
  storyId: string
}): AuthoringUxAuditReport {
  return {
    domain,
    events: [],
    failures: [],
    mode,
    storyExportName,
    storyId,
    summary: {
      fieldChanges: 0,
      inlineExpansions: 0,
      resets: 0,
      stepVisits: 0,
      maxWorkspaceDepth: 0,
      workspaceOpens: 0
    }
  }
}

async function openStory(page: Page, storyId: string) {
  await page.goto(`/iframe.html?id=${storyId}&viewMode=story`, { waitUntil: 'commit', timeout: 60_000 })
  await storyExpect(page.getByTestId('authoring-form-content')).toBeVisible()
}

function formStepNav(page: Page) {
  return page.getByRole('navigation', { name: /^(form sections|.+ steps)$/i }).first()
}

function editorWorkspaces(page: Page) {
  return page.getByRole('region').filter({
    has: page.getByRole('button', { name: /close editor/i })
  })
}

function activeWorkspace(page: Page) {
  return editorWorkspaces(page).last()
}

function rowTriggers(surface: Page | Locator) {
  return surface.locator('button[aria-expanded="false"]:has(> svg[aria-hidden="true"]):has(> span)')
}

function editButtons(surface: Page | Locator) {
  return surface.getByRole('button', { name: /^edit /i })
}

function saveLikeButtons(page: Page) {
  return page.getByRole('button', { name: /^(save|activate|submit)/i })
}

function removeLikeButtons(page: Page) {
  return page.getByRole('button', { name: /^remove /i })
}

function recordPageFailures(page: Page) {
  const failures: PageFailure[] = []

  page.on('console', (message) => {
    if (message.type() !== 'error') return
    failures.push({ source: 'console', message: message.text() })
  })
  page.on('pageerror', (error) => {
    failures.push({ source: 'pageerror', message: error.message })
  })
  page.on('requestfailed', (request) => {
    if (!['document', 'fetch', 'script', 'xhr'].includes(request.resourceType())) return
    failures.push({
      source: 'requestfailed',
      message: `${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`
    })
  })

  return failures
}

async function assertNoPageFailures(failures: readonly PageFailure[]) {
  expect(failures, failures.map((failure) => `${failure.source}: ${failure.message}`).join('\n')).toEqual([])
}

function appendUniqueFailures(target: PageFailure[], failures: readonly PageFailure[]) {
  for (const failure of failures) {
    if (!target.includes(failure)) target.push(failure)
  }
}

function summarizeAudit(report: AuthoringUxAuditReport) {
  report.summary = {
    fieldChanges: report.events.filter((event) => event.kind === 'field-change').length,
    inlineExpansions: report.events.filter((event) => event.kind === 'inline-expand').length,
    maxWorkspaceDepth: Math.max(0, ...report.events.map((event) => (
      event.kind === 'workspace-open' ? event.depthAfterOpen : 0
    ))),
    resets: report.events.filter((event) => event.kind === 'reset-step').length,
    stepVisits: report.events.filter((event) => event.kind === 'step-visit').length,
    workspaceOpens: report.events.filter((event) => event.kind === 'workspace-open').length
  }

  return report
}

async function writeAuthoringUxAudit(testInfo: TestInfo, report: AuthoringUxAuditReport) {
  const outputPath = testInfo.outputPath('authoring-ux-audit.json')
  mkdirSync(dirname(outputPath), { recursive: true })
  const body = JSON.stringify(summarizeAudit(report), null, 2)
  writeFileSync(outputPath, body)
  await testInfo.attach('authoring-ux-audit', {
    body,
    contentType: 'application/json'
  })
}

async function getSurfaceMetrics(page: Page): Promise<SurfaceMetrics> {
  const viewport = page.viewportSize()
  const content = page.getByTestId('authoring-form-content')
  const box = await content.boundingBox().catch(() => null)

  return {
    contentHeight: box?.height ?? null,
    contentWidth: box?.width ?? null,
    viewportHeight: viewport?.height ?? null,
    viewportWidth: viewport?.width ?? null
  }
}

function inferChildMapHintFromEditLabel(actionLabel: string) {
  return actionLabel
    .replace(/^edit\s+/i, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+([a-z0-9])/g, (_match, next: string) => next.toUpperCase())
    .replace(/[^a-z0-9]/g, '')
}

async function installNavigationMarker(page: Page) {
  const marker = `authoring-${Date.now()}-${Math.random()}`
  await page.evaluate((nextMarker) => {
    Object.assign(window, { __authoringWalkthroughMarker: nextMarker })
  }, marker)

  return marker
}

async function expectNavigationMarker(page: Page, marker: string) {
  await expect.poll(async () => page.evaluate(() => (
    (window as typeof window & { __authoringWalkthroughMarker?: string }).__authoringWalkthroughMarker
  ))).toBe(marker)
}

async function expectSameUrl(page: Page, url: string) {
  await expect.poll(() => page.url()).toBe(url)
}

async function getStepNames(page: Page) {
  const nav = formStepNav(page)
  if (await nav.count() === 0) return []

  const buttons = nav.getByRole('button')
  const count = await buttons.count()
  const names: string[] = []

  for (let index = 0; index < count; index += 1) {
    const name = (await buttons.nth(index).innerText()).trim()
    if (name) names.push(name)
  }

  return names
}

async function getCurrentStepName(page: Page) {
  const currentStep = formStepNav(page).locator('[aria-current="step"]')
  if (await currentStep.count() > 0) return (await currentStep.first().innerText()).trim()

  const heading = page.getByRole('heading', { level: 1 }).first()
  return (await heading.innerText()).trim()
}

async function goToStep(page: Page, stepName: string) {
  const stepButton = formStepNav(page).getByRole('button').filter({ hasText: stepName }).first()
  if (await stepButton.count() === 0) return false

  await stepButton.click()
  await storyExpect.poll(async () => getCurrentStepName(page)).toBe(stepName)
  return true
}

async function assertCurrentStep(page: Page, stepName: string) {
  const nav = formStepNav(page)
  if (await nav.count() === 0) return
  await storyExpect(nav.getByRole('button').filter({ hasText: stepName }).first()).toHaveAttribute('aria-current', 'step')
}

async function isEditable(locator: Locator) {
  return await locator.isVisible()
    && await locator.isEnabled()
    && await locator.getAttribute('readonly') == null
    && await locator.getAttribute('aria-readonly') !== 'true'
}

async function changeFirstEditableField(page: Page, audit?: AuthoringUxAuditReport, stepName?: string) {
  const comboboxes = page.getByRole('combobox')
  const comboCount = await comboboxes.count()
  for (let index = 0; index < comboCount; index += 1) {
    const combo = comboboxes.nth(index)
    if (!await combo.isVisible() || !await combo.isEnabled()) continue

    await combo.click()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    if (audit && stepName) audit.events.push({ kind: 'field-change', stepName })
    return true
  }

  const textboxes = page.getByRole('textbox')
  const textboxCount = await textboxes.count()
  for (let index = 0; index < textboxCount; index += 1) {
    const textbox = textboxes.nth(index)
    if (!await isEditable(textbox)) continue

    const currentValue = await textbox.inputValue().catch(() => '')
    await textbox.fill(currentValue ? `${currentValue} Test` : 'Test')
    if (audit && stepName) audit.events.push({ kind: 'field-change', stepName })
    return true
  }

  const spinbuttons = page.getByRole('spinbutton')
  const spinbuttonCount = await spinbuttons.count()
  for (let index = 0; index < spinbuttonCount; index += 1) {
    const spinbutton = spinbuttons.nth(index)
    if (!await isEditable(spinbutton)) continue

    const currentValue = Number(await spinbutton.inputValue().catch(() => '0'))
    await spinbutton.fill(String(Number.isFinite(currentValue) ? currentValue + 1 : 1))
    if (audit && stepName) audit.events.push({ kind: 'field-change', stepName })
    return true
  }

  return false
}

async function resetCurrentStepIfDirty(page: Page, stepName: string, audit?: AuthoringUxAuditReport) {
  const resetStep = page.getByRole('button', { name: /reset step/i }).first()
  if (await resetStep.count() === 0 || !await resetStep.isVisible() || !await resetStep.isEnabled()) return

  await resetStep.click()
  await assertCurrentStep(page, stepName)
  audit?.events.push({ kind: 'reset-step', stepName })
}

async function expandAllRows(surface: Page | Locator, audit?: AuthoringUxAuditReport, stepName?: string) {
  for (let iteration = 0; iteration < MAX_ROW_EXPANSIONS; iteration += 1) {
    const trigger = rowTriggers(surface).first()
    if (await trigger.count() === 0) return
    const label = (await trigger.innerText()).trim()
    await trigger.click()
    if (audit && stepName && label) audit.events.push({ kind: 'inline-expand', label, stepName })
  }

  throw new Error(`Exceeded ${MAX_ROW_EXPANSIONS} row expansions while walking authoring form.`)
}

async function getVisibleEditButtonNames(surface: Page | Locator) {
  const buttons = editButtons(surface)
  const count = await buttons.count()
  const names: string[] = []

  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index)
    if (!await button.isVisible() || !await button.isEnabled()) continue
    const name = (await button.innerText()).trim()
    if (name) names.push(name)
  }

  return names
}

async function closeActiveWorkspaceWithBack(page: Page) {
  await activeWorkspace(page).getByRole('button', { name: /^back$/i }).click()
}

async function closeActiveWorkspaceWithDone(page: Page) {
  const currentWorkspace = activeWorkspace(page)

  for (let index = 0; index < 20; index += 1) {
    const doneButton = currentWorkspace.getByRole('button', { name: /^done$/i })
    if (await doneButton.count() > 0 && await doneButton.isVisible()) {
      await doneButton.click()
      return
    }

    const nextButton = currentWorkspace.getByRole('button', { name: /^next$/i })
    if (await nextButton.count() === 0 || !await nextButton.isVisible() || !await nextButton.isEnabled()) break
    await nextButton.click()
  }

  await closeActiveWorkspaceWithBack(page)
}

async function walkWorkspaceEditors(
  page: Page,
  parentStepName: string,
  surface: Page | Locator,
  audit?: AuthoringUxAuditReport,
  depth = 0
) {
  if (depth > MAX_WORKSPACE_DEPTH) {
    throw new Error(`Exceeded nested editor depth ${MAX_WORKSPACE_DEPTH}.`)
  }

  const openedNames = new Set<string>()
  let nextNames = await getVisibleEditButtonNames(surface)

  while (nextNames.some((name) => !openedNames.has(name))) {
    const name = nextNames.find((candidate) => !openedNames.has(candidate))
    if (!name) return
    openedNames.add(name)

    const beforeWorkspaces = await editorWorkspaces(page).count()
    const surfaceMetrics = await getSurfaceMetrics(page)
    await surface.getByRole('button', { name, exact: true }).first().click()
    await storyExpect.poll(async () => editorWorkspaces(page).count()).toBeGreaterThan(beforeWorkspaces)
    const depthAfterOpen = await editorWorkspaces(page).count()
    audit?.events.push({
      kind: 'workspace-open',
      actionLabel: name,
      childMapHint: inferChildMapHintFromEditLabel(name),
      depthAfterOpen,
      depthBeforeOpen: beforeWorkspaces,
      sourceStepName: parentStepName,
      surface: surfaceMetrics
    })

    const workspace = activeWorkspace(page)
    await expandAllRows(workspace, audit, parentStepName)
    await walkWorkspaceEditors(page, await getCurrentStepName(page), workspace, audit, depth + 1)
    const closeKind = openedNames.size % 2 === 0 ? 'back' : 'done'
    if (openedNames.size % 2 === 0) {
      await closeActiveWorkspaceWithBack(page)
    } else {
      await closeActiveWorkspaceWithDone(page)
    }
    await storyExpect.poll(async () => editorWorkspaces(page).count()).toBe(beforeWorkspaces)
    await assertCurrentStep(page, parentStepName)
    audit?.events.push({
      kind: 'workspace-close',
      closeKind,
      depthBeforeClose: depthAfterOpen,
      returnedStepName: await getCurrentStepName(page),
      sourceStepName: parentStepName
    })

    nextNames = await getVisibleEditButtonNames(surface)
  }
}

async function walkEditableStory(page: Page, audit: AuthoringUxAuditReport) {
  const storyUrl = page.url()
  const marker = await installNavigationMarker(page)
  const steps = await getStepNames(page)
  const stepNames = steps.length > 0 ? steps : [await getCurrentStepName(page)]

  for (const stepName of stepNames) {
    if (steps.length > 0 && !await goToStep(page, stepName)) continue
    audit.events.push({ kind: 'step-visit', mode: 'editable', stepName })

    await expectSameUrl(page, storyUrl)
    await expectNavigationMarker(page, marker)
    await expandAllRows(page, audit, stepName)
    await walkWorkspaceEditors(page, stepName, page, audit)
    await assertCurrentStep(page, stepName)
  }

  const dirtyStepNames = await getStepNames(page)
  for (const stepName of (dirtyStepNames.length > 0 ? dirtyStepNames : [await getCurrentStepName(page)])) {
    if (dirtyStepNames.length > 0 && !await goToStep(page, stepName)) continue
    const changed = await changeFirstEditableField(page, audit, stepName)

    await expectSameUrl(page, storyUrl)
    await expectNavigationMarker(page, marker)
    await assertCurrentStep(page, stepName)

    if (changed) await resetCurrentStepIfDirty(page, stepName, audit)
  }
}

async function walkReadonlyStory(page: Page, audit: AuthoringUxAuditReport) {
  const steps = await getStepNames(page)
  for (const stepName of steps) {
    if (!await goToStep(page, stepName)) continue
    audit.events.push({ kind: 'step-visit', mode: 'readonly', stepName })
    audit.events.push({ kind: 'readonly-step', stepName })
    await expandAllRows(page, audit, stepName)
  }

  await storyExpect(removeLikeButtons(page)).toHaveCount(0)
  await storyExpect(saveLikeButtons(page)).toHaveCount(0)
  await storyExpect(page.getByRole('button', { name: /duplicate|copy/i }).first()).toBeVisible()
}

function storyModeLabel(mode: AuthoringCoverageMode) {
  return mode === 'readonly' ? 'readonly' : 'editable'
}

function getActiveAuthoringRendererDomains() {
  const domainsRoot = resolve(process.cwd(), 'src/domains')

  return readdirSync(domainsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((domain) => {
      const componentsPath = resolve(domainsRoot, domain, 'components')
      if (!existsSync(componentsPath)) return false

      return readdirSync(componentsPath).some((fileName) => AUTHORING_RENDERER_FILE.test(fileName))
    })
}

test.describe('authored form coverage manifest', () => {
  test('covers each active domain authoring renderer and story export', async () => {
    for (const domain of authoredFormCoverage) {
      const storyPath = resolve(process.cwd(), domain.storyFile)
      expect(existsSync(storyPath), `${domain.domain} story file should exist`).toBe(true)

      const source = readFileSync(storyPath, 'utf8')
      expect(source).toContain(`title: '${domain.title}'`)

      const exports = Array.from(source.matchAll(/^export const ([A-Z][A-Za-z0-9]*)/gm), (match) => match[1])
        .filter((exportName) => exportName !== 'Default')
      const coveredExports = new Set(domain.stories.map((story) => story.exportName))
      expect(coveredExports, `${domain.domain} manifest should match story exports`).toEqual(new Set(exports))
    }

    expect(new Set(authoredFormCoverage.map((domain) => domain.domain))).toEqual(new Set(getActiveAuthoringRendererDomains()))
  })
})

test.describe('authored form exhaustive interactions', () => {
  for (const story of authoredFormCoverageStories) {
    test(`${story.domain} ${story.exportName} ${storyModeLabel(story.mode)}`, async ({ page }, testInfo) => {
      test.setTimeout(90_000)
      const failures = recordPageFailures(page)
      const audit = createAuthoringUxAudit({
        domain: story.domain,
        mode: story.mode,
        storyExportName: story.exportName,
        storyId: story.id
      })

      try {
        await openStory(page, story.id)

        if (story.mode === 'readonly') {
          await walkReadonlyStory(page, audit)
        } else {
          await walkEditableStory(page, audit)
        }

        appendUniqueFailures(audit.failures, failures)
        await assertNoPageFailures(failures)
      } finally {
        appendUniqueFailures(audit.failures, failures)
        await writeAuthoringUxAudit(testInfo, audit)
      }
    })
  }
})
