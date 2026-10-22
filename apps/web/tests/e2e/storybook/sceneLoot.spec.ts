import { expect, test, type Page } from '@playwright/test'
import { LOOT_RANGE_REFUSAL } from '@artificer-toolkit/shared/vtt/lootTable'

test.describe('Scene loot tables', () => {
  test('authors a table with an item and coins, reloads it, and refuses an overlapping range', async ({
    page
  }) => {
    test.setTimeout(60_000)
    await openStory(page, 'domains-campaigns-vtt-scene-loot-editor--empty')
    await expect(page.getByText('No loot tables on this Scene yet.')).toBeVisible()

    await page.getByRole('button', { name: 'Add loot table' }).click()
    await page.getByRole('textbox', { name: 'Table name' }).fill('Guard room')
    const first = page.getByRole('group', { name: 'Table 1 range 1' })
    await first.getByRole('button', { name: 'Add item' }).click()
    await first.getByRole('button', { name: 'Add coins' }).click()
    await expect(first.getByRole('combobox', { name: 'Item' })).toHaveValue('Silvered Dagger')
    await expect(first.getByRole('combobox', { name: 'Coin' })).toHaveValue('Gold Piece')
    await page.getByRole('button', { name: 'Save loot' }).click()
    await expect(page.getByRole('button', { name: 'Save loot' })).toBeDisabled()

    await page.reload()
    await expect(page.locator('#storybook-root')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('textbox', { name: 'Table name' })).toHaveValue('Guard room')
    const reopened = page.getByRole('group', { name: 'Table 1 range 1' })
    await expect(reopened.getByRole('combobox', { name: 'Item' })).toHaveValue('Silvered Dagger')
    await expect(reopened.getByRole('combobox', { name: 'Coin' })).toHaveValue('Gold Piece')

    await page.getByRole('button', { name: 'Add range' }).click()
    const second = page.getByRole('textbox', { name: 'Table 1 range 2 roll from' })
    await second.fill('1')
    await expect(page.getByRole('alert')).toContainText(LOOT_RANGE_REFUSAL.OVERLAP)
    await expect(page.getByRole('button', { name: 'Save loot' })).toBeDisabled()
  })
})

async function openStory(page: Page, storyId: string) {
  await page.goto('/iframe.html?id=' + storyId + '&viewMode=story')
  await expect(page.locator('#storybook-root')).toBeVisible({ timeout: 30_000 })
}
