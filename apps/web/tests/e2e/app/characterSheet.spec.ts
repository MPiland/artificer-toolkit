import { test } from './support/auth.fixture'
import { verifyPersonalSheet, verifyPersonalSheetExtras } from './support/characterSheet'

test('runs the native personal Character Sheet proof', async ({ authenticatedPage: page }) => {
  test.setTimeout(900_000)
  page.setDefaultTimeout(30_000)
  const characterId = process.env.CONVEX_E2E_CHARACTER_ID
  if (!characterId)
    throw new Error('CONVEX_E2E_CHARACTER_ID is required for the Sheet browser proof.')
  await page.goto(`/characters/${characterId}`, { waitUntil: 'networkidle' })
  await verifyPersonalSheet(page)
  await verifyPersonalSheetExtras(page)
})
