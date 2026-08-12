import { expect, test, type Locator, type Page } from '@playwright/test'

test.describe('notifications and delivery UI', () => {
  test('opens the real desktop drawer and returns focus to its bell', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openStory(page, 'shell-notifications-composition--desktop-bell')

    const newBell = page.getByRole('button', { name: 'Notifications, 1 new' })
    const drawer = page.getByRole('dialog', { name: 'Notifications' })
    await expect(newBell).toBeVisible()
    await newBell.click()
    await expect(drawer).toBeVisible()
    await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible()
    await expect(drawer.getByRole('region', { name: 'Notification feed' })).toBeVisible()
    await expect(drawer.getByText('Notifications', { exact: true })).toHaveCount(1)

    await drawer.getByRole('button', { name: /close/i }).click()
    await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeFocused()
  })

  test('uses the mobile header route and preserves the five-item footer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openStory(page, 'shell-notifications-composition--mobile-page')

    await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Notifications' })).toBeVisible()
    const footer = page.getByRole('contentinfo', { name: 'App navigation' })
    await expect(footer.locator('a, button')).toHaveCount(5)
    await expectNoHorizontalOverflow(page)
  })

  test('uses actionable rows and safe empty, error, and malformed states', async ({ page }) => {
    await openStory(page, 'shell-notifications-feed--grouped-unread')
    await expect(page.getByText('3 new applications for The Glass Harbor')).toBeVisible()
    await expectMinimumTarget(page.getByRole('button', { name: /3 new applications/i }))
    await expect(page.getByRole('article').first()).toHaveAttribute('data-unread', 'true')
    await expect(page.getByRole('button', { name: /mark|archive|load older/i })).toHaveCount(0)

    await openStory(page, 'shell-notifications-feed--empty')
    await expect(page.getByRole('heading', { name: 'No notifications yet' })).toBeVisible()
    await expectMinimumTarget(page.getByRole('button', { name: 'Explore Social Hub' }))

    await openStory(page, 'shell-notifications-feed--error')
    await expectMinimumTarget(page.getByRole('button', { name: 'Retry' }))

    await openStory(page, 'shell-notifications-feed--malformed')
    await expect(page.getByText('Notification unavailable')).toBeVisible()
    await expect(page.getByRole('button', { name: /notification unavailable/i })).toHaveCount(0)
  })

  test('renders preference variants and visible save failure in both themes', async ({ page }) => {
    await openStory(page, 'settings-notifications-preferences--enabled', 'light')
    await expect(page.getByRole('switch', { name: 'In-app notifications' })).toBeChecked()
    await expect(page.getByRole('switch', { name: 'Email notifications' })).toBeChecked()

    await openStory(page, 'settings-notifications-preferences--email-disabled', 'dark')
    await expect(page.getByRole('switch', { name: 'Email notifications' })).not.toBeChecked()

    await openStory(page, 'settings-notifications-preferences--save-error')
    await expect(page.getByRole('alert')).toHaveText('Notification preferences could not be saved.')
  })

  test('focuses a linked source row and keeps missing records non-leaking', async ({ page }) => {
    await openStory(page, 'social-hosting-sent-invitations--focused-deep-link')
    const row = page.getByRole('article')
    await expect(row).toBeFocused()
    await expect(row).toHaveAttribute('data-highlighted', 'true')

    await openStory(page, 'social-hosting-sent-invitations--missing-deep-link')
    await expect(page.getByRole('alert')).toHaveText('This item is no longer available.')
  })
})

async function openStory(page: Page, storyId: string, theme?: 'dark' | 'light') {
  const globals = theme ? '&globals=theme:' + theme : ''
  await page.goto('/iframe.html?id=' + storyId + '&viewMode=story' + globals)
  await expect(page.locator('#storybook-root')).toBeVisible({ timeout: 30_000 })
}

async function expectMinimumTarget(target: Locator) {
  const box = await target.boundingBox()
  expect(box?.height).toBeGreaterThanOrEqual(44)
  expect(box?.width).toBeGreaterThanOrEqual(44)
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }))

  expect(overflow.body).toBeLessThanOrEqual(1)
  expect(overflow.document).toBeLessThanOrEqual(1)
}
