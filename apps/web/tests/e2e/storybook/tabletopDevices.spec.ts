import { expect, test, type Page } from '@playwright/test'

const gateStory = 'domains-campaigns-vtt-tabletop-device-gate--gated-tabletop'
const entryStory = 'domains-campaigns-vtt-tabletop-device-gate--entry-points'

async function openStory(page: Page, storyId: string, heading: RegExp) {
  await page.goto(`/iframe.html?id=${storyId}&viewMode=story`)
  await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 30_000 })
}

test.describe('phone', () => {
  test.use({ screen: { height: 844, width: 390 }, viewport: { height: 844, width: 390 } })

  test('hides the tabletop entry and tells a direct visit to use a larger screen', async ({
    page
  }) => {
    await openStory(page, entryStory, /campaign workspace/i)
    await expect(page.getByText('Session notes stay available on every device.')).toBeVisible()
    await expect(page.getByText('Live tabletop')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /open tabletop window/i })).toHaveCount(0)

    await openStory(page, gateStory, /needs a larger screen/i)
    await expect(page.getByText(/large tablet or a computer/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /back to the campaign/i })).toHaveAttribute(
      'href',
      '/campaigns/camp1/the-lost-mine'
    )
    await expect(page.getByRole('heading', { name: 'Tabletop stage' })).toHaveCount(0)
  })
})

test.describe('large tablet in portrait', () => {
  test.use({ screen: { height: 1194, width: 834 }, viewport: { height: 1194, width: 834 } })

  test('covers the tabletop until landscape, then shows it without a reload', async ({ page }) => {
    await openStory(page, entryStory, /campaign workspace/i)
    await expect(page.getByRole('link', { name: /open tabletop window/i })).toBeVisible()

    await page.goto(`/iframe.html?id=${gateStory}&viewMode=story`)
    await expect(page.getByRole('dialog', { name: /make the window wider/i })).toBeVisible({
      timeout: 30_000
    })
    await expect(page.getByText(/turn your tablet to landscape/i)).toBeVisible()
    await page.evaluate(() => Reflect.set(window, 'tabletopJourneyMarker', true))

    await page.setViewportSize({ height: 834, width: 1194 })

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Tabletop stage' })).toBeVisible()
    expect(await page.evaluate(() => Reflect.get(window, 'tabletopJourneyMarker'))).toBe(true)
  })
})
