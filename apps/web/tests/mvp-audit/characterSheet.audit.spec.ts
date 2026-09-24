import { expect, test, type Page } from '@playwright/test'
import { installDevtoolLauncherHiding } from '../e2e/app/support/devtools'
import { captureAuditNetwork } from './auditNetwork'
import { navigateForMvpAudit } from './auditNavigation'

const storageState = process.env.MVP_AUDIT_STORAGE_STATE
if (storageState) test.use({ storageState })

test.describe('MVP character Sheet audit', () => {
  test('loads and settles representative HP and notes commands', async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    const characterPath = process.env.MVP_AUDIT_CHARACTER_PATH
    if (!characterPath) {
      throw new Error(
        'Set MVP_AUDIT_CHARACTER_PATH to a finalized local character route, for example /characters/<public-id>/<slug>.'
      )
    }

    const capture = captureAuditNetwork(page)
    const groupLabel = `MVP audit ${Date.now()}`
    const noteTitle = `MVP audit note ${Date.now()}`
    const noteBody = `Persistent note body for ${noteTitle}`

    try {
      await installDevtoolLauncherHiding(page)
      const navigation = await navigateForMvpAudit(page, characterPath)
      if (navigation.prerequisite) {
        throw new Error(navigation.prerequisite)
      }

      await expect(page.getByText('Character Sheet', { exact: true })).toBeVisible()

      const hitPointsBeforeDamage = await readCurrentHitPoints(page)
      expect(hitPointsBeforeDamage).toBeGreaterThan(0)
      await ensureHpControlsOpen(page)
      await page.getByLabel('Amount').fill('1')

      await page.getByRole('button', { name: 'Apply Damage' }).click()
      const hitPointsAfterDamage = hitPointsBeforeDamage - 1
      await expect.poll(() => readCurrentHitPoints(page)).toBe(hitPointsAfterDamage)

      await goToNotes(page)
      await expect(page.locator('#character-sheet-notes')).toBeVisible()

      await page.getByRole('button', { name: 'Browse Notes', exact: true }).click()
      const browseNotesDrawer = page.getByRole('dialog', { name: 'Browse Notes' })
      await browseNotesDrawer.getByLabel('New note group name').fill(groupLabel)
      await browseNotesDrawer.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(
        browseNotesDrawer.getByRole('button', { name: groupLabel, exact: true })
      ).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(browseNotesDrawer).toBeHidden()

      await page.getByRole('button', { name: 'New Note', exact: true }).click()

      const newNoteDrawer = page.getByRole('dialog', { name: 'New Note' })
      await newNoteDrawer.getByLabel('Title').fill(noteTitle)
      const groupSelect = newNoteDrawer.getByLabel('Group')
      await groupSelect.click()
      await page.getByRole('option', { name: groupLabel, exact: true }).click()
      await expect(groupSelect).toHaveValue(groupLabel)
      await newNoteDrawer.getByLabel('Note').fill(noteBody)
      await expect(
        newNoteDrawer.getByRole('button', { name: 'Create Note', exact: true })
      ).toBeEnabled()

      await newNoteDrawer.getByRole('button', { name: 'Create Note', exact: true }).click()
      await expect(newNoteDrawer).toBeHidden()

      await selectNote(page, noteTitle)
      await expect(page.getByRole('heading', { name: noteTitle, exact: true })).toBeVisible()
      await expect(page.getByText(noteBody, { exact: true })).toBeVisible()

      await expect.poll(() => readCurrentHitPoints(page)).toBe(hitPointsAfterDamage)
      await ensureHpControlsOpen(page)
      await page.getByLabel('Amount').fill('1')
      await page.getByRole('button', { name: 'Heal', exact: true }).click()
      await expect.poll(() => readCurrentHitPoints(page)).toBe(hitPointsBeforeDamage)

      await page.reload({ waitUntil: 'networkidle' })
      await expect(page.getByText('Character Sheet', { exact: true })).toBeVisible({
        timeout: 120_000
      })
      await goToNotes(page)
      await selectNote(page, noteTitle)
      await expect(page.getByRole('heading', { name: noteTitle, exact: true })).toBeVisible()
      await expect(page.getByText(noteBody, { exact: true })).toBeVisible()
    } finally {
      await capture.attach(testInfo, 'sheet-network-timings')
      capture.dispose()
    }
  })
})

async function selectNote(page: Page, noteTitle: string) {
  await page.getByRole('button', { name: 'Browse Notes', exact: true }).click()
  const browseNotesDrawer = page.getByRole('dialog', { name: 'Browse Notes' })
  await browseNotesDrawer.getByLabel('Search notes').fill(noteTitle)
  const noteButton = browseNotesDrawer.getByRole('button').filter({ hasText: noteTitle })
  await expect(noteButton).toHaveCount(1)
  await noteButton.click()
  await expect(browseNotesDrawer).toBeHidden()
}

async function goToNotes(page: Page) {
  const notesTab = page.getByRole('tab', { name: 'Notes' })
  if (await notesTab.isVisible()) {
    await notesTab.click()
    return
  }

  if (await page.getByLabel('Amount').isVisible()) await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Open sheet section menu' }).click()
  const sectionMenu = page.getByRole('dialog', { name: 'Sheet sections' })
  await sectionMenu.getByRole('button', { name: 'Notes', exact: true }).click()
  await expect(sectionMenu).toBeHidden()
}

async function ensureHpControlsOpen(page: Page) {
  const manageHp = page.getByRole('button', { name: 'Manage HP' })
  await expect(manageHp).toBeVisible()
  if ((await manageHp.getAttribute('aria-expanded')) !== 'true') {
    await manageHp.click()
  }
  await expect(page.getByLabel('Amount')).toBeVisible()
}

async function readCurrentHitPoints(page: Page): Promise<number> {
  const vitalsText = await page
    .getByRole('heading', { name: 'Combat facts and hit points' })
    .locator('..')
    .innerText()
  const match = vitalsText.match(/\bHP\s*(\d+)\s*\/\s*\d+/i)

  const currentHitPoints = match?.[1]
  if (!currentHitPoints) {
    throw new Error(`Unable to read current hit points from: ${vitalsText}`)
  }

  return Number(currentHitPoints)
}
