import { expect as baseExpect, type Page } from '@playwright/test'

const expect = baseExpect.configure({ timeout: 30_000 })

export async function verifyPersonalSheet(page: Page): Promise<void> {
  await expect(page.getByText('Character Sheet', { exact: true })).toBeVisible()

  const hp = page.getByRole('heading', { name: 'Combat facts and hit points' }).locator('..')
  const initialHitPoints = await readHitPoints(hp)
  expect(initialHitPoints).toBeGreaterThan(0)

  const manageHp = page.getByRole('button', { name: 'Manage hit points' })
  await manageHp.click()
  const hpAmount = page.getByLabel('Hit point amount')
  await hpAmount.fill('1')
  await page.getByRole('button', { name: 'Damage', exact: true }).click()
  await expect.poll(() => readHitPoints(hp)).toBe(initialHitPoints - 1)

  await hpAmount.fill('1')
  await page.getByRole('button', { name: 'Heal', exact: true }).click()
  await expect.poll(() => readHitPoints(hp)).toBe(initialHitPoints)

  const tempHp = page.getByLabel('Temp HP')
  await tempHp.fill('3')
  await tempHp.press('Tab')
  await expect(tempHp).toHaveValue('3')
  await expect(manageHp).toBeEnabled()
  const maxAdjustment = page.getByLabel('Max HP adjustment')
  const maximumBeforeAdjustment = await readMaximumHitPoints(hp)
  await maxAdjustment.fill('2')
  await maxAdjustment.press('Tab')
  await expect.poll(() => readMaximumHitPoints(hp)).toBe(maximumBeforeAdjustment + 2)
  await maxAdjustment.fill('0')
  await maxAdjustment.press('Tab')
  await expect.poll(() => readMaximumHitPoints(hp)).toBe(maximumBeforeAdjustment)

  await expect(page.getByRole('button', { name: 'Manage hit points', exact: true })).toBeEnabled()
  await page.waitForLoadState('networkidle')
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByText('Character Sheet', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Combat facts and hit points' }).locator('..')
  ).toContainText(/Temp\s*3/)

  const inspiration = page.getByRole('button', { name: 'Gain inspiration' })
  await inspiration.click()
  const inspired = page.getByRole('button', { name: 'Use inspiration' })
  await expect(inspired).toHaveAttribute('aria-pressed', 'true')
  await inspired.click()
  await expect(page.getByRole('button', { name: 'Gain inspiration' })).toHaveAttribute(
    'aria-pressed',
    'false'
  )

  const conditionSummary = page.getByRole('button', { name: 'Add Condition', exact: true })
  await conditionSummary.click()
  const conditionSelect = page.getByRole('combobox', { name: 'Add condition' })
  await conditionSelect.click()
  await page.getByRole('option', { name: 'Blinded', exact: true }).click()
  const conditionNotes = page.getByLabel('Condition notes')
  await conditionNotes.fill('P04 condition note')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('button', { name: 'Edit Blinded notes' }).click()
  await conditionNotes.fill('P04 updated condition note')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('P04 updated condition note', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Remove Blinded condition' }).click()
  await expect(page.getByRole('button', { name: 'Edit Blinded notes' })).toHaveCount(0)
  await conditionSummary.click()
  await expect(conditionSummary).toHaveAttribute('aria-expanded', 'false')

  await openSection(page, 'Inventory')
  await page.getByRole('button', { name: 'Manage Equipment' }).click()
  const equipment = page.getByRole('combobox', { name: 'Equipment' })
  await equipment.click()
  await page.getByRole('option', { name: 'Club', exact: true }).click()
  const clubCountBefore = await page.getByText('Club', { exact: true }).count()
  await page.getByRole('button', { name: 'Add Item', exact: true }).click()
  await expect
    .poll(() => page.getByText('Club', { exact: true }).count())
    .toBeGreaterThan(clubCountBefore)
  await page.getByRole('combobox', { name: 'Currency type', exact: true }).click()
  await page.getByRole('option', { name: 'Gold Piece', exact: true }).click()
  const currencyAmount = page.getByLabel('Amount', { exact: true })
  await currencyAmount.fill('1')
  await page.getByRole('button', { name: 'Apply Currency', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Apply Currency', exact: true })).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Manage Equipment', exact: true })).toBeHidden()
  await expect(page.getByLabel('Currency totals')).toContainText(/101\s*Gold Piece/)

  await openSection(page, 'Notes')
  const suffix = Date.now()
  const groupLabel = `P04 group ${suffix}`
  const noteTitle = `P04 note ${suffix}`
  const updatedTitle = `${noteTitle} updated`
  await page.getByRole('button', { name: 'Browse Notes', exact: true }).click()
  const browse = page.getByRole('dialog', { name: 'Browse Notes' })
  await browse.getByLabel('New note group name').fill(groupLabel)
  await browse.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(browse.getByRole('button', { name: groupLabel, exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(browse).toBeHidden()
  await page.getByRole('button', { name: 'New Note', exact: true }).click()
  const noteEditor = page.getByRole('dialog', { name: 'New Note' })
  await noteEditor.getByLabel('Title').fill(noteTitle)
  await noteEditor.getByLabel('Group').click()
  await page.getByRole('option', { name: groupLabel, exact: true }).click()
  await noteEditor.getByLabel('Note').fill('P04 note body')
  await noteEditor.getByRole('button', { name: 'Create Note', exact: true }).click()
  await expect(noteEditor).toBeHidden()
  await expect(page.getByRole('heading', { name: noteTitle, exact: true })).toBeVisible()

  await page.getByRole('button', { name: `Edit ${noteTitle}`, exact: true }).click()
  const editNote = page.getByRole('dialog', { name: 'Edit Note' })
  await editNote.getByLabel('Title').fill(updatedTitle)
  await editNote.getByLabel('Note').fill('P04 updated note body')
  await editNote.getByRole('button', { name: 'Save Note', exact: true }).click()
  await expect(editNote).toBeHidden()
  await expect(page.getByRole('heading', { name: updatedTitle, exact: true })).toBeVisible()
  await page.getByRole('button', { name: `Delete ${updatedTitle}`, exact: true }).click()
  const deleteNote = page.getByRole('dialog', { name: 'Delete note?' })
  await deleteNote.getByRole('button', { name: 'Delete Note', exact: true }).click()
  await expect(deleteNote).toBeHidden()
  await expect(page.getByRole('heading', { name: updatedTitle, exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Browse Notes', exact: true }).click()
  const browseAfterDelete = page.getByRole('dialog', { name: 'Browse Notes' })
  await browseAfterDelete.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(browseAfterDelete.getByText(groupLabel, { exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(browseAfterDelete).toBeHidden()

  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  const shortRest = page.getByRole('dialog', { name: 'Short Rest' })
  await expect(shortRest.getByText('Spend Hit Dice', { exact: true })).toBeVisible()
  await shortRest.getByRole('button', { name: 'Add one d10 hit die' }).click()
  await expect(shortRest.getByText('1 selected', { exact: true })).toBeVisible()
  await shortRest.getByRole('button', { name: /^Roll / }).click()
  await shortRest.getByRole('button', { name: 'Take Short Rest', exact: true }).click()
  await expect(shortRest).toBeHidden()
  await expect(hp).toContainText('0/1d10')

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  const longRest = page.getByRole('dialog', { name: 'Long Rest' })
  await expect(
    longRest.getByText('Review the full recovery before applying it.', { exact: true })
  ).toBeVisible()
  await longRest.getByRole('button', { name: 'Take Long Rest', exact: true }).click()
  await expect(longRest).toBeHidden()
  await expect(hp).toContainText('1/1d10')

  await expect(page.getByRole('button', { name: 'Manage hit points', exact: true })).toBeEnabled()
  await page.waitForLoadState('networkidle')
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByText('Character Sheet', { exact: true })).toBeVisible()
  await openSection(page, 'Inventory')
  await expect(page.getByLabel('Currency totals')).toContainText(/101\s*Gold Piece/)
  await expect(page.getByLabel('Manage hit points')).toBeVisible()
}

export async function verifyPersonalSheetExtras(page: Page): Promise<void> {
  await expect(page.getByText('Character Sheet', { exact: true })).toBeVisible()
  await openSection(page, 'Extras')

  await page.getByRole('button', { name: 'Add Extra', exact: true }).click()
  const companionDrawer = page.getByRole('dialog', { name: 'Add Extra' })
  await companionDrawer.getByRole('combobox', { name: 'Kind' }).click()
  await page.getByRole('option', { name: 'Companion', exact: true }).click()
  const creature = companionDrawer.getByRole('combobox', { name: 'Creature' })
  await creature.click()
  await creature.fill('Owl')
  await page.getByRole('option', { name: 'Owl', exact: true }).click()
  await companionDrawer.getByRole('combobox', { name: 'Origin' }).click()
  await page.getByRole('option', { name: 'World', exact: true }).click()
  await companionDrawer.getByRole('button', { name: 'Add Extra', exact: true }).click()

  const companionInspector = page.getByRole('dialog', { name: 'Owl' })
  await expect(companionInspector).toBeVisible()
  await companionInspector.getByLabel('Custom name').fill('P04 Owl')
  await companionInspector.getByLabel('Custom name').press('Tab')
  const renamedCompanion = page.getByRole('dialog', { name: 'P04 Owl', exact: true })
  await expect(renamedCompanion).toBeVisible()
  await renamedCompanion.getByLabel('Current hit points').fill('0')
  await renamedCompanion.getByLabel('Current hit points').press('Tab')
  // The sheet's Extras row shows the committed hit points; reload only once the command has landed.
  await expect(
    page.locator('[aria-label="Open P04 Owl (Owl) details"] [data-extra-metric="HP"] strong')
  ).toHaveText(/^0 \/ \d+$/)
  await expect(page.getByRole('button', { name: 'Manage hit points', exact: true })).toBeEnabled()
  await page.waitForLoadState('networkidle')
  await page.reload({ waitUntil: 'networkidle' })
  await openSection(page, 'Extras')
  await page.getByRole('button', { name: 'Open P04 Owl (Owl) details', exact: true }).click()
  const reloadedCompanion = page.getByRole('dialog', { name: 'P04 Owl' })
  await expect(reloadedCompanion).toBeVisible()
  await expect(reloadedCompanion.getByLabel('Custom name')).toHaveValue('P04 Owl')
  await expect(reloadedCompanion.getByLabel('Current hit points')).toHaveValue('0')
  page.once('dialog', (dialog) => dialog.accept())
  await reloadedCompanion.getByRole('button', { name: 'Remove extra', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Open P04 Owl (Owl) details', exact: true })
  ).toHaveCount(0)

  await page.getByRole('button', { name: 'Add Extra', exact: true }).click()
  const vehicleDrawer = page.getByRole('dialog', { name: 'Add Extra' })
  await vehicleDrawer.getByRole('combobox', { name: 'Kind' }).click()
  await page.getByRole('option', { name: 'Vehicle', exact: true }).click()
  const vehicle = vehicleDrawer.getByRole('combobox', { name: 'Vehicle' })
  await vehicle.click()
  await vehicle.fill('Sailing Ship')
  await page.getByRole('option', { name: 'Sailing Ship', exact: true }).click()
  await vehicleDrawer.getByRole('button', { name: 'Add Extra', exact: true }).click()

  const vehicleInspector = page.getByRole('dialog', { name: 'Sailing Ship' })
  await expect(vehicleInspector).toBeVisible()
  await vehicleInspector.getByLabel('Custom name').fill('P04 Ship')
  await vehicleInspector.getByLabel('Custom name').press('Tab')
  await expect(page.getByRole('dialog', { name: 'P04 Ship', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Manage hit points', exact: true })).toBeEnabled()
  await page.waitForLoadState('networkidle')
  await page.reload({ waitUntil: 'networkidle' })
  await openSection(page, 'Extras')
  await page
    .getByRole('button', { name: 'Open P04 Ship (Sailing Ship) details', exact: true })
    .click()
  const reloadedVehicle = page.getByRole('dialog', { name: 'P04 Ship' })
  await expect(reloadedVehicle).toBeVisible()
  await expect(reloadedVehicle.getByLabel('Custom name')).toHaveValue('P04 Ship')
  page.once('dialog', (dialog) => dialog.accept())
  await reloadedVehicle.getByRole('button', { name: 'Remove extra', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Open P04 Ship (Sailing Ship) details', exact: true })
  ).toHaveCount(0)
}

async function openSection(page: Page, label: string) {
  const tab = page.getByRole('tab', { name: label, exact: true })
  if (await tab.isVisible()) {
    await tab.click()
    return
  }
  await page.getByRole('button', { name: 'Open sheet section menu' }).click()
  const menu = page.getByRole('dialog', { name: 'Sheet sections' })
  await menu.getByRole('button', { name: label, exact: true }).click()
  await expect(menu).toBeHidden()
}

async function readHitPoints(locator: ReturnType<Page['locator']>): Promise<number> {
  const match = (await locator.innerText()).match(/\bHP\s*(\d+)\s*\/\s*\d+/i)
  if (!match) throw new Error('Unable to read current hit points')
  return Number(match[1])
}

async function readMaximumHitPoints(locator: ReturnType<Page['locator']>): Promise<number> {
  const match = (await locator.innerText()).match(/\bHP\s*\d+\s*\/\s*(\d+)/i)
  if (!match) throw new Error('Unable to read maximum hit points')
  return Number(match[1])
}
