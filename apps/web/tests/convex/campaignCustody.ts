import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect, type Page } from '@playwright/test'
import { authSessionSnapshotDtoSchema } from '@artificer-toolkit/schema/api/auth'

export type CampaignCustodyStage =
  | 'cargo-filled'
  | 'unavailable'
  | 'restored'
  | 'returned'
  | 'destroy-filled'
  | 'destroyed'

type CampaignCredential = { email: string; password: string }

export type CampaignCustodyVerificationInput = {
  owner: CampaignCredential
  players: readonly [CampaignCredential, CampaignCredential]
  publicId: string
  evidenceDirectory: string
  verifyState: (stage: CampaignCustodyStage) => Promise<void>
}

const origin = 'http://localhost:3000'
const campaignSlug = 'encounter-execution-fixture'
const vehicleLabel = 'Campaign Vehicle'

export async function verifyCampaignCustodyBrowser(
  input: CampaignCustodyVerificationInput
): Promise<void> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const diagnostics: string[] = []
  let stage = 'sign in'
  let owner: Page | undefined
  let players: [Page, Page] | undefined
  let contexts: Array<Awaited<ReturnType<typeof browser.newContext>>> = []

  try {
    contexts = await Promise.all(
      ['owner', 'player-1', 'player-2'].map(async () => {
        const context = await browser.newContext({
          viewport: { width: 1280, height: 900 },
          reducedMotion: 'reduce'
        })
        context.setDefaultTimeout(30_000)
        context.setDefaultNavigationTimeout(90_000)
        await context.tracing.start({
          screenshots: true,
          snapshots: true,
          sources: true
        })
        return context
      })
    )
    owner = await contexts[0].newPage()
    players = [await contexts[1].newPage(), await contexts[2].newPage()]
    const pages = [owner, ...players] as const
    const sessions = pages.map((page) => watchAuthenticatedSession(page))
    pages.forEach((page, index) =>
      captureDiagnostics(page, ['owner', 'player-1', 'player-2'][index], () => stage, diagnostics)
    )

    await Promise.all([
      signIn(owner, input.owner, sessions[0]),
      signIn(players[0], input.players[0], sessions[1]),
      signIn(players[1], input.players[1], sessions[2])
    ])

    stage = 'open inventory'
    for (const [index, page] of pages.entries())
      await openInventory(page, input.publicId, sessions[index])
    await Promise.all(pages.map(assertHealthyPage))
    await expect(owner.getByRole('heading', { name: 'Vehicles', exact: true })).toBeVisible()
    await expect(
      owner.getByRole('heading', { name: 'Inventory activity', exact: true })
    ).toBeVisible()
    for (const player of players)
      await expect(
        player.getByRole('heading', {
          name: 'Inventory activity',
          exact: true
        })
      ).toHaveCount(0)
    await expect(owner.getByText('No Campaign vehicles.', { exact: true })).toBeVisible()

    stage = 'fill first vehicle cargo'
    await addVehicle(owner)
    await fillVehicleCargo(owner)
    await assertOwnerCargo(owner)
    await assertPlayersCanReadCargo(players)
    await assertPlayersCannotMutate(players)
    await input.verifyState('cargo-filled')
    await Promise.all(
      pages.map((page, index) =>
        page.screenshot({
          caret: 'initial',
          path: `${input.evidenceDirectory}/campaign-custody-cargo-filled-${index}.png`,
          fullPage: true
        })
      )
    )

    stage = 'mark unavailable'
    await owner.getByRole('button', { name: 'Mark unavailable', exact: true }).click()
    await expect(owner.getByText('Unavailable', { exact: true })).toBeVisible()
    await assertOwnerCargo(owner)
    await assertPlayersCannotAccessVehicle(players)
    await input.verifyState('unavailable')
    await Promise.all(
      players.map((page, index) =>
        page.screenshot({
          caret: 'initial',
          path: `${input.evidenceDirectory}/campaign-custody-unavailable-player-${index + 1}.png`,
          fullPage: true
        })
      )
    )

    stage = 'restore vehicle'
    await owner.getByRole('button', { name: 'Restore', exact: true }).click()
    await expect(owner.getByText('Unavailable', { exact: true })).toHaveCount(0)
    await assertPlayersCanReadCargo(players)
    await input.verifyState('restored')

    stage = 'remove and return cargo'
    await removeVehicle(owner, 'Remove and return cargo to Party')
    await expect(owner.getByText('No Campaign vehicles.', { exact: true })).toBeVisible()
    await selectOption(owner, 'Inventory owner', 'Party inventory')
    await input.verifyState('returned')
    await owner.screenshot({
      caret: 'initial',
      path: `${input.evidenceDirectory}/campaign-custody-returned.png`,
      fullPage: true
    })

    stage = 'fill destroy vehicle cargo'
    await addVehicle(owner)
    await fillVehicleCargo(owner)
    await assertOwnerCargo(owner)
    await input.verifyState('destroy-filled')

    stage = 'remove and destroy cargo'
    await removeVehicle(owner, 'Remove and destroy all cargo and coins')
    await expect(owner.getByText('No Campaign vehicles.', { exact: true })).toBeVisible()
    await input.verifyState('destroyed')
    await owner.screenshot({
      caret: 'initial',
      path: `${input.evidenceDirectory}/campaign-custody-destroyed.png`,
      fullPage: true
    })

    stage = 'reload final state'
    sessions.forEach((session) => {
      session.authenticated = false
    })
    await Promise.all(
      pages.map(async (page, index) => {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 })
        await expect.poll(() => sessions[index].authenticated, { timeout: 30_000 }).toBe(true)
        await assertHealthyPage(page)
        await page.getByRole('tab', { name: 'Inventory', exact: true }).click()
        await expect(page.getByRole('tab', { name: 'Inventory', exact: true })).toHaveAttribute(
          'data-active',
          'true'
        )
        await expect(page.getByText('No Campaign vehicles.', { exact: true })).toBeVisible()
      })
    )

    stage = 'complete owner-only audit pages'
    const audit = owner.locator('section').filter({
      has: owner.getByRole('heading', {
        name: 'Inventory activity',
        exact: true
      })
    })
    const auditRows = audit.locator('[data-audit-event-id]')
    await expect(auditRows.first()).toBeVisible()
    const older = audit.getByRole('button', {
      name: 'Load older activity',
      exact: true
    })
    while (await older.count()) {
      const before = await auditRows.count()
      expect(before).toBeLessThan(100)
      await older.click()
      await expect.poll(() => auditRows.count()).toBeGreaterThan(before)
    }
    await expect(audit.getByText('vehicle lifecycle', { exact: true })).toHaveCount(9)
    const auditIds = await auditRows.evaluateAll((rows) =>
      rows.map((row) => row.getAttribute('data-audit-event-id'))
    )
    expect(new Set(auditIds).size).toBe(auditIds.length)
    await writeFile(
      `${input.evidenceDirectory}/browser-audit.json`,
      JSON.stringify({ auditIds }, null, 2)
    )
    for (const player of players)
      await expect(
        player.getByRole('heading', {
          name: 'Inventory activity',
          exact: true
        })
      ).toHaveCount(0)

    if (diagnostics.length > 0)
      throw new Error(`Campaign custody diagnostics: ${diagnostics.join(' | ')}`)
  } catch (error) {
    await Promise.all(
      [owner, ...(players ?? [])]
        .filter((page): page is Page => Boolean(page))
        .map((page, index) =>
          page.screenshot({
            caret: 'initial',
            path: `${input.evidenceDirectory}/campaign-custody-failure-${index}.png`,
            fullPage: true
          })
        )
    )
    const message =
      error instanceof Error ? error.message : 'Campaign custody browser verification failed.'
    throw new Error(scrub(`${message} | diagnostics: ${diagnostics.join(' | ')}`, input))
  } finally {
    await Promise.all(
      contexts.map((context, index) =>
        context.tracing.stop({
          path: `${input.evidenceDirectory}/campaign-custody-${['owner', 'player-1', 'player-2'][index]}.zip`
        })
      )
    )
    await browser.close()
    await writeFile(
      `${input.evidenceDirectory}/campaign-custody-diagnostics.json`,
      JSON.stringify(
        {
          diagnostics: diagnostics.map((diagnostic) => scrub(diagnostic, input))
        },
        null,
        2
      )
    )
  }
}

async function addVehicle(page: Page): Promise<void> {
  const picker = page.getByRole('combobox', { name: 'Current Vehicle' })
  await expect(picker).toBeEnabled()
  await selectOption(page, 'Current Vehicle', 'Cart')
  await page.getByRole('button', { name: 'Add vehicle', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mark unavailable', exact: true })).toBeVisible()
}

async function fillVehicleCargo(page: Page): Promise<void> {
  await selectOption(page, 'Inventory owner', vehicleLabel)
  const inventory = inventoryPanel(page)
  await expect(inventory.getByRole('combobox', { name: 'Equipment' })).toBeEnabled({
    timeout: 30_000
  })
  await selectOption(page, 'Equipment', 'Backpack')
  await inventory.getByLabel('Quantity', { exact: true }).fill('1')
  await inventory.getByRole('button', { name: 'Add item', exact: true }).click()
  await expect(inventory.getByText('Backpack', { exact: true })).toBeVisible()

  await selectOption(page, 'Add to', 'Backpack')
  await selectOption(page, 'Equipment', 'Club')
  await inventory.getByRole('button', { name: 'Add item', exact: true }).click()
  await selectOption(page, 'Currency', 'Gold Piece')
  const addCurrency = inventory.getByText('Add currency', { exact: true }).locator('..')
  await addCurrency.getByLabel('Amount', { exact: true }).fill('5')
  await addCurrency.getByRole('button', { name: 'Apply', exact: true }).click()
}

async function assertOwnerCargo(page: Page): Promise<void> {
  const inventory = inventoryPanel(page)
  await expect(inventory.getByText('Backpack', { exact: true })).toBeVisible()
  await expect(inventory.getByText('Club', { exact: true })).toHaveCount(1)
  await expect(inventory.getByText('Club', { exact: true })).toBeVisible()
  await expect(inventory.getByText('Gold Piece', { exact: true })).toBeVisible()
  await expect(inventory.getByText('5 gp in Backpack', { exact: true })).toBeVisible()
}

async function assertPlayersCanReadCargo(players: readonly Page[]): Promise<void> {
  await Promise.all(
    players.map(async (page) => {
      await selectOption(page, 'Inventory owner', vehicleLabel)
      const inventory = inventoryPanel(page)
      await expect(inventory.getByText('Backpack', { exact: true })).toBeVisible()
      await expect(inventory.getByText('Club', { exact: true })).toHaveCount(1)
      await expect(inventory.getByText('Club', { exact: true })).toBeVisible()
      await expect(inventory.getByText('Gold Piece', { exact: true })).toBeVisible()
      await expect(inventory.getByText('5 gp', { exact: true })).toBeVisible()
    })
  )
}

async function assertPlayersCannotMutate(players: readonly Page[]): Promise<void> {
  await Promise.all(
    players.map(async (page) => {
      await expect(page.getByRole('combobox', { name: 'Current Vehicle' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Add vehicle', exact: true })).toHaveCount(0)
      await expect(
        inventoryPanel(page).getByRole('button', {
          name: 'Transfer',
          exact: true
        })
      ).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Mark unavailable', exact: true })).toHaveCount(
        0
      )
      await expect(page.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(0)
      await expect(
        inventoryPanel(page).getByRole('button', {
          name: 'Add item',
          exact: true
        })
      ).toHaveCount(0)
    })
  )
}

async function assertPlayersCannotAccessVehicle(players: readonly Page[]): Promise<void> {
  await Promise.all(
    players.map(async (page) => {
      await page.getByRole('combobox', { name: 'Inventory owner' }).click()
      await expect(page.getByRole('option', { name: vehicleLabel, exact: true })).toHaveCount(0)
      await page.keyboard.press('Escape')
      await expect(page.getByRole('combobox', { name: 'Inventory owner' })).toHaveValue(
        'Party inventory'
      )
    })
  )
}

async function removeVehicle(page: Page, action: string): Promise<void> {
  await page
    .getByLabel('Vehicles', { exact: true })
    .getByRole('button', { name: 'Remove', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Remove Campaign vehicle' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: action, exact: true }).click()
  await expect(dialog).toHaveCount(0)
}

async function selectOption(page: Page, label: string, option: string): Promise<void> {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

function inventoryPanel(page: Page) {
  return page.locator('section[aria-labelledby="inventory-title"]')
}

function watchAuthenticatedSession(page: Page): { authenticated: boolean } {
  const session = { authenticated: false }
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      const message: unknown = JSON.parse(payload.toString())
      if (!message || typeof message !== 'object' || !('modifications' in message)) return
      if (!Array.isArray(message.modifications)) return
      for (const modification of message.modifications) {
        if (!modification || typeof modification !== 'object' || !('value' in modification))
          continue
        const snapshot = authSessionSnapshotDtoSchema.safeParse(modification.value)
        if (snapshot.success && snapshot.data.user !== null) session.authenticated = true
      }
    })
  })
  return session
}

async function signIn(
  page: Page,
  account: CampaignCredential,
  session: { authenticated: boolean }
): Promise<void> {
  await page.goto(`${origin}/sign-in`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000
  })
  await page.getByRole('textbox', { name: 'Email or username' }).fill(account.email)
  await page.locator('input[name="password"]').fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 60_000 })
  await expect.poll(() => session.authenticated, { timeout: 30_000 }).toBe(true)
}

async function openInventory(
  page: Page,
  publicId: string,
  session: { authenticated: boolean }
): Promise<void> {
  session.authenticated = false
  await page.goto(`${origin}/campaigns/${publicId}/${campaignSlug}?tab=inventory`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000
  })
  await expect.poll(() => session.authenticated, { timeout: 30_000 }).toBe(true)
  await expect(page.getByRole('tab', { name: 'Inventory', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Inventory', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Vehicles', exact: true })).toBeVisible()
}

async function assertHealthyPage(page: Page): Promise<void> {
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page).toHaveTitle(/Artificer/i)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
}

function captureDiagnostics(
  page: Page,
  account: string,
  currentStage: () => string,
  diagnostics: string[]
): void {
  const record = (kind: string, detail: string) =>
    diagnostics.push(`${account} ${currentStage()}: ${kind} ${detail.slice(0, 3000)}`)
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning')
      record('console', message.text())
  })
  page.on('pageerror', (error) => record('pageerror', error.message))
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.hostname.endsWith('.supabase.co') || url.pathname.startsWith('/api/trpc'))
      record('legacy request', `${request.method()} ${url.hostname}${url.pathname}`)
  })
  page.on('requestfailed', (request) =>
    record(
      'requestfailed',
      `${request.method()} ${new URL(request.url()).pathname} ${request.failure()?.errorText ?? ''}`
    )
  )
  page.on('response', (response) => {
    if (response.status() >= 400)
      record('response', `${response.status()} ${new URL(response.url()).pathname}`)
  })
}

function scrub(value: string, input: CampaignCustodyVerificationInput): string {
  return [input.owner, ...input.players].reduce(
    (scrubbed, account, index) =>
      scrubbed
        .replaceAll(account.email, `[account ${index} email]`)
        .replaceAll(account.password, `[account ${index} password]`),
    value.replace(/(https?:\/\/[^?\s"'<>]+)\?[^\s"'<>]+/g, '$1?[redacted]')
  )
}
