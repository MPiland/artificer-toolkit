import { expect, test, type Locator, type Page } from '@playwright/test'

const mobileViewport = { width: 390, height: 844 }

test.describe('mobile shell and catalogue layout', () => {
  test.use({ viewport: mobileViewport })

  test('keeps home within the viewport through catalogue focus and browser history', async ({
    page
  }) => {
    await openStory(page, 'home-homepage--mobile', /what are you building today/i)
    await expectNoHorizontalOverflow(page)

    await openStory(
      page,
      'platform-authored-list-authoredlistpage--mobile-in-app-shell',
      /^spells$/i
    )

    const search = page.getByRole('textbox', { name: /search spells/i })
    await search.focus()
    await expect(search).toBeFocused()
    expect(
      await search.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
    ).toBeGreaterThanOrEqual(16)

    await page.goBack()
    await expect(page.getByRole('heading', { name: /what are you building today/i })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.goForward()
    await expect(search).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('reserves readable first-viewport space for results and empty states', async ({ page }) => {
    await openStory(
      page,
      'platform-authored-list-authoredlistpage--mobile-in-app-shell',
      /^spells$/i
    )
    await expectAlignedTitleAndCreate(page, 'Spells', 'Create Spell')
    const results = page.getByRole('region', { name: 'Spells results' })
    await expectVisibleHeight(results, 240)
    await expectCardResultsWithoutOuterFrame(results)
    await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible()
    await expect(page.getByRole('button', { name: /table view/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /card view/i })).toHaveCount(0)

    await page.getByRole('button', { name: 'Filters' }).click()
    await expect(page.getByRole('dialog', { name: /spells filters and sort/i })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await openStory(
      page,
      'platform-authored-list-authoredlistpage--mobile-empty-in-app-shell',
      /^characters$/i
    )
    await expect(page.getByText('No characters found.')).toBeVisible()
    await expectVisibleHeight(page.getByRole('region', { name: 'Characters results' }), 240)
    await expectNoHorizontalOverflow(page)

    await openStory(
      page,
      'platform-authored-list-authoredlistpage--mobile-in-app-shell',
      /^spells$/i,
      'light'
    )
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'light')
    await expectVisibleHeight(page.getByRole('region', { name: 'Spells results' }), 240)
    await expectNoHorizontalOverflow(page)
  })
})

async function openStory(page: Page, storyId: string, heading: RegExp, theme?: 'dark' | 'light') {
  const globals = theme ? `&globals=theme:${theme}` : ''
  await page.goto(`/iframe.html?id=${storyId}&viewMode=story${globals}`)
  await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 30_000 })
}

async function expectVisibleHeight(locator: Locator, minimum: number) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Expected a measurable results region.')

  const visibleHeight = Math.min(mobileViewport.height, box.y + box.height) - Math.max(0, box.y)
  expect(visibleHeight).toBeGreaterThanOrEqual(minimum)
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }))

  expect(overflow.body).toBeLessThanOrEqual(1)
  expect(overflow.document).toBeLessThanOrEqual(1)
}

async function expectAlignedTitleAndCreate(page: Page, title: string, createLabel: string) {
  const titleBox = await page.getByRole('heading', { name: title, level: 1 }).boundingBox()
  const createButton = page.getByRole('button', { name: createLabel })
  const createBox = await createButton.boundingBox()

  if (!titleBox || !createBox) throw new Error('Expected a measurable title and create button.')

  expect(await createButton.textContent()).toBe('Create')
  expect(Math.abs(titleBox.y - createBox.y)).toBeLessThanOrEqual(8)
}

async function expectCardResultsWithoutOuterFrame(results: Locator) {
  const frame = await results.evaluate((element) => {
    const styles = getComputedStyle(element)
    return {
      backgroundColor: styles.backgroundColor,
      borderTopWidth: styles.borderTopWidth
    }
  })

  expect(frame).toEqual({
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderTopWidth: '0px'
  })
}
