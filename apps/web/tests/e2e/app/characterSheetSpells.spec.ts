import { test, expect as baseExpect } from './support/auth.fixture'

const expect = baseExpect.configure({ timeout: 30_000 })

test('prepares, casts, restores, and forgets native Sheet spells', async ({
  authenticatedPage: page
}) => {
  test.setTimeout(900_000)
  page.setDefaultTimeout(30_000)
  const id = process.env.CONVEX_E2E_CHARACTER_ID
  if (!id) throw new Error('CONVEX_E2E_CHARACTER_ID is required for the Sheet spell proof.')
  await page.goto(`/characters/${id}`, { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'Spells', exact: true }).click()
  await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Manage Spells' })
  const missile = drawer.getByRole('group', { name: 'Magic Missile', exact: true })
  await expect(missile.getByRole('button', { name: 'Prepare', exact: true })).toBeDisabled()
  await missile.getByRole('button', { name: 'Learn', exact: true }).click()
  await expect(missile.getByRole('button', { name: 'Forget', exact: true })).toBeEnabled()
  await missile.getByRole('button', { name: 'Prepare', exact: true }).click()
  await expect(missile.getByRole('button', { name: 'Unprepare', exact: true })).toBeEnabled()
  await page.keyboard.press('Escape')
  const panel = page.getByRole('region', { name: 'Spells', exact: true })
  await expect(
    panel.getByRole('button', { name: 'Level 1: 2 of 2 remaining', exact: true })
  ).toBeVisible()
  await panel.getByRole('button', { name: /Cast Magic Missile/ }).click()
  await expect(
    panel.getByRole('button', { name: 'Level 1: 1 of 2 remaining', exact: true })
  ).toBeVisible()
  await expect(panel.getByRole('button', { name: /Cast Magic Missile/ })).toBeEnabled()
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'Spells', exact: true }).click()
  await expect(
    panel.getByRole('button', { name: 'Level 1: 1 of 2 remaining', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()
  const restored = page.getByRole('dialog', { name: 'Manage Spells' })
  const learned = restored.getByRole('group', { name: 'Magic Missile', exact: true })
  await expect(learned.getByRole('button', { name: 'Forget', exact: true })).toBeEnabled()
  await expect(learned.getByRole('button', { name: 'Unprepare', exact: true })).toBeEnabled()
  await restored
    .getByRole('button', { name: 'Restore one Level 1 spell slot', exact: true })
    .click()
  await expect(
    restored.getByRole('button', { name: 'Restore one Level 1 spell slot', exact: true })
  ).toHaveCount(0)
  await expect(learned.getByRole('button', { name: 'Unprepare', exact: true })).toBeEnabled()
  await learned.getByRole('button', { name: 'Unprepare', exact: true }).click()
  await expect(learned.getByRole('button', { name: 'Prepare', exact: true })).toBeEnabled()
  await learned.getByRole('button', { name: 'Forget', exact: true }).click()
  await expect(learned.getByRole('button', { name: 'Learn', exact: true })).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(
    panel.getByRole('button', { name: 'Level 1: 2 of 2 remaining', exact: true })
  ).toBeVisible()
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'Spells', exact: true }).click()
  await expect(
    panel.getByRole('button', { name: 'Level 1: 2 of 2 remaining', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()
  await expect(missile.getByRole('button', { name: 'Learn', exact: true })).toBeEnabled()
  await expect(missile.getByRole('button', { name: 'Prepare', exact: true })).toBeDisabled()
})
