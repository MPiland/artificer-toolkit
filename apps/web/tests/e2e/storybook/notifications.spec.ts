import { expect, test, type Locator, type Page } from '@playwright/test'

// The shell bell, drawer and mobile page read the seeded notification feed, so their checks are the
// play functions of the shell backend stories (NotificationShell.backend.stories.tsx, the
// storybook-backend-browser proof), which this props-only run cannot load. The sent-invitation deep
// link checks are the play functions of SocialListingInvitations.backend.stories.tsx.
test.describe('notifications and delivery UI', () => {
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
