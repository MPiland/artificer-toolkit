import { expect, test } from '@playwright/test'

test('native catalogue groups retain ranking, one scroll owner, and bounded page navigation', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(
    '/iframe.html?id=platform-authored-list-native-catalogue-search--ranked-groups&viewMode=story'
  )
  const master = page.getByRole('region', { name: 'SRD search results' })
  const owned = page.getByRole('region', { name: 'Homebrew search results' })
  await expect(master.getByRole('button', { name: 'Open Shield Warden' })).toBeVisible({
    timeout: 30_000
  })
  await expect(owned.getByRole('button', { name: 'Open Hearth Ward' })).toBeVisible()
  await expect(master.getByText('2 loaded on this page · Relevance')).toBeVisible()
  await expect(page.getByText('Sorted by relevance')).toBeVisible()
  await expect(master.getByRole('row').nth(1)).toHaveAttribute('aria-label', 'View Shield Warden')
  const scrollOwners = await master.getByRole('table').evaluate((element) => {
    let owners = 0
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent.dataset.testid === 'app-shell-main') break
      if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)) owners++
    }
    return owners
  })
  expect(scrollOwners).toBe(1)
  expect(
    await page
      .getByTestId('app-shell-main')
      .evaluate((element) => element.scrollHeight <= element.clientHeight + 1)
  ).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true })
  await master.getByRole('button', { name: 'Next SRD results' }).click()
  await expect(master.getByRole('button', { name: 'Open Warding Adept' })).toBeVisible()
  await expect(master.getByRole('button', { name: 'Open Shield Warden' })).toHaveCount(0)
  await master.getByRole('button', { name: 'Previous SRD results' }).click()
  await expect(master.getByRole('button', { name: 'Open Shield Warden' })).toBeVisible()
})

test('mobile search keeps groups and filters without an invented exact total', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(
    '/iframe.html?id=platform-authored-list-native-catalogue-search--cards&viewMode=story'
  )
  await expect(page.getByRole('button', { name: 'Open Shield Warden' })).toBeVisible({
    timeout: 30_000
  })
  await expect(page.getByRole('region', { name: 'Homebrew search results' })).toBeAttached()
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'Open Hearth Ward' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('button', { name: 'Open Hearth Ward' })).toBeVisible()
  expect(
    await page
      .getByTestId('app-shell-main')
      .evaluate((element) => element.scrollHeight <= element.clientHeight + 1)
  ).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('mobile-homebrew.png'), fullPage: true })
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await expect(page.getByText('Sorted by relevance')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show results', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show 5 results' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Show results', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
})
